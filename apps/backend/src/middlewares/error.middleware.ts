import { Prisma } from "@verity/db";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { MulterError } from "multer";
import { HttpError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export const notFoundHandler: RequestHandler = (_req, _res, next) => next(new HttpError(404, "route_not_found"));

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, fields: err.fields } });
    return;
  }
  if (err instanceof MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 422;
    res.status(status).json({ error: { code: err.code === "LIMIT_FILE_SIZE" ? "file_too_large" : "upload_invalid" } });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    res.status(409).json({ error: { code: "already_exists" } });
    return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: { code: "payload_too_large" } });
    return;
  }
  logger.error({ err, path: req.path }, "unhandled error");
  res.status(500).json({ error: { code: "internal_error" } });
};
