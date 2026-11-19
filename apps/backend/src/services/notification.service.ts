import { prisma, type Prisma, type Tenant } from "@verity/db";
import { SOCKET_EVENTS, type NotificationDto, type PublicEventType } from "@verity/shared";
import { sendTemplate, type TemplateKey } from "./email.service.js";
import { emitToUser } from "./realtime.service.js";

/**
 * Record a candidate-visible milestone: public event + in-app notification + real-time push + email.
 * Notification text is a message key so the client renders it in the candidate's language.
 */
export async function publishMilestone(opts: {
  applicationId: string;
  type: PublicEventType;
  data?: Record<string, unknown>;
  actorUserId?: string | null;
  email?: { vars: Record<string, unknown>; attachments?: { filename: string; content: string | Buffer; contentType: string }[] } | false;
  path?: string;
}) {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: opts.applicationId },
    include: { tenant: true, user: true, job: true },
  });
  const data = (opts.data ?? {}) as Prisma.InputJsonValue;
  const [, notification] = await prisma.$transaction([
    prisma.applicationEvent.create({
      data: { applicationId: app.id, type: opts.type, visibility: "PUBLIC", data, actorUserId: opts.actorUserId ?? null },
    }),
    prisma.notification.create({
      data: { userId: app.userId, tenantId: app.tenantId, applicationId: app.id, type: opts.type, data },
    }),
  ]);

  const dto: NotificationDto = {
    id: notification.id,
    type: opts.type,
    applicationId: app.id,
    data: (notification.data as Record<string, unknown>) ?? null,
    readAt: null,
    createdAt: notification.createdAt.toISOString(),
  };
  emitToUser(app.userId, SOCKET_EVENTS.notification, { tenantSlug: app.tenant.slug, notification: dto });
  emitToUser(app.userId, SOCKET_EVENTS.applicationUpdated, { tenantSlug: app.tenant.slug, applicationId: app.id });

  if (opts.email !== false) {
    await sendTemplate({
      to: app.user.email,
      template: opts.type as TemplateKey,
      tenant: app.tenant,
      locale: app.user.locale,
      vars: { jobTitle: app.job.title, reference: app.reference, ...(opts.email?.vars ?? {}) },
      attachments: opts.email?.attachments,
      path: opts.path ?? `/${app.tenant.slug}/applications/${app.id}`,
    });
  }
}

export async function internalEvent(applicationId: string, type: string, data?: Record<string, unknown>, actorUserId?: string | null) {
  await prisma.applicationEvent.create({
    data: { applicationId, type, visibility: "INTERNAL", data: (data ?? {}) as Prisma.InputJsonValue, actorUserId: actorUserId ?? null },
  });
}

/** Silent refresh signal for open portals (no notification row). */
export function pingApplication(userId: string, tenant: Pick<Tenant, "slug">, applicationId: string) {
  emitToUser(userId, SOCKET_EVENTS.applicationUpdated, { tenantSlug: tenant.slug, applicationId });
}

export async function emailRecruiters(applicationId: string, template: TemplateKey, vars: Record<string, unknown>) {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { tenant: true, recruiter: true, job: true },
  });
  let recipients = app.recruiter ? [app.recruiter.email] : [];
  if (recipients.length === 0) {
    const staff = await prisma.staffMembership.findMany({
      where: { tenantId: app.tenantId, role: { in: ["ADMIN", "RECRUITER"] } },
      include: { user: true },
    });
    recipients = staff.map((s) => s.user.email);
  }
  await Promise.all(
    recipients.map((to) =>
      sendTemplate({ to, template, tenant: app.tenant, vars: { jobTitle: app.job.title, ...vars }, path: `/${app.tenant.slug}` }),
    ),
  );
}
