import { Server } from "socket.io";
import { config } from "./config.js";

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    // CLIENT_URL is comma-separated (see app.js's CORS setup) — split it the
    // same way here so socket.io accepts every allowed origin, not just a
    // literal match on the whole joined string.
    cors: { origin: config.clientUrl.split(",").map((s) => s.trim()), credentials: true },
  });

  io.on("connection", (socket) => {
    socket.on("identify", (username) => {
      if (username) socket.join(`user:${username}`);
    });
  });

  return io;
}

export function getIO() {
  return io;
}

export function emitLeadEvent(event, payload) {
  if (io) io.emit(event, payload);
}

export function emitToUser(username, event, payload) {
  if (io) io.to(`user:${username}`).emit(event, payload);
}
