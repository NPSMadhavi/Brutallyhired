import type { ApplicationOverview } from "@verity/shared";
import { clsx } from "clsx";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/feedback";
import { Calendar, Check, Clock, Eye, Video } from "@/components/ui/icons";
import { useFormat } from "@/lib/format";

const ROUND_DETAILS = [
  {
    name: "Round 1",
    title: "Technical Screening & Coding Assessment",
    duration: "45 Minutes",
    format: "Live Video & Coding Sandbox",
    interviewer: "Arun K. (Principal Architect)",
    topics: "Data structures, algorithms, problem-solving, and core fundamentals.",
    status: "Active / Scheduled",
  },
  {
    name: "Round 2",
    title: "System Architecture & Deep Dive",
    duration: "60 Minutes",
    format: "Technical Panel Discussion",
    interviewer: "Chandra (Senior Tech Talent Partner) & Lead Architect",
    topics: "Scalable architecture, database modeling, and technical design patterns.",
    status: "Upcoming (Unlocks after Round 1)",
  },
  {
    name: "Round 3",
    title: "Engineering Leadership & Cultural Fit",
    duration: "45 Minutes",
    format: "1:1 Leadership Discussion",
    interviewer: "Tanuja HR (HR Director & Administrator)",
    topics: "Team collaboration, company values, career growth, and offer alignment.",
    status: "Upcoming (Unlocks after Round 2)",
  },
];

