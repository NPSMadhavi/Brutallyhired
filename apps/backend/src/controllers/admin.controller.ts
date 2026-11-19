import { prisma, type Prisma } from "@verity/db";
import {
  APPLICATION_STAGES,
  assessmentInviteSchema,
  assessmentTemplateSchema,
  eligibilityOverrideSchema,
  interviewRoundSchema,
  jobUpsertSchema,
  joiningDetailsSchema,
  offerCreateSchema,
  onboardingReviewSchema,
  onboardingTemplateSchema,
  staffInviteSchema,
  stageChangeSchema,
  tenantSettingsSchema,
} from "@verity/shared";
import type { RequestHandler } from "express";
import { type Request } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { sendTemplate } from "../services/email.service.js";
import { storeUpload } from "../services/file.service.js";
import { interviewToken } from "../services/livekit.service.js";
import { internalEvent, publishMilestone } from "../services/notification.service.js";
import { scoreApplication } from "../services/scoring.service.js";
import { advanceTo, changeStage } from "../services/stage.service.js";
import { invalidateTenant } from "../services/tenant.service.js";
import { randomToken } from "../utils/crypto.js";
import { ah, conflict, notFound, parse } from "../utils/errors.js";
import { tenantOf, userOf } from "../utils/request.js";
import { addMs, minutes } from "../utils/time.js";

/**
 * Hiring-team API. Exposes internal data (scores, proctoring) — staff only, tenant-scoped.
 */

async function tenantApp(req: Request, id: string) {
  const app = await prisma.application.findFirst({ where: { id, tenantId: tenantOf(req).id }, include: { job: true } });
  if (!app) throw notFound("application");
  return app;
}

// ── Tenant settings & staff ─────────────────────────────

// ── Jobs ─────────────────────────────

async function writeJob(tenantId: string, input: z.output<typeof jobUpsertSchema>, existingId?: string) {
  if (input.assessmentTemplateId) {
    const t = await prisma.assessmentTemplate.findFirst({ where: { id: input.assessmentTemplateId, tenantId } });
    if (!t) throw notFound("assessment_template");
  }
  const { requirements, questions, ...fields } = input;
  return prisma.$transaction(async (tx) => {
    let job;
    if (existingId) {
      const prev = await tx.job.findFirstOrThrow({ where: { id: existingId, tenantId }, include: { requirements: true } });
      const reqChanged =
        JSON.stringify(prev.requirements.map((r) => [r.label, r.kind, r.keywords, r.weight])) !==
        JSON.stringify(requirements.map((r) => [r.label, r.kind, r.keywords, r.weight]));
      job = await tx.job.update({ where: { id: existingId }, data: { ...fields, version: reqChanged ? prev.version + 1 : prev.version } });
      await tx.jobRequirement.deleteMany({ where: { jobId: job.id } });
      // Questions are replaced only when no application has answered them yet.
      const answered = await tx.applicationAnswer.count({ where: { question: { jobId: job.id } } });
      if (answered === 0) {
        await tx.jobQuestion.deleteMany({ where: { jobId: job.id } });
        await tx.jobQuestion.createMany({ data: questions.map((q, i) => ({ ...q, jobId: job!.id, order: i })) });
      }
    } else {
      job = await tx.job.create({ data: { ...fields, tenantId } });
      await tx.jobQuestion.createMany({ data: questions.map((q, i) => ({ ...q, jobId: job!.id, order: i })) });
    }
    await tx.jobRequirement.createMany({ data: requirements.map((r, i) => ({ ...r, jobId: job.id, order: i })) });
    return job;
  });
}

// ── Applications (internal view) ─────────────────────────────

/** HR override of the eligibility review — always with a documented reason. */

// ── Assessments ─────────────────────────────

// ── Interviews ─────────────────────────────

async function tenantRound(req: Request, id: string) {
  const round = await prisma.interviewRound.findFirst({ where: { id, application: { tenantId: tenantOf(req).id } } });
  if (!round) throw notFound("interview");
  return round;
}

// ── Offer ─────────────────────────────

// ── Onboarding ─────────────────────────────

export const getSettings: RequestHandler = (req, res) => {
  res.json(tenantOf(req));
};

export const updateSettings = ah(async (req, res) => {
  const input = parse(tenantSettingsSchema, req.body);
  const t = await prisma.tenant.update({ where: { id: tenantOf(req).id }, data: input });
  invalidateTenant(t.slug);
  res.json(t);
});

export const listStaff = ah(async (req, res) => {
  res.json({
    items: await prisma.staffMembership.findMany({
      where: { tenantId: tenantOf(req).id },
      include: { user: { select: { email: true, displayName: true } } },
    }),
  });
});

