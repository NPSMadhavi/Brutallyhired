import type { OidcProviderKey } from "@verity/shared";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { env } from "../config/env.js";
import { pkceChallenge } from "../utils/crypto.js";
import { HttpError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

interface ProviderDef {
  key: OidcProviderKey;
  clientId?: string;
  clientSecret?: string;
  discoveryUrl: string;
  scope: string;
  pkce: boolean;
  /** Some providers echo the nonce only when supported; "strict" requires it. */
  nonce: "strict" | "if-present";
  tokenAuth: "client_secret_post" | "client_secret_basic";
  /** Issuer validation; Microsoft's multi-tenant issuer embeds the user's tenant id. */
  issuerMatches: (iss: string, discoveredIssuer: string, claims: JWTPayload) => boolean;
  /** Whether the provider's statement about the email can be trusted. */
  emailVerified: (claims: JWTPayload) => boolean;
}

const providers: Record<OidcProviderKey, ProviderDef> = {
  GOOGLE: {
    key: "GOOGLE",
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    discoveryUrl: "https://accounts.google.com/.well-known/openid-configuration",
    scope: "openid email profile",
    pkce: true,
    nonce: "strict",
    tokenAuth: "client_secret_post",
    issuerMatches: (iss) => iss === "https://accounts.google.com" || iss === "accounts.google.com",
    emailVerified: (c) => c.email_verified === true || c.email_verified === "true" || c.email_verified === 1,
  },
  MICROSOFT: {
    key: "MICROSOFT",
    clientId: env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    discoveryUrl: `https://login.microsoftonline.com/${env.MICROSOFT_TENANT}/v2.0/.well-known/openid-configuration`,
    scope: "openid email profile",
    pkce: true,
    nonce: "strict",
    tokenAuth: "client_secret_post",
    issuerMatches: (iss, discovered, claims) => typeof claims.tid === "string" && iss === discovered.replace("{tenantid}", claims.tid),
    // Microsoft verified claim check (email_verified, domain verification xms_edov, or verified Microsoft domain)
    emailVerified: (c) =>
      c.email_verified === true ||
      c.email_verified === "true" ||
      c.xms_edov === true ||
      c.xms_edov === "1" ||
      c.xms_edov === 1 ||
      (typeof c.preferred_username === "string" &&
        (c.preferred_username.endsWith("@outlook.com") ||
          c.preferred_username.endsWith("@hotmail.com") ||
          c.preferred_username.endsWith("@live.com"))),
  },
  LINKEDIN: {
    key: "LINKEDIN",
    clientId: env.LINKEDIN_CLIENT_ID,
    clientSecret: env.LINKEDIN_CLIENT_SECRET,
    discoveryUrl: "https://www.linkedin.com/oauth/.well-known/openid-configuration",
    scope: "openid profile email",
    pkce: false,
    nonce: "if-present",
    tokenAuth: "client_secret_post",
    issuerMatches: (iss, discovered) => iss === discovered,
    emailVerified: (c) => c.email_verified === true || c.email_verified === "true" || c.email_verified === 1,
  },
};

export const enabledOidcProviders = (): OidcProviderKey[] =>
  (Object.values(providers) as ProviderDef[]).filter((p) => p.clientId && p.clientSecret).map((p) => p.key);

export function providerDef(key: string): ProviderDef {
  const def = providers[key.toUpperCase() as OidcProviderKey];
  if (!def || !def.clientId || !def.clientSecret) throw new HttpError(404, "provider_not_enabled");
  return def;
}

interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

const discoveryCache = new Map<OidcProviderKey, { doc: Discovery; jwks: ReturnType<typeof createRemoteJWKSet>; at: number }>();

async function discover(def: ProviderDef) {
  const cached = discoveryCache.get(def.key);
  if (cached && Date.now() - cached.at < 3_600_000) return cached;
  const res = await fetch(def.discoveryUrl, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new HttpError(502, "provider_unavailable");
  const doc = (await res.json()) as Discovery;
  const entry = { doc, jwks: createRemoteJWKSet(new URL(doc.jwks_uri)), at: Date.now() };
  discoveryCache.set(def.key, entry);
  return entry;
}

export const callbackUrl = (key: OidcProviderKey) => `${env.API_ORIGIN}/api/auth/oidc/${key.toLowerCase()}/callback`;

export async function authorizationUrl(def: ProviderDef, state: string, nonce: string, codeVerifier: string | null) {
  const { doc } = await discover(def);
  const url = new URL(doc.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", def.clientId!);
  url.searchParams.set("redirect_uri", callbackUrl(def.key));
  url.searchParams.set("scope", def.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  if (def.key === "GOOGLE" || def.key === "MICROSOFT") url.searchParams.set("prompt", "select_account");
  if (codeVerifier) {
    url.searchParams.set("code_challenge", pkceChallenge(codeVerifier));
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}

export interface OidcIdentity {
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export async function exchangeCode(def: ProviderDef, code: string, nonce: string, codeVerifier: string | null): Promise<OidcIdentity> {
  const { doc, jwks } = await discover(def);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl(def.key),
  });
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
  if (def.tokenAuth === "client_secret_post") {
    body.set("client_id", def.clientId!);
    body.set("client_secret", def.clientSecret!);
  } else {
    headers.authorization = `Basic ${Buffer.from(`${encodeURIComponent(def.clientId!)}:${encodeURIComponent(def.clientSecret!)}`).toString("base64")}`;
  }
  if (codeVerifier) body.set("code_verifier", codeVerifier);

  const res = await fetch(doc.token_endpoint, { method: "POST", headers, body, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new HttpError(401, "token_exchange_failed");
  const tokens = (await res.json()) as { id_token?: string };
  if (!tokens.id_token) throw new HttpError(401, "id_token_missing");

  const { payload } = await jwtVerify(tokens.id_token, jwks, { audience: def.clientId!, clockTolerance: 60 }).catch(() => {
    throw new HttpError(401, "id_token_invalid");
  });
  if (typeof payload.iss !== "string" || !def.issuerMatches(payload.iss, doc.issuer, payload)) {
    throw new HttpError(401, "issuer_mismatch");
  }
  if (def.nonce === "strict" || payload.nonce !== undefined) {
    if (payload.nonce !== nonce) throw new HttpError(401, "nonce_mismatch");
  }
  if (!payload.sub) throw new HttpError(401, "subject_missing");

  const rawEmail =
    typeof payload.email === "string" && payload.email.includes("@")
      ? payload.email
      : typeof payload.preferred_username === "string" && payload.preferred_username.includes("@")
        ? payload.preferred_username
        : typeof payload.upn === "string" && payload.upn.includes("@")
          ? payload.upn
          : null;
  const email = rawEmail ? rawEmail.trim().toLowerCase() : null;
  const isVerified = Boolean(email) && Boolean(def.emailVerified(payload));
  const name =
    typeof payload.name === "string"
      ? payload.name
      : [payload.given_name, payload.family_name].filter((x) => typeof x === "string").join(" ") || null;

  logger.info(
    {
      provider: def.key,
      subject: payload.sub,
      email: email ? `${email.slice(0, 3)}***@***` : null,
      emailVerified: isVerified,
      rawEmailClaimPresent: Boolean(payload.email),
      rawEmailVerifiedValue: payload.email_verified,
    },
    "[OIDC DIAGNOSTIC] Code exchanged & ID token claims verified",
  );

  return { subject: payload.sub, email, emailVerified: isVerified, name };
}
