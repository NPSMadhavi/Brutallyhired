import { prisma, type Prisma } from "@verity/db";
import { resumeSummarySchema } from "@verity/shared";
import { aiEnabled, env } from "../config/env.js";
import { evaluateCandidateWithAi, type AiEvaluationResult } from "./ai.service.js";
import { internalEvent } from "./notification.service.js";

/**
 * BrutalScore™ — internal, explainable fit score.
 * Uses only job-related evidence: CV text, the structured CV read, and questionnaire answers.
 * Never uses names, photos, contact details or any personal trait. Never rejects: a low score only
 * flags the application for an eligibility review by a person.
 */
export async function scoreApplication(applicationId: string) {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { job: { include: { requirements: true, questions: true } }, answers: true, tenant: true },
  });
  const summary = resumeSummarySchema.safeParse(app.resumeSummary ?? {});
  const corpusParts = [
    app.resumeText ?? "",
    ...(summary.success
      ? [...summary.data.skills, ...summary.data.certifications, ...summary.data.education, summary.data.currentRole ?? ""]
      : []),
    ...app.answers.map((a) => (typeof a.value === "string" ? a.value : "")),
  ];
  const corpus = corpusParts.join("\n");
  const lower = corpus.toLowerCase();

  const evidenceFor = (keyword: string) => {
    const k = keyword.toLowerCase().trim();
    if (!k) return null;
    const re = new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i");
    const m = re.exec(lower);
    if (!m) return null;
    const start = Math.max(0, m.index - 60);
    return corpus
      .slice(start, m.index + k.length + 80)
      .replace(/\s+/g, " ")
      .trim();
  };

  // 1. Attempt deep AI evaluation via Qwen if enabled and resumeText exists
  let aiEval: AiEvaluationResult | null = null;
  if (aiEnabled && app.resumeText) {
    aiEval = await evaluateCandidateWithAi({
      jobTitle: app.job.title,
      jobDescription: (app.job as any).description || (app.job as any).summary,
      requirements: app.job.requirements.map((r) => ({
        id: r.id,
        label: r.label,
        kind: r.kind,
        weight: r.weight,
      })),
      questions: app.job.questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        required: q.required,
      })),
      answers: app.answers.map((a) => ({
        questionId: a.questionId,
        value: a.value,
      })),
      resumeText: app.resumeText,
      resumeSummary: summary.success ? summary.data : null,
    });
  }

  // 2. Build requirements breakdown (using AI matches + evidence where available, with fallback)
  const breakdown = app.job.requirements.map((r) => {
    const aiItem = aiEval?.requirementsEvaluation?.find((e) => e.requirementId === r.id);
    if (aiItem) {
      return {
        requirementId: r.id,
        label: r.label,
        kind: r.kind,
        weight: r.weight,
        matched: aiItem.matched,
        matchedKeyword: aiItem.matched ? "AI Verified" : null,
        evidence: aiItem.evidence || aiItem.reasoning || null,
        reasoning: aiItem.reasoning || null,
      };
    }

    let evidence: string | null = null;
    let matchedKeyword: string | null = null;
    for (const kw of r.keywords) {
      evidence = evidenceFor(kw);
      if (evidence) {
        matchedKeyword = kw;
        break;
      }
    }
    return {
      requirementId: r.id,
      label: r.label,
      kind: r.kind,
      weight: r.weight,
      matched: Boolean(evidence),
      matchedKeyword,
      evidence,
      reasoning: null,
    };
  });

  const part = (kind: "HARD" | "PREFERRED") => {
    const items = breakdown.filter((b) => b.kind === kind);
    const total = items.reduce((s, b) => s + b.weight, 0);
    return total === 0 ? null : items.filter((b) => b.matched).reduce((s, b) => s + b.weight, 0) / total;
  };
  const hard = part("HARD");
  const pref = part("PREFERRED");
  const fit = hard === null && pref === null ? 0 : hard === null ? pref! : pref === null ? hard : 0.75 * hard + 0.25 * pref;

  const answered = app.job.questions.filter((q) => app.answers.some((a) => a.questionId === q.id)).length;
  const questionnaire = app.job.questions.length ? answered / app.job.questions.length : 1;

  // Use AI total score if available, otherwise deterministic blend
  const total = aiEval?.totalScore ?? Math.round(100 * (0.9 * fit + 0.1 * questionnaire));

  const missingInformation = [
    ...(app.resumeText ? [] : ["resume_text_unreadable"]),
    ...(aiEval?.missingOrWeakSkills && aiEval.missingOrWeakSkills.length > 0
      ? aiEval.missingOrWeakSkills
      : breakdown.filter((b) => b.kind === "HARD" && !b.matched).map((b) => b.label)),
    ...app.job.questions.filter((q) => q.required && !app.answers.some((a) => a.questionId === q.id)).map((q) => `question:${q.prompt}`),
  ];

  const confidence = aiEval ? 0.95 : !app.resumeText ? 0.3 : summary.success && app.resumeReadStatus === "READ" ? 0.85 : 0.6;
  const belowThreshold = total < app.tenant.eligibilityThreshold;

  const score = await prisma.applicationScore.create({
    data: {
      applicationId,
      total,
      breakdown: {
        requirements: breakdown,
        hardFit: aiEval ? aiEval.hardScore / 100 : hard,
        preferredFit: aiEval ? aiEval.preferredScore / 100 : pref,
        questionnaire,
        executiveSummary: aiEval?.executiveSummary ?? null,
        strengths: aiEval?.strengths ?? [],
        missingSkills: aiEval?.missingOrWeakSkills ?? [],
      } as Prisma.InputJsonValue,
      confidence,
      missingInformation,
      jobVersion: app.job.version,
      rubricVersion: env.SCORING_RUBRIC_VERSION,
      modelVersion: aiEval ? (env.AI_MODEL ?? null) : app.resumeReadStatus === "READ" ? (env.AI_MODEL ?? null) : null,
      belowThreshold,
    },
  });
  await internalEvent(applicationId, belowThreshold ? "eligibility_review_required" : "scored", { scoreId: score.id, total });
  return score;
}
