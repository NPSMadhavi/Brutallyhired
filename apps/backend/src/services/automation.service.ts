import { prisma, type Prisma } from "@verity/db";
import { resumeSummarySchema } from "@verity/shared";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { aiEnabled, env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { callAiJson, generateCandidateAssessmentQuestions } from "./ai.service.js";
import { sendTrackedTemplate } from "./email.service.js";
import { internalEvent, publishMilestone } from "./notification.service.js";

function getTenantSlotsFilePath(tenantSlug: string) {
  const safe = tenantSlug.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(env.STORAGE_DIR || "./storage", `interview_slots_${safe}.json`);
}

async function readTenantSlots(tenantSlug: string): Promise<any[]> {
  try {
    const raw = await fs.readFile(getTenantSlotsFilePath(tenantSlug), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeTenantSlots(tenantSlug: string, slots: any[]) {
  const filePath = getTenantSlotsFilePath(tenantSlug);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(slots, null, 2), "utf-8");
}

/**
 * Step 1: Automatically moves submitted application to IN_REVIEW and dispatches Screening Test email.
 */
export async function onApplicationSubmittedAuto(applicationId: string) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { user: true, job: true, tenant: true },
  });
  if (!app) return;

  await prisma.application.update({
    where: { id: app.id },
    data: { stage: "IN_REVIEW" },
  });

  await internalEvent(app.id, "stage_changed", { from: "SUBMITTED", to: "IN_REVIEW" }, app.userId);
  await internalEvent(app.id, "screening_invited", { jobTitle: app.job.title }, app.userId);

  await sendTrackedTemplate({
    tenantId: app.tenantId,
    applicationId: app.id,
    to: app.user.email,
    template: "screening_invited",
    tenant: app.tenant,
    vars: { jobTitle: app.job.title },
    path: `/${app.tenant.slug}/applications/${app.id}/screening`,
    dedupKey: `screening-invite-${app.id}`,
  });
}

export interface ScreeningAnswerInput {
  questionId: string;
  prompt: string;
  type: string;
  category?: string;
  points?: number;
  answer: string;
  correctOptionIndex?: number;
  options?: string[];
}

export interface ScreeningEvaluationResult {
  decision: "SHORTLISTED" | "ON_HOLD";
  score: number;
  reason: string;
  flaggedItems: string[];
  evaluatedModel: string;
}

/**
 * Step 2: Evaluates Screening Test answers using deterministic validation + Ubuntu Ollama LLM (qwen3.5:9b).
 * Auto-shortlists suitable candidates and sends slot booking link;
 * otherwise sets stage to ON_HOLD with an automatically written reason.
 */
