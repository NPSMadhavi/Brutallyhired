import { prisma, type Prisma } from "@verity/db";
import { resumeSummarySchema } from "@verity/shared";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { callAiJson } from "../services/ai.service.js";
import { bookRound1SlotAndSchedule, evaluateScreeningAndAutomate } from "../services/automation.service.js";
import { sendTrackedTemplate } from "../services/email.service.js";
import { internalEvent } from "../services/notification.service.js";
import {
  evaluateRound2TechnicalProject,
  generateRound2TechnicalProject,
  type Round2TaskSpec,
  type SubmissionFile,
} from "../services/round2Ai.service.js";
import { ah, notFound } from "../utils/errors.js";
import { tenantOf } from "../utils/request.js";

/**
 * GET /api/t/:tenantSlug/workflow/applications
 * Returns complete recruitment pipeline state for all applications in the tenant
 * (Round 1, Round 2, Round 3, scores, proctoring, and email logs).
 */
export const getWorkflowApplications = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { jobId, stage, search } = req.query as Record<string, string | undefined>;

  const where: Prisma.ApplicationWhereInput = {
    tenantId: tenant.id,
    ...(jobId ? { jobId } : {}),
    ...(stage && stage !== "ALL" ? { stage: stage as any } : {}),
  };

  const apps = await prisma.application.findMany({
    where,
    include: {
      user: { select: { id: true, email: true, displayName: true } },
      job: {
        include: {
          requirements: true,
          questions: true,
        },
      },
      scores: { orderBy: { createdAt: "desc" }, take: 1 },
      assessmentInvites: {
        orderBy: { createdAt: "desc" },
        include: {
          template: { include: { questions: { orderBy: { order: "asc" } } } },
          attempt: {
            include: {
              events: { orderBy: { at: "desc" }, take: 50 },
            },
          },
        },
      },
      technicalProject: true,
      interviewRounds: {
        orderBy: { sequence: "asc" },
        include: {
          panelists: true,
          slots: { orderBy: { startsAt: "asc" } },
        },
      },
      events: { orderBy: { createdAt: "desc" }, take: 25 },
    },
    orderBy: { updatedAt: "desc" },
  });

  const filtered = search
    ? apps.filter((a) => {
        const q = search.toLowerCase();
        return (
          a.user.email.toLowerCase().includes(q) ||
          (a.user.displayName || "").toLowerCase().includes(q) ||
          a.job.title.toLowerCase().includes(q) ||
          a.reference.toLowerCase().includes(q)
        );
      })
    : apps;

  const emailLogs = await prisma.emailLog.findMany({
    where: { tenantId: tenant.id },
    orderBy: { sentAt: "desc" },
    take: 100,
  });

  res.json({
    ok: true,
    applications: filtered,
    emailLogs,
  });
});

/**
 * GET /api/t/:tenantSlug/workflow/emails
 */
export const getWorkflowEmailLogs = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const applicationId = req.query.applicationId as string | undefined;
  const logs = await prisma.emailLog.findMany({
    where: {
      tenantId: tenant.id,
      ...(applicationId ? { applicationId } : {}),
    },
    orderBy: { sentAt: "desc" },
    take: 100,
  });
  res.json({ ok: true, logs });
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUND 1: PROCTORED TECHNICAL ASSESSMENT (STABILIZED & DB-BACKED)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/t/:tenantSlug/workflow/applications/:appId/round1/configure
 * HR configures Round 1 assessment questions, slot timing, and sends invite email.
 */
export const configureRound1 = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { appId } = req.params;
  const {
    title = "Round 1: Technical Assessment",
    description = "Timed proctored technical assessment.",
    durationMinutes = 45,
    questions = [],
    scheduledSlotStart,
    scheduledSlotEnd,
    dueAt,
    sendEmail = true,
  } = req.body || {};

  const app = await prisma.application.findFirst({
    where: { id: appId, tenantId: tenant.id },
    include: { user: true, job: true },
  });
  if (!app) throw notFound("application");

  const template = await prisma.assessmentTemplate.create({
    data: {
      tenantId: tenant.id,
      title: String(title),
      description: String(description),
      durationMinutes: Number(durationMinutes) || 45,
      proctored: true,
      topics: [app.job.title],
      questions: {
        create: (Array.isArray(questions) ? questions : []).map((q: any, idx: number) => ({
          order: idx + 1,
          type: q.type === "TEXT" ? "TEXT" : q.type === "MULTI_CHOICE" ? "MULTI_CHOICE" : "SINGLE_CHOICE",
          prompt: String(q.prompt || `Question ${idx + 1}`),
          options: Array.isArray(q.options) ? q.options.map(String) : ["Option A", "Option B", "Option C", "Option D"],
          correct: Array.isArray(q.correct)
            ? q.correct.map(Number)
            : [typeof q.correctOptionIndex === "number" ? q.correctOptionIndex : 0],
          points: Number(q.points) || 20,
        })),
      },
    },
    include: { questions: { orderBy: { order: "asc" } } },
  });

  const due = dueAt ? new Date(dueAt) : new Date(Date.now() + 48 * 3600 * 1000);
  const invite = await prisma.assessmentInvite.create({
    data: {
      applicationId: app.id,
      templateId: template.id,
      roundNumber: 1,
      dueAt: due,
      scheduledSlotStart: scheduledSlotStart ? new Date(scheduledSlotStart) : null,
      scheduledSlotEnd: scheduledSlotEnd ? new Date(scheduledSlotEnd) : null,
      status: "INVITED",
      hrReviewStatus: "PENDING",
    },
    include: { template: { include: { questions: true } } },
  });

  await prisma.application.update({
    where: { id: app.id },
    data: { stage: "ASSESSMENT" },
  });

  const assessPath = `/${tenant.slug}/applications/${app.id}/assessments/${invite.id}`;
  let emailResult: any = null;

  if (sendEmail) {
    emailResult = await sendTrackedTemplate({
      tenantId: tenant.id,
      applicationId: app.id,
      to: app.user.email,
      template: "assessment_invited",
      tenant,
      vars: {
        jobTitle: app.job.title,
        assessmentTitle: template.title,
        dueAt: due.toLocaleString(),
        durationMinutes: template.durationMinutes,
      },
      path: assessPath,
      dedupKey: `r1-invite-${invite.id}`,
    });

    await prisma.assessmentInvite.update({
      where: { id: invite.id },
      data: { emailSentAt: new Date() },
    });
  }

  await internalEvent(app.id, "assessment_invited", {
    inviteId: invite.id,
    title: template.title,
    dueAt: due.toISOString(),
  }, app.userId);

  res.status(201).json({
    ok: true,
    invite,
    assessUrl: `${env.WEB_ORIGIN}${assessPath}`,
    emailResult,
  });
});

