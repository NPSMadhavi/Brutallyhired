import { prisma } from "@verity/db";
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { attachSocket } from "./services/realtime.service.js";
import { logger } from "./utils/logger.js";

const server = createServer(createApp());
attachSocket(server);

server.listen(env.API_PORT, () => logger.info(`API listening on :${env.API_PORT}`));

// Housekeeping: expired sessions, auth flows, codes and intents.
const sweep = setInterval(async () => {
  const now = new Date();
  try {
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.authFlow.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.emailCode.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.linkIntent.deleteMany({ where: { expiresAt: { lt: now } } }),
    ]);
  } catch (err) {
    logger.warn({ err }, "sweep failed");
  }
}, 15 * 60_000);

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  clearInterval(sweep);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
