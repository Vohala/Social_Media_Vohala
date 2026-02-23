const express = require('express');
const router = express.Router();
const { db } = require('../database');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

function safeUser(user) {
  const { password, ...safe } = user;
  return safe;
}

function enrichUser(user, viewerId) {
  const friendCount = db.prepare('SELECT COUNT(*) as c FROM friendships WHERE user_id = ?').get(user.id);
  const followerCount = db.prepare('SELECT COUNT(*) as c FROM follows WHERE following_id = ?').get(user.id);
  const followingCount = db.prepare('SELECT COUNT(*) as c FROM follows WHERE follower_id = ?').get(user.id);

  let relationshipStatus = 'none';
  if (viewerId && viewerId !== user.id) {
    const friendship = db.prepare('SELECT id FROM friendships WHERE user_id = ? AND friend_id = ?').get(viewerId, user.id);
    if (friendship) {
      relationshipStatus = 'friends';
    } else {
      const sentReq = db.prepare('SELECT id FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = ?').get(viewerId, user.id, 'pending');
      const receivedReq = db.prepare('SELECT id FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = ?').get(user.id, viewerId, 'pending');
      if (sentReq) relationshipStatus = 'request_sent';
      else if (receivedReq) relationshipStatus = 'request_received';
    }
  }

  const isFollowing = viewerId ? !!db.prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?').get(viewerId, user.id) : false;
  const isBlocked = viewerId ? !!db.prepare('SELECT id FROM blocks WHERE blocker_id = ? AND blocked_id = ?').get(viewerId, user.id) : false;

  let mutualFriends = 0;
  if (viewerId && viewerId !== user.id) {
    const result = db.prepare(`
      SELECT COUNT(*) as c FROM friendships f1
      JOIN friendships f2 ON f1.friend_id = f2.friend_id
      WHERE f1.user_id = ? AND f2.user_id = ?
    `).get(viewerId, user.id);
    mutualFriends = result ? result.c : 0;
  }

  return {
    ...safeUser(user),
    friendCount: friendCount.c,
    followerCount: followerCount.c,
    followingCount: followingCount.c,
    relationshipStatus,
    isFollowing,
    isBlocked,
    mutualFriends
  };
}

// GET /api/users/:id
router.get('/:id', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(enrichUser(user, req.user.id));
});

// PUT /api/users/:id - update profile
router.put('/:id', auth, (req, res) => {
  if (Number(req.params.id) !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  const { name, username, bio, location, website, work, education, relationship_status, birthday, privacy_profile, privacy_posts, privacy_messages } = req.body;

  if (username) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.user.id);
    if (existing) return res.status(409).json({ error: 'Username already taken' });
  }

  db.prepare(`
    UPDATE users SET name=COALESCE(?,name), username=COALESCE(?,username), bio=COALESCE(?,bio),
    location=COALESCE(?,location), website=COALESCE(?,website), work=COALESCE(?,work),
    education=COALESCE(?,education), relationship_status=COALESCE(?,relationship_status),
    birthday=COALESCE(?,birthday), privacy_profile=COALESCE(?,privacy_profile),
    privacy_posts=COALESCE(?,privacy_posts), privacy_messages=COALESCE(?,privacy_messages)
    WHERE id=?
  `).run(name, username, bio, location, website, work, education, relationship_status, birthday, privacy_profile, privacy_posts, privacy_messages, req.user.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json(enrichUser(user, req.user.id));
});