export const inviteStaff = ah(async (req, res) => {
  const { email, role, title } = parse(staffInviteSchema, req.body);
  const tenant = tenantOf(req);
  const user = await prisma.user.upsert({ where: { email }, create: { email }, update: {} });
  const membership = await prisma.staffMembership.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    create: { userId: user.id, tenantId: tenant.id, role, title },
    update: { role, title },
  });
  await sendTemplate({ to: email, template: "staff_invited", tenant, vars: {}, path: `/${tenant.slug}/signin` });
  res.status(201).json(membership);
});

export const listJobs = ah(async (req, res) => {
  res.json({
    items: await prisma.job.findMany({
      where: { tenantId: tenantOf(req).id },
      include: { _count: { select: { applications: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  });
});

export const getJob = ah(async (req, res) => {
  const job = await prisma.job.findFirst({
    where: { id: req.params.id, tenantId: tenantOf(req).id },
    include: { requirements: { orderBy: { order: "asc" } }, questions: { orderBy: { order: "asc" } } },
  });
  if (!job) throw notFound("job");
  res.json(job);
});

export const createJob = ah(async (req, res) => {
  res.status(201).json(await writeJob(tenantOf(req).id, parse(jobUpsertSchema, req.body)));
});

export const updateJob = ah(async (req, res) => {
  res.json(await writeJob(tenantOf(req).id, parse(jobUpsertSchema, req.body), req.params.id));
});

export const listApplications = ah(async (req, res) => {
  const stage = parse(z.enum(APPLICATION_STAGES).optional(), req.query.stage);
  const jobId = parse(z.string().optional(), req.query.jobId);
  const items = await prisma.application.findMany({
    where: { tenantId: tenantOf(req).id, stage: stage ?? { not: "DRAFT" }, jobId },
    include: {
      job: { select: { title: true } },
      user: { select: { email: true } },
      scores: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { submittedAt: "desc" },
    take: 200,
  });
  res.json({ items });
});

export const getApplication = ah(async (req, res) => {
  const app = await tenantApp(req, req.params.id!);
  const full = await prisma.application.findUniqueOrThrow({
    where: { id: app.id },
    include: {
      job: { include: { requirements: true, questions: true } },
      user: { select: { email: true } },
      answers: true,
      events: { orderBy: { createdAt: "desc" } },
      scores: { orderBy: { createdAt: "desc" } },
      overrides: { orderBy: { createdAt: "desc" } },
      assessmentInvites: { include: { attempt: { select: { id: true, startedAt: true, submittedAt: true, autoScore: true } } } },
      interviewRounds: { include: { panelists: true, rescheduleAsks: true } },
      offer: true,
      onboardingTasks: true,
      joiningDetails: true,
    },
  });
  const profile = await prisma.candidateProfile.findUnique({ where: { userId_tenantId: { userId: app.userId, tenantId: app.tenantId } } });
  res.json({ ...full, profile });
});

export const changeApplicationStage = ah(async (req, res) => {
  const app = await tenantApp(req, req.params.id!);
  const { stage, note } = parse(stageChangeSchema, req.body);
  res.json(await changeStage(app.id, stage, userOf(req).id, note));
});

export const assignRecruiter = ah(async (req, res) => {
  const app = await tenantApp(req, req.params.id!);
  const { userId } = parse(z.object({ userId: z.string().min(1) }), req.body);
  const staff = await prisma.staffMembership.findFirst({ where: { userId, tenantId: app.tenantId } });
  if (!staff) throw notFound("staff");
  res.json(await prisma.application.update({ where: { id: app.id }, data: { recruiterUserId: userId } }));
});

export const overrideEligibility = ah(async (req, res) => {
  const app = await tenantApp(req, req.params.id!);
  const { decision, reason } = parse(eligibilityOverrideSchema, req.body);
  const override = await prisma.eligibilityOverride.create({
    data: { applicationId: app.id, staffUserId: userOf(req).id, decision, reason },
  });
  await internalEvent(app.id, "eligibility_override", { decision, overrideId: override.id }, userOf(req).id);
  if (decision === "ADVANCE") await advanceTo(app.id, "IN_REVIEW", userOf(req).id);
  if (decision === "NOT_SELECTED") await changeStage(app.id, "NOT_SELECTED", userOf(req).id, reason);
  res.status(201).json(override);
});

export const rescoreApplication = ah(async (req, res) => {
  const app = await tenantApp(req, req.params.id!);
  res.json(await scoreApplication(app.id));
});

export const listAssessmentTemplates = ah(async (req, res) => {
  res.json({
    items: await prisma.assessmentTemplate.findMany({
      where: { tenantId: tenantOf(req).id },
      include: { _count: { select: { questions: true } } },
    }),
  });
});

export const createAssessmentTemplate = ah(async (req, res) => {
  const { questions, ...t } = parse(assessmentTemplateSchema, req.body);
  const created = await prisma.assessmentTemplate.create({
    data: { ...t, tenantId: tenantOf(req).id, questions: { create: questions.map((q, i) => ({ ...q, order: i })) } },
  });
  res.status(201).json(created);
});

export const inviteToAssessment = ah(async (req, res) => {
  const app = await tenantApp(req, req.params.id!);
  const { templateId, dueAt } = parse(assessmentInviteSchema, req.body);
  const template = await prisma.assessmentTemplate.findFirst({ where: { id: templateId, tenantId: app.tenantId } });
  if (!template) throw notFound("assessment_template");
  const invite = await prisma.assessmentInvite.create({ data: { applicationId: app.id, templateId, dueAt: new Date(dueAt) } });
  await advanceTo(app.id, "ASSESSMENT", userOf(req).id);
  await publishMilestone({
    applicationId: app.id,
    type: "assessment_invited",
    data: { inviteId: invite.id, title: template.title, dueAt },
    email: { vars: { assessmentTitle: template.title, dueAt: new Date(dueAt).toUTCString(), durationMinutes: template.durationMinutes } },
    path: `/${tenantOf(req).slug}/applications/${app.id}/assessments/${invite.id}`,
  });
  res.status(201).json(invite);
});

export const getProctoringReview = ah(async (req, res) => {
  const attempt = await prisma.assessmentAttempt.findFirst({
    where: { id: req.params.id, invite: { application: { tenantId: tenantOf(req).id } } },
    include: { events: { orderBy: { at: "asc" } }, chunks: { orderBy: [{ kind: "asc" }, { seq: "asc" }] } },
  });
  if (!attempt) throw notFound("attempt");
  res.json(attempt);
});

export const createInterviewRound = ah(async (req, res) => {
  const app = await tenantApp(req, req.params.id!);
  const input = parse(interviewRoundSchema, req.body);
  const sequence = (await prisma.interviewRound.count({ where: { applicationId: app.id } })) + 1;
  const round = await prisma.interviewRound.create({
    data: {
      applicationId: app.id,
      sequence,
      title: input.title,
      description: input.description,
      preparation: input.preparation,
      durationMinutes: input.durationMinutes,
      bookByAt: input.bookByAt ? new Date(input.bookByAt) : null,
      roomName: `iv_${randomToken(12)}`,
      panelists: { create: input.panelists },
      slots: {
        create: input.slots.map((s) => ({
          startsAt: new Date(s.startsAt),
          endsAt: addMs(new Date(s.startsAt), minutes(input.durationMinutes)),
        })),
      },
    },
  });
  await advanceTo(app.id, "INTERVIEW", userOf(req).id);
  await publishMilestone({
    applicationId: app.id,
    type: "interview_invited",
    data: { roundId: round.id, title: round.title },
    email: { vars: { roundTitle: round.title } },
    path: `/${tenantOf(req).slug}/applications/${app.id}/interviews/${round.id}`,
  });
  res.status(201).json(round);
});

export const completeInterview = ah(async (req, res) => {
  const round = await tenantRound(req, req.params.id!);
  if (round.status !== "SCHEDULED") throw conflict("interview_not_scheduled");
  const updated = await prisma.interviewRound.update({ where: { id: round.id }, data: { status: "COMPLETED" } });
  await publishMilestone({
    applicationId: round.applicationId,
    type: "interview_completed",
    data: { roundId: round.id, title: round.title },
    email: { vars: { roundTitle: round.title } },
  });
  res.json(updated);
});

export const cancelInterview = ah(async (req, res) => {
  const round = await tenantRound(req, req.params.id!);
  const updated = await prisma.interviewRound.update({ where: { id: round.id }, data: { status: "CANCELLED" } });
  await internalEvent(round.applicationId, "interview_cancelled", { roundId: round.id }, userOf(req).id);
  res.json(updated);
});

export const createStaffJoinToken = ah(async (req, res) => {
  const round = await tenantRound(req, req.params.id!);
  if (round.status !== "SCHEDULED" || !round.scheduledEnd) throw conflict("interview_not_scheduled");
  const user = userOf(req);
  res.json(
    await interviewToken({
      roomName: round.roomName,
      identity: `staff:${user.id}`,
      name: user.displayName ?? user.email,
      ttlSeconds: (round.scheduledEnd.getTime() + minutes(env.INTERVIEW_JOIN_LATE_MINUTES) - Date.now()) / 1000,
      canModerate: true,
    }),
  );
});

export const upsertOffer = ah(async (req, res) => {
  const app = await tenantApp(req, req.params.id!);
  const { terms, message, respondBy, send } = parse(offerCreateSchema, req.body);
  const existing = await prisma.offer.findUnique({ where: { applicationId: app.id } });
  if (existing && existing.status !== "DRAFT") throw conflict("offer_already_sent");
  const data = { terms: terms as Prisma.InputJsonValue, message, respondBy: new Date(respondBy) };
  let offer = existing
    ? await prisma.offer.update({ where: { id: existing.id }, data })
    : await prisma.offer.create({ data: { ...data, applicationId: app.id } });
  if (send) {
    offer = await prisma.offer.update({ where: { id: offer.id }, data: { status: "SENT", sentAt: new Date() } });
    await advanceTo(app.id, "OFFER", userOf(req).id);
    await publishMilestone({
      applicationId: app.id,
      type: "offer_sent",
      data: { respondBy },
      email: { vars: { respondBy: new Date(respondBy).toUTCString() } },
      path: `/${tenantOf(req).slug}/applications/${app.id}/offer`,
    });
  }
  res.json(offer);
});

export const uploadOfferLetter = ah(async (req, res) => {
  const app = await tenantApp(req, req.params.id!);
  const offer = await prisma.offer.findUnique({ where: { applicationId: app.id } });
  if (!offer) throw notFound("offer");
  if (offer.status !== "DRAFT") throw conflict("offer_already_sent");
  const file = await storeUpload({
    file: req.file,
    tenantId: app.tenantId,
    ownerUserId: userOf(req).id,
    purpose: "OFFER_LETTER",
    accept: ["application/pdf"],
  });
  res.json(await prisma.offer.update({ where: { id: offer.id }, data: { letterFileId: file.id } }));
});

export const withdrawOffer = ah(async (req, res) => {
  const app = await tenantApp(req, req.params.id!);
  const offer = await prisma.offer.findUnique({ where: { applicationId: app.id } });
  if (!offer || offer.status !== "SENT") throw conflict("offer_not_withdrawable");
  await prisma.offer.update({ where: { id: offer.id }, data: { status: "WITHDRAWN" } });
  await internalEvent(app.id, "offer_withdrawn", {}, userOf(req).id);
  res.json({ ok: true });
});

export const saveOnboardingTemplate = ah(async (req, res) => {
  const { items } = parse(onboardingTemplateSchema, req.body);
  const tenantId = tenantOf(req).id;
  await prisma.$transaction([
    prisma.onboardingTemplateItem.deleteMany({ where: { tenantId } }),
    prisma.onboardingTemplateItem.createMany({ data: items.map((it, i) => ({ ...it, tenantId, order: i })) }),
  ]);
  res.json({ items: await prisma.onboardingTemplateItem.findMany({ where: { tenantId }, orderBy: { order: "asc" } }) });
});

export const reviewOnboardingDocument = ah(async (req, res) => {
  const task = await prisma.onboardingTask.findFirst({ where: { id: req.params.id, application: { tenantId: tenantOf(req).id } } });
  if (!task) throw notFound("task");
  if (task.status !== "SUBMITTED") throw conflict("task_not_submitted");
  const { status, note } = parse(onboardingReviewSchema, req.body);
  const updated = await prisma.onboardingTask.update({
    where: { id: task.id },
    data: { status, reviewerNote: note ?? null, reviewedAt: new Date() },
  });
  await publishMilestone({
    applicationId: task.applicationId,
    type: status === "VERIFIED" ? "onboarding_document_verified" : "onboarding_document_rejected",
    data: { taskId: task.id, title: task.title },
    email: { vars: { taskTitle: task.title, note: note ?? "" } },
    path: `/${tenantOf(req).slug}/applications/${task.applicationId}/onboarding`,
  });
  res.json(updated);
});

export const saveJoiningDetails = ah(async (req, res) => {
  const app = await tenantApp(req, req.params.id!);
  const input = parse(joiningDetailsSchema, req.body);
  const data = { ...input, startDate: new Date(input.startDate) };
  const details = await prisma.joiningDetails.upsert({
    where: { applicationId: app.id },
    create: { ...data, applicationId: app.id },
    update: data,
  });
  await publishMilestone({
    applicationId: app.id,
    type: "joining_details_shared",
    data: { startDate: input.startDate },
    email: { vars: { startDate: new Date(input.startDate).toDateString(), location: input.location } },
    path: `/${tenantOf(req).slug}/applications/${app.id}/onboarding`,
  });
  res.json(details);
});

export const markHired = ah(async (req, res) => {
  const app = await tenantApp(req, req.params.id!);
  if (app.stage !== "ONBOARDING") throw conflict("not_in_onboarding");
  res.json(await changeStage(app.id, "HIRED", userOf(req).id));
});