/**
 * GET /api/t/:tenantSlug/workflow/applications/:appId/round1
 */
export const getRound1State = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { appId } = req.params;
  const isAdminView = req.query.view === "admin";

  const invite = await prisma.assessmentInvite.findFirst({
    where: { applicationId: appId, application: { tenantId: tenant.id }, roundNumber: 1 },
    orderBy: { createdAt: "desc" },
    include: {
      template: { include: { questions: { orderBy: { order: "asc" } } } },
      attempt: {
        include: {
          events: { orderBy: { at: "desc" } },
        },
      },
    },
  });

  if (!invite) {
    return res.json({ ok: true, invite: null });
  }

  const sanitizedQuestions = invite.template.questions.map((q) => ({
    id: q.id,
    order: q.order,
    type: q.type,
    prompt: q.prompt,
    options: q.options,
    points: q.points,
    ...(isAdminView ? { correct: q.correct } : {}),
  }));

  res.json({
    ok: true,
    invite: {
      ...invite,
      template: {
        ...invite.template,
        questions: sanitizedQuestions,
      },
    },
  });
});

/**
 * POST /api/t/:tenantSlug/workflow/applications/:appId/round1/submit
 * Grades Round 1 responses accurately against stored correct answers & saves proctoring logs.
 */
export const submitRound1 = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { appId } = req.params;
  const { answers = {}, proctoringReports = [], disqualified = false, questionsSnapshot = [] } = req.body || {};

  const app = await prisma.application.findFirst({
    where: { id: appId, tenantId: tenant.id },
    include: { user: true, job: true },
  });
  if (!app) throw notFound("application");

  let invite = await prisma.assessmentInvite.findFirst({
    where: { applicationId: app.id, roundNumber: 1 },
    orderBy: { createdAt: "desc" },
    include: { template: { include: { questions: { orderBy: { order: "asc" } } } }, attempt: true },
  });

  // Ensure DB invite + template exists even if candidate started from a local/fallback studio config
  if (!invite) {
    const fallbackQuestions = Array.isArray(questionsSnapshot) ? questionsSnapshot : [];
    const template = await prisma.assessmentTemplate.create({
      data: {
        tenantId: tenant.id,
        title: `Round 1: ${app.job.title} Technical Assessment`,
        description: "Proctored technical assessment.",
        durationMinutes: 45,
        proctored: true,
        topics: [app.job.title],
        questions: {
          create: fallbackQuestions.map((q: any, idx: number) => ({
            order: idx + 1,
            type: q.type === "TEXT" ? "TEXT" : "SINGLE_CHOICE",
            prompt: String(q.prompt || `Question ${idx + 1}`),
            options: Array.isArray(q.options) ? q.options.map(String) : [],
            correct: Array.isArray(q.correct)
              ? q.correct.map(Number)
              : [typeof q.correctOptionIndex === "number" ? q.correctOptionIndex : 0],
            points: Number(q.points) || 20,
          })),
        },
      },
      include: { questions: true },
    });

    invite = await prisma.assessmentInvite.create({
      data: {
        applicationId: app.id,
        templateId: template.id,
        roundNumber: 1,
        dueAt: new Date(Date.now() + 24 * 3600 * 1000),
        status: "IN_PROGRESS",
      },
      include: { template: { include: { questions: { orderBy: { order: "asc" } } } }, attempt: true },
    });
  }

  // Grade responses accurately
  const dbQuestions = invite.template.questions;
  let totalPoints = 0;
  let earnedPoints = 0;

  for (let idx = 0; idx < dbQuestions.length; idx++) {
    const q = dbQuestions[idx]!;
    const pts = q.points || 1;
    totalPoints += pts;
    const snapQ = Array.isArray(questionsSnapshot) ? questionsSnapshot[idx] : undefined;
    const ans = answers[q.id] ?? (snapQ?.id ? answers[snapQ.id] : undefined);

    if (q.type === "TEXT") {
      if (typeof ans === "string" && ans.trim().length >= 20) {
        earnedPoints += pts;
      }
    } else if (Array.isArray(ans)) {
      const sortedAns = [...ans].map(Number).sort().join(",");
      const sortedCorrect = [...q.correct].map(Number).sort().join(",");
      if (sortedAns.length > 0 && sortedAns === sortedCorrect) {
        earnedPoints += pts;
      }
    }
  }

  const autoScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

  // Generate AI Evaluation Report for Round 1 (proctoring alerts are reviewable evidence, never auto-rejection)
  const proctoringCount = Array.isArray(proctoringReports) ? proctoringReports.length : 0;
  let round1Report: any = {
    score: autoScore,
    earnedPoints,
    totalPoints,
    summary: `Candidate scored ${autoScore}/100 (${earnedPoints}/${totalPoints} pts) on Round 1 Technical Assessment. ${proctoringCount} proctoring event(s) logged for HR review.`,
    strengths: autoScore >= 70 ? ["Demonstrated solid foundational technical knowledge"] : [],
    weaknesses: autoScore < 70 ? ["Missed key technical assessment questions"] : [],
    proctoringEvidenceCount: proctoringCount,
    recommendation: autoScore >= 70 ? "APPROVE_FOR_ROUND2" : "HR_REVIEW_REQUIRED",
    evaluatedAt: new Date().toISOString(),
    evaluatedModel: "auto-grader",
  };

  try {
    const qaLines = dbQuestions.map((q, idx) => {
      const snapQ = Array.isArray(questionsSnapshot) ? questionsSnapshot[idx] : undefined;
      const ans = answers[q.id] ?? (snapQ?.id ? answers[snapQ.id] : undefined);
      const ansText = Array.isArray(ans) ? ans.map((i: number) => q.options[i] ?? i).join(", ") : String(ans || "No answer");
      return `${idx + 1}. ${q.prompt}\n   Candidate Answer: ${ansText}`;
    }).join("\n");

    const aiR1 = await callAiJson<any>({
      message: `Evaluate this candidate's Round 1 Technical Assessment.\nRole: ${app.job.title}\nScore: ${autoScore}/100\nProctoring Events Logged (reviewable evidence): ${proctoringCount}\n\nQuestions & Answers:\n${qaLines}\n\nReturn JSON: { "summary": "2-3 sentence assessment", "strengths": ["..."], "weaknesses": ["..."], "recommendation": "APPROVE_FOR_ROUND2" | "REJECT" | "HR_REVIEW_REQUIRED" }`,
      systemPrompt: "You are a Technical Hiring Evaluator. Output ONLY valid JSON.",
      temperature: 0.1,
      timeoutMs: 20_000,
    });
    if (aiR1 && aiR1.summary) {
      round1Report = {
        ...round1Report,
        summary: String(aiR1.summary),
        strengths: Array.isArray(aiR1.strengths) ? aiR1.strengths.map(String) : round1Report.strengths,
        weaknesses: Array.isArray(aiR1.weaknesses) ? aiR1.weaknesses.map(String) : round1Report.weaknesses,
        recommendation: String(aiR1.recommendation || round1Report.recommendation),
        evaluatedModel: env.AI_MODEL || "qwen3.5:9b",
      };
    }
  } catch {}

  const now = new Date();
  let attemptId = invite.attempt?.id;

  if (attemptId) {
    await prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: {
        answers: answers as Prisma.InputJsonValue,
        autoScore,
        round1Report: round1Report as Prisma.InputJsonValue,
        submittedAt: now,
      },
    });
  } else {
    const createdAttempt = await prisma.assessmentAttempt.create({
      data: {
        inviteId: invite.id,
        startedAt: now,
        deadlineAt: new Date(now.getTime() + invite.template.durationMinutes * 60_000),
        submittedAt: now,
        answers: answers as Prisma.InputJsonValue,
        autoScore,
        round1Report: round1Report as Prisma.InputJsonValue,
      },
    });
    attemptId = createdAttempt.id;
  }

  // Persist proctoring events to PostgreSQL as reviewable evidence
  if (Array.isArray(proctoringReports) && proctoringReports.length > 0 && attemptId) {
    await prisma.proctoringEvent.createMany({
      data: proctoringReports.map((rep: any) => ({
        attemptId: attemptId!,
        type: String(rep.eventType || "VIOLATION"),
        at: new Date(),
        detail: rep as Prisma.InputJsonValue,
      })),
    });
  }

  await prisma.assessmentInvite.update({
    where: { id: invite.id },
    data: { status: "SUBMITTED" },
  });

  // Always transition to ROUND1_PENDING_HR_APPROVAL; AI must wait for HR decision
  await prisma.application.update({
    where: { id: app.id },
    data: { stage: "ROUND1_PENDING_HR_APPROVAL" },
  });

  await internalEvent(app.id, "assessment_submitted", {
    inviteId: invite.id,
    attemptId,
    autoScore,
    proctoringCount,
    disqualified: Boolean(disqualified),
  }, app.userId);

  res.json({
    ok: true,
    inviteId: invite.id,
    attemptId,
    autoScore,
    earnedPoints,
    totalPoints,
    round1Report,
    stage: "ROUND1_PENDING_HR_APPROVAL",
  });
});

