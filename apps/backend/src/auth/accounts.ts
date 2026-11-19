import { prisma, type AuthProvider } from "@verity/db";
import { HttpError } from "../lib/errors.js";
import { addMs, minutes } from "../lib/time.js";
import type { OidcIdentity } from "./oidc.js";

export type LoginOutcome =
  | { kind: "login"; userId: string }
  | { kind: "intent"; intentId: string; intentKind: "LINK_EXISTING" | "VERIFY_EMAIL" };

const INTENT_TTL = minutes(30);

/**
 * Resolve an OIDC social sign-in (Google, Microsoft, LinkedIn):
 *  - known provider identity → sign in directly
 *  - linking requested by a signed-in user → attach to that user
 *  - verified provider email matching existing candidate account → associate social identity and log in directly (NO extra OTP)
 *  - new candidate with verified provider email → create account and log in directly (NO extra OTP)
 *  - unverified provider email → require email verification first (LinkIntent)
 */
export async function resolveOidcLogin(
  provider: AuthProvider,
  id: OidcIdentity,
  opts: { linkUserId: string | null; returnTo: string },
): Promise<LoginOutcome> {
  const existingIdentity = await prisma.identity.findUnique({
    where: { provider_subject: { provider, subject: id.subject } },
  });

  // 1. Explicit linking requested by an already authenticated user (e.g. from Profile page)
  if (opts.linkUserId) {
    if (existingIdentity && existingIdentity.userId !== opts.linkUserId) {
      throw new HttpError(409, "identity_in_use");
    }
    if (!existingIdentity) {
      await prisma.identity.create({
        data: { userId: opts.linkUserId, provider, subject: id.subject, email: id.email },
      });
    }
    return { kind: "login", userId: opts.linkUserId };
  }

  // 2. Candidate has previously signed in with this social identity: log in directly
  if (existingIdentity) {
    await prisma.$transaction([
      prisma.identity.update({
        where: { id: existingIdentity.id },
        data: { lastUsedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: existingIdentity.userId },
        data: {
          emailVerifiedAt: new Date(),
          ...(id.email ? { email: id.email } : {}),
        },
      }),
    ]);
    return { kind: "login", userId: existingIdentity.userId };
  }

  if (!id.email) {
    throw new HttpError(422, "email_required");
  }

  // 3. Check if a candidate account exists with this email (e.g. registered via manual email OTP)
  const owner = await prisma.user.findUnique({
    where: { email: id.email },
    include: { identities: true },
  });

  if (owner) {
    // If the provider email is verified (Google, Microsoft, LinkedIn),
    // associate the social identity directly with the existing account and log in without extra OTP!
    if (id.emailVerified) {
      const alreadyHasThisIdentity = owner.identities.some(
        (i) => i.provider === provider && i.subject === id.subject,
      );

      if (!alreadyHasThisIdentity) {
        await prisma.identity.create({
          data: {
            userId: owner.id,
            provider,
            subject: id.subject,
            email: id.email,
          },
        });
      }

      await prisma.user.update({
        where: { id: owner.id },
        data: {
          emailVerifiedAt: owner.emailVerifiedAt ?? new Date(),
          ...(!owner.displayName && id.name ? { displayName: id.name } : {}),
        },
      });

      return { kind: "login", userId: owner.id };
    } else {
      // Security requirement: Never automatically link an unverified email address.
      const intent = await prisma.linkIntent.create({
        data: {
          kind: "LINK_EXISTING",
          provider,
          subject: id.subject,
          email: id.email,
          returnTo: opts.returnTo,
          expiresAt: addMs(new Date(), INTENT_TTL),
        },
      });
      return { kind: "intent", intentId: intent.id, intentKind: intent.kind };
    }
  }

  // 4. New candidate: no existing account with this email
  if (!id.emailVerified) {
    // Security requirement: unverified email from provider requires verification code
    const intent = await prisma.linkIntent.create({
      data: {
        kind: "VERIFY_EMAIL",
        provider,
        subject: id.subject,
        email: id.email,
        returnTo: opts.returnTo,
        expiresAt: addMs(new Date(), INTENT_TTL),
      },
    });
    return { kind: "intent", intentId: intent.id, intentKind: intent.kind };
  }

  // 5. Verified email from provider, new candidate: create account and log in directly without OTP
  const user = await prisma.user.create({
    data: {
      email: id.email,
      emailVerifiedAt: new Date(),
      displayName: id.name,
      identities: {
        create: {
          provider,
          subject: id.subject,
          email: id.email,
        },
      },
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