export async function evaluateScreeningAndAutomate(
  applicationId: string,
  answers: ScreeningAnswerInput[],
): Promise<{
  evaluation: ScreeningEvaluationResult;
  slotBookingUrl?: string;
}> {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { user: true, job: true, tenant: true },
  });

  // 1. Deterministic validation rules (catches negative CTC, invalid numbers, wrong MCQs)
  const deterministicFlags: string[] = [];
  let totalPts = 0;
  let earnedPts = 0;

  for (const a of answers) {
    const pts = Number(a.points) || 20;
    totalPts += pts;
    const ans = String(a.answer || "").trim();
    const promptLower = (a.prompt || "").toLowerCase();

    if (!ans || ans === "—") {
      deterministicFlags.push(`Missing answer for "${a.prompt}"`);
      continue;
    }

    // Compensation / CTC sanity checks
    if (promptLower.includes("ctc") || promptLower.includes("salary") || promptLower.includes("compensation")) {
      const numMatch = ans.match(/-?\d+(?:\.\d+)?/);
      if (!numMatch) {
        deterministicFlags.push(`Invalid numeric format for "${a.prompt}": "${ans}"`);
        continue;
      }
      const val = parseFloat(numMatch[0]);
      if (val < 0) {
        deterministicFlags.push(`Invalid negative compensation value (${val}) entered for "${a.prompt}".`);
        continue;
      }
      if (val === 0 && promptLower.includes("expected")) {
        deterministicFlags.push(`Expected CTC cannot be 0.`);
        continue;
      }
    }

    // MCQ / YES_NO check
    if ((a.type === "MCQ" || a.type === "YES_NO") && typeof a.correctOptionIndex === "number") {
      const opts = a.type === "YES_NO" && (!a.options || a.options.length === 0) ? ["Yes", "No"] : (a.options || []);
      const idx = opts.findIndex((o) => o === ans);
      if (idx !== a.correctOptionIndex) {
        deterministicFlags.push(`Incorrect or unsuitable response for "${a.prompt}": "${ans}"`);
        continue;
      }
    }

    // Negative location/availability response check
    if (promptLower.includes("comfortable") && ans.toLowerCase().startsWith("no")) {
      deterministicFlags.push(`Candidate is not comfortable with job location/schedule requirements.`);
      continue;
    }

    earnedPts += pts;
  }

  const deterministicScore = totalPts > 0 ? Math.round((earnedPts / totalPts) * 100) : 100;

  // 2. Call Ubuntu Ollama LLM (qwen3.5:9b) to validate & explain suitability
  let aiDecision: "SHORTLISTED" | "ON_HOLD" = deterministicFlags.length > 0 || deterministicScore < 70 ? "ON_HOLD" : "SHORTLISTED";
  let aiScore = deterministicScore;
  let aiReason =
    deterministicFlags.length > 0
      ? `Placed on hold automatically: ${deterministicFlags.join(" ")}`
      : `Candidate passed all screening criteria (${deterministicScore}/100) and matches ${app.job.title} requirements.`;
  let flaggedItems = [...deterministicFlags];
  let evaluatedModel = "deterministic-validator";

  if (aiEnabled && env.AI_BASE_URL) {
    try {
      const summaryParsed = resumeSummarySchema.safeParse(app.resumeSummary ?? {});
      const qaText = answers.map((a, i) => `${i + 1}. Q: ${a.prompt}\n   A: ${a.answer}`).join("\n");
      const prompt = `You are an automated HR Screening Evaluator for Brutallyhired.
Evaluate this candidate's screening answers against the Job Role and Resume.
Check strictly for:
- Invalid, negative, or nonsensical values (e.g. negative Expected CTC like -30, unrealistic numbers, missing info)
- Role suitability (experience, notice period, location comfort, compensation alignment)

Job Title: ${app.job.title}
Job Description: ${(app.job.summary || "").slice(0, 1200)}
Candidate Skills: ${summaryParsed.success ? summaryParsed.data.skills.join(", ") : "N/A"}
Candidate Experience: ${summaryParsed.success ? summaryParsed.data.totalExperience || "N/A" : "N/A"}

Screening Q&A:
${qaText}

Deterministic Pre-Checks Flagged: ${deterministicFlags.length > 0 ? deterministicFlags.join("; ") : "None"}

Respond ONLY with valid JSON:
{
  "decision": "SHORTLISTED" or "ON_HOLD",
  "score": 0 to 100 integer,
  "reason": "Clear 1-2 sentence explanation for HR and candidate (especially explaining why ON_HOLD if answers are invalid or unsuitable)",
  "flaggedItems": ["list of specific problematic answers if any"]
}`;

      const parsed = await callAiJson<any>({
        message: prompt,
        systemPrompt: "You are a strict HR Screening Validator. Output ONLY valid JSON.",
        temperature: 0,
        timeoutMs: 30_000,
      });

      if (parsed && (parsed.decision === "SHORTLISTED" || parsed.decision === "ON_HOLD")) {
        evaluatedModel = env.AI_MODEL || "qwen3.5:9b";
        aiScore = typeof parsed.score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score))) : deterministicScore;
        aiReason = String(parsed.reason || aiReason).trim();
        if (Array.isArray(parsed.flaggedItems)) {
          flaggedItems = Array.from(new Set([...deterministicFlags, ...parsed.flaggedItems.map(String)]));
        }
        // Hard safety guard: never shortlist if deterministic validation flagged invalid/negative inputs
        if (deterministicFlags.length > 0) {
          aiDecision = "ON_HOLD";
          aiScore = Math.min(aiScore, deterministicScore);
          if (!aiReason.toLowerCase().includes("hold") && !aiReason.toLowerCase().includes("invalid") && !aiReason.toLowerCase().includes("negative")) {
            aiReason = `${deterministicFlags.join(" ")} ${aiReason}`.trim();
          }
        } else {
          aiDecision = parsed.decision;
        }
      }
    } catch (err) {
      logger.warn({ err, applicationId }, "Screening AI evaluation fell back to deterministic validator");
    }
  }

  const evaluation: ScreeningEvaluationResult = {
    decision: aiDecision,
    score: aiScore,
    reason: aiReason,
    flaggedItems,
    evaluatedModel,
  };

  // 3. Persist result & trigger automated next action
  if (aiDecision === "ON_HOLD") {
    await prisma.application.update({
      where: { id: app.id },
      data: {
        stage: "ON_HOLD",
        holdReason: aiReason,
        screeningResult: { ...evaluation, answers, evaluatedAt: new Date().toISOString() } as unknown as Prisma.InputJsonValue,
      },
    });

    await internalEvent(app.id, "on_hold", { reason: aiReason, score: aiScore, flaggedItems }, app.userId);

    await sendTrackedTemplate({
      tenantId: app.tenantId,
      applicationId: app.id,
      to: app.user.email,
      template: "screening_on_hold",
      tenant: app.tenant,
      vars: { jobTitle: app.job.title, reason: aiReason },
      path: `/${app.tenant.slug}/applications/${app.id}`,
      dedupKey: `screening-hold-${app.id}-${aiScore}`,
    });

    return { evaluation };
  }

  // SHORTLISTED -> Ensure interview slots exist & send slot booking link email automatically!
  await prisma.application.update({
    where: { id: app.id },
    data: {
      stage: "SHORTLISTED",
      holdReason: null,
      screeningResult: { ...evaluation, answers, evaluatedAt: new Date().toISOString() } as unknown as Prisma.InputJsonValue,
    },
  });

  await internalEvent(app.id, "shortlisted", { score: aiScore, reason: aiReason }, app.userId);

  await ensureDefaultRound1Slots(app.tenant.slug, app.jobId, app.job.title);

  // Create Round 1 InterviewRound in AWAITING_BOOKING state if missing
  const existingR1 = await prisma.interviewRound.findFirst({
    where: { applicationId: app.id, sequence: 1 },
  });
  if (!existingR1) {
    await prisma.interviewRound.create({
      data: {
        applicationId: app.id,
        sequence: 1,
        title: "Round 1: Proctored Technical Assessment",
        description: "Select your preferred Round 1 slot. AI-generated technical questions will be emailed 1 hour before your slot.",
        durationMinutes: 60,
        status: "AWAITING_BOOKING",
        roomName: `bh-r1-${app.id.slice(-8)}-${crypto.randomBytes(3).toString("hex")}`,
      },
    });
  }

  const slotBookingPath = `/${app.tenant.slug}/applications/${app.id}/interviews`;
  await sendTrackedTemplate({
    tenantId: app.tenantId,
    applicationId: app.id,
    to: app.user.email,
    template: "slot_booking_invited",
    tenant: app.tenant,
    vars: { jobTitle: app.job.title },
    path: slotBookingPath,
    dedupKey: `r1-slot-invite-${app.id}`,
  });

  return {
    evaluation,
    slotBookingUrl: `${env.WEB_ORIGIN}${slotBookingPath}`,
  };
}

