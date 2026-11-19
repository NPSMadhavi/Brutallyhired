import { prisma, type Prisma } from "@verity/db";
import { assessmentAnswersSchema, CAPTURE_KINDS, proctoringEventsSchema, type AssessmentInviteDto, type AttemptDto } from "@verity/shared";
import express from "express";
import { z } from "zod";
import { storeBuffer } from "../services/file.service.js";
import { internalEvent, publishMilestone } from "../services/notification.service.js";
import { ah, conflict, HttpError, notFound, parse } from "../utils/errors.js";
import { tenantOf, userOf } from "../utils/request.js";
import { addMs, minutes } from "../utils/time.js";

const GRACE_MS = 30_000;

async function ownedInvite(req: express.Request, id: string) {
  const invite = await prisma.assessmentInvite.findFirst({
    where: { id, application: { userId: userOf(req).id, tenantId: tenantOf(req).id } },
    include: { template: { include: { questions: true } }, attempt: true, application: true },
  });
  if (!invite) throw notFound("assessment");
  if (invite.status === "INVITED" && invite.dueAt < new Date()) {
    await prisma.assessmentInvite.update({ where: { id: invite.id }, data: { status: "EXPIRED" } });
    invite.status = "EXPIRED";
  }
  return invite;
}

async function ownedAttempt(req: express.Request, id: string) {
  const attempt = await prisma.assessmentAttempt.findFirst({
    where: { id, invite: { application: { userId: userOf(req).id, tenantId: tenantOf(req).id } } },
    include: { invite: { include: { template: { include: { questions: true } } } } },
  });
  if (!attempt) throw notFound("attempt");
  return attempt;
}

const inviteDto = (inv: Awaited<ReturnType<typeof ownedInvite>>): AssessmentInviteDto => ({
  id: inv.id,
  title: inv.template.title,
  description: inv.template.description,
  durationMinutes: inv.template.durationMinutes,
  proctored: inv.template.proctored,
  topics: inv.template.topics,
  questionCount: inv.template.questions.length,
  dueAt: inv.dueAt.toISOString(),
  status: inv.status,
  attempt: inv.attempt
    ? { id: inv.attempt.id, deadlineAt: inv.attempt.deadlineAt.toISOString(), submittedAt: inv.attempt.submittedAt?.toISOString() ?? null }
    : null,
});

/** Questions without correct answers or points. */
const attemptDto = (attempt: Awaited<ReturnType<typeof ownedAttempt>>): AttemptDto => ({
  id: attempt.id,
  deadlineAt: attempt.deadlineAt.toISOString(),
  serverNow: new Date().toISOString(),
  questions: [...attempt.invite.template.questions]
    .sort((a, b) => a.order - b.order)
    .map((q) => ({ id: q.id, order: q.order, type: q.type, prompt: q.prompt, options: q.options })),
  answers: (attempt.answers as AttemptDto["answers"]) ?? {},
});

/** Recording chunks from MediaRecorder (camera or screen), uploaded in order. */

