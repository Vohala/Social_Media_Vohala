const express = require('express');
const router = express.Router();
const { db } = require('../database');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET /api/stories - friends' stories grouped by user
router.get('/', auth, (req, res) => {
  const uid = req.user.id;
  const stories = db.prepare(`
    SELECT s.*, u.id as user_id, u.name, u.username, u.avatar,
    (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id) as view_count,
    (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id AND sv.user_id = ?) as viewed_by_me
    FROM stories s JOIN users u ON s.user_id = u.id
    WHERE (s.user_id = ? OR s.user_id IN (SELECT friend_id FROM friendships WHERE user_id = ?))
    AND datetime(s.expires_at) > datetime('now')
    ORDER BY s.user_id = ? DESC, s.created_at ASC
  `).all(uid, uid, uid, uid);

  // Group by user
  const grouped = {};
  for (const story of stories) {
    if (!grouped[story.user_id]) {
      grouped[story.user_id] = {
        user_id: story.user_id,
        name: story.name,
        username: story.username,
        avatar: story.avatar,
        stories: [],
        allViewed: true
      };
    }
    grouped[story.user_id].stories.push(story);
    if (!story.viewed_by_me) grouped[story.user_id].allViewed = false;
  }

  res.json(Object.values(grouped));
});

// POST /api/stories - create story
router.post('/', auth, upload.single('media'), (req, res) => {
  const { story_type, content, bg_color, caption } = req.body;
  const uid = req.user.id;
  let mediaUrl = null;

  if (req.file) {
    mediaUrl = '/uploads/' + req.file.filename;
  }

  if (story_type !== 'text' && !mediaUrl) {
    return res.status(400).json({ error: 'Media required for image/video stories' });
  }

  const result = db.prepare(`
    INSERT INTO stories (user_id, story_type, media_url, content, bg_color, caption, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+24 hours'))
  `).run(uid, story_type || 'text', mediaUrl, content || '', bg_color || '#667eea', caption || '');

  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(result.lastInsertRowid);
  res.json(story);
});

// POST /api/stories/:id/view - mark as viewed
router.post('/:id/view', auth, (req, res) => {
  const storyId = Number(req.params.id);
  const uid = req.user.id;
  db.prepare('INSERT OR IGNORE INTO story_views (story_id, user_id) VALUES (?, ?)').run(storyId, uid);
  const viewCount = db.prepare('SELECT COUNT(*) as count FROM story_views WHERE story_id = ?').get(storyId);
  res.json({ viewCount: viewCount.count });
});

// GET /api/stories/:id/viewers
router.get('/:id/viewers', auth, (req, res) => {
  const viewers = db.prepare(`
    SELECT sv.viewed_at, u.id, u.name, u.username, u.avatar FROM story_views sv
    JOIN users u ON sv.user_id = u.id WHERE sv.story_id = ?
    ORDER BY sv.viewed_at DESC
  `).all(req.params.id);
  res.json(viewers);
});

// POST /api/stories/:id/react
router.post('/:id/react', auth, (req, res) => {
  const { reaction_type } = req.body;
  const storyId = Number(req.params.id);
  const uid = req.user.id;
  const existing = db.prepare('SELECT id FROM story_reactions WHERE story_id = ? AND user_id = ?').get(storyId, uid);
  if (existing) {
    db.prepare('UPDATE story_reactions SET reaction_type = ? WHERE story_id = ? AND user_id = ?').run(reaction_type, storyId, uid);
  } else {
    db.prepare('INSERT INTO story_reactions (story_id, user_id, reaction_type) VALUES (?, ?, ?)').run(storyId, uid, reaction_type);
  }
  res.json({ success: true });
});

// DELETE /api/stories/:id
router.delete('/:id', auth, (req, res) => {
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.id);
  if (!story) return res.status(404).json({ error: 'Story not found' });
  if (story.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM stories WHERE id = ?').run(story.id);
  res.json({ success: true });
});

module.exports = router;