/**
 * POST /api/t/:tenantSlug/workflow/applications/:appId/round1/review
 * HR approves or rejects Round 1.
 * On APPROVED: Automatically generates personalized Round 2 Technical Project via local LLM!
 */
export const reviewRound1 = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { appId } = req.params;
  const {
    decision,
    comments = "",
    reviewedBy = "HR Admin",
    difficulty = "MEDIUM",
    durationMinutes = 90,
  } = req.body || {};

  if (decision !== "APPROVED" && decision !== "REJECTED") {
    return res.status(400).json({ error: "decision must be APPROVED or REJECTED" });
  }

  const app = await prisma.application.findFirst({
    where: { id: appId, tenantId: tenant.id },
    include: {
      user: true,
      job: { include: { requirements: true } },
    },
  });
  if (!app) throw notFound("application");

  const invite = await prisma.assessmentInvite.findFirst({
    where: { applicationId: app.id, roundNumber: 1 },
    orderBy: { createdAt: "desc" },
  });

  if (invite) {
    await prisma.assessmentInvite.update({
      where: { id: invite.id },
      data: {
        hrReviewStatus: decision,
        hrComments: String(comments),
        hrReviewedBy: String(reviewedBy),
        hrReviewedAt: new Date(),
      },
    });
  }

  if (decision === "REJECTED") {
    await prisma.application.update({
      where: { id: app.id },
      data: { stage: "REJECTED", closedAt: new Date() },
    });

    await sendTrackedTemplate({
      tenantId: tenant.id,
      applicationId: app.id,
      to: app.user.email,
      template: "application_closed",
      tenant,
      vars: { jobTitle: app.job.title },
      path: `/${tenant.slug}/applications/${app.id}`,
      dedupKey: `r1-reject-${app.id}`,
    });

    await internalEvent(app.id, "application_closed", { round: 1, comments }, app.userId);
    return res.json({ ok: true, decision, round2Project: null });
  }

  // APPROVED -> Auto-generate Round 2 AI Technical Project, auto-schedule & send invitation email!
  const summaryParsed = resumeSummarySchema.safeParse(app.resumeSummary ?? {});
  const requiredSkills = app.job.requirements.filter((r) => r.kind === "HARD").map((r) => r.label);
  const preferredSkills = app.job.requirements.filter((r) => r.kind === "PREFERRED").map((r) => r.label);

  const taskSpec = await generateRound2TechnicalProject({
    jobTitle: app.job.title,
    jobDescription: app.job.summary,
    requiredSkills,
    preferredSkills,
    responsibilities: app.job.summary,
    candidateName: app.user.displayName || app.user.email,
    resumeText: app.resumeText,
    resumeSummary: summaryParsed.success ? summaryParsed.data : null,
    difficulty,
    durationMinutes: Number(durationMinutes) || 90,
  });

  const slotStart = new Date();
  const slotEnd = new Date(slotStart.getTime() + taskSpec.durationMinutes * 60_000);
  const dueAt = new Date(slotStart.getTime() + 48 * 3600 * 1000);

  const round2Project = await prisma.technicalProjectAssessment.upsert({
    where: { applicationId: app.id },
    update: {
      taskSpec: taskSpec as unknown as Prisma.InputJsonValue,
      durationMinutes: taskSpec.durationMinutes,
      totalMarks: taskSpec.totalMarks,
      status: "INVITED",
      hrTaskApproved: true,
      hrTaskReviewedBy: String(reviewedBy),
      hrTaskReviewedAt: new Date(),
      scheduledSlotStart: slotStart,
      scheduledSlotEnd: slotEnd,
      dueAt,
      inviteSentAt: new Date(),
    },
    create: {
      applicationId: app.id,
      tenantId: tenant.id,
      jobId: app.jobId,
      status: "INVITED",
      taskSpec: taskSpec as unknown as Prisma.InputJsonValue,
      durationMinutes: taskSpec.durationMinutes,
      totalMarks: taskSpec.totalMarks,
      hrTaskApproved: true,
      hrTaskReviewedBy: String(reviewedBy),
      hrTaskReviewedAt: new Date(),
      scheduledSlotStart: slotStart,
      scheduledSlotEnd: slotEnd,
      dueAt,
      inviteSentAt: new Date(),
    },
  });

  await prisma.application.update({
    where: { id: app.id },
    data: { stage: "ASSESSMENT" },
  });

  const round2Path = `/${tenant.slug}/applications/${app.id}/assessments/round-2`;
  const slotWindow = `${slotStart.toLocaleString()} – ${dueAt.toLocaleString()}`;
  const emailResult = await sendTrackedTemplate({
    tenantId: tenant.id,
    applicationId: app.id,
    to: app.user.email,
    template: "round2_invited",
    tenant,
    vars: {
      jobTitle: app.job.title,
      projectTitle: taskSpec.title,
      slotWindow,
      durationMinutes: taskSpec.durationMinutes,
    },
    path: round2Path,
    dedupKey: `r2-auto-invite-${round2Project.id}`,
  });

  await internalEvent(app.id, "round2_invited", {
    round: 2,
    projectId: round2Project.id,
    title: taskSpec.title,
    slotWindow,
  }, app.userId);

  res.json({
    ok: true,
    decision,
    round2Project,
    emailResult,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUND 2: AI-GENERATED TECHNICAL PROJECT & EVALUATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/t/:tenantSlug/workflow/applications/:appId/round2/generate
 * HR generates or regenerates the AI-personalized Round 2 technical project.
 */
export const generateRound2Project = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { appId } = req.params;
  const { difficulty = "MEDIUM", durationMinutes = 90 } = req.body || {};

  const app = await prisma.application.findFirst({
    where: { id: appId, tenantId: tenant.id },
    include: { user: true, job: { include: { requirements: true } } },
  });
  if (!app) throw notFound("application");

  const summaryParsed = resumeSummarySchema.safeParse(app.resumeSummary ?? {});
  const requiredSkills = app.job.requirements.filter((r) => r.kind === "HARD").map((r) => r.label);
  const preferredSkills = app.job.requirements.filter((r) => r.kind === "PREFERRED").map((r) => r.label);

  const taskSpec = await generateRound2TechnicalProject({
    jobTitle: app.job.title,
    jobDescription: app.job.summary,
    requiredSkills,
    preferredSkills,
    responsibilities: app.job.summary,
    candidateName: app.user.displayName || app.user.email,
    resumeText: app.resumeText,
    resumeSummary: summaryParsed.success ? summaryParsed.data : null,
    difficulty,
    durationMinutes: Number(durationMinutes) || 90,
  });

  const project = await prisma.technicalProjectAssessment.upsert({
    where: { applicationId: app.id },
    update: {
      taskSpec: taskSpec as unknown as Prisma.InputJsonValue,
      durationMinutes: taskSpec.durationMinutes,
      totalMarks: taskSpec.totalMarks,
      status: "GENERATED",
      hrTaskApproved: false,
    },
    create: {
      applicationId: app.id,
      tenantId: tenant.id,
      jobId: app.jobId,
      status: "GENERATED",
      taskSpec: taskSpec as unknown as Prisma.InputJsonValue,
      durationMinutes: taskSpec.durationMinutes,
      totalMarks: taskSpec.totalMarks,
    },
  });

  res.json({ ok: true, project });
});

