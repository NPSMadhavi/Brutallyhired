import { prisma } from "@verity/db";
import {
  emailCodeRequestSchema,
  emailCodeVerifySchema,
  returnToSchema,
  type AuthProviderKey,
  type LinkIntentDto,
  type SessionUser,
} from "@verity/shared";
import type { RequestHandler } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { resolveEmailLogin, resolveOidcLogin } from "../services/account.service.js";
import { sendTemplate } from "../services/email.service.js";
import { authorizationUrl, enabledOidcProviders, exchangeCode, providerDef } from "../services/oidc.service.js";
import { endSession, startSession } from "../services/session.service.js";
import { hmacHex, randomToken, safeEqualHex, sixDigitCode } from "../utils/crypto.js";
import { ah, HttpError, notFound, parse } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { userOf } from "../utils/request.js";
import { addMs, hours, minutes } from "../utils/time.js";

const MAX_CODE_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;

const webUrl = (path: string) => new URL(path, env.WEB_ORIGIN).toString();

/** Tenant slug is the first path segment of in-app return paths: /:tenant/... */
const tenantFromPath = (p: string) => p.split("/").filter(Boolean)[0] ?? null;

// ── OIDC ──────────────────────────────────────────────

// ── Link intents (explicit identity linking) ──────────────────────────────

// ── Email codes ──────────────────────────────

export const getProviders: RequestHandler = (_req, res) => {
  res.json({ providers: [...enabledOidcProviders(), "EMAIL"] satisfies AuthProviderKey[] });
};

export const getCurrentUser = ah(async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user.id },
    include: { identities: true, staff: { include: { tenant: true } } },
  });
  const dto: SessionUser = {
    id: user.id,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    displayName: user.displayName,
    identities: user.identities.map((i) => ({ provider: i.provider, email: i.email, createdAt: i.createdAt.toISOString() })),
    staffOf: user.staff.map((s) => ({ tenantSlug: s.tenant.slug, role: s.role })),
  };
  res.json({ user: dto });
});

export const logout = ah(async (req, res) => {
  await endSession(req, res);
  res.status(204).end();
});

export const startOidc = ah(async (req, res) => {
  const def = providerDef(String(req.params.provider));
  const returnTo = parse(returnToSchema, req.query.returnTo ?? "/");
  const link = req.query.link === "1";
  if (link && !req.user) throw new HttpError(401, "unauthenticated");
  const state = randomToken(24);
  const nonce = randomToken(24);
  const verifier = def.pkce ? randomToken(48) : null;
  await prisma.authFlow.create({
    data: {
      id: state,
      provider: def.key,
      nonce,
      codeVerifier: verifier,
      returnTo,
      linkUserId: link ? req.user!.id : null,
      expiresAt: addMs(new Date(), minutes(10)),
    },
  });
  res.redirect(await authorizationUrl(def, state, nonce, verifier));
});

export const oidcCallback = ah(async (req, res) => {
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const flow = state ? await prisma.authFlow.findUnique({ where: { id: state } }) : null;
  if (flow) await prisma.authFlow.delete({ where: { id: flow.id } });
  const fail = (code: string) => {
    const q = new URLSearchParams({ code, returnTo: flow?.returnTo ?? "/" });
    res.redirect(webUrl(`/auth/error?${q}`));
  };
  if (!flow || flow.expiresAt < new Date()) return fail("login_expired");
  if (typeof req.query.error === "string") return fail("provider_denied");
  try {
    const def = providerDef(String(req.params.provider));
    if (def.key !== flow.provider) return fail("provider_mismatch");
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code) return fail("code_missing");
    const identity = await exchangeCode(def, code, flow.nonce, flow.codeVerifier);
    const outcome = await resolveOidcLogin(def.key, identity, { linkUserId: flow.linkUserId, returnTo: flow.returnTo });
    if (outcome.kind === "intent") {
      const path = outcome.intentKind === "LINK_EXISTING" ? "link" : "verify-email";
      return res.redirect(webUrl(`/auth/${path}/${outcome.intentId}`));
    }
    if (!flow.linkUserId) await startSession(req, res, outcome.userId);
    res.redirect(webUrl(flow.returnTo));
  } catch (e) {
    logger.warn({ err: e }, "oidc callback failed");
    fail(e instanceof HttpError ? e.code : "login_failed");
  }
});

