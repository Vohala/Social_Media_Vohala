const express = require('express');
const router = express.Router();
const { db } = require('../database');
const auth = require('../middleware/auth');

// GET /api/notifications
router.get('/', auth, (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  const notifications = db.prepare(`
    SELECT n.*, u.name as actor_name, u.username as actor_username, u.avatar as actor_avatar
    FROM notifications n JOIN users u ON n.actor_id = u.id
    WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT ? OFFSET ?
  `).all(req.user.id, Number(limit), Number(offset));

  const unread = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id);
  res.json({ notifications, unreadCount: unread.count });
});

// PUT /api/notifications/read-all
router.put('/read-all', auth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ success: true });
});

// PUT /api/notifications/:id/read
router.put('/:id/read', auth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// DELETE /api/notifications/:id
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

module.exports = router;
