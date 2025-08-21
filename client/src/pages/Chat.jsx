import { useEffect, useState } from "react";
import io from "socket.io-client";
import axios from "axios";

const socket = io("http://localhost:5000");

export default function Chat({ userId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    socket.emit("join", userId);
    socket.on("receiveMessage", msg => {
      setMessages(prev => [...prev, msg]);
    });
  }, []);

  const send = async () => {
    await axios.post(`/api/messages/${userId}`, { text });
    socket.emit("sendMessage", { sender: "me", receiver: userId, text });
    setText("");
  };

  return (
    <div className="p-4">
      <div className="h-64 overflow-y-scroll border">
        {messages.map((m, i) => <div key={i}>{m.sender}: {m.text}</div>)}
      </div>
      <input value={text} onChange={e => setText(e.target.value)} className="border p-2 w-3/4" />
      <button onClick={send} className="bg-vohala px-3 py-1 text-white">Send</button>
    </div>
  );
}