/**
 * Ensures available Round 1 slots exist in the tenant's Interview Slots store for the next 3 days.
 */
export async function ensureDefaultRound1Slots(tenantSlug: string, jobId: string, jobTitle: string) {
  const slots = await readTenantSlots(tenantSlug);
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  // Purge expired AVAILABLE slots
  const validExistingSlots = slots.filter((s) => {
    if (s.status !== "AVAILABLE") return true;
    if (!s.date || !s.startTime) return false;
    if (s.date < todayStr) return false;
    const slotDt = new Date(`${s.date}T${s.startTime}:00`);
    return slotDt.getTime() > now.getTime() - 10 * 60_000;
  });

  const availableFutureCount = validExistingSlots.filter(
    (s) => s.roundNumber === 1 && s.status === "AVAILABLE" && (s.jobId === jobId || s.jobTitle === jobTitle),
  ).length;

  const newSlots: any[] = [];
  if (availableFutureCount < 5) {
    const times = [
      { start: "10:00", end: "11:00" },
      { start: "11:30", end: "12:30" },
      { start: "14:00", end: "15:00" },
      { start: "15:30", end: "16:30" },
      { start: "17:00", end: "18:00" },
    ];

    for (let dOffset = 0; dOffset < 4; dOffset++) {
      const d = new Date(now);
      d.setDate(now.getDate() + dOffset);
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      for (const t of times) {
        const [hh, mm] = t.start.split(":").map(Number);
        const slotDt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0, 0);
        if (slotDt.getTime() <= now.getTime() + 15 * 60_000) continue; // skip past slots today
        const slotId = `slot-r1-${jobId.slice(-6)}-${dateStr}-${t.start.replace(":", "")}`;
        if (!validExistingSlots.some((s) => s.id === slotId || (s.date === dateStr && s.startTime === t.start && s.roundNumber === 1))) {
          newSlots.push({
            id: slotId,
            jobId,
            jobTitle,
            roundNumber: 1,
            roundName: "Round 1 (Proctored Technical Assessment)",
            date: dateStr,
            startTime: t.start,
            endTime: t.end,
            durationMinutes: 60,
            interviewerName: "Tanuja HR (Talent Acquisition Lead)",
            interviewerEmail: "hr@brutallyhired.com",
            mode: "PROCTORED_ASSESSMENT",
            status: "AVAILABLE",
            createdAt: now.toISOString(),
          });
        }
      }
    }
  }

  const combined = [...validExistingSlots, ...newSlots];
  // Sort chronologically ascending
  combined.sort((a, b) => {
    const aIso = `${a.date || "1970-01-01"}T${a.startTime || "00:00"}:00`;
    const bIso = `${b.date || "1970-01-01"}T${b.startTime || "00:00"}:00`;
    return aIso.localeCompare(bIso);
  });

  await writeTenantSlots(tenantSlug, combined);
}

