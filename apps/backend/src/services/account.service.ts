import { prisma, type AuthProvider } from "@verity/db";
import { HttpError } from "../utils/errors.js";
import { addMs, minutes } from "../utils/time.js";
import type { OidcIdentity } from "./oidc.service.js";

export type LoginOutcome =
  { kind: "login"; userId: string } | { kind: "intent"; intentId: string; intentKind: "LINK_EXISTING" | "VERIFY_EMAIL" };

const INTENT_TTL = minutes(30);

/**
 * Resolve an OIDC sign-in without ever silently merging accounts:
 *  - known identity → sign in
 *  - linking requested by a signed-in user → attach to that user
 *  - email belongs to another account → ask the owner to confirm (LinkIntent)
 *  - email not vouched for by the provider → prove it with a code first
 *  - otherwise → create the account
 */
export async function resolveOidcLogin(
  provider: AuthProvider,
  id: OidcIdentity,
  opts: { linkUserId: string | null; returnTo: string },
): Promise<LoginOutcome> {
  const existingIdentity = await prisma.identity.findUnique({
    where: { provider_subject: { provider, subject: id.subject } },
  });

  if (opts.linkUserId) {
    if (existingIdentity && existingIdentity.userId !== opts.linkUserId) throw new HttpError(409, "identity_in_use");
    if (!existingIdentity) {
      await prisma.identity.create({ data: { userId: opts.linkUserId, provider, subject: id.subject, email: id.email } });
    }
    return { kind: "login", userId: opts.linkUserId };
  }

  if (existingIdentity) {
    await prisma.identity.update({ where: { id: existingIdentity.id }, data: { lastUsedAt: new Date() } });
    return { kind: "login", userId: existingIdentity.userId };
  }

  if (!id.email) throw new HttpError(422, "email_required");

  const owner = await prisma.user.findUnique({ where: { email: id.email }, include: { identities: true } });

  // Pre-provisioned account (e.g. staff invited by email) with no sign-in yet: a verified email proves ownership.
  if (owner && owner.identities.length === 0 && id.emailVerified) {
    await prisma.$transaction([
      prisma.identity.create({ data: { userId: owner.id, provider, subject: id.subject, email: id.email } }),
      prisma.user.update({ where: { id: owner.id }, data: { emailVerifiedAt: owner.emailVerifiedAt ?? new Date() } }),
    ]);
    return { kind: "login", userId: owner.id };
  }

  if (owner || !id.emailVerified) {
    const intent = await prisma.linkIntent.create({
      data: {
        kind: owner ? "LINK_EXISTING" : "VERIFY_EMAIL",
        provider,
        subject: id.subject,
        email: id.email,
        returnTo: opts.returnTo,
        expiresAt: addMs(new Date(), INTENT_TTL),
      },
    });
    return { kind: "intent", intentId: intent.id, intentKind: intent.kind };
  }

  const user = await prisma.user.create({
    data: {
      email: id.email,
      emailVerifiedAt: new Date(),
      displayName: id.name,
      identities: { create: { provider, subject: id.subject, email: id.email } },
    },
  });
  return { kind: "login", userId: user.id };
}

/** Called after an emailed code proves ownership of `email`. */
export async function resolveEmailLogin(email: string, intentId: string | undefined) {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email, emailVerifiedAt: new Date() } });
  } else if (!user.emailVerifiedAt) {
    user = await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  }
  await prisma.identity.upsert({
    where: { provider_subject: { provider: "EMAIL", subject: email } },
    create: { userId: user.id, provider: "EMAIL", subject: email, email },
    update: { lastUsedAt: new Date() },
  });

  let returnTo: string | null = null;
  if (intentId) {
    const intent = await prisma.linkIntent.findUnique({ where: { id: intentId } });
    // A VERIFY_EMAIL intent completes once the same email is proven.
    if (intent && intent.kind === "VERIFY_EMAIL" && !intent.consumedAt && intent.expiresAt > new Date() && intent.email === email) {
      const taken = await prisma.identity.findUnique({
        where: { provider_subject: { provider: intent.provider, subject: intent.subject } },
      });
      if (!taken) {
        await prisma.identity.create({ data: { userId: user.id, provider: intent.provider, subject: intent.subject, email } });
      }
      await prisma.linkIntent.update({ where: { id: intent.id }, data: { consumedAt: new Date() } });
      returnTo = intent.returnTo;
    }
  }
  return { user, returnTo };
}
