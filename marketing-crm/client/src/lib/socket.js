import { io } from "socket.io-client";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL || "http://localhost:5050", { autoConnect: false });
  }
  return socket;
}

export function connectSocket(username) {
  const s = getSocket();
  if (!s.connected) s.connect();
  s.once("connect", () => s.emit("identify", username));
  if (s.connected) s.emit("identify", username);
  return s;
}