/**
 * Step 3: Candidate books a Round 1 slot -> fills in Interview Slots (DB + JSON) and schedules 1-hour pre-slot dispatch.
 */
export async function bookRound1SlotAndSchedule(
  applicationId: string,
  slotInput: {
    slotId?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    startsAtIso?: string;
    endsAtIso?: string;
  },
) {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { user: true, job: true, tenant: true },
  });

  const startsAt = slotInput.startsAtIso
    ? new Date(slotInput.startsAtIso)
    : new Date(`${slotInput.date}T${slotInput.startTime || "10:00"}:00`);
  const endsAt = slotInput.endsAtIso
    ? new Date(slotInput.endsAtIso)
    : new Date(startsAt.getTime() + 60 * 60_000);

  // 1. Update InterviewRound (sequence 1) + InterviewSlot in PostgreSQL
  let round = await prisma.interviewRound.findFirst({
    where: { applicationId: app.id, sequence: 1 },
  });
  if (!round) {
    round = await prisma.interviewRound.create({
      data: {
        applicationId: app.id,
        sequence: 1,
        title: "Round 1: Proctored Technical Assessment",
        durationMinutes: 60,
        status: "SCHEDULED",
        scheduledStart: startsAt,
        scheduledEnd: endsAt,
        roomName: `bh-r1-${app.id.slice(-8)}-${crypto.randomBytes(3).toString("hex")}`,
        panelists: { create: [{ name: "Tanuja HR", title: "Talent Acquisition Lead" }] },
      },
    });
  } else {
    round = await prisma.interviewRound.update({
      where: { id: round.id },
      data: {
        status: "SCHEDULED",
        scheduledStart: startsAt,
        scheduledEnd: endsAt,
      },
    });
  }

  await prisma.interviewSlot.upsert({
    where: { roundId_startsAt: { roundId: round.id, startsAt } },
    update: { bookedAt: new Date(), endsAt },
    create: { roundId: round.id, startsAt, endsAt, bookedAt: new Date() },
  });

  // 2. Fill slot in Interview Slots JSON store so Admin InterviewSlotsModule shows BOOKED immediately
  const slots = await readTenantSlots(app.tenant.slug);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = slotInput.date || `${startsAt.getFullYear()}-${pad(startsAt.getMonth() + 1)}-${pad(startsAt.getDate())}`;
  const startTimeStr = slotInput.startTime || `${pad(startsAt.getHours())}:${pad(startsAt.getMinutes())}`;
  const endTimeStr = slotInput.endTime || `${pad(endsAt.getHours())}:${pad(endsAt.getMinutes())}`;

  let matched = false;
  const updatedSlots = slots.map((s) => {
    const isTarget =
      (slotInput.slotId && s.id === slotInput.slotId) ||
      (s.roundNumber === 1 &&
        s.date === dateStr &&
        s.startTime === startTimeStr &&
        (s.jobId === app.jobId || s.jobTitle === app.job.title) &&
        s.status === "AVAILABLE");
    if (isTarget && !matched) {
      matched = true;
      return {
        ...s,
        status: "BOOKED",
        bookedCandidateId: app.id,
        bookedCandidateName: app.user.displayName || app.user.email,
        bookedCandidateEmail: app.user.email,
      };
    }
    return s;
  });

  if (!matched) {
    updatedSlots.push({
      id: slotInput.slotId || `slot-r1-${app.id.slice(-6)}-${Date.now()}`,
      jobId: app.jobId,
      jobTitle: app.job.title,
      roundNumber: 1,
      roundName: "Round 1 (Proctored Technical Assessment)",
      date: dateStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      durationMinutes: 60,
      interviewerName: "Tanuja HR (Talent Acquisition Lead)",
      interviewerEmail: "hr@brutallyhired.com",
      mode: "PROCTORED_ASSESSMENT",
      status: "BOOKED",
      bookedCandidateId: app.id,
      bookedCandidateName: app.user.displayName || app.user.email,
      bookedCandidateEmail: app.user.email,
      createdAt: new Date().toISOString(),
    });
  }
  await writeTenantSlots(app.tenant.slug, updatedSlots);

  // 3. Create/update AssessmentInvite (roundNumber 1) awaiting 1-hour pre-slot dispatch
  let invite = await prisma.assessmentInvite.findFirst({
    where: { applicationId: app.id, roundNumber: 1 },
    orderBy: { createdAt: "desc" },
  });

  const dueAt = new Date(endsAt.getTime() + 2 * 3600 * 1000);
  if (!invite) {
    const placeholderTemplate = await prisma.assessmentTemplate.create({
      data: {
        tenantId: app.tenantId,
        title: `Round 1: ${app.job.title} Technical Assessment`,
        description: "AI-generated technical assessment (prepared 1 hour prior to scheduled slot).",
        durationMinutes: 45,
        proctored: true,
        topics: [app.job.title],
      },
    });
    invite = await prisma.assessmentInvite.create({
      data: {
        applicationId: app.id,
        templateId: placeholderTemplate.id,
        roundNumber: 1,
        scheduledSlotStart: startsAt,
        scheduledSlotEnd: endsAt,
        dueAt,
        status: "INVITED",
        emailSentAt: null,
      },
    });
  } else {
    invite = await prisma.assessmentInvite.update({
      where: { id: invite.id },
      data: {
        scheduledSlotStart: startsAt,
        scheduledSlotEnd: endsAt,
        dueAt,
        emailSentAt: null,
      },
    });
  }

  await publishMilestone({
    applicationId: app.id,
    type: "interview_booked",
    data: {
      roundId: round.id,
      roundTitle: round.title,
      startsAt: startsAt.toLocaleString(),
    },
  });

  // 4. Immediately check if the booked slot is already within 1 hour -> generate & send Round 1 questions right now!
  const dispatchedNow = await dispatchRound1IfWithinWindow(invite.id);

  return {
    round,
    inviteId: invite.id,
    scheduledStart: startsAt.toISOString(),
    scheduledEnd: endsAt.toISOString(),
    dispatchedNow,
  };
}

