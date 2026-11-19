import type { ApplicationStageKey, MilestoneKey } from "./enums.js";

export type MilestoneState = "done" | "current" | "upcoming";

/** Which milestone a stage sits on. */
export function milestoneForStage(stage: ApplicationStageKey): MilestoneKey | null {
  switch (stage) {
    case "SUBMITTED":
    case "IN_REVIEW":
      return "IN_REVIEW";
    case "ASSESSMENT":
      return "ASSESSMENT";
    case "INTERVIEW":
      return "INTERVIEWS";
    case "OFFER":
      return "OFFER";
    case "ONBOARDING":
      return "ONBOARDING";
    case "HIRED":
      return "FIRST_DAY";
    default:
      return null;
  }
}

/** The milestone list for a job: the assessment step only appears when the job has one. */
export function milestonesFor(hasAssessment: boolean): MilestoneKey[] {
  const all: MilestoneKey[] = ["APPLIED", "IN_REVIEW", "ASSESSMENT", "INTERVIEWS", "OFFER", "ONBOARDING", "FIRST_DAY"];
  return hasAssessment ? all : all.filter((m) => m !== "ASSESSMENT");
}

/**
 * Build the public track. `reachedStage` is the furthest open stage the application reached
 * (for closed applications this is the stage before closing).
 */
export function buildTrack(
  reachedStage: ApplicationStageKey,
  hasAssessment: boolean,
  reachedAt: Partial<Record<MilestoneKey, string>>,
  isHired: boolean,
): { key: MilestoneKey; state: MilestoneState; at: string | null }[] {
  const list = milestonesFor(hasAssessment);
  const current = milestoneForStage(reachedStage);
  const idx = current ? list.indexOf(current) : -1;
  return list.map((key, i) => {
    let state: MilestoneState = "upcoming";
    if (isHired || i < idx) state = "done";
    else if (i === idx) state = "current";
    return { key, state, at: reachedAt[key] ?? null };
  });
}
