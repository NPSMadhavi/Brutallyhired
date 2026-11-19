import type { ApplicationStageKey } from "@verity/shared";
import type { Tone } from "@/components/ui/Card";

export const stageTone = (s: ApplicationStageKey): Tone =>
  s === "OFFER" || s === "ONBOARDING" || s === "HIRED"
    ? "teal"
    : s === "ASSESSMENT"
      ? "amber"
      : s === "NOT_SELECTED" || s === "WITHDRAWN" || s === "DRAFT"
        ? "gray"
        : "blue";
