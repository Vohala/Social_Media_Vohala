const express = require('express');
const router = express.Router();
const { db } = require('../database');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

function enrichPost(post, userId) {
  const media = db.prepare('SELECT * FROM post_media WHERE post_id = ? ORDER BY sort_order').all(post.id);
  const reactions = db.prepare('SELECT reaction_type, COUNT(*) as count FROM post_reactions WHERE post_id = ? GROUP BY reaction_type').all(post.id);
  const totalReactions = reactions.reduce((s, r) => s + r.count, 0);
  const userReaction = db.prepare('SELECT reaction_type FROM post_reactions WHERE post_id = ? AND user_id = ?').get(post.id, userId);
  const commentCount = db.prepare('SELECT COUNT(*) as count FROM comments WHERE post_id = ? AND parent_id IS NULL').get(post.id);
  const author = db.prepare('SELECT id, name, username, avatar, is_verified, is_online FROM users WHERE id = ?').get(post.user_id);
  const saved = db.prepare('SELECT id FROM saved_posts WHERE post_id = ? AND user_id = ?').get(post.id, userId);
  const tags = db.prepare(`
    SELECT u.id, u.name, u.username FROM post_tags pt
    JOIN users u ON pt.user_id = u.id WHERE pt.post_id = ?
  `).all(post.id);

  let sharedPost = null;
  if (post.original_post_id) {
    const orig = db.prepare('SELECT * FROM posts WHERE id = ?').get(post.original_post_id);
    if (orig) {
      const origAuthor = db.prepare('SELECT id, name, username, avatar, is_verified FROM users WHERE id = ?').get(orig.user_id);
      const origMedia = db.prepare('SELECT * FROM post_media WHERE post_id = ? ORDER BY sort_order').all(orig.id);
      sharedPost = { ...orig, author: origAuthor, media: origMedia };
    }
  }

  return {
    ...post,
    author,
    media,
    reactions,
    totalReactions,
    userReaction: userReaction ? userReaction.reaction_type : null,
    commentCount: commentCount.count,
    saved: !!saved,
    tags,
    sharedPost
  };
}

// GET /api/posts/feed
router.get('/feed', auth, (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  const uid = req.user.id;

  const posts = db.prepare(`
    SELECT DISTINCT p.* FROM posts p
    LEFT JOIN friendships f ON (f.friend_id = p.user_id AND f.user_id = ?)
    WHERE (p.user_id = ? OR (f.user_id = ? AND p.privacy IN ('public','friends')) OR p.privacy = 'public')
    AND p.user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
    ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).all(uid, uid, uid, uid, Number(limit), Number(offset));

  res.json(posts.map(p => enrichPost(p, uid)));
});

// POST /api/posts - create post
router.post('/', auth, upload.array('media', 10), (req, res) => {
  const { content, feeling, feeling_emoji, location, privacy, bg_color, tagged_users } = req.body;
  const uid = req.user.id;

  if (!content && (!req.files || !req.files.length)) {
    return res.status(400).json({ error: 'Post content or media required' });
  }

  const result = db.prepare(`
    INSERT INTO posts (user_id, content, feeling, feeling_emoji, location, privacy, bg_color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uid, content || '', feeling || null, feeling_emoji || null, location || null, privacy || 'friends', bg_color || null);

  const postId = result.lastInsertRowid;

  if (req.files && req.files.length > 0) {
    const insertMedia = db.prepare('INSERT INTO post_media (post_id, url, media_type, sort_order) VALUES (?, ?, ?, ?)');
    req.files.forEach((file, idx) => {
      const mediaType = file.mimetype.startsWith('video') ? 'video' : 'image';
      insertMedia.run(postId, '/uploads/' + file.filename, mediaType, idx);
    });
  }

  if (tagged_users) {
    const tags = JSON.parse(tagged_users);
    const insertTag = db.prepare('INSERT OR IGNORE INTO post_tags (post_id, user_id) VALUES (?, ?)');
    tags.forEach(tid => {
      insertTag.run(postId, tid);
      if (tid !== uid) {
        db.prepare('INSERT INTO notifications (user_id, actor_id, type, entity_id, entity_type, message) VALUES (?, ?, ?, ?, ?, ?)').run(
          tid, uid, 'tag', postId, 'post', `${req.user.name || ''} tagged you in a post`
        );
      }
    });
  }

  // Extract and save hashtags
  const hashtags = (content || '').match(/#[a-zA-Z0-9_]+/g) || [];
  for (const tag of hashtags) {
    const tagName = tag.slice(1).toLowerCase();
    db.prepare('INSERT OR IGNORE INTO hashtags (tag, post_count) VALUES (?, 0)').run(tagName);
    db.prepare('UPDATE hashtags SET post_count = post_count + 1 WHERE tag = ?').run(tagName);
    const ht = db.prepare('SELECT id FROM hashtags WHERE tag = ?').get(tagName);
    if (ht) db.prepare('INSERT OR IGNORE INTO post_hashtags (post_id, hashtag_id) VALUES (?, ?)').run(postId, ht.id);
  }

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  res.json(enrichPost(post, uid));
});

// GET /api/posts/:id
router.get('/:id', auth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(enrichPost(post, req.user.id));
});

// PUT /api/posts/:id - edit post
router.put('/:id', auth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  const { content, feeling, feeling_emoji, location, privacy, bg_color } = req.body;
  db.prepare(`
    UPDATE posts SET content=?, feeling=?, feeling_emoji=?, location=?, privacy=?, bg_color=?, updated_at=datetime('now') WHERE id=?
  `).run(content || '', feeling || null, feeling_emoji || null, location || null, privacy || 'friends', bg_color || null, post.id);

  const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(post.id);
  res.json(enrichPost(updated, req.user.id));
});

