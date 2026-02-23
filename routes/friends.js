const express = require('express');
const router = express.Router();
const { db } = require('../database');
const auth = require('../middleware/auth');

// GET /api/friends/requests - incoming requests
router.get('/requests', auth, (req, res) => {
  const requests = db.prepare(`
    SELECT fr.id, fr.created_at, u.id as user_id, u.name, u.username, u.avatar, u.is_verified,
    (SELECT COUNT(*) FROM friendships f1 JOIN friendships f2 ON f1.friend_id = f2.friend_id
     WHERE f1.user_id = ? AND f2.user_id = u.id) as mutual_friends
    FROM friend_requests fr JOIN users u ON fr.sender_id = u.id
    WHERE fr.receiver_id = ? AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
  `).all(req.user.id, req.user.id);
  res.json(requests);
});

// GET /api/friends/sent - sent requests
router.get('/sent', auth, (req, res) => {
  const requests = db.prepare(`
    SELECT fr.id, fr.created_at, u.id as user_id, u.name, u.username, u.avatar FROM friend_requests fr
    JOIN users u ON fr.receiver_id = u.id WHERE fr.sender_id = ? AND fr.status = 'pending'
  `).all(req.user.id);
  res.json(requests);
});

// POST /api/friends/request/:userId - send request
router.post('/request/:userId', auth, (req, res) => {
  const targetId = Number(req.params.userId);
  const uid = req.user.id;
  if (targetId === uid) return res.status(400).json({ error: 'Cannot send request to yourself' });

  const alreadyFriends = db.prepare('SELECT id FROM friendships WHERE user_id = ? AND friend_id = ?').get(uid, targetId);
  if (alreadyFriends) return res.status(409).json({ error: 'Already friends' });

  const existing = db.prepare('SELECT * FROM friend_requests WHERE sender_id = ? AND receiver_id = ?').get(uid, targetId);
  if (existing) return res.status(409).json({ error: 'Request already sent' });

  // If they already sent us a request, auto-accept
  const theirRequest = db.prepare('SELECT * FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = ?').get(targetId, uid, 'pending');
  if (theirRequest) {
    db.prepare("UPDATE friend_requests SET status = 'accepted' WHERE id = ?").run(theirRequest.id);
    db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)').run(uid, targetId);
    db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)').run(targetId, uid);
    const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(uid);
    db.prepare('INSERT INTO notifications (user_id, actor_id, type, entity_id, entity_type, message) VALUES (?, ?, ?, ?, ?, ?)').run(
      targetId, uid, 'friend_accept', uid, 'user', `${actor.name} accepted your friend request`
    );
    if (global.emitNotification) {
      const notif = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(targetId);
      global.emitNotification(targetId, notif);
    }
    return res.json({ status: 'accepted' });
  }

  db.prepare('INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES (?, ?, ?)').run(uid, targetId, 'pending');

  const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(uid);
  const notifResult = db.prepare('INSERT INTO notifications (user_id, actor_id, type, entity_id, entity_type, message) VALUES (?, ?, ?, ?, ?, ?)').run(
    targetId, uid, 'friend_request', uid, 'user', `${actor.name} sent you a friend request`
  );
  if (global.emitNotification) {
    const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(notifResult.lastInsertRowid);
    global.emitNotification(targetId, notif);
  }

  res.json({ status: 'sent' });
});

// PUT /api/friends/accept/:userId - accept request
router.put('/accept/:userId', auth, (req, res) => {
  const senderId = Number(req.params.userId);
  const uid = req.user.id;

  const request = db.prepare("SELECT * FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'").get(senderId, uid);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  db.prepare("UPDATE friend_requests SET status = 'accepted' WHERE id = ?").run(request.id);
  db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)').run(uid, senderId);
  db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)').run(senderId, uid);

  const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(uid);
  db.prepare('INSERT INTO notifications (user_id, actor_id, type, entity_id, entity_type, message) VALUES (?, ?, ?, ?, ?, ?)').run(
    senderId, uid, 'friend_accept', uid, 'user', `${actor.name} accepted your friend request`
  );
  if (global.emitNotification) {
    const notif = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(senderId);
    global.emitNotification(senderId, notif);
    global.emitToUser(senderId, 'friend_accepted', { userId: uid });
  }

  res.json({ success: true });
});

// DELETE /api/friends/reject/:userId - reject request
router.delete('/reject/:userId', auth, (req, res) => {
  const senderId = Number(req.params.userId);
  const uid = req.user.id;
  db.prepare("DELETE FROM friend_requests WHERE sender_id = ? AND receiver_id = ?").run(senderId, uid);
  res.json({ success: true });
});

// DELETE /api/friends/cancel/:userId - cancel sent request
router.delete('/cancel/:userId', auth, (req, res) => {
  const targetId = Number(req.params.userId);
  db.prepare("DELETE FROM friend_requests WHERE sender_id = ? AND receiver_id = ?").run(req.user.id, targetId);
  res.json({ success: true });
});

// DELETE /api/friends/:userId - unfriend
router.delete('/:userId', auth, (req, res) => {
  const targetId = Number(req.params.userId);
  const uid = req.user.id;
  db.prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(uid, targetId, targetId, uid);
  db.prepare("DELETE FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)").run(uid, targetId, targetId, uid);
  res.json({ success: true });
});

// GET /api/friends/suggestions - PYMK
router.get('/suggestions', auth, (req, res) => {
  const uid = req.user.id;
  const suggestions = db.prepare(`
    SELECT u.id, u.name, u.username, u.avatar, u.is_verified,
    (SELECT COUNT(*) FROM friendships f1 JOIN friendships f2 ON f1.friend_id = f2.friend_id
     WHERE f1.user_id = ? AND f2.user_id = u.id) as mutual_friends
    FROM users u
    WHERE u.id != ?
    AND u.id NOT IN (SELECT friend_id FROM friendships WHERE user_id = ?)
    AND u.id NOT IN (SELECT receiver_id FROM friend_requests WHERE sender_id = ? AND status = 'pending')
    AND u.id NOT IN (SELECT sender_id FROM friend_requests WHERE receiver_id = ? AND status = 'pending')
    AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
    ORDER BY mutual_friends DESC, RANDOM() LIMIT 10
  `).all(uid, uid, uid, uid, uid, uid);
  res.json(suggestions);
});

// GET /api/friends/list - all friends
router.get('/list', auth, (req, res) => {
  const friends = db.prepare(`
    SELECT u.id, u.name, u.username, u.avatar, u.is_verified, u.is_online, u.last_seen FROM friendships f
    JOIN users u ON f.friend_id = u.id WHERE f.user_id = ? ORDER BY u.name
  `).all(req.user.id);
  res.json(friends);
});

module.exports = router;
