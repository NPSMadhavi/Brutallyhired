import { prisma, type Prisma } from "@verity/db";
import { resumeSummarySchema } from "@verity/shared";
import { env } from "../config/env.js";
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

  const breakdown = app.job.requirements.map((r) => {
    let evidence: string | null = null;
    let matchedKeyword: string | null = null;
    for (const kw of r.keywords) {
      evidence = evidenceFor(kw);
      if (evidence) {
        matchedKeyword = kw;
        break;
      }
    }
    return { requirementId: r.id, label: r.label, kind: r.kind, weight: r.weight, matched: Boolean(evidence), matchedKeyword, evidence };
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
  const total = Math.round(100 * (0.9 * fit + 0.1 * questionnaire));

  const missingInformation = [
    ...(app.resumeText ? [] : ["resume_text_unreadable"]),
    ...breakdown.filter((b) => b.kind === "HARD" && !b.matched).map((b) => b.label),
    ...app.job.questions.filter((q) => q.required && !app.answers.some((a) => a.questionId === q.id)).map((q) => `question:${q.prompt}`),
  ];
  const confidence = !app.resumeText ? 0.3 : summary.success && app.resumeReadStatus === "READ" ? 0.85 : 0.6;
  const belowThreshold = total < app.tenant.eligibilityThreshold;

  const score = await prisma.applicationScore.create({
    data: {
      applicationId,
      total,
      breakdown: { requirements: breakdown, hardFit: hard, preferredFit: pref, questionnaire } as Prisma.InputJsonValue,
      confidence,
      missingInformation,
      jobVersion: app.job.version,
      rubricVersion: env.SCORING_RUBRIC_VERSION,
      modelVersion: app.resumeReadStatus === "READ" ? (env.AI_MODEL ?? null) : null,
      belowThreshold,
    },
  });
  await internalEvent(applicationId, belowThreshold ? "eligibility_review_required" : "scored", { scoreId: score.id, total });
  return score;
}
