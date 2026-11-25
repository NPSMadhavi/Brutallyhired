import type { ApplicationStageKey } from "@verity/shared";
import type { Tone } from "@/components/ui/Card";

export const stageTone = (s: ApplicationStageKey | string): Tone =>
  s === "OFFER" || s === "ONBOARDING" || s === "HIRED"
    ? "teal"
    : s === "ASSESSMENT"
      ? "amber"
      : s === "REJECTED" || s === "NOT_SELECTED" || s === "WITHDRAWN" || s === "DRAFT"
        ? "gray"
        : "blue";