// DELETE /api/posts/:id
router.delete('/:id', auth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
  res.json({ success: true });
});

// POST /api/posts/:id/react
router.post('/:id/react', auth, (req, res) => {
  const { reaction_type } = req.body;
  const postId = Number(req.params.id);
  const uid = req.user.id;
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const existing = db.prepare('SELECT * FROM post_reactions WHERE post_id = ? AND user_id = ?').get(postId, uid);

  if (existing) {
    if (existing.reaction_type === reaction_type) {
      db.prepare('DELETE FROM post_reactions WHERE post_id = ? AND user_id = ?').run(postId, uid);
    } else {
      db.prepare('UPDATE post_reactions SET reaction_type = ? WHERE post_id = ? AND user_id = ?').run(reaction_type, postId, uid);
    }
  } else {
    db.prepare('INSERT INTO post_reactions (post_id, user_id, reaction_type) VALUES (?, ?, ?)').run(postId, uid, reaction_type);
    if (post.user_id !== uid) {
      const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(uid);
      db.prepare('INSERT INTO notifications (user_id, actor_id, type, entity_id, entity_type, message) VALUES (?, ?, ?, ?, ?, ?)').run(
        post.user_id, uid, 'reaction', postId, 'post', `${actor.name} reacted to your post`
      );
      if (global.emitNotification) {
        const notif = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(post.user_id);
        global.emitNotification(post.user_id, notif);
      }
    }
  }

  const reactions = db.prepare('SELECT reaction_type, COUNT(*) as count FROM post_reactions WHERE post_id = ? GROUP BY reaction_type').all(postId);
  const userReaction = db.prepare('SELECT reaction_type FROM post_reactions WHERE post_id = ? AND user_id = ?').get(postId, uid);

  if (req.io) {
    req.io.emit('post_reaction_update', { postId, reactions, userId: uid, userReaction: userReaction ? userReaction.reaction_type : null });
  }

  res.json({ reactions, userReaction: userReaction ? userReaction.reaction_type : null });
});

// GET /api/posts/:id/reactions
router.get('/:id/reactions', auth, (req, res) => {
  const reactions = db.prepare(`
    SELECT pr.reaction_type, u.id, u.name, u.username, u.avatar FROM post_reactions pr
    JOIN users u ON pr.user_id = u.id WHERE pr.post_id = ?
  `).all(req.params.id);
  res.json(reactions);
});

// GET /api/posts/:id/comments
router.get('/:id/comments', auth, (req, res) => {
  const comments = db.prepare(`
    SELECT c.*, u.name, u.username, u.avatar, u.is_verified,
    (SELECT COUNT(*) FROM comments r WHERE r.parent_id = c.id) as reply_count,
    (SELECT COUNT(*) FROM comment_reactions cr WHERE cr.comment_id = c.id) as reaction_count,
    (SELECT reaction_type FROM comment_reactions WHERE comment_id = c.id AND user_id = ?) as user_reaction
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ? AND c.parent_id IS NULL ORDER BY c.created_at ASC
  `).all(req.user.id, req.params.id);
  res.json(comments);
});

// POST /api/posts/:id/comments
router.post('/:id/comments', auth, (req, res) => {
  const { content, parent_id } = req.body;
  const postId = Number(req.params.id);
  const uid = req.user.id;
  if (!content) return res.status(400).json({ error: 'Content required' });

  const result = db.prepare('INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)').run(postId, uid, content, parent_id || null);
  const comment = db.prepare(`
    SELECT c.*, u.name, u.username, u.avatar, u.is_verified FROM comments c
    JOIN users u ON c.user_id = u.id WHERE c.id = ?
  `).get(result.lastInsertRowid);

  const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(postId);
  if (post && post.user_id !== uid) {
    const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(uid);
    db.prepare('INSERT INTO notifications (user_id, actor_id, type, entity_id, entity_type, message) VALUES (?, ?, ?, ?, ?, ?)').run(
      post.user_id, uid, 'comment', postId, 'post', `${actor.name} commented on your post`
    );
    if (global.emitNotification) {
      const notif = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(post.user_id);
      global.emitNotification(post.user_id, notif);
    }
  }

  if (req.io) req.io.emit('new_comment', { postId, comment });

  res.json({ ...comment, reply_count: 0, reaction_count: 0, user_reaction: null });
});

