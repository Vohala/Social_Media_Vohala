import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import requireAuth from '../middleware/auth.js';
import Post from '../models/Post.js';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const upload = multer({
  dest: path.join(__dirname, '../../public/uploads'),
  limits: { fileSize: 7 * 1024 * 1024 } // 7MB
});

const router = express.Router();

router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  const { text } = req.body;
  let imageUrl = '';
  if (req.file) imageUrl = `/uploads/${req.file.filename}`;
  const post = await Post.create({ user: req.user.id, text, imageUrl });
  const populated = await post.populate('user', 'name avatarUrl');
  res.json(populated);
});

router.get('/feed', requireAuth, async (req, res) => {
  const me = await User.findById(req.user.id);
  const ids = [me._id, ...me.following];
  const posts = await Post.find({ user: { $in: ids } })
    .populate('user', 'name avatarUrl')
    .sort({ createdAt: -1 })
    .limit(100);
  res.json(posts);
});

router.get('/user/:id', requireAuth, async (req, res) => {
  const posts = await Post.find({ user: req.params.id })
    .populate('user', 'name avatarUrl')
    .sort({ createdAt: -1 });
  res.json(posts);
});

router.post('/:id/like', requireAuth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const liked = post.likes.some(u => u.toString() === req.user.id);
  if (liked) {
    post.likes = post.likes.filter(u => u.toString() !== req.user.id);
  } else {
    post.likes.push(req.user.id);
  }
  await post.save();
  res.json({ liked: !liked, likesCount: post.likes.length });
});

router.post('/:id/comment', requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Empty comment' });
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  post.comments.push({ user: req.user.id, text });
  await post.save();
  const populated = await Post.findById(req.params.id).populate('comments.user', 'name avatarUrl');
  res.json(populated.comments[populated.comments.length - 1]);
});

export default router;