/**
 * Generates Round 1 questions using Ubuntu Ollama LLM (qwen3.5:9b) and dispatches the assessment link email
 * if the scheduled slot is within 1 hour (60 minutes) from now.
 */
export async function dispatchRound1IfWithinWindow(inviteId: string): Promise<boolean> {
  const invite = await prisma.assessmentInvite.findUnique({
    where: { id: inviteId },
    include: {
      template: { include: { questions: true } },
      application: {
        include: { user: true, job: true, tenant: true },
      },
    },
  });

  if (!invite || invite.roundNumber !== 1 || invite.emailSentAt || !invite.scheduledSlotStart || invite.status !== "INVITED") {
    return false;
  }

  const msUntilSlot = invite.scheduledSlotStart.getTime() - Date.now();
  const ONE_HOUR_MS = 60 * 60 * 1000;
  if (msUntilSlot > ONE_HOUR_MS) {
    return false; // Not within 1-hour window yet
  }

  const app = invite.application;
  const summaryParsed = resumeSummarySchema.safeParse(app.resumeSummary ?? {});

  // Auto-generate questions with Ubuntu Ollama LLM (qwen3.5:9b) if template doesn't have questions yet
  if (invite.template.questions.length === 0) {
    const generated = await generateCandidateAssessmentQuestions({
      jobTitle: app.job.title,
      jobDescription: app.job.summary,
      candidateName: app.user.displayName || app.user.email,
      candidateSkills: summaryParsed.success ? summaryParsed.data.skills : [],
      candidateExperience: summaryParsed.success ? summaryParsed.data.totalExperience : undefined,
      candidateRole: summaryParsed.success ? summaryParsed.data.currentRole : undefined,
      count: 5,
    });

    if (generated && generated.questions.length > 0) {
      await prisma.assessmentTemplate.update({
        where: { id: invite.templateId },
        data: {
          title: generated.title,
          topics: generated.topics,
          durationMinutes: generated.durationMinutes,
          questions: {
            create: generated.questions.map((q, idx) => ({
              order: idx + 1,
              type: "SINGLE_CHOICE",
              prompt: q.prompt,
              options: q.options,
              correct: [q.correctOptionIndex],
              points: q.points || 20,
            })),
          },
        },
      });
    }
  }

  await prisma.assessmentInvite.update({
    where: { id: invite.id },
    data: { emailSentAt: new Date() },
  });

  await prisma.application.update({
    where: { id: app.id },
    data: { stage: "ASSESSMENT" },
  });

  const assessPath = `/${app.tenant.slug}/applications/${app.id}/assessments/${invite.id}`;
  await sendTrackedTemplate({
    tenantId: app.tenantId,
    applicationId: app.id,
    to: app.user.email,
    template: "assessment_invited",
    tenant: app.tenant,
    vars: {
      jobTitle: app.job.title,
      assessmentTitle: invite.template.title,
      dueAt: invite.dueAt.toLocaleString(),
      durationMinutes: invite.template.durationMinutes,
    },
    path: assessPath,
    dedupKey: `r1-1hr-dispatch-${invite.id}`,
  });

  await internalEvent(
    app.id,
    "assessment_invited",
    {
      inviteId: invite.id,
      title: invite.template.title,
      dueAt: invite.dueAt.toISOString(),
    },
    app.userId,
  );

  logger.info({ applicationId: app.id, inviteId: invite.id }, "Auto-generated Round 1 questions & sent 1-hour pre-slot email");
  return true;
}

/**
 * Background scheduler sweep: finds all booked Round 1 invites within 1 hour of start and auto-dispatches them.
 */
export async function processScheduledRound1Assessments() {
  const cutoff = new Date(Date.now() + 60 * 60 * 1000);
  const dueInvites = await prisma.assessmentInvite.findMany({
    where: {
      roundNumber: 1,
      status: "INVITED",
      emailSentAt: null,
      scheduledSlotStart: { lte: cutoff },
    },
    select: { id: true },
  });

  for (const inv of dueInvites) {
    try {
      await dispatchRound1IfWithinWindow(inv.id);
    } catch (err) {
      logger.error({ err, inviteId: inv.id }, "Failed auto-dispatching 1-hour Round 1 assessment");
    }
  }
}
