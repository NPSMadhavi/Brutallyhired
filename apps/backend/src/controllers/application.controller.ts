import { prisma, type Prisma } from "@verity/db";
import {
  ACCEPTED_RESUME_MIME,
  draftUpdateSchema,
  profileSchema,
  resumeSummarySchema,
  submitApplicationSchema,
  type ApplicationDraftDto,
  type ApplicationListItem,
  type ResumeReadStatus,
} from "@verity/shared";
import { fileMeta, jobPublic } from "../serializers/candidate.serializer.js";
import { ownedApplication } from "../services/access.service.js";
import { storeUpload } from "../services/file.service.js";
import { internalEvent, pingApplication, publishMilestone } from "../services/notification.service.js";
import { buildOverview } from "../services/overview.service.js";
import { newApplicationReference } from "../services/reference.service.js";
import { readResumeForApplication } from "../services/resume.service.js";
import { scoreApplication } from "../services/scoring.service.js";
import { onApplicationSubmittedAuto } from "../services/automation.service.js";
import { changeStage } from "../services/stage.service.js";
import { ah, conflict, HttpError, notFound, parse } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { tenantOf, userOf } from "../utils/request.js";
import { addMs, days } from "../utils/time.js";

async function draftDto(applicationId: string, userId: string, tenantId: string): Promise<ApplicationDraftDto> {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { job: { include: { questions: true } }, answers: true },
  });
  const [profile, resume, coverFile] = await Promise.all([
    prisma.candidateProfile.findUnique({ where: { userId_tenantId: { userId, tenantId } } }),
    app.resumeFileId ? prisma.fileObject.findUnique({ where: { id: app.resumeFileId } }) : null,
    app.coverLetterFileId ? prisma.fileObject.findUnique({ where: { id: app.coverLetterFileId } }) : null,
  ]);
  const summary = resumeSummarySchema.safeParse(app.resumeSummary ?? undefined);
  return {
    id: app.id,
    reference: app.reference,
    stage: app.stage,
    job: jobPublic(app.job),
    profile: profile
      ? {
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: profile.phone,
          city: profile.city,
          experience: profile.experience,
          noticePeriod: profile.noticePeriod,
        }
      : null,
    resume: fileMeta(resume),
    resumeSummary: app.resumeSummary && summary.success ? summary.data : null,
    resumeReadStatus: app.resumeReadStatus as ResumeReadStatus,
    coverLetterText: app.coverLetterText,
    coverLetterFile: fileMeta(coverFile),
    answers: Object.fromEntries(app.answers.map((a) => [a.questionId, a.value as string | number])),
  };
}

async function ownedDraft(req: Parameters<typeof ownedApplication>[0], id: string) {
  const app = await ownedApplication(req, id);
  if (app.stage !== "DRAFT") throw conflict("already_submitted");
  return app;
}

/** Start (or resume) an application for a job. Idempotent per candidate+job. */

/** The candidate corrects what was read from their CV; the hiring team sees this version. */

export const startApplication = ah(async (req, res) => {
  const user = userOf(req);
  const tenant = tenantOf(req);
  const ref = req.params.ref || "software-developer";
  let job = await prisma.job.findFirst({
    where: { tenantId: tenant.id, OR: [{ externalRef: ref }, { id: ref }] },
  });
  if (!job) {
    const rawTitle = ref
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
    job = await prisma.job.create({
      data: {
        tenantId: tenant.id,
        externalRef: ref,
        title: rawTitle || "Software Developer",
        department: "Engineering",
        location: "Hybrid / Flexible",
        employmentType: "Full-time",
        workplaceType: "HYBRID",
        summary: `We are seeking an experienced ${rawTitle || "Software Developer"} to join our Engineering team.`,
        status: "OPEN",
      },
    });
  }
  const existing = await prisma.application.findUnique({ where: { jobId_userId: { jobId: job.id, userId: user.id } } });
  if (existing) {
    if (existing.stage === "NOT_SELECTED" || existing.stage === "WITHDRAWN") {
      // Allow fresh application: delete old rejected/withdrawn app so candidate can re-apply cleanly!
      await prisma.application.delete({ where: { id: existing.id } });
    } else {
      return res.json({ id: existing.id, stage: existing.stage });
    }
  }
  if (job.status !== "OPEN") throw new HttpError(410, "job_closed");
  const created = await prisma.application.create({
    data: {
      reference: await newApplicationReference(tenant.slug),
      tenantId: tenant.id,
      jobId: job.id,
      userId: user.id,
      jobVersion: job.version,
    },
  });
  await internalEvent(created.id, "draft_started", {}, user.id);
  res.status(201).json({ id: created.id, stage: created.stage });
});

export const listApplications = ah(async (req, res) => {
  const rows = await prisma.application.findMany({
    where: { userId: userOf(req).id, tenantId: tenantOf(req).id },
    include: { job: true },
    orderBy: { updatedAt: "desc" },
  });
  const items: ApplicationListItem[] = rows.map((a) => ({
    id: a.id,
    reference: a.reference,
    stage: a.stage,
    jobTitle: a.job.title,
    jobLocation: a.job.location,
    submittedAt: a.submittedAt?.toISOString() ?? null,
    updatedAt: a.updatedAt.toISOString(),
  }));
  res.json({ items });
});

export const getOverview = ah(async (req, res) => {
  const app = await ownedApplication(req, req.params.id!);
  res.json(await buildOverview(app.id));
});

export const getDraft = ah(async (req, res) => {
  const app = await ownedDraft(req, req.params.id!);
  res.json(await draftDto(app.id, app.userId, app.tenantId));
});

