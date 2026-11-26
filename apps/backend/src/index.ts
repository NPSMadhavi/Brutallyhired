import { prisma } from "@verity/db";
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { processScheduledRound1Assessments } from "./services/automation.service.js";
import { attachSocket } from "./services/realtime.service.js";
import { logger } from "./utils/logger.js";

const server = createServer(createApp());
attachSocket(server);

server.listen(env.API_PORT, "0.0.0.0", () => logger.info(`API listening on :${env.API_PORT}`));

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

// Automation scheduler: 1-hour pre-slot Round 1 question generation & email dispatch (every 30s).
const automationSweep = setInterval(() => {
  void processScheduledRound1Assessments().catch((err) => logger.warn({ err }, "automation sweep failed"));
}, 30_000);

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  clearInterval(sweep);
  clearInterval(automationSweep);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