export function JourneyTrack({ track }: { track: ApplicationOverview["track"] | any[] }) {
  const { t } = useTranslation();
  const f = useFormat();
  const [isInterviewExpanded, setIsInterviewExpanded] = useState(false);
  const [selectedRound, setSelectedRound] = useState<typeof ROUND_DETAILS[0] | null>(null);

  const displayedTrack = useMemo(() => {
    if (!Array.isArray(track)) return [];
    const result: Array<{
      key: string;
      label: string;
      state: "done" | "current" | "upcoming";
      at: string | null;
      stepNumber: string;
      isInterviewStep?: boolean;
      isSubStep?: boolean;
      isCompact?: boolean;
      subLabel?: string;
      roundDetail?: typeof ROUND_DETAILS[0];
    }> = [];

    let stepNum = 1;

    for (const m of track) {
      const isInterview = m.key === "INTERVIEW_SCHEDULE" || m.key === "INTERVIEWS";
      const currentNum = String(stepNum++);

      result.push({
        key: m.key,
        label: (m as any).label || t(`milestone.${m.key}`),
        state: m.state,
        at: m.at,
        stepNumber: currentNum,
        isInterviewStep: isInterview,
        isCompact: isInterviewExpanded && !isInterview,
      });

      if (isInterview && isInterviewExpanded) {
        const round1State = (m as any).rounds?.[0]?.state || (m.state === "current" ? "current" : m.state === "done" ? "done" : "upcoming");
        const round2State = (m as any).rounds?.[1]?.state || (m.state === "done" ? "done" : "upcoming");
        const round3State = (m as any).rounds?.[2]?.state || (m.state === "done" ? "done" : "upcoming");

        result.push(
          {
            key: "INTERVIEW_ROUND_1",
            label: "Round 1",
            subLabel: "Technical Screening",
            state: round1State,
            at: null,
            stepNumber: `${currentNum}.1`,
            isSubStep: true,
            isCompact: false,
            roundDetail: ROUND_DETAILS[0],
          },
          {
            key: "INTERVIEW_ROUND_2",
            label: "Round 2",
            subLabel: "System Architecture",
            state: round2State,
            at: null,
            stepNumber: `${currentNum}.2`,
            isSubStep: true,
            isCompact: false,
            roundDetail: ROUND_DETAILS[1],
          },
          {
            key: "INTERVIEW_ROUND_3",
            label: "Round 3",
            subLabel: "Leadership Fit",
            state: round3State,
            at: null,
            stepNumber: `${currentNum}.3`,
            isSubStep: true,
            isCompact: false,
            roundDetail: ROUND_DETAILS[2],
          }
        );
      }
    }

    return result;
  }, [track, isInterviewExpanded, t]);

  if (!Array.isArray(track) || track.length === 0) return null;

  return (
    <div className="w-full overflow-x-auto pb-1">
      <style>{`
        .track-item-compact::after {
          left: 44px !important;
          right: 4px !important;
        }
      `}</style>
      <ol
        aria-label={t("overview.progressLabel")}
        className="grid w-full transition-all duration-300"
        style={{
          gridTemplateColumns: isInterviewExpanded
            ? "minmax(55px, 0.65fr) minmax(60px, 0.7fr) minmax(70px, 0.75fr) minmax(65px, 0.7fr) minmax(130px, 1.4fr) minmax(110px, 1.2fr) minmax(110px, 1.2fr) minmax(110px, 1.2fr) minmax(55px, 0.6fr) minmax(65px, 0.7fr)"
            : `repeat(${displayedTrack.length}, minmax(0, 1fr))`,
        }}
      >
        {displayedTrack.map((m) => {
          if (m.isInterviewStep) {
            return (
              <li
                key={m.key}
                data-state={m.state}
                className="track-item relative flex flex-col gap-2 pr-2 cursor-pointer select-none group"
                aria-current={m.state === "current" ? "step" : undefined}
                aria-expanded={isInterviewExpanded}
                onClick={() => setIsInterviewExpanded((prev) => !prev)}
                title={isInterviewExpanded ? "Click to collapse interview rounds" : "Click to view 3 interview rounds (5.1, 5.2, 5.3)"}
              >
                <span
                  className={clsx(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 font-display text-sm font-bold transition-all group-hover:scale-105",
                    m.state === "done" && "border-ok bg-ok text-white",
                    m.state === "current" && "border-brand bg-brand text-brand-fg shadow-[0_0_0_6px_rgb(var(--brand)/0.12)]",
                    m.state === "upcoming" && "border-[#E4E9F0] bg-[#F1F4F8] text-ink-muted group-hover:border-brand/50",
                  )}
                >
                  {m.state === "done" ? <Check size={18} /> : m.stepNumber}
                </span>
                <span
                  className={clsx(
                    "text-sm whitespace-nowrap transition-colors flex items-center gap-1",
                    m.state === "upcoming" ? "font-medium text-ink-muted group-hover:text-brand" : "font-semibold",
                    m.state === "current" && "text-brand"
                  )}
                >
                  <span>{m.label}</span>
                  <span className="text-[11px] font-bold text-brand ml-0.5">
                    {isInterviewExpanded ? "▴" : "▾"}
                  </span>
                </span>
                
              </li>
            );
          }

          if (m.isSubStep) {
            return (
              <li
                key={m.key}
                data-state={m.state}
                className="track-item relative flex flex-col gap-2 pr-2 cursor-pointer select-none group"
                onClick={() => {
                  if (m.roundDetail) setSelectedRound(m.roundDetail);
                }}
                title={`Click to view ${m.label} (${m.stepNumber}) details`}
              >
                <span
                  className={clsx(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 font-display text-xs font-bold transition-all group-hover:scale-105",
                    m.state === "done" && "border-ok bg-ok text-white",
                    m.state === "current" && "border-brand bg-brand text-brand-fg shadow-[0_0_0_6px_rgb(var(--brand)/0.12)]",
                    m.state === "upcoming" && "border-[#E4E9F0] bg-[#F1F4F8] text-ink-muted group-hover:border-brand/50 group-hover:text-brand",
                  )}
                >
                  {m.state === "done" ? <Check size={16} /> : m.stepNumber}
                </span>
                <span
                  className={clsx(
                    "text-sm whitespace-nowrap transition-colors",
                    m.state === "upcoming" ? "font-medium text-ink-muted group-hover:text-brand" : "font-semibold",
                    m.state === "current" && "text-brand"
                  )}
                >
                  {m.label}
                </span>
                <span className="min-h-4 text-xs text-ink-muted group-hover:text-brand truncate">
                  {m.subLabel}
                </span>
              </li>
            );
          }

          return (
            <li
              key={m.key}
              data-state={m.state}
              className={clsx(
                "track-item relative flex flex-col gap-2 pr-2 transition-all",
                m.isCompact && "track-item-compact cursor-pointer select-none group"
              )}
              aria-current={m.state === "current" ? "step" : undefined}
              onClick={() => {
                if (isInterviewExpanded) {
                  setIsInterviewExpanded(false);
                }
              }}
              title={m.isCompact ? `Click to return to normal view (${m.label})` : undefined}
            >
              <span
                className={clsx(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 font-display text-sm font-bold transition-all",
                  m.state === "done" && "border-ok bg-ok text-white",
                  m.state === "current" && "border-brand bg-brand text-brand-fg shadow-[0_0_0_6px_rgb(var(--brand)/0.12)]",
                  m.state === "upcoming" && "border-[#E4E9F0] bg-[#F1F4F8] text-ink-muted",
                  m.isCompact && "group-hover:scale-105 group-hover:border-brand/50"
                )}
              >
                {m.state === "done" ? <Check size={18} /> : m.stepNumber}
              </span>
              <span
                className={clsx(
                  "transition-colors",
                  m.isCompact
                    ? "text-xs font-medium truncate group-hover:text-brand max-w-full"
                    : "text-sm whitespace-nowrap",
                  m.state === "upcoming" ? "text-ink-muted" : "font-semibold",
                  m.state === "current" && "text-brand"
                )}
                title={m.label}
              >
                {m.label}
              </span>
              <span className="min-h-4 text-xs text-ink-muted">
                {m.at ? f.dayMonth(m.at) : ""}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Modal: Interview Round Details */}
      <Modal
        open={Boolean(selectedRound)}
        onClose={() => setSelectedRound(null)}
        title={selectedRound ? `${selectedRound.name} — ${selectedRound.title}` : "Interview Schedule — Rounds"}
        subtitle="Evaluation rounds configured for Interview Schedule stage"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-brand/5 border border-brand/20 p-3 text-xs text-brand-ink">
            <Eye size={16} className="text-brand shrink-0" />
            <span>
              Evaluation rounds scheduled for candidates at the <strong>Interview schedule</strong> stage.
            </span>
          </div>

          <div className="space-y-3">
            {ROUND_DETAILS.map((rd) => {
              const isSelected = selectedRound?.name === rd.name;
              return (
                <div
                  key={rd.name}
                  className={clsx(
                    "rounded-xl border p-4 transition-all",
                    isSelected
                      ? "border-brand bg-brand/[0.04] shadow-sm ring-1 ring-brand/30"
                      : "border-line bg-canvas/40 hover:bg-canvas/80"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-brand text-brand-fg px-2 py-0.5 text-xs font-bold font-mono">
                        {rd.name}
                      </span>
                      <h4 className="text-sm font-semibold text-ink">{rd.title}</h4>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-medium text-ink-muted">
                      <Clock size={11} /> {rd.duration}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-ink-muted leading-relaxed">
                    {rd.topics}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center justify-between border-t border-line-soft pt-2.5 text-xs text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <Video size={13} className="text-brand" />
                      <strong className="text-ink">Format:</strong> {rd.format}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-forest" />
                      <strong className="text-ink">Interviewer:</strong> {rd.interviewer}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-xs text-ink-muted">
              Rounds are evaluated sequentially from Round 1 to Round 3.
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelectedRound(null)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
