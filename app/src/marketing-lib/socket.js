import { io } from "socket.io-client";

// socket.io attaches directly to the combined backend's raw HTTP server
// (see combined-server/index.js's initSocket call), not under the
// /marketing Express mount prefix — so this connects to the backend's root
// origin, not VITE_MARKETING_API_URL itself.
const MARKETING_API_URL = import.meta.env.VITE_MARKETING_API_URL || "http://localhost:6050";
const SOCKET_ORIGIN = MARKETING_API_URL.replace(/\/marketing\/?$/, "");

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_ORIGIN, { autoConnect: false });
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
