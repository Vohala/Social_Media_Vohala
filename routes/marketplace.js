const express = require('express');
const router = express.Router();
const { db } = require('../database');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET /api/marketplace
router.get('/', auth, (req, res) => {
  const { category, search, minPrice, maxPrice } = req.query;
  let query = `
    SELECT m.*, u.name as seller_name, u.avatar as seller_avatar, u.username as seller_username,
    (SELECT url FROM marketplace_photos WHERE item_id = m.id ORDER BY sort_order LIMIT 1) as primary_photo
    FROM marketplace_items m JOIN users u ON m.seller_id = u.id WHERE m.is_sold = 0
  `;
  const params = [];

  if (category) { query += ' AND m.category = ?'; params.push(category); }
  if (search) { query += ' AND (m.title LIKE ? OR m.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (minPrice) { query += ' AND m.price >= ?'; params.push(Number(minPrice)); }
  if (maxPrice) { query += ' AND m.price <= ?'; params.push(Number(maxPrice)); }

  query += ' ORDER BY m.created_at DESC LIMIT 50';

  const items = db.prepare(query).all(...params);
  res.json(items);
});

// POST /api/marketplace
router.post('/', auth, upload.array('photos', 5), (req, res) => {
  const { title, description, price, condition, category, location } = req.body;
  if (!title || !price) return res.status(400).json({ error: 'Title and price required' });

  const result = db.prepare(`
    INSERT INTO marketplace_items (seller_id, title, description, price, condition, category, location)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, title, description || '', Number(price), condition || 'good', category || 'other', location || '');

  const itemId = result.lastInsertRowid;

  if (req.files && req.files.length > 0) {
    const insertPhoto = db.prepare('INSERT INTO marketplace_photos (item_id, url, sort_order) VALUES (?, ?, ?)');
    req.files.forEach((file, idx) => insertPhoto.run(itemId, '/uploads/' + file.filename, idx));
  }

  const item = db.prepare('SELECT * FROM marketplace_items WHERE id = ?').get(itemId);
  const photos = db.prepare('SELECT * FROM marketplace_photos WHERE item_id = ? ORDER BY sort_order').all(itemId);
  res.json({ ...item, photos });
});

// GET /api/marketplace/:id
router.get('/:id', auth, (req, res) => {
  const item = db.prepare('SELECT m.*, u.name as seller_name, u.avatar as seller_avatar, u.username as seller_username, u.id as seller_id FROM marketplace_items m JOIN users u ON m.seller_id = u.id WHERE m.id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  const photos = db.prepare('SELECT * FROM marketplace_photos WHERE item_id = ? ORDER BY sort_order').all(item.id);
  res.json({ ...item, photos });
});

// PUT /api/marketplace/:id/mark-sold
router.put('/:id/mark-sold', auth, (req, res) => {
  const item = db.prepare('SELECT * FROM marketplace_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.seller_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('UPDATE marketplace_items SET is_sold = 1 WHERE id = ?').run(item.id);
  res.json({ success: true });
});

// DELETE /api/marketplace/:id
router.delete('/:id', auth, (req, res) => {
  const item = db.prepare('SELECT * FROM marketplace_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (item.seller_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM marketplace_items WHERE id = ?').run(item.id);
  res.json({ success: true });
});

module.exports = router;
