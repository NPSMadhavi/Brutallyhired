import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env, isProd } from "./config/env.js";
import { csrfGuard, loadSession } from "./middlewares/auth.middleware.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import { apiLimiter } from "./middlewares/rateLimit.middleware.js";
import { apiRouter } from "./routes/index.js";
import { logger } from "./utils/logger.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (isProd) app.set("trust proxy", 1);

  app.use(helmet());
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/health" } }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use("/api", apiLimiter, loadSession, csrfGuard);

  app.use("/api", apiRouter);
  app.use("/api", notFoundHandler);
  app.use(errorHandler);

  logger.info({ web: env.WEB_ORIGIN }, "app configured");
  return app;
}
