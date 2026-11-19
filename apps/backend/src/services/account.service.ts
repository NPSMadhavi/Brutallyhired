import { prisma, type AuthProvider } from "@verity/db";
import { HttpError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { addMs, minutes } from "../utils/time.js";
import type { OidcIdentity } from "./oidc.service.js";

export type LoginOutcome =
  | { kind: "login"; userId: string }
  | { kind: "intent"; intentId: string; intentKind: "LINK_EXISTING" | "VERIFY_EMAIL" };

const INTENT_TTL = minutes(30);

/**
 * Resolve an OIDC social sign-in (Google, Microsoft, LinkedIn):
 *  - known provider identity -> sign in directly
 *  - linking requested by a signed-in user -> attach to that user
 *  - verified provider email matching existing candidate account -> associate social identity and log in directly (NO extra OTP)
 *  - new candidate with verified provider email -> create account and log in directly (NO extra OTP)
 *  - unverified provider email -> require email verification first (LinkIntent)
 */
export async function resolveOidcLogin(
  provider: AuthProvider,
  id: OidcIdentity,
  opts: { linkUserId: string | null; returnTo: string },
): Promise<LoginOutcome> {
  const existingIdentity = await prisma.identity.findUnique({
    where: { provider_subject: { provider, subject: id.subject } },
  });

  logger.info(
    {
      provider,
      subject: id.subject,
      emailVerified: id.emailVerified,
      existingIdentityFound: Boolean(existingIdentity),
      existingIdentityUserId: existingIdentity?.userId ?? null,
    },
    "[AUTH DIAGNOSTIC] Step 1: Checked provider identity",
  );

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
    logger.info(
      { userId: opts.linkUserId, provider },
      "[AUTH DIAGNOSTIC] Linked identity to explicitly logged-in user",
    );
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
    logger.info(
      { userId: existingIdentity.userId, provider },
      "[AUTH DIAGNOSTIC] Recognized existing social identity -> direct login",
    );
    return { kind: "login", userId: existingIdentity.userId };
  }

  if (!id.email) {
    logger.warn({ provider }, "[AUTH DIAGNOSTIC] No email returned by provider");
    throw new HttpError(422, "email_required");
  }

  // 3. Check if a candidate account exists with this email (e.g. registered via manual email OTP)
  const normalizedEmail = id.email.trim().toLowerCase();
  const owner = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { identities: true },
  });

  logger.info(
    {
      provider,
      normalizedEmail: `${normalizedEmail.slice(0, 3)}***@***`,
      existingAccountFound: Boolean(owner),
      existingUserId: owner?.id ?? null,
      emailVerified: id.emailVerified,
      branchDecision: owner
        ? id.emailVerified
          ? "LINK_EXISTING_AND_LOGIN_DIRECT"
          : "UNVERIFIED_EMAIL_CREATE_LINK_INTENT"
        : id.emailVerified
          ? "NEW_USER_CREATE_AND_LOGIN_DIRECT"
          : "UNVERIFIED_EMAIL_CREATE_VERIFY_INTENT",
    },
    "[AUTH DIAGNOSTIC] Step 2: Account lookup & linking decision",
  );

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
            email: normalizedEmail,
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

      logger.info(
        { userId: owner.id, provider, directLogin: true },
        "[AUTH DIAGNOSTIC] Successfully associated social identity with existing account -> logging in directly",
      );
      return { kind: "login", userId: owner.id };
    } else {
      // Security requirement: Never automatically link an unverified email address.
      logger.warn(
        { provider, reason: "provider_email_unverified" },
        "[AUTH DIAGNOSTIC] Provider email unverified -> creating LinkIntent for email verification",
      );
      const intent = await prisma.linkIntent.create({
        data: {
          kind: "LINK_EXISTING",
          provider,
          subject: id.subject,
          email: normalizedEmail,
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
    logger.warn(
      { provider, reason: "new_candidate_unverified_email" },
      "[AUTH DIAGNOSTIC] New candidate email unverified -> creating VerifyEmail intent",
    );
    const intent = await prisma.linkIntent.create({
      data: {
        kind: "VERIFY_EMAIL",
        provider,
        subject: id.subject,
        email: normalizedEmail,
        returnTo: opts.returnTo,
        expiresAt: addMs(new Date(), INTENT_TTL),
      },
    });
    return { kind: "intent", intentId: intent.id, intentKind: intent.kind };
  }

  // 5. Verified email from provider, new candidate: create account and log in directly without OTP
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      emailVerifiedAt: new Date(),
      displayName: id.name,
      identities: {
        create: {
          provider,
          subject: id.subject,
          email: normalizedEmail,
        },
      },
    },
  });

  logger.info(
    { userId: user.id, provider, directLogin: true },
    "[AUTH DIAGNOSTIC] Created new candidate account with social identity -> logging in directly",
  );
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
