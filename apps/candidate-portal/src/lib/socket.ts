import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) socket = io({ path: "/socket.io", withCredentials: true, autoConnect: false, transports: ["websocket", "polling"] });
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}
