const express = require('express');
const router = express.Router();
const { db } = require('../database');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET /api/messages - conversation list
router.get('/', auth, (req, res) => {
  const uid = req.user.id;
  const conversations = db.prepare(`
    SELECT u.id, u.name, u.username, u.avatar, u.is_online, u.last_seen,
    m.content as last_message, m.created_at as last_message_time, m.sender_id as last_sender_id,
    m.media_type as last_media_type,
    (SELECT COUNT(*) FROM messages WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0 AND deleted_for_receiver = 0) as unread_count
    FROM messages m
    JOIN users u ON (CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END) = u.id
    WHERE (m.sender_id = ? AND m.deleted_for_sender = 0) OR (m.receiver_id = ? AND m.deleted_for_receiver = 0)
    AND m.deleted_for_everyone = 0
    GROUP BY u.id
    HAVING m.created_at = MAX(m.created_at)
    ORDER BY m.created_at DESC
  `).all(uid, uid, uid, uid);

  res.json(conversations);
});

// GET /api/messages/:userId - messages with a user
router.get('/:userId', auth, (req, res) => {
  const uid = req.user.id;
  const otherId = Number(req.params.userId);
  const { before, limit = 30 } = req.query;

  let query = `
    SELECT m.*, u.name as sender_name, u.avatar as sender_avatar FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE ((m.sender_id = ? AND m.receiver_id = ? AND m.deleted_for_sender = 0)
       OR (m.sender_id = ? AND m.receiver_id = ? AND m.deleted_for_receiver = 0))
    AND m.deleted_for_everyone = 0
  `;
  const params = [uid, otherId, otherId, uid];

  if (before) {
    query += ' AND m.id < ? ';
    params.push(Number(before));
  }
  query += ' ORDER BY m.created_at DESC LIMIT ?';
  params.push(Number(limit));

  const messages = db.prepare(query).all(...params).reverse();

  // Mark as read
  db.prepare('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?').run(otherId, uid);

  res.json(messages);
});

// POST /api/messages/:userId - send message
router.post('/:userId', auth, upload.single('media'), (req, res) => {
  const uid = req.user.id;
  const receiverId = Number(req.params.userId);
  const { content } = req.body;

  let mediaUrl = null, mediaType = null;
  if (req.file) {
    mediaUrl = '/uploads/' + req.file.filename;
    mediaType = req.file.mimetype.startsWith('video') ? 'video' : 'image';
  }

  if (!content && !mediaUrl) return res.status(400).json({ error: 'Message content or media required' });

  const result = db.prepare('INSERT INTO messages (sender_id, receiver_id, content, media_url, media_type) VALUES (?, ?, ?, ?, ?)').run(uid, receiverId, content || '', mediaUrl, mediaType);
  const message = db.prepare(`
    SELECT m.*, u.name as sender_name, u.avatar as sender_avatar FROM messages m
    JOIN users u ON m.sender_id = u.id WHERE m.id = ?
  `).get(result.lastInsertRowid);

  // Emit via socket
  if (global.emitToUser) {
    global.emitToUser(receiverId, 'new_message', message);
  }

  // Notification
  const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(uid);
  db.prepare('INSERT INTO notifications (user_id, actor_id, type, entity_id, entity_type, message) VALUES (?, ?, ?, ?, ?, ?)').run(
    receiverId, uid, 'message', uid, 'user', `${actor.name} sent you a message`
  );

  res.json(message);
});

// DELETE /api/messages/:messageId
router.delete('/:messageId', auth, (req, res) => {
  const { deleteFor } = req.query; // 'me' or 'everyone'
  const uid = req.user.id;
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.messageId);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  if (msg.sender_id !== uid && msg.receiver_id !== uid) return res.status(403).json({ error: 'Forbidden' });

  if (deleteFor === 'everyone' && msg.sender_id === uid) {
    db.prepare('UPDATE messages SET deleted_for_everyone = 1, content = "" WHERE id = ?').run(msg.id);
  } else if (msg.sender_id === uid) {
    db.prepare('UPDATE messages SET deleted_for_sender = 1 WHERE id = ?').run(msg.id);
  } else {
    db.prepare('UPDATE messages SET deleted_for_receiver = 1 WHERE id = ?').run(msg.id);
  }

  res.json({ success: true });
});

module.exports = router;