export const getIntent = ah(async (req, res) => {
  const intent = await prisma.linkIntent.findUnique({ where: { id: req.params.id } });
  if (!intent || intent.consumedAt || intent.expiresAt < new Date()) throw notFound("intent");
  const owner = await prisma.user.findUnique({ where: { email: intent.email }, include: { identities: true } });
  const dto: LinkIntentDto & { kind: string; returnTo: string; tenantSlug: string | null } = {
    id: intent.id,
    kind: intent.kind,
    provider: intent.provider,
    email: intent.email,
    existingProviders: intent.kind === "LINK_EXISTING" ? [...new Set(owner?.identities.map((i) => i.provider) ?? [])] : [],
    returnTo: intent.returnTo,
    tenantSlug: tenantFromPath(intent.returnTo),
  };
  res.json(dto);
});

export const confirmIntent = ah(async (req, res) => {
  const user = userOf(req);
  const intent = await prisma.linkIntent.findUnique({ where: { id: req.params.id } });
  if (!intent || intent.consumedAt || intent.expiresAt < new Date() || intent.kind !== "LINK_EXISTING") throw notFound("intent");
  if (intent.email !== user.email) throw new HttpError(403, "intent_belongs_to_other_account");
  await prisma.$transaction(async (tx) => {
    const taken = await tx.identity.findUnique({
      where: { provider_subject: { provider: intent.provider, subject: intent.subject } },
    });
    if (taken && taken.userId !== user.id) throw new HttpError(409, "identity_in_use");
    if (!taken)
      await tx.identity.create({ data: { userId: user.id, provider: intent.provider, subject: intent.subject, email: intent.email } });
    await tx.linkIntent.update({ where: { id: intent.id }, data: { consumedAt: new Date() } });
  });
  res.json({ ok: true, returnTo: intent.returnTo });
});

export const unlinkIdentity = ah(async (req, res) => {
  const user = userOf(req);
  const provider = String(req.params.provider).toUpperCase() as AuthProviderKey;
  const identities = await prisma.identity.findMany({ where: { userId: user.id } });
  const toRemove = identities.filter((i) => i.provider === provider);
  if (toRemove.length === 0) throw notFound("identity");
  if (identities.length - toRemove.length < 1) throw new HttpError(409, "last_sign_in_method");
  await prisma.identity.deleteMany({ where: { userId: user.id, provider } });
  res.status(204).end();
});

export const requestEmailCode = ah(async (req, res) => {
  const { email } = parse(emailCodeRequestSchema, req.body);
  const tenantSlug = parse(z.string().max(64).optional(), req.body?.tenant);
  const recent = await prisma.emailCode.count({ where: { email, createdAt: { gt: addMs(new Date(), -hours(1)) } } });
  // Same response either way: never reveal whether an account exists.
  if (recent < MAX_CODES_PER_HOUR) {
    const code = sixDigitCode();
    await prisma.emailCode.create({
      data: { email, codeHash: hmacHex(`${email}:${code}`), expiresAt: addMs(new Date(), minutes(env.EMAIL_CODE_TTL_MINUTES)) },
    });
    const tenant = tenantSlug ? await prisma.tenant.findUnique({ where: { slug: tenantSlug } }) : null;
    await sendTemplate({ to: email, template: "login_code", tenant, vars: { code, minutes: env.EMAIL_CODE_TTL_MINUTES } });
  }
  res.status(202).json({ ok: true });
});

export const verifyEmailCode = ah(async (req, res) => {
  const { email, code } = parse(emailCodeVerifySchema, req.body);
  const intentId = parse(z.string().max(64).optional(), req.body?.intentId);
  const record = await prisma.emailCode.findFirst({
    where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.attempts >= MAX_CODE_ATTEMPTS) throw new HttpError(401, "code_invalid_or_expired");
  if (!safeEqualHex(record.codeHash, hmacHex(`${email}:${code}`))) {
    await prisma.emailCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(401, "code_incorrect");
  }
  await prisma.emailCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  const { user, returnTo } = await resolveEmailLogin(email, intentId);
  await startSession(req, res, user.id);
  res.json({ ok: true, returnTo });
});
