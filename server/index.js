import { Server } from "socket.io";

const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  socket.on("sendMessage", ({ sender, receiver, text }) => {
    io.to(receiver).emit("receiveMessage", { sender, text });
  });

  socket.on("join", (userId) => {
    socket.join(userId);
  });
});