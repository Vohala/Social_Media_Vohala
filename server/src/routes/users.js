import express from 'express';
import requireAuth from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

router.get('/me', requireAuth, async (req, res) => {
  const me = await User.findById(req.user.id).select('-password');
  res.json(me);
});

router.get('/:id', requireAuth, async (req, res) => {
  const u = await User.findById(req.params.id).select('-password');
  if (!u) return res.status(404).json({ error: 'Not found' });
  res.json(u);
});

router.post('/:id/follow', requireAuth, async (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });
  const me = await User.findById(req.user.id);
  const target = await User.findById(targetId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const isFollowing = me.following.some(f => f.toString() === targetId);
  if (isFollowing) {
    me.following = me.following.filter(f => f.toString() != targetId);
    target.followers = target.followers.filter(f => f.toString() != me._id.toString());
  } else {
    me.following.push(targetId);
    target.followers.push(me._id);
  }
  await me.save();
  await target.save();
  res.json({ following: !isFollowing });
});

router.get("/search", async (req, res) => {
  const { q } = req.query;
  const users = await User.find({
    username: { $regex: q, $options: "i" }
  }).select("username name");
  res.json(users);
});

router.post("/:id/follow", async (req, res) => {
  const user = await User.findById(req.user.id);
  const target = await User.findById(req.params.id);

  if (!user.following.includes(target._id)) {
    user.following.push(target._id);
    target.followers.push(user._id);
    await user.save();
    await target.save();
  }
  res.json({ success: true });
});

export default router;
