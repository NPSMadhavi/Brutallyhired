import type { NextFunction, Request, RequestHandler, Response } from "express";
import { env } from "../config/env.js";
import { SESSION_COOKIE, userFromToken } from "../services/session.service.js";
import { HttpError } from "../utils/errors.js";

/** Attach the signed-in user (if any) to the request. */
export const loadSession: RequestHandler = async (req, _res, next) => {
  try {
    const found = await userFromToken(req.cookies?.[SESSION_COOKIE]);
    if (found) {
      req.user = found.user;
      req.sessionId = found.sessionId;
    }
    next();
  } catch (e) {
    next(e);
  }
};

export function requireUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, "unauthenticated"));
  next();
}

/** Candidates must have a verified email before acting on applications. */
export function requireVerifiedUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, "unauthenticated"));
  if (!req.user.emailVerifiedAt) return next(new HttpError(403, "email_not_verified"));
  next();
}

/**
 * CSRF defence for cookie-authenticated mutations: SameSite=Lax cookies plus a custom header
 * that cross-site forms cannot send, plus an Origin check when the browser provides one.
 */
export const csrfGuard: RequestHandler = (req, _res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  const allowed = [new URL(env.WEB_ORIGIN).origin, new URL(env.ADMIN_ORIGIN).origin];
  if (origin && !allowed.includes(origin)) return next(new HttpError(403, "bad_origin"));
  if (req.get("x-verity-csrf") !== "1") return next(new HttpError(403, "csrf_header_missing"));
  next();
};
