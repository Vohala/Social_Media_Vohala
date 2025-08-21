import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './utils/db.js';
import authRouter from './routes/auth.js';
import userRouter from './routes/users.js';
import postsRouter from './routes/posts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }
});

// Simple in-memory presence map for demo
const onlineUsers = new Map();
io.on('connection', (socket) => {
  socket.on('online', (userId) => {
    onlineUsers.set(userId, socket.id);
  });
  socket.on('disconnect', () => {
    for (const [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) onlineUsers.delete(uid);
    }
  });
});

app.set('io', io);

// middleware
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/posts', postsRouter);

// health
app.get('/api/health', (req, res) => res.json({ ok: true, app: 'Vohala Social API' }));

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, "0.0.0.0", () => console.log(`[server] running on http://localhost:${PORT}`));
}).catch((err) => {
  console.error('DB connection failed', err);
  process.exit(1);
});
