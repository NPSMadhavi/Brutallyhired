import { clsx } from "clsx";
import type { ReactNode } from "react";
import { initials } from "@/lib/format";
import { Pill, type Tone } from "./Card";

export function Avatar({
  name,
  size = 36,
  className,
}: {
  name?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-display text-xs font-bold text-brand ring-1 ring-brand/10",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={name ?? undefined}
    >
      {initials(name)}
    </span>
  );
}

export const STAGE_TONES: Record<string, Tone> = {
  DRAFT: "gray",
  SUBMITTED: "blue",
  IN_REVIEW: "amber",
  ASSESSMENT: "purple",
  INTERVIEW: "blue",
  OFFER: "teal",
  ONBOARDING: "teal",
  HIRED: "teal",
  NOT_SELECTED: "red",
  WITHDRAWN: "gray",
};

export function StagePill({ stage }: { stage: string }) {
  const tone = STAGE_TONES[stage] ?? "gray";
  const label = stage.replace(/_/g, " ");
  return (
    <Pill tone={tone} dot>
      {label}
    </Pill>
  );
}

export function ScoreBadge({
  score,
  threshold = 60,
  max = 100,
}: {
  score?: number | null;
  threshold?: number;
  max?: number;
}) {
  if (score === undefined || score === null) {
    return <span className="text-xs font-medium text-ink-muted">Not scored</span>;
  }
  const isPassing = score >= threshold;
  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className={clsx(
          "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold",
          isPassing ? "bg-ok-soft text-ok-ink" : "bg-danger-soft text-danger",
        )}
      >
        {score}
      </span>
      <span className="text-[11px] text-ink-muted">/{max}</span>
    </div>
  );
}