/**
 * PUT /api/t/:tenantSlug/workflow/applications/:appId/round2/task
 * HR previews, edits, and approves the Round 2 task specification.
 */
export const updateAndApproveRound2Task = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { appId } = req.params;
  const { taskSpec, durationMinutes, dueAt, approveTask = true, reviewedBy = "HR Admin" } = req.body || {};

  const existing = await prisma.technicalProjectAssessment.findFirst({
    where: { applicationId: appId, tenantId: tenant.id },
  });
  if (!existing) throw notFound("round2_project");

  const updated = await prisma.technicalProjectAssessment.update({
    where: { id: existing.id },
    data: {
      ...(taskSpec ? { taskSpec: taskSpec as Prisma.InputJsonValue } : {}),
      ...(durationMinutes ? { durationMinutes: Number(durationMinutes) } : {}),
      ...(dueAt ? { dueAt: new Date(dueAt) } : {}),
      ...(approveTask
        ? {
            hrTaskApproved: true,
            hrTaskReviewedBy: String(reviewedBy),
            hrTaskReviewedAt: new Date(),
            status: existing.status === "GENERATED" ? "HR_APPROVED" : existing.status,
          }
        : {}),
    },
  });

  res.json({ ok: true, project: updated });
});

/**
 * POST /api/t/:tenantSlug/workflow/applications/:appId/round2/schedule
 * HR schedules Round 2 slot & automatically dispatches invitation email.
 */
