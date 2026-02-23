const express = require('express');
const router = express.Router();
const { db } = require('../database');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET /api/groups - list public groups + my groups
router.get('/', auth, (req, res) => {
  const uid = req.user.id;
  const groups = db.prepare(`
    SELECT g.*, u.name as creator_name, u.avatar as creator_avatar,
    (SELECT role FROM group_members WHERE group_id = g.id AND user_id = ?) as my_role
    FROM groups g JOIN users u ON g.creator_id = u.id
    WHERE g.privacy = 'public' OR g.id IN (SELECT group_id FROM group_members WHERE user_id = ?)
    ORDER BY g.created_at DESC
  `).all(uid, uid);
  res.json(groups);
});

// POST /api/groups - create group
router.post('/', auth, upload.single('cover'), (req, res) => {
  const { name, description, privacy } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const uid = req.user.id;
  let coverUrl = null;
  if (req.file) coverUrl = '/uploads/' + req.file.filename;

  const result = db.prepare('INSERT INTO groups (name, description, privacy, creator_id, cover_photo) VALUES (?, ?, ?, ?, ?)').run(name, description || '', privacy || 'public', uid, coverUrl);
  const groupId = result.lastInsertRowid;
  db.prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)').run(groupId, uid, 'admin');

  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
  res.json(group);
});

// GET /api/groups/:id
router.get('/:id', auth, (req, res) => {
  const uid = req.user.id;
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const members = db.prepare(`
    SELECT u.id, u.name, u.username, u.avatar, u.is_verified, gm.role, gm.joined_at FROM group_members gm
    JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ? ORDER BY gm.role = 'admin' DESC, gm.joined_at
  `).all(group.id);

  const myRole = db.prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?').get(group.id, uid);

  res.json({ ...group, members, myRole: myRole ? myRole.role : null });
});

// POST /api/groups/:id/join
router.post('/:id/join', auth, (req, res) => {
  const groupId = Number(req.params.id);
  const uid = req.user.id;
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const existing = db.prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, uid);
  if (existing) return res.status(409).json({ error: 'Already a member' });
  db.prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)').run(groupId, uid, 'member');
  db.prepare('UPDATE groups SET member_count = member_count + 1 WHERE id = ?').run(groupId);
  res.json({ success: true });
});

// DELETE /api/groups/:id/leave
router.delete('/:id/leave', auth, (req, res) => {
  const groupId = Number(req.params.id);
  const uid = req.user.id;
  const member = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, uid);
  if (!member) return res.status(404).json({ error: 'Not a member' });
  if (member.role === 'admin') {
    const otherAdmin = db.prepare("SELECT id FROM group_members WHERE group_id = ? AND user_id != ? AND role = 'admin'").get(groupId, uid);
    if (!otherAdmin) {
      const nextMember = db.prepare("SELECT id, user_id FROM group_members WHERE group_id = ? AND user_id != ?").get(groupId, uid);
      if (nextMember) {
        db.prepare("UPDATE group_members SET role = 'admin' WHERE id = ?").run(nextMember.id);
      } else {
        db.prepare('DELETE FROM groups WHERE id = ?').run(groupId);
        return res.json({ success: true, groupDeleted: true });
      }
    }
  }
  db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, uid);
  db.prepare('UPDATE groups SET member_count = MAX(0, member_count - 1) WHERE id = ?').run(groupId);
  res.json({ success: true });
});

// GET /api/groups/:id/posts
router.get('/:id/posts', auth, (req, res) => {
  const uid = req.user.id;
  const groupId = Number(req.params.id);
  const posts = db.prepare(`
    SELECT p.* FROM posts p JOIN group_posts gp ON gp.post_id = p.id
    WHERE gp.group_id = ? ORDER BY p.created_at DESC LIMIT 20
  `).all(groupId);

  res.json(posts.map(p => {
    const author = db.prepare('SELECT id, name, username, avatar, is_verified FROM users WHERE id = ?').get(p.user_id);
    const media = db.prepare('SELECT * FROM post_media WHERE post_id = ?').all(p.id);
    const reactions = db.prepare('SELECT reaction_type, COUNT(*) as count FROM post_reactions WHERE post_id = ? GROUP BY reaction_type').all(p.id);
    const totalReactions = reactions.reduce((s, r) => s + r.count, 0);
    const userReaction = db.prepare('SELECT reaction_type FROM post_reactions WHERE post_id = ? AND user_id = ?').get(p.id, uid);
    const commentCount = db.prepare('SELECT COUNT(*) as count FROM comments WHERE post_id = ?').get(p.id);
    return { ...p, author, media, reactions, totalReactions, userReaction: userReaction?.reaction_type || null, commentCount: commentCount.count };
  }));
});

// POST /api/groups/:id/posts - post in group
router.post('/:id/posts', auth, upload.array('media', 5), (req, res) => {
  const groupId = Number(req.params.id);
  const uid = req.user.id;
  const { content } = req.body;

  const member = db.prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, uid);
  if (!member) return res.status(403).json({ error: 'Not a member' });

  const result = db.prepare('INSERT INTO posts (user_id, content, privacy) VALUES (?, ?, ?)').run(uid, content || '', 'friends');
  const postId = result.lastInsertRowid;

  if (req.files && req.files.length > 0) {
    const insertMedia = db.prepare('INSERT INTO post_media (post_id, url, media_type, sort_order) VALUES (?, ?, ?, ?)');
    req.files.forEach((file, idx) => {
      insertMedia.run(postId, '/uploads/' + file.filename, file.mimetype.startsWith('video') ? 'video' : 'image', idx);
    });
  }

  db.prepare('INSERT INTO group_posts (group_id, post_id) VALUES (?, ?)').run(groupId, postId);
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  const author = db.prepare('SELECT id, name, username, avatar, is_verified FROM users WHERE id = ?').get(uid);
  res.json({ ...post, author, media: [], reactions: [], totalReactions: 0, commentCount: 0 });
});

module.exports = router;
