import { prisma, type User } from "@verity/db";
import { parse as parseCookie } from "cookie";
import type { Request, Response } from "express";
import { env, isProd } from "../config/env.js";
import { randomToken, sha256Hex } from "../utils/crypto.js";
import { addMs, days } from "../utils/time.js";

export const SESSION_COOKIE = isProd ? "__Host-verity_sid" : "verity_sid";

/** Opaque random token in an HttpOnly cookie; only its SHA-256 is stored. */
export async function startSession(req: Request, res: Response, userId: string) {
  const token = randomToken(32);
  const expiresAt = addMs(new Date(), days(env.SESSION_TTL_DAYS));
  await prisma.session.create({
    data: {
      id: sha256Hex(token),
      userId,
      expiresAt,
      userAgent: req.get("user-agent")?.slice(0, 300) ?? null,
      ip: req.ip ?? null,
    },
  });
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", expires: expiresAt });
}

export async function endSession(req: Request, res: Response) {
  if (req.sessionId) await prisma.session.delete({ where: { id: req.sessionId } }).catch(() => undefined);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function userFromToken(token: string | undefined): Promise<{ user: User; sessionId: string } | null> {
  if (!token) return null;
  const id = sha256Hex(token);
  const session = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return { user: session.user, sessionId: id };
}

export function userFromCookieHeader(header: string | undefined) {
  if (!header) return Promise.resolve(null);
  return userFromToken(parseCookie(header)[SESSION_COOKIE]);
}