export const scheduleRound2 = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { appId } = req.params;
  const { scheduledSlotStart, scheduledSlotEnd, dueAt, durationMinutes } = req.body || {};

  const app = await prisma.application.findFirst({
    where: { id: appId, tenantId: tenant.id },
    include: { user: true, job: true, technicalProject: true },
  });
  if (!app || !app.technicalProject) throw notFound("round2_project");

  const start = scheduledSlotStart ? new Date(scheduledSlotStart) : new Date();
  const dur = Number(durationMinutes) || app.technicalProject.durationMinutes || 90;
  const end = scheduledSlotEnd ? new Date(scheduledSlotEnd) : new Date(start.getTime() + dur * 60_000);
  const deadline = dueAt ? new Date(dueAt) : new Date(end.getTime() + 24 * 3600 * 1000);

  const updated = await prisma.technicalProjectAssessment.update({
    where: { id: app.technicalProject.id },
    data: {
      hrTaskApproved: true,
      scheduledSlotStart: start,
      scheduledSlotEnd: end,
      dueAt: deadline,
      durationMinutes: dur,
      status: "INVITED",
      inviteSentAt: new Date(),
    },
  });

  const taskTitle = (updated.taskSpec as any)?.title || `${app.job.title} Technical Project`;
  const round2Path = `/${tenant.slug}/applications/${app.id}/assessments/round-2`;
  const slotWindow = `${start.toLocaleString()} – ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  const emailResult = await sendTrackedTemplate({
    tenantId: tenant.id,
    applicationId: app.id,
    to: app.user.email,
    template: "round2_invited",
    tenant,
    vars: {
      jobTitle: app.job.title,
      projectTitle: taskTitle,
      slotWindow,
      durationMinutes: dur,
    },
    path: round2Path,
    dedupKey: `r2-invite-${updated.id}-${start.toISOString()}`,
  });

  await internalEvent(app.id, "round2_invited", {
    projectId: updated.id,
    title: taskTitle,
    slotWindow,
    dueAt: deadline.toISOString(),
  }, app.userId);

  res.json({ ok: true, project: updated, emailResult, portalUrl: `${env.WEB_ORIGIN}${round2Path}` });
});

/**
 * GET /api/t/:tenantSlug/workflow/applications/:appId/round2
 */
export const getRound2State = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { appId } = req.params;

  const project = await prisma.technicalProjectAssessment.findFirst({
    where: { applicationId: appId, tenantId: tenant.id },
    include: {
      application: {
        include: {
          user: { select: { id: true, email: true, displayName: true } },
          job: { select: { id: true, title: true, department: true, location: true } },
        },
      },
    },
  });

  res.json({ ok: true, project });
});

/**
 * POST /api/t/:tenantSlug/workflow/applications/:appId/round2/start
 * Candidate starts Round 2 timed technical project.
 */
export const startRound2 = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { appId } = req.params;

  const project = await prisma.technicalProjectAssessment.findFirst({
    where: { applicationId: appId, tenantId: tenant.id },
  });
  if (!project) throw notFound("round2_project");

  if (project.submittedAt) {
    return res.status(409).json({ error: "Round 2 project has already been submitted." });
  }

  const updated = await prisma.technicalProjectAssessment.update({
    where: { id: project.id },
    data: {
      status: "IN_PROGRESS",
      startedAt: project.startedAt || new Date(),
    },
  });

  res.json({ ok: true, project: updated });
});

/**
 * POST /api/t/:tenantSlug/workflow/applications/:appId/round2/submit
 * Candidate submits source files, architecture notes & deliverables.
 * Automatically runs static validation + AI rubric evaluation & sets AI_EVALUATION_COMPLETED.
 */
export const submitRound2 = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { appId } = req.params;
  const {
    submissionFiles = [],
    architectureNotes = "",
    repoUrl = "",
    proctoringReports = [],
    disqualified = false,
  } = req.body || {};

  const app = await prisma.application.findFirst({
    where: { id: appId, tenantId: tenant.id },
    include: { user: true, job: true, technicalProject: true },
  });
  if (!app || !app.technicalProject) throw notFound("round2_project");

  const project = app.technicalProject;
  const taskSpec = project.taskSpec as unknown as Round2TaskSpec;
  const files: SubmissionFile[] = Array.isArray(submissionFiles) ? submissionFiles : [];

  await prisma.technicalProjectAssessment.update({
    where: { id: project.id },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      submissionFiles: files as unknown as Prisma.InputJsonValue,
      architectureNotes: String(architectureNotes),
      repoUrl: repoUrl ? String(repoUrl) : null,
      submissionMeta: {
        proctoringReports,
        disqualified: Boolean(disqualified),
        violationCount: Array.isArray(proctoringReports) ? proctoringReports.length : 0,
      } as Prisma.InputJsonValue,
    },
  });

  const summaryParsed = resumeSummarySchema.safeParse(app.resumeSummary ?? {});
  const aiReport = await evaluateRound2TechnicalProject({
    jobTitle: app.job.title,
    taskSpec,
    submissionFiles: files,
    architectureNotes: String(architectureNotes),
    repoUrl,
    candidateSkills: summaryParsed.success ? summaryParsed.data.skills : [],
  });

  const completed = await prisma.technicalProjectAssessment.update({
    where: { id: project.id },
    data: {
      status: "AI_EVALUATION_COMPLETED",
      aiReport: aiReport as unknown as Prisma.InputJsonValue,
      evaluatedAt: new Date(),
      evaluatedModel: aiReport.evaluatedModel,
    },
  });

  await prisma.application.update({
    where: { id: app.id },
    data: { stage: "ROUND2_PENDING_HR_APPROVAL" },
  });

  await internalEvent(app.id, "round2_submitted", {
    projectId: completed.id,
    overallScore: aiReport.overallScore,
    recommendation: aiReport.recommendation,
  }, app.userId);

  res.json({
    ok: true,
    project: completed,
    aiReport,
    stage: "ROUND2_PENDING_HR_APPROVAL",
  });
});

/**
 * POST /api/t/:tenantSlug/workflow/applications/:appId/round2/decision
 * HR makes the final Round 2 decision (APPROVED / REJECTED / FURTHER_REVIEW).
 * Triggers automated email (no duplicates) & unlocks Round 3 on approval.
 */
export const decideRound2 = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { appId } = req.params;
  const { decision, comments = "", decidedBy = "HR Admin" } = req.body || {};

  if (!["APPROVED", "REJECTED", "FURTHER_REVIEW"].includes(decision)) {
    return res.status(400).json({ error: "decision must be APPROVED, REJECTED, or FURTHER_REVIEW" });
  }

  const app = await prisma.application.findFirst({
    where: { id: appId, tenantId: tenant.id },
    include: { user: true, job: true, technicalProject: true },
  });
  if (!app || !app.technicalProject) throw notFound("round2_project");

  const nextStatus =
    decision === "APPROVED"
      ? "PASSED"
      : decision === "REJECTED"
      ? "REJECTED"
      : "REVISION_REQUESTED";

  const updated = await prisma.technicalProjectAssessment.update({
    where: { id: app.technicalProject.id },
    data: {
      status: nextStatus,
      hrDecision: decision,
      hrDecisionComments: String(comments),
      hrDecisionBy: String(decidedBy),
      hrDecisionAt: new Date(),
    },
  });

  let emailResult: any = null;
  let round3Interview: any = null;

  if (decision === "APPROVED") {
    // Unlock Round 3 HR Interview
    const existingR3 = await prisma.interviewRound.findFirst({
      where: { applicationId: app.id, sequence: 3 },
    });

    if (!existingR3) {
      round3Interview = await prisma.interviewRound.create({
        data: {
          applicationId: app.id,
          sequence: 3,
          title: "Round 3: Final HR & Leadership Interview",
          description: "Final proctored HR interview covering leadership, role alignment, and offer readiness.",
          durationMinutes: 45,
          status: "AWAITING_BOOKING",
          roomName: `bh-r3-${app.id.slice(-8)}-${crypto.randomBytes(3).toString("hex")}`,
          hrDecision: "PENDING",
          panelists: {
            create: [
              { name: "Tanuja HR", title: "Head of Talent & People" },
            ],
          },
        },
        include: { panelists: true, slots: true },
      });
    } else {
      round3Interview = existingR3;
    }

    await prisma.application.update({
      where: { id: app.id },
      data: { stage: "INTERVIEW" },
    });

    emailResult = await sendTrackedTemplate({
      tenantId: tenant.id,
      applicationId: app.id,
      to: app.user.email,
      template: "round2_passed",
      tenant,
      vars: { jobTitle: app.job.title },
      path: `/${tenant.slug}/applications/${app.id}/interviews`,
      dedupKey: `r2-pass-${updated.id}`,
    });

    await prisma.technicalProjectAssessment.update({
      where: { id: updated.id },
      data: { decisionEmailSentAt: new Date() },
    });

    await internalEvent(app.id, "round2_passed", { projectId: updated.id }, app.userId);
  } else if (decision === "REJECTED") {
    await prisma.application.update({
      where: { id: app.id },
      data: { stage: "REJECTED", closedAt: new Date() },
    });

    emailResult = await sendTrackedTemplate({
      tenantId: tenant.id,
      applicationId: app.id,
      to: app.user.email,
      template: "round2_rejected",
      tenant,
      vars: { jobTitle: app.job.title },
      path: `/${tenant.slug}/applications/${app.id}`,
      dedupKey: `r2-reject-${updated.id}`,
    });

    await prisma.technicalProjectAssessment.update({
      where: { id: updated.id },
      data: { decisionEmailSentAt: new Date() },
    });

    await internalEvent(app.id, "application_closed", { round: 2, comments }, app.userId);
  }

  res.json({
    ok: true,
    project: updated,
    round3Interview,
    emailResult,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUND 3: HR INTERVIEW WITH PROCTORING & FINAL HIRING DECISION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/t/:tenantSlug/workflow/applications/:appId/round3/schedule
 * HR schedules Round 3 interview slot(s) and automatically sends invitation email.
 */
export const scheduleRound3 = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { appId } = req.params;
  const {
    scheduledStart,
    scheduledEnd,
    durationMinutes = 45,
    panelistName = "Tanuja HR",
    panelistTitle = "Head of Talent & People",
  } = req.body || {};

  const app = await prisma.application.findFirst({
    where: { id: appId, tenantId: tenant.id },
    include: { user: true, job: true },
  });
  if (!app) throw notFound("application");

  const start = scheduledStart ? new Date(scheduledStart) : new Date(Date.now() + 24 * 3600 * 1000);
  const dur = Number(durationMinutes) || 45;
  const end = scheduledEnd ? new Date(scheduledEnd) : new Date(start.getTime() + dur * 60_000);

  let round = await prisma.interviewRound.findFirst({
    where: { applicationId: app.id, sequence: 3 },
    include: { panelists: true, slots: true },
  });

  if (round) {
    round = await prisma.interviewRound.update({
      where: { id: round.id },
      data: {
        status: "SCHEDULED",
        scheduledStart: start,
        scheduledEnd: end,
        durationMinutes: dur,
      },
      include: { panelists: true, slots: true },
    });
  } else {
    round = await prisma.interviewRound.create({
      data: {
        applicationId: app.id,
        sequence: 3,
        title: "Round 3: Final HR & Leadership Interview",
        description: "Final proctored HR interview covering leadership, role alignment, and offer readiness.",
        durationMinutes: dur,
        status: "SCHEDULED",
        scheduledStart: start,
        scheduledEnd: end,
        roomName: `bh-r3-${app.id.slice(-8)}-${crypto.randomBytes(3).toString("hex")}`,
        hrDecision: "PENDING",
        panelists: {
          create: [{ name: String(panelistName), title: String(panelistTitle) }],
        },
        slots: {
          create: [{ startsAt: start, endsAt: end, bookedAt: new Date() }],
        },
      },
      include: { panelists: true, slots: true },
    });
  }

  await prisma.application.update({
    where: { id: app.id },
    data: { stage: "INTERVIEW" },
  });

  const round3Path = `/${tenant.slug}/applications/${app.id}/interviews/round-3`;
  const slotWindow = `${start.toLocaleString()} – ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  const emailResult = await sendTrackedTemplate({
    tenantId: tenant.id,
    applicationId: app.id,
    to: app.user.email,
    template: "round3_invited",
    tenant,
    vars: {
      jobTitle: app.job.title,
      slotWindow,
    },
    path: round3Path,
    dedupKey: `r3-invite-${round.id}-${start.toISOString()}`,
  });

  await internalEvent(app.id, "interview_booked", {
    roundId: round.id,
    roundTitle: round.title,
    startsAt: start.toISOString(),
  }, app.userId);

  res.json({ ok: true, round, emailResult, portalUrl: `${env.WEB_ORIGIN}${round3Path}` });
});