// GET /api/posts/comments/:commentId/replies
router.get('/comments/:commentId/replies', auth, (req, res) => {
  const replies = db.prepare(`
    SELECT c.*, u.name, u.username, u.avatar, u.is_verified,
    (SELECT COUNT(*) FROM comment_reactions cr WHERE cr.comment_id = c.id) as reaction_count,
    (SELECT reaction_type FROM comment_reactions WHERE comment_id = c.id AND user_id = ?) as user_reaction
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.parent_id = ? ORDER BY c.created_at ASC
  `).all(req.user.id, req.params.commentId);
  res.json(replies);
});

// PUT /api/posts/comments/:id
router.put('/comments/:id', auth, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  db.prepare("UPDATE comments SET content = ?, updated_at = datetime('now') WHERE id = ?").run(req.body.content, comment.id);
  res.json({ success: true });
});

// DELETE /api/posts/comments/:id
router.delete('/comments/:id', auth, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM comments WHERE id = ?').run(comment.id);
  res.json({ success: true });
});

// POST /api/posts/comments/:id/react
router.post('/comments/:id/react', auth, (req, res) => {
  const { reaction_type } = req.body;
  const cid = Number(req.params.id);
  const uid = req.user.id;
  const existing = db.prepare('SELECT * FROM comment_reactions WHERE comment_id = ? AND user_id = ?').get(cid, uid);
  if (existing) {
    if (existing.reaction_type === reaction_type) {
      db.prepare('DELETE FROM comment_reactions WHERE comment_id = ? AND user_id = ?').run(cid, uid);
    } else {
      db.prepare('UPDATE comment_reactions SET reaction_type = ? WHERE comment_id = ? AND user_id = ?').run(reaction_type, cid, uid);
    }
  } else {
    db.prepare('INSERT INTO comment_reactions (comment_id, user_id, reaction_type) VALUES (?, ?, ?)').run(cid, uid, reaction_type);
  }
  const count = db.prepare('SELECT COUNT(*) as c FROM comment_reactions WHERE comment_id = ?').get(cid);
  const userReaction = db.prepare('SELECT reaction_type FROM comment_reactions WHERE comment_id = ? AND user_id = ?').get(cid, uid);
  res.json({ count: count.c, userReaction: userReaction ? userReaction.reaction_type : null });
});

// POST /api/posts/:id/share
router.post('/:id/share', auth, (req, res) => {
  const { content, privacy } = req.body;
  const originalId = Number(req.params.id);
  const uid = req.user.id;

  const original = db.prepare('SELECT * FROM posts WHERE id = ?').get(originalId);
  if (!original) return res.status(404).json({ error: 'Post not found' });

  const result = db.prepare(`
    INSERT INTO posts (user_id, content, privacy, original_post_id) VALUES (?, ?, ?, ?)
  `).run(uid, content || '', privacy || 'friends', originalId);

  db.prepare('UPDATE posts SET share_count = share_count + 1 WHERE id = ?').run(originalId);

  if (original.user_id !== uid) {
    const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(uid);
    db.prepare('INSERT INTO notifications (user_id, actor_id, type, entity_id, entity_type, message) VALUES (?, ?, ?, ?, ?, ?)').run(
      original.user_id, uid, 'share', originalId, 'post', `${actor.name} shared your post`
    );
  }

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);
  res.json(enrichPost(post, uid));
});

// POST /api/posts/:id/save
router.post('/:id/save', auth, (req, res) => {
  const postId = Number(req.params.id);
  const uid = req.user.id;
  const existing = db.prepare('SELECT id FROM saved_posts WHERE post_id = ? AND user_id = ?').get(postId, uid);
  if (existing) {
    db.prepare('DELETE FROM saved_posts WHERE post_id = ? AND user_id = ?').run(postId, uid);
    return res.json({ saved: false });
  }
  db.prepare('INSERT INTO saved_posts (post_id, user_id) VALUES (?, ?)').run(postId, uid);
  res.json({ saved: true });
});

// GET /api/posts/saved
router.get('/saved/list', auth, (req, res) => {
  const uid = req.user.id;
  const posts = db.prepare(`
    SELECT p.* FROM posts p JOIN saved_posts sp ON sp.post_id = p.id
    WHERE sp.user_id = ? ORDER BY sp.saved_at DESC
  `).all(uid);
  res.json(posts.map(p => enrichPost(p, uid)));
});

module.exports = router;
