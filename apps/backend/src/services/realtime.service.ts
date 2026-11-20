import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { userFromCookieHeader } from "./session.service.js";

let io: Server | null = null;

export function attachSocket(server: HttpServer) {
  io = new Server(server, {
    path: "/socket.io",
    cors: {
      origin: [env.WEB_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"],
      credentials: true,
    },
  });
  io.use(async (socket, next) => {
    try {
      const found = await userFromCookieHeader(socket.handshake.headers.cookie);
      if (!found) return next(new Error("unauthenticated"));
      socket.data.userId = found.user.id;
      next();
    } catch (err) {
      next(err as Error);
    }
  });
  io.on("connection", (socket) => {
    void socket.join(`user:${socket.data.userId as string}`);
  });
  logger.info("socket.io attached");
  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}