/**
 * POST /api/t/:tenantSlug/workflow/applications/:appId/round3/attendance
 * Records candidate attendance timestamps & proctoring monitoring telemetry for Round 3.
 */
export const recordRound3Attendance = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { appId } = req.params;
  const { action = "JOIN", proctoringSummary } = req.body || {};

  const round = await prisma.interviewRound.findFirst({
    where: { applicationId: appId, sequence: 3, application: { tenantId: tenant.id } },
  });
  if (!round) throw notFound("round3_interview");

  const updated = await prisma.interviewRound.update({
    where: { id: round.id },
    data: {
      ...(action === "JOIN" && !round.attendanceJoinedAt ? { attendanceJoinedAt: new Date() } : {}),
      ...(action === "LEAVE" ? { attendanceLeftAt: new Date() } : {}),
      ...(proctoringSummary ? { proctoringSummary: proctoringSummary as Prisma.InputJsonValue } : {}),
    },
  });

  res.json({ ok: true, round: updated });
});

/**
 * POST /api/t/:tenantSlug/workflow/applications/:appId/round3/feedback
 * HR records Round 3 interview feedback, score, and comments -> sets stage to ROUND3_PENDING_FINAL_HR_APPROVAL.
 */
export const saveRound3Feedback = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { appId } = req.params;
  const { feedback = "", score = 85, recommendation = "HIRE" } = req.body || {};

  const app = await prisma.application.findFirst({
    where: { id: appId, tenantId: tenant.id },
  });
  if (!app) throw notFound("application");

  let round = await prisma.interviewRound.findFirst({
    where: { applicationId: app.id, sequence: 3 },
  });
  if (!round) {
    round = await prisma.interviewRound.create({
      data: {
        applicationId: app.id,
        sequence: 3,
        title: "Round 3: Final HR & Leadership Interview",
        durationMinutes: 45,
        status: "COMPLETED",
        roomName: `bh-r3-${app.id.slice(-8)}-${crypto.randomBytes(3).toString("hex")}`,
      },
    });
  }

  const updatedRound = await prisma.interviewRound.update({
    where: { id: round.id },
    data: {
      status: "COMPLETED",
      hrFeedback: String(feedback),
      hrScore: Number(score) || 0,
      hrRecommendation: String(recommendation),
      hrDecision: "PENDING",
    },
  });

  await prisma.application.update({
    where: { id: app.id },
    data: { stage: "ROUND3_PENDING_FINAL_HR_APPROVAL" },
  });

  res.json({ ok: true, round: updatedRound, stage: "ROUND3_PENDING_FINAL_HR_APPROVAL" });
});