export const listAssessments = ah(async (req, res) => {
  const invites = await prisma.assessmentInvite.findMany({
    where: { applicationId: req.params.appId, application: { userId: userOf(req).id, tenantId: tenantOf(req).id } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const items = await Promise.all(invites.map(async (i) => inviteDto(await ownedInvite(req, i.id))));
  res.json({ items });
});

export const getAssessment = ah(async (req, res) => {
  res.json(inviteDto(await ownedInvite(req, req.params.id!)));
});

export const startAttempt = ah(async (req, res) => {
  const invite = await ownedInvite(req, req.params.id!);
  if (invite.status === "IN_PROGRESS" && invite.attempt && !invite.attempt.submittedAt) {
    return res.json(attemptDto(await ownedAttempt(req, invite.attempt.id)));
  }
  if (invite.status !== "INVITED") throw conflict(`assessment_${invite.status.toLowerCase()}`);
  const now = new Date();
  const attempt = await prisma.$transaction(async (tx) => {
    const claimed = await tx.assessmentInvite.updateMany({ where: { id: invite.id, status: "INVITED" }, data: { status: "IN_PROGRESS" } });
    if (claimed.count !== 1) throw conflict("assessment_already_started");
    return tx.assessmentAttempt.create({
      data: { inviteId: invite.id, startedAt: now, deadlineAt: addMs(now, minutes(invite.template.durationMinutes)) },
    });
  });
  await internalEvent(invite.applicationId, "assessment_started", { attemptId: attempt.id });
  res.status(201).json(attemptDto(await ownedAttempt(req, attempt.id)));
});

export const getAttempt = ah(async (req, res) => {
  const attempt = await ownedAttempt(req, req.params.id!);
  if (attempt.submittedAt) throw conflict("attempt_submitted");
  res.json(attemptDto(attempt));
});

export const saveAnswers = ah(async (req, res) => {
  const attempt = await ownedAttempt(req, req.params.id!);
  if (attempt.submittedAt) throw conflict("attempt_submitted");
  if (Date.now() > attempt.deadlineAt.getTime() + GRACE_MS) throw new HttpError(409, "time_up");
  const { answers } = parse(assessmentAnswersSchema, req.body);
  const questions = attempt.invite.template.questions;
  for (const [qid, v] of Object.entries(answers)) {
    const q = questions.find((x) => x.id === qid);
    if (!q) throw new HttpError(422, "unknown_question");
    const isChoice = q.type !== "TEXT";
    if (isChoice !== Array.isArray(v)) throw new HttpError(422, "answer_type_mismatch");
    if (Array.isArray(v) && v.some((i) => i >= q.options.length)) throw new HttpError(422, "answer_out_of_range");
    if (q.type === "SINGLE_CHOICE" && Array.isArray(v) && v.length > 1) throw new HttpError(422, "single_choice_only");
  }
  const merged = { ...((attempt.answers as Record<string, unknown>) ?? {}), ...answers };
  await prisma.assessmentAttempt.update({ where: { id: attempt.id }, data: { answers: merged as Prisma.InputJsonValue } });
  res.status(204).end();
});

export const recordProctoringEvents = ah(async (req, res) => {
  const attempt = await ownedAttempt(req, req.params.id!);
  if (attempt.submittedAt) return res.status(204).end();
  const { events } = parse(proctoringEventsSchema, req.body);
  await prisma.proctoringEvent.createMany({
    data: events.map((e) => ({
      attemptId: attempt.id,
      type: e.type,
      at: new Date(e.at),
      detail: (e.detail ?? undefined) as Prisma.InputJsonValue | undefined,
    })),
  });
  res.status(204).end();
});

export const uploadRecordingChunk = ah(async (req, res) => {
  const attempt = await ownedAttempt(req, req.params.id!);
  const kind = parse(z.enum(CAPTURE_KINDS), String(req.params.kind).toUpperCase());
  const seq = parse(z.coerce.number().int().min(0).max(100_000), req.params.seq);
  if (Date.now() > attempt.deadlineAt.getTime() + minutes(5)) throw new HttpError(409, "time_up");
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(422, "empty_chunk");
  const file = await storeBuffer({
    buffer: req.body,
    mime: "video/webm",
    originalName: `${kind.toLowerCase()}-${seq}.webm`,
    tenantId: tenantOf(req).id,
    ownerUserId: userOf(req).id,
    purpose: "PROCTOR_RECORDING",
  });
  await prisma.proctoringChunk.create({ data: { attemptId: attempt.id, kind, seq, fileId: file.id } });
  res.status(204).end();
});

export const submitAttempt = ah(async (req, res) => {
  const attempt = await ownedAttempt(req, req.params.id!);
  if (attempt.submittedAt) throw conflict("attempt_submitted");
  const now = new Date();
  const late = now.getTime() > attempt.deadlineAt.getTime() + GRACE_MS;

  // Internal auto-marking of choice questions; text answers are reviewed by people.
  const answers = (attempt.answers as Record<string, number[] | string> | null) ?? {};
  let earned = 0;
  let possible = 0;
  for (const q of attempt.invite.template.questions) {
    if (q.type === "TEXT") continue;
    possible += q.points;
    const given = answers[q.id];
    if (Array.isArray(given) && given.length === q.correct.length && given.every((g) => q.correct.includes(g))) earned += q.points;
  }

  await prisma.$transaction([
    prisma.assessmentAttempt.update({
      where: { id: attempt.id },
      data: { submittedAt: now, autoScore: possible ? Math.round((100 * earned) / possible) : null },
    }),
    prisma.assessmentInvite.update({ where: { id: attempt.inviteId }, data: { status: "SUBMITTED" } }),
  ]);
  if (late) await internalEvent(attempt.invite.applicationId, "assessment_submitted_late", { attemptId: attempt.id });
  await publishMilestone({
    applicationId: attempt.invite.applicationId,
    type: "assessment_submitted",
    data: { title: attempt.invite.template.title },
  });
  res.json({ ok: true });
});
