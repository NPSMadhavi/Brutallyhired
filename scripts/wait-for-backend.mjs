import net from "node:net";

const PORT = parseInt(process.env.API_PORT || "4000", 10);
const HOST = "127.0.0.1";
const TIMEOUT_MS = 6000;
const start = Date.now();

function probe() {
  const socket = net.createConnection({ port: PORT, host: HOST });
  socket.setTimeout(400);

  socket.on("connect", () => {
    socket.destroy();
    process.exit(0);
  });

  socket.on("timeout", () => {
    socket.destroy();
    retry();
  });

  socket.on("error", () => {
    socket.destroy();
    retry();
  });
}

function retry() {
  if (Date.now() - start >= TIMEOUT_MS) {
    process.exit(0);
  }
  setTimeout(probe, 200);
}

probe();