/**
 * POST /api/t/:tenantSlug/workflow/applications/:appId/round3/decision
 * HR records Round 3 interview feedback, score, and final selection decision (HIRED / REJECTED).
 */
export const decideRound3 = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { appId } = req.params;
  const {
    feedback = "",
    score = 85,
    recommendation = "HIRE",
    decision,
    decidedBy = "HR Admin",
  } = req.body || {};

  if (decision !== "HIRED" && decision !== "REJECTED") {
    return res.status(400).json({ error: "decision must be HIRED or REJECTED" });
  }

  const app = await prisma.application.findFirst({
    where: { id: appId, tenantId: tenant.id },
    include: { user: true, job: true },
  });
  if (!app) throw notFound("application");

  let round = await prisma.interviewRound.findFirst({
    where: { applicationId: app.id, sequence: 3 },
  });

  if (!round) {
    round = await prisma.interviewRound.create({
      data: {
        applicationId: app.id,
        sequence: 3,
        title: "Round 3: Final HR & Leadership Interview",
        durationMinutes: 45,
        status: "COMPLETED",
        roomName: `bh-r3-${app.id.slice(-8)}-${crypto.randomBytes(3).toString("hex")}`,
      },
    });
  }

  const updatedRound = await prisma.interviewRound.update({
    where: { id: round.id },
    data: {
      status: "COMPLETED",
      hrFeedback: String(feedback),
      hrScore: Number(score) || 0,
      hrRecommendation: String(recommendation),
      hrDecision: decision,
      hrDecidedBy: String(decidedBy),
      hrDecidedAt: new Date(),
      decisionEmailSentAt: new Date(),
    },
  });

  if (decision === "HIRED") {
    await prisma.application.update({
      where: { id: app.id },
      data: { stage: "HIRED" },
    });

    const emailResult = await sendTrackedTemplate({
      tenantId: tenant.id,
      applicationId: app.id,
      to: app.user.email,
      template: "hired",
      tenant,
      vars: { jobTitle: app.job.title },
      path: `/${tenant.slug}/applications/${app.id}`,
      dedupKey: `r3-hire-${updatedRound.id}`,
    });

    await internalEvent(app.id, "hired", { roundId: updatedRound.id, score, feedback }, app.userId);
    return res.json({ ok: true, round: updatedRound, decision, emailResult });
  }

  await prisma.application.update({
    where: { id: app.id },
    data: { stage: "REJECTED", closedAt: new Date() },
  });

  const emailResult = await sendTrackedTemplate({
    tenantId: tenant.id,
    applicationId: app.id,
    to: app.user.email,
    template: "application_closed",
    tenant,
    vars: { jobTitle: app.job.title },
    path: `/${tenant.slug}/applications/${app.id}`,
    dedupKey: `r3-reject-${updatedRound.id}`,
  });

  await internalEvent(app.id, "application_closed", { round: 3, feedback }, app.userId);
  return res.json({ ok: true, round: updatedRound, decision, emailResult });
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTOMATED SCREENING EVALUATION & ROUND 1 SLOT BOOKING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/t/:tenantSlug/workflow/applications/:appId/screening/submit
 * AI evaluates screening answers -> SHORTLISTED (+ auto slot booking link) OR ON_HOLD (+ reason).
 */
export const submitScreeningAuto = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { appId } = req.params;
  const { answers = [] } = req.body || {};

  const app = await prisma.application.findFirst({
    where: { id: appId, tenantId: tenant.id },
  });
  if (!app) throw notFound("application");

  const result = await evaluateScreeningAndAutomate(app.id, Array.isArray(answers) ? answers : []);
  res.json({ ok: true, ...result });
});

/**
 * POST /api/t/:tenantSlug/workflow/applications/:appId/round1/book-slot
 * Candidate books Round 1 time slot -> fills in Interview Slots & schedules 1-hour pre-slot Round 1 generation/email.
 */
export const bookRound1Slot = ah(async (req, res) => {
  const tenant = tenantOf(req);
  const { appId } = req.params;

  const app = await prisma.application.findFirst({
    where: { id: appId, tenantId: tenant.id },
  });
  if (!app) throw notFound("application");

  const booking = await bookRound1SlotAndSchedule(app.id, req.body || {});
  res.json({ ok: true, ...booking });
});
