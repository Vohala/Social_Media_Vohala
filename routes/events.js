const express = require('express');
const router = express.Router();
const { db } = require('../database');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET /api/events
router.get('/', auth, (req, res) => {
  const uid = req.user.id;
  const events = db.prepare(`
    SELECT e.*, u.name as creator_name, u.avatar as creator_avatar,
    (SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND response = 'going') as going_count,
    (SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND response = 'interested') as interested_count,
    (SELECT response FROM event_responses WHERE event_id = e.id AND user_id = ?) as my_response
    FROM events e JOIN users u ON e.creator_id = u.id
    WHERE e.privacy = 'public' OR e.creator_id = ?
    OR e.id IN (SELECT event_id FROM event_responses WHERE user_id = ?)
    ORDER BY e.start_date ASC
  `).all(uid, uid, uid);
  res.json(events);
});

// POST /api/events
router.post('/', auth, upload.single('cover'), (req, res) => {
  const { title, description, start_date, end_date, location, is_online, privacy } = req.body;
  if (!title || !start_date) return res.status(400).json({ error: 'Title and start date required' });
  const uid = req.user.id;
  let coverUrl = null;
  if (req.file) coverUrl = '/uploads/' + req.file.filename;

  const result = db.prepare(`
    INSERT INTO events (creator_id, title, description, cover_photo, start_date, end_date, location, is_online, privacy)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uid, title, description || '', coverUrl, start_date, end_date || null, location || '', is_online ? 1 : 0, privacy || 'public');

  db.prepare('INSERT OR IGNORE INTO event_responses (event_id, user_id, response) VALUES (?, ?, ?)').run(result.lastInsertRowid, uid, 'going');

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
  res.json(event);
});

// GET /api/events/:id
router.get('/:id', auth, (req, res) => {
  const uid = req.user.id;
  const event = db.prepare(`
    SELECT e.*, u.name as creator_name, u.avatar as creator_avatar,
    (SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND response = 'going') as going_count,
    (SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND response = 'interested') as interested_count,
    (SELECT response FROM event_responses WHERE event_id = e.id AND user_id = ?) as my_response
    FROM events e JOIN users u ON e.creator_id = u.id WHERE e.id = ?
  `).get(uid, req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const attendees = db.prepare(`
    SELECT u.id, u.name, u.username, u.avatar, er.response FROM event_responses er
    JOIN users u ON er.user_id = u.id WHERE er.event_id = ? ORDER BY er.response
  `).all(event.id);

  res.json({ ...event, attendees });
});

// POST /api/events/:id/rsvp
router.post('/:id/rsvp', auth, (req, res) => {
  const { response } = req.body;
  const eventId = Number(req.params.id);
  const uid = req.user.id;

  if (!['going', 'interested', 'not_going'].includes(response)) {
    return res.status(400).json({ error: 'Invalid response' });
  }

  const existing = db.prepare('SELECT id FROM event_responses WHERE event_id = ? AND user_id = ?').get(eventId, uid);
  if (existing) {
    if (response === 'not_going') {
      db.prepare('DELETE FROM event_responses WHERE event_id = ? AND user_id = ?').run(eventId, uid);
    } else {
      db.prepare('UPDATE event_responses SET response = ? WHERE event_id = ? AND user_id = ?').run(response, eventId, uid);
    }
  } else {
    if (response !== 'not_going') {
      db.prepare('INSERT INTO event_responses (event_id, user_id, response) VALUES (?, ?, ?)').run(eventId, uid, response);
    }
  }

  const counts = db.prepare(`
    SELECT
    (SELECT COUNT(*) FROM event_responses WHERE event_id = ? AND response = 'going') as going_count,
    (SELECT COUNT(*) FROM event_responses WHERE event_id = ? AND response = 'interested') as interested_count
  `).get(eventId, eventId);

  res.json({ ...counts, myResponse: response === 'not_going' ? null : response });
});

module.exports = router;