export const updateDraft = ah(async (req, res) => {
  const app = await ownedDraft(req, req.params.id!);
  const input = parse(draftUpdateSchema, req.body);
  if (input.coverLetterText !== undefined) {
    await prisma.application.update({ where: { id: app.id }, data: { coverLetterText: input.coverLetterText || null } });
  }
  if (input.answers) {
    const questions = await prisma.jobQuestion.findMany({ where: { jobId: app.jobId } });
    for (const [questionId, value] of Object.entries(input.answers)) {
      const q = questions.find((x) => x.id === questionId);
      if (!q) throw new HttpError(422, "unknown_question");
      if (q.type === "NUMBER" && typeof value !== "number") throw new HttpError(422, "answer_must_be_number");
      if (q.type === "SINGLE_CHOICE" && (typeof value !== "string" || !q.options.includes(value)))
        throw new HttpError(422, "answer_not_an_option");
      if (value === "") {
        await prisma.applicationAnswer.deleteMany({ where: { applicationId: app.id, questionId } });
        continue;
      }
      await prisma.applicationAnswer.upsert({
        where: { applicationId_questionId: { applicationId: app.id, questionId } },
        create: { applicationId: app.id, questionId, value },
        update: { value },
      });
    }
  }
  res.json(await draftDto(app.id, app.userId, app.tenantId));
});

export const uploadResume = ah(async (req, res) => {
  const app = await ownedDraft(req, req.params.id!);
  const file = await storeUpload({
    file: req.file,
    tenantId: app.tenantId,
    ownerUserId: app.userId,
    purpose: "RESUME",
    accept: ACCEPTED_RESUME_MIME,
  });
  await prisma.application.update({
    where: { id: app.id },
    data: { resumeFileId: file.id, resumeReadStatus: "READING", resumeSummary: undefined, resumeText: null },
  });
  const tenant = tenantOf(req);
  void readResumeForApplication(app.id, file.id, () => pingApplication(app.userId, tenant, app.id)).catch((err) =>
    logger.error({ err }, "resume read crashed"),
  );
  res.status(201).json(await draftDto(app.id, app.userId, app.tenantId));
});

export const saveResumeSummary = ah(async (req, res) => {
  const app = await ownedDraft(req, req.params.id!);
  const summary = parse(resumeSummarySchema, req.body);
  await prisma.application.update({
    where: { id: app.id },
    data: { resumeSummary: summary as Prisma.InputJsonValue, resumeReadStatus: "READ" },
  });
  res.json(await draftDto(app.id, app.userId, app.tenantId));
});

export const uploadCoverLetter = ah(async (req, res) => {
  const app = await ownedDraft(req, req.params.id!);
  const file = await storeUpload({
    file: req.file,
    tenantId: app.tenantId,
    ownerUserId: app.userId,
    purpose: "COVER_LETTER",
    accept: ACCEPTED_RESUME_MIME,
  });
  await prisma.application.update({ where: { id: app.id }, data: { coverLetterFileId: file.id } });
  res.status(201).json(await draftDto(app.id, app.userId, app.tenantId));
});

export const removeCoverLetter = ah(async (req, res) => {
  const app = await ownedDraft(req, req.params.id!);
  await prisma.application.update({ where: { id: app.id }, data: { coverLetterFileId: null } });
  res.json(await draftDto(app.id, app.userId, app.tenantId));
});

export const submitApplication = ah(async (req, res) => {
  const app = await ownedDraft(req, req.params.id!);
  const input = parse(submitApplicationSchema, req.body);
  const tenant = tenantOf(req);
  const job = await prisma.job.findUniqueOrThrow({ where: { id: app.jobId }, include: { questions: true } });
  if (job.status !== "OPEN") throw new HttpError(410, "job_closed");

  const profile = await prisma.candidateProfile.findUnique({
    where: { userId_tenantId: { userId: app.userId, tenantId: app.tenantId } },
  });
  const problems: Record<string, string[]> = {};
  if (!profile || !profileSchema.safeParse(profile).success) problems.profile = ["incomplete"];
  if (!app.resumeFileId) problems.resume = ["required"];
  const answers = await prisma.applicationAnswer.findMany({ where: { applicationId: app.id } });
  const missing = job.questions.filter((q) => q.required && !answers.some((a) => a.questionId === q.id));
  if (missing.length) problems.answers = missing.map((q) => q.id);
  if (Object.keys(problems).length) throw new HttpError(422, "application_incomplete", undefined, problems);

  await prisma.application.update({
    where: { id: app.id },
    data: {
      stage: "IN_REVIEW",
      submittedAt: new Date(),
      jobVersion: job.version,
      consentAccuracy: input.consentAccuracy,
      consentPrivacy: input.consentPrivacy,
      talentPoolUntil: input.talentPool && tenant.talentPoolMonths > 0 ? addMs(new Date(), days(30 * tenant.talentPoolMonths)) : null,
    },
  });
  await internalEvent(app.id, "stage_changed", { from: "DRAFT", to: "IN_REVIEW" }, app.userId);
  await publishMilestone({ applicationId: app.id, type: "application_submitted", data: { reference: app.reference } });
  void onApplicationSubmittedAuto(app.id).catch((err) => logger.error({ err }, "auto screening dispatch failed"));
  void scoreApplication(app.id).catch((err) => logger.error({ err }, "scoring failed"));
  res.json(await buildOverview(app.id));
});

export const withdrawApplication = ah(async (req, res) => {
  const app = await ownedApplication(req, req.params.id!);
  if (["DRAFT", "HIRED", "WITHDRAWN", "NOT_SELECTED"].includes(app.stage)) throw conflict("cannot_withdraw");
  await changeStage(app.id, "WITHDRAWN", app.userId);
  res.json(await buildOverview(app.id));
});
