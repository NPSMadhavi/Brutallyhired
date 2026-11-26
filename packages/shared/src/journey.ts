import type { ApplicationStageKey, MilestoneKey } from "./enums.js";

export type MilestoneState = "done" | "current" | "upcoming";

/** Which milestone a stage sits on. */
export function milestoneForStage(stage: ApplicationStageKey | string): MilestoneKey | null {
  switch (stage as string) {
    case "SUBMITTED":
    case "IN_REVIEW":
      return "IN_REVIEW";
    case "ASSESSMENT":
    case "ROUND1_PENDING_HR_APPROVAL":
      return "SCREENING_TEST";
    case "SHORTLISTED":
      return "SHORTLISTED";
    case "ROUND2_PENDING_HR_APPROVAL":
    case "INTERVIEW":
    case "ROUND3_PENDING_FINAL_HR_APPROVAL":
      return "INTERVIEW_SCHEDULE";
    case "OFFER":
      return "OFFER";
    case "ONBOARDING":
    case "HIRED":
      return "ONBOARDING";
    default:
      return null;
  }
}

/** The milestone list for a job: 1st applied, next in review, next screening test, next shortlisted, next interview schedule, next offer, next onboarding. */
export function milestonesFor(_hasAssessment?: boolean): MilestoneKey[] {
  return [
    "APPLIED",
    "IN_REVIEW",
    "SCREENING_TEST",
    "SHORTLISTED",
    "INTERVIEW_SCHEDULE",
    "OFFER",
    "ONBOARDING",
  ];
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