// POST /api/users/:id/avatar
router.post('/:id/avatar', auth, upload.single('avatar'), (req, res) => {
  if (Number(req.params.id) !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = '/uploads/' + req.file.filename;
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(url, req.user.id);
  res.json({ avatar: url });
});

// POST /api/users/:id/cover
router.post('/:id/cover', auth, upload.single('cover'), (req, res) => {
  if (Number(req.params.id) !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = '/uploads/' + req.file.filename;
  db.prepare('UPDATE users SET cover_photo = ? WHERE id = ?').run(url, req.user.id);
  res.json({ cover_photo: url });
});

// GET /api/users/:id/posts
router.get('/:id/posts', auth, (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  const uid = req.user.id;
  const profileId = Number(req.params.id);

  const isFriend = db.prepare('SELECT id FROM friendships WHERE user_id = ? AND friend_id = ?').get(uid, profileId);
  const privacyFilter = uid === profileId ? "p.privacy IN ('public','friends','only_me')" : isFriend ? "p.privacy IN ('public','friends')" : "p.privacy = 'public'";

  const posts = db.prepare(`
    SELECT p.* FROM posts p WHERE p.user_id = ? AND p.original_post_id IS NULL AND ${privacyFilter}
    ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).all(profileId, Number(limit), Number(offset));

  res.json(posts.map(p => {
    const media = db.prepare('SELECT * FROM post_media WHERE post_id = ? ORDER BY sort_order').all(p.id);
    const reactions = db.prepare('SELECT reaction_type, COUNT(*) as count FROM post_reactions WHERE post_id = ? GROUP BY reaction_type').all(p.id);
    const totalReactions = reactions.reduce((s, r) => s + r.count, 0);
    const userReaction = db.prepare('SELECT reaction_type FROM post_reactions WHERE post_id = ? AND user_id = ?').get(p.id, uid);
    const commentCount = db.prepare('SELECT COUNT(*) as count FROM comments WHERE post_id = ? AND parent_id IS NULL').get(p.id);
    const author = db.prepare('SELECT id, name, username, avatar, is_verified, is_online FROM users WHERE id = ?').get(p.user_id);
    const saved = db.prepare('SELECT id FROM saved_posts WHERE post_id = ? AND user_id = ?').get(p.id, uid);
    return { ...p, author, media, reactions, totalReactions, userReaction: userReaction ? userReaction.reaction_type : null, commentCount: commentCount.count, saved: !!saved, tags: [] };
  }));
});

// GET /api/users/:id/photos
router.get('/:id/photos', auth, (req, res) => {
  const photos = db.prepare(`
    SELECT pm.url, pm.post_id, p.created_at FROM post_media pm
    JOIN posts p ON pm.post_id = p.id
    WHERE p.user_id = ? AND pm.media_type = 'image'
    ORDER BY p.created_at DESC LIMIT 50
  `).all(req.params.id);
  res.json(photos);
});

// GET /api/users/:id/friends
router.get('/:id/friends', auth, (req, res) => {
  const friends = db.prepare(`
    SELECT u.id, u.name, u.username, u.avatar, u.is_verified, u.is_online FROM friendships f
    JOIN users u ON f.friend_id = u.id WHERE f.user_id = ?
  `).all(req.params.id);
  res.json(friends);
});

// POST /api/users/:id/follow
router.post('/:id/follow', auth, (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });
  const existing = db.prepare('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?').get(req.user.id, targetId);
  if (existing) {
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.user.id, targetId);
    return res.json({ following: false });
  }
  db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(req.user.id, targetId);
  res.json({ following: true });
});

// POST /api/users/:id/block
router.post('/:id/block', auth, (req, res) => {
  const targetId = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM blocks WHERE blocker_id = ? AND blocked_id = ?').get(req.user.id, targetId);
  if (existing) {
    db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').run(req.user.id, targetId);
    return res.json({ blocked: false });
  }
  db.prepare('INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)').run(req.user.id, targetId);
  // Also remove friendship
  db.prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(req.user.id, targetId, targetId, req.user.id);
  res.json({ blocked: true });
});

// GET /api/users/blocked/list
router.get('/blocked/list', auth, (req, res) => {
  const blocked = db.prepare(`
    SELECT u.id, u.name, u.username, u.avatar FROM blocks b
    JOIN users u ON b.blocked_id = u.id WHERE b.blocker_id = ?
  `).all(req.user.id);
  res.json(blocked);
});

module.exports = router;
