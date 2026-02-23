const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const { initDatabase, db } = require('./database');

const app = express();
const server = http.createServer(app);

// ── Socket.io — tuned for 1000+ concurrent clients ────────────────────────────
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],    // websocket first — faster, less overhead
  pingTimeout: 30000,                       // disconnect if no pong within 30s
  pingInterval: 25000,                      // send ping every 25s
  maxHttpBufferSize: 1e6,                   // 1 MB max per message
  perMessageDeflate: { threshold: 1024 },   // compress websocket frames > 1 KB
  upgradeTimeout: 10000,
  allowEIO3: false,                         // block legacy Socket.io v2 clients
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // recover state within 2 min
    skipMiddlewares: true
  }
});

// ── Performance / Security middleware ─────────────────────────────────────────
app.disable('x-powered-by');
app.use(compression({ level: 6 }));         // gzip all HTTP responses (~70% size saving)
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','PATCH'], credentials: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files — no maxAge so JS/CSS changes are always fresh
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true
}));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'), {
  maxAge: '7d',
  etag: true
}));

// ── Simple in-memory rate limiter (no extra packages) ─────────────────────────
const _rateLimitMap = new Map();
const RATE_LIMIT = 200;          // max requests per IP per window
const RATE_WINDOW = 60 * 1000;   // 1-minute window

function rateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = _rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    _rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return next();
  }
  if (++entry.count > RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many requests — please slow down.' });
  }
  next();
}

// Periodically clean expired rate-limit entries (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _rateLimitMap) {
    if (v.resetAt < now) _rateLimitMap.delete(k);
  }
}, 5 * 60 * 1000);

// ── Database ───────────────────────────────────────────────────────────────────
initDatabase();

// ── Attach io to every request ────────────────────────────────────────────────
app.use((req, res, next) => { req.io = io; next(); });

// ── API routes (rate-limited) ──────────────────────────────────────────────────
app.use('/api', rateLimit);
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/posts',       require('./routes/posts'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/friends',     require('./routes/friends'));
app.use('/api/messages',    require('./routes/messages'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/stories',     require('./routes/stories'));
app.use('/api/groups',      require('./routes/groups'));
app.use('/api/events',      require('./routes/events'));
app.use('/api/marketplace', require('./routes/marketplace'));
app.use('/api/search',      require('./routes/search'));

// ── Socket.io — online users map: userId → socketId ───────────────────────────
const onlineUsers = new Map();

// Reuse prepared statements for hot paths
const stmtOnline  = db.prepare('UPDATE users SET is_online = 1, last_seen = CURRENT_TIMESTAMP WHERE id = ?');
const stmtOffline = db.prepare('UPDATE users SET is_online = 0, last_seen = CURRENT_TIMESTAMP WHERE id = ?');

io.on('connection', (socket) => {
  // User comes online
  socket.on('user_online', (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;
    try { stmtOnline.run(userId); } catch (e) {}
    io.emit('user_status', { userId, online: true });
  });

  // DM rooms
  socket.on('join_room',  (roomId) => socket.join(roomId));
  socket.on('leave_room', (roomId) => socket.leave(roomId));

  // Typing indicators
  socket.on('typing_start', ({ senderId, receiverId }) => {
    const rcv = onlineUsers.get(receiverId);
    if (rcv) io.to(rcv).emit('typing_start', { senderId });
  });

  socket.on('typing_stop', ({ senderId, receiverId }) => {
    const rcv = onlineUsers.get(receiverId);
    if (rcv) io.to(rcv).emit('typing_stop', { senderId });
  });

  // New message
  socket.on('send_message', (data) => {
    const rcv = onlineUsers.get(data.receiverId);
    if (rcv) io.to(rcv).emit('new_message', data);
  });

  // Message read
  socket.on('message_read', ({ senderId, receiverId }) => {
    const snd = onlineUsers.get(senderId);
    if (snd) io.to(snd).emit('messages_read', { readBy: receiverId });
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      try { stmtOffline.run(socket.userId); } catch (e) {}
      io.emit('user_status', { userId: socket.userId, online: false });
    }
  });
});

// ── Global helpers for routes ──────────────────────────────────────────────────
global.emitNotification = (userId, notification) => {
  const socketId = onlineUsers.get(userId);
  if (socketId) io.to(socketId).emit('new_notification', notification);
};

global.emitToUser = (userId, event, data) => {
  const socketId = onlineUsers.get(userId);
  if (socketId) io.to(socketId).emit(event, data);
};

// ── SPA fallback ───────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Global error handler ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Server-level tuning for 1000+ connections ─────────────────────────────────
server.keepAliveTimeout = 65000;   // keep TCP connections alive
server.headersTimeout   = 66000;   // slightly longer than keepAlive
// maxConnections intentionally not set — OS-level ulimit controls the ceiling

const PORT = process.env.PORT || 5050;
server.listen(PORT, () => {
  console.log(`\n🚀 Vohala Social Media running at http://localhost:${PORT}`);
  console.log(`📧 Demo: rahul@demo.com / demo123`);
  console.log(`⚡ Socket.io: websocket-first, 1000+ client ready\n`);
});
