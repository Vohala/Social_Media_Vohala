const express = require('express');
const router = express.Router();
const { db } = require('../database');
const auth = require('../middleware/auth');

// GET /api/search?q=&type=
router.get('/', auth, (req, res) => {
  const { q, type = 'all' } = req.query;
  if (!q || q.trim().length < 1) return res.json({ people: [], posts: [], groups: [], events: [] });

  const uid = req.user.id;
  const term = `%${q.trim()}%`;
  const results = {};

  if (type === 'all' || type === 'people') {
    results.people = db.prepare(`
      SELECT u.id, u.name, u.username, u.avatar, u.bio, u.location, u.is_verified, u.is_online,
      (SELECT COUNT(*) FROM friendships WHERE user_id = ? AND friend_id = u.id) as is_friend,
      (SELECT COUNT(*) FROM friendships f1 JOIN friendships f2 ON f1.friend_id = f2.friend_id WHERE f1.user_id = ? AND f2.user_id = u.id) as mutual_friends
      FROM users u
      WHERE (u.name LIKE ? OR u.username LIKE ?)
      AND u.id != ?
      AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
      ORDER BY is_friend DESC, mutual_friends DESC, u.name LIMIT 20
    `).all(uid, uid, term, term, uid, uid);
  }

  if (type === 'all' || type === 'posts') {
    results.posts = db.prepare(`
      SELECT p.*, u.name, u.username, u.avatar FROM posts p JOIN users u ON p.user_id = u.id
      WHERE p.content LIKE ? AND p.privacy IN ('public','friends')
      ORDER BY p.created_at DESC LIMIT 20
    `).all(term);
  }

  if (type === 'all' || type === 'groups') {
    results.groups = db.prepare(`
      SELECT g.*, u.name as creator_name FROM groups g JOIN users u ON g.creator_id = u.id
      WHERE (g.name LIKE ? OR g.description LIKE ?) AND g.privacy = 'public'
      LIMIT 10
    `).all(term, term);
  }

  if (type === 'all' || type === 'events') {
    results.events = db.prepare(`
      SELECT e.*, u.name as creator_name FROM events e JOIN users u ON e.creator_id = u.id
      WHERE (e.title LIKE ? OR e.description LIKE ?) AND e.privacy = 'public'
      LIMIT 10
    `).all(term, term);
  }

  if (type === 'all' || type === 'hashtags') {
    results.hashtags = db.prepare(`
      SELECT tag, post_count FROM hashtags WHERE tag LIKE ? ORDER BY post_count DESC LIMIT 10
    `).all(term);
  }

  res.json(results);
});

module.exports = router;
