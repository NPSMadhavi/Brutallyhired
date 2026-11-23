import type { ApplicationOverview } from "@verity/shared";
import { clsx } from "clsx";
import { useState } from "react";
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
  const [previewRounds, setPreviewRounds] = useState(true);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedRound, setSelectedRound] = useState<typeof ROUND_DETAILS[0] | null>(null);

  if (!Array.isArray(track) || track.length === 0) return null;
  return (
    <div className="overflow-x-auto pb-2">
      <ol aria-label={t("overview.progressLabel")} className="grid min-w-[780px]" style={{ gridTemplateColumns: `repeat(${track.length}, minmax(0, 1fr))` }}>
        {track.map((m, i) => (
          <li key={m.key || i} data-state={m.state} className="track-item relative flex flex-col gap-2 pr-2.5" aria-current={m.state === "current" ? "step" : undefined}>
            <span
              className={clsx(
                "flex h-10 w-10 items-center justify-center rounded-full border-2 font-display text-sm font-bold transition-all",
                m.state === "done" && "border-ok bg-ok text-white",
                m.state === "current" && "border-brand bg-brand text-brand-fg shadow-[0_0_0_6px_rgb(var(--brand)/0.12)]",
                m.state === "upcoming" && "border-[#E4E9F0] bg-[#F1F4F8] text-ink-muted",
              )}
            >
              {m.state === "done" ? <Check size={18} /> : i + 1}
            </span>
            <span className={clsx("text-sm whitespace-nowrap", m.state === "upcoming" ? "font-medium text-ink-muted" : "font-semibold", m.state === "current" && "text-brand")}>
              {(m as any).label || t(`milestone.${m.key}`)}
            </span>
            <span className="min-h-4 text-xs text-ink-muted">{m.at ? f.dayMonth(m.at) : ""}</span>

            {/* When it is in interview schedule, Round 1, Round 2, Round 3 are visible with testing preview */}
            {(m.key === "INTERVIEW_SCHEDULE" || m.key === "INTERVIEWS") && (
              <div className="mt-1 flex flex-col gap-1.5">
                {/* Testing Preview Toggle Button */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewRounds((prev) => !prev);
                    }}
                    className="inline-flex items-center gap-1 rounded bg-brand/10 hover:bg-brand/20 px-2 py-0.5 text-[11px] font-semibold text-brand transition-colors cursor-pointer border border-brand/20 shadow-xs"
                    title="Toggle rounds preview for testing"
                  >
                    <Eye size={12} />
                    <span>{previewRounds ? "Hide preview" : "Preview rounds"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewModalOpen(true);
                    }}
                    className="text-[10px] text-ink-muted hover:text-brand underline cursor-pointer"
                  >
                    View details
                  </button>
                </div>

                {/* Visible Rounds (active in interview schedule stage or when preview is toggled) */}
                {(m.state === "current" || previewRounds || (m as any).showRounds) && (
                  <div className="flex flex-wrap items-center gap-1">
                    {(
                      (m as any).rounds || [
                        { name: "Round 1", state: m.state === "current" ? "current" : "upcoming" },
                        { name: "Round 2", state: "upcoming" },
                        { name: "Round 3", state: "upcoming" },
                      ]
                    ).map((r: { name: string; state?: "done" | "current" | "upcoming" }) => (
                      <button
                        key={r.name}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const found = ROUND_DETAILS.find((rd) => rd.name === r.name);
                          if (found) {
                            setSelectedRound(found);
                          } else {
                            setPreviewModalOpen(true);
                          }
                        }}
                        title={`Click to preview ${r.name} details`}
                        className={clsx(
                          "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-all cursor-pointer hover:opacity-85 shadow-xs",
                          r.state === "done" && "bg-emerald-50 text-emerald-700 border border-emerald-200",
                          r.state === "current" && "bg-brand/10 text-brand border border-brand/30 ring-1 ring-brand/20",
                          (!r.state || r.state === "upcoming") && "bg-slate-100 text-ink-2 border border-slate-200 hover:border-brand/40",
                        )}
                      >
                        {r.state === "done" && <Check size={9} />}
                        {r.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      {/* Modal: Interview Rounds Preview for Testing */}
      <Modal
        open={previewModalOpen || Boolean(selectedRound)}
        onClose={() => {
          setPreviewModalOpen(false);
          setSelectedRound(null);
        }}
        title="Interview Schedule — Rounds Preview (Testing Mode)"
        subtitle="Evaluation rounds configured for Interview Schedule stage"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-brand/5 border border-brand/20 p-3 text-xs text-brand-ink">
            <Eye size={16} className="text-brand shrink-0" />
            <span>
              <strong>Testing Preview:</strong> These are the 3 evaluation rounds scheduled for candidates at the <strong>Interview schedule</strong> stage.
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
              onClick={() => {
                setPreviewModalOpen(false);
                setSelectedRound(null);
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
