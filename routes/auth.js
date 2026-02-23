const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'vohala_super_secret_jwt_key_2026';
const JWT_EXPIRES = '30d';

function makeToken(user) {
  return jwt.sign({ id: user.id, email: user.email, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function safeUser(user) {
  const { password, ...safe } = user;
  return safe;
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const username = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now().toString().slice(-4);
  const hashed = bcrypt.hashSync(password, 10);

  const result = db.prepare('INSERT INTO users (name, username, email, password) VALUES (?, ?, ?, ?)').run(name, username, email, hashed);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = makeToken(user);

  res.json({ token, user: safeUser(user) });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  db.prepare('UPDATE users SET is_online = 1, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  const token = makeToken(user);

  res.json({ token, user: safeUser(user) });
});

// POST /api/auth/logout
router.post('/logout', auth, (req, res) => {
  db.prepare('UPDATE users SET is_online = 0, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(req.user.id);
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(safeUser(user));
});

// POST /api/auth/change-password
router.post('/change-password', auth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'All fields required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = bcrypt.compareSync(currentPassword, user.password);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const hashed = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id);
  res.json({ success: true });
});

// DELETE /api/auth/account
router.delete('/account', auth, (req, res) => {
  const { password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Incorrect password' });

  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  res.json({ success: true });
});

module.exports = router;
