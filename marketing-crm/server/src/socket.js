import { Server } from "socket.io";
import { config } from "./config.js";

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.clientUrl, credentials: true },
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
