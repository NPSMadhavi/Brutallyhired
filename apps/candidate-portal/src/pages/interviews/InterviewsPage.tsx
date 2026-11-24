import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { useInterviews } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Pill } from "@/components/ui/Card";
import { EmptyState, PageLoader } from "@/components/ui/feedback";
import { Arrow, Calendar, Check, ChevronLeft, Clock, Video } from "@/components/ui/icons";
import { useFormat } from "@/lib/format";
import { useEffect, useState } from "react";

export interface StoredRoundData {
  id: string;
  sequence: number;
  totalRounds: number;
  title: string;
  subtitle: string;
  type: "ASSIGNMENT_DEFENSE" | "LIVEKIT_VIDEO" | "LEADERSHIP_SCENARIO";
  durationMinutes: number;
  status: "AWAITING_BOOKING" | "SCHEDULED" | "ASSIGNMENT_SUBMITTED" | "COMPLETED";
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  panelists: string;
  formatBadge: string;
  description: string;
}

export function InterviewsPage() {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const f = useFormat();
  const { appId: rawAppId = "" } = useParams();
  const appId =
    rawAppId ||
    (() => {
      try {
        const raw = localStorage.getItem("bh_admin_applications");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed[0]?.id) return parsed[0].id;
        }
      } catch {}
      return "cmwssnj7e0003vnvsanhlfhqg";
    })();
  const q = useInterviews(tenant.slug, appId);
  const [rounds, setRounds] = useState<StoredRoundData[]>([]);

  useEffect(() => {
    // Load scheduled interviews from localStorage
    let storedScheduled: Record<string, any> = {};
    try {
      const raw = localStorage.getItem("bh_admin_interviews");
      if (raw) storedScheduled = JSON.parse(raw);
    } catch {}

    // Load assignment submissions
    let storedSubmissions: Record<string, any> = {};
    try {
      const raw = localStorage.getItem("bh_assignment_submissions");
      if (raw) storedSubmissions = JSON.parse(raw);
    } catch {}

    const now = new Date();
    const defaultStartR1 = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const defaultEndR1 = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();
    const defaultStartR2 = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const defaultEndR2 = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();
    const defaultStartR3 = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    const defaultEndR3 = new Date(now.getTime() + 49 * 60 * 60 * 1000).toISOString();

    const r1Sched = storedScheduled[`${appId}_round-1`] || storedScheduled["round-1"];
    const r2Sched = storedScheduled[`${appId}_round-2`] || storedScheduled["round-2"];
    const r3Sched = storedScheduled[`${appId}_round-3`] || storedScheduled["round-3"];

    const r1Sub = storedSubmissions[`${appId}_round-1`] || storedSubmissions["round-1"];
    const r3Sub = storedSubmissions[`${appId}_round-3`] || storedSubmissions["round-3"];

    const initialRounds: StoredRoundData[] = [
      {
        id: "round-1",
        sequence: 1,
        totalRounds: 3,
        title: "Round 1: Technical & Architecture Practical Assignment",
        subtitle: "In-Portal Assignment + System Architecture Defense",
        type: "ASSIGNMENT_DEFENSE",
        durationMinutes: 60,
        status: r1Sched?.status || (r1Sub ? "ASSIGNMENT_SUBMITTED" : "AWAITING_BOOKING"),
        scheduledStart: r1Sched?.startsAt || defaultStartR1,
        scheduledEnd: r1Sched?.endsAt || defaultEndR1,
        panelists: "Arun K. (Principal Architect) · Vikram M. (Staff Engineer)",
        formatBadge: "In-Portal Assignment & Defense",
        description: "Submit your distributed system architecture & proctored pipeline implementation, evaluated by Qwen 3.5:9b AI.",
      },
      {
        id: "round-2",
        sequence: 2,
        totalRounds: 3,
        title: "Round 2: Live Technical & System Deep-Dive",
        subtitle: "Interactive LiveRTC Video Room & Live Coding",
        type: "LIVEKIT_VIDEO",
        durationMinutes: 45,
        status: r2Sched?.status || (r1Sched?.status === "COMPLETED" || r1Sub ? "SCHEDULED" : "AWAITING_BOOKING"),
        scheduledStart: r2Sched?.startsAt || defaultStartR2,
        scheduledEnd: r2Sched?.endsAt || defaultEndR2,
        panelists: "Chandra S. (VP of Engineering)",
        formatBadge: "LiveKit RTC Video Conference",
        description: "Deep dive into distributed systems resiliency, live architecture diagrams, and high-concurrency event ingestion.",
      },
      {
        id: "round-3",
        sequence: 3,
        totalRounds: 3,
        title: "Round 3: Leadership, Product Strategy & Culture Alignment",
        subtitle: "Leadership Scenario Challenge + Executive Panel",
        type: "LEADERSHIP_SCENARIO",
        durationMinutes: 45,
        status: r3Sched?.status || (r3Sub ? "ASSIGNMENT_SUBMITTED" : "AWAITING_BOOKING"),
        scheduledStart: r3Sched?.startsAt || defaultStartR3,
        scheduledEnd: r3Sched?.endsAt || defaultEndR3,
        panelists: "Tanuja HR (Head of Talent) · Ananya R. (Director of Product)",
        formatBadge: "Executive & Culture Alignment",
        description: "Solve a crisis incident scenario, discuss product engineering vision, and align on leadership principles.",
      },
    ];

    setRounds(initialRounds);
  }, [appId]);

  if (q.isPending && !rounds.length) return <PageLoader />;

  // Submission checks for badges
  let storedSubmissions: Record<string, any> = {};
  try {
    const raw = localStorage.getItem("bh_assignment_submissions");
    if (raw) storedSubmissions = JSON.parse(raw);
  } catch {}

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link to={`/${tenant.slug}/applications/${appId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand no-underline">
          <ChevronLeft size={16} />
          {t("common.backToOverview")}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[30px] font-bold text-ink">Interview Rounds (3-Stage Process)</h1>
            <p className="text-sm text-ink-muted mt-0.5">
              Complete each round's practical assignment, select your defense slot, and meet the panel on LiveKit RTC.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-bold text-teal-800">
              AI Evaluated with Qwen 3.5:9b
            </span>
            <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-800">
              LiveKit RTC Video
            </span>
          </div>
        </div>
      </div>

      {/* Progress Track for 3 Rounds */}
      <div className="card p-4 rounded-2xl bg-canvas border border-line flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white font-bold text-sm">
            3
          </span>
          <div>
            <p className="text-sm font-bold text-ink">3-Round Structured Evaluation Track</p>
            <p className="text-xs text-ink-muted">All rounds are mandatory before formal offer generation.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-medium border border-emerald-200">
            <Check size={13} /> Screening Passed (92%)
          </span>
          <span className="px-2.5 py-1 rounded-full bg-brand-soft text-brand font-semibold border border-brand/20">
            Round 1 Active
          </span>
          <span className="px-2.5 py-1 rounded-full bg-line-soft text-ink-muted">
            Round 2 Ready
          </span>
          <span className="px-2.5 py-1 rounded-full bg-line-soft text-ink-muted">
            Round 3 Ready
          </span>
        </div>
      </div>

      {rounds.length === 0 ? (
        <EmptyState icon={<Calendar size={26} />} title={t("interviews.none")} body={t("interviews.noneBody")} />
      ) : (
        <ul className="flex max-w-[960px] flex-col gap-4 list-none p-0 m-0">
          {rounds.map((r) => {
            const sub = storedSubmissions[`${appId}_${r.id}`] || storedSubmissions[r.id];
            const hasScore = typeof sub?.evaluation?.score === "number";

            return (
              <li key={r.id}>
                <div className="card flex flex-col md:flex-row items-start md:items-center justify-between gap-5 p-5 md:p-6 transition-all hover:border-brand/40 hover:shadow-lift">
                  <div className="flex items-start gap-4 flex-1">
                    {r.scheduledStart ? (
                      <span className="flex w-16 shrink-0 flex-col items-center rounded-2xl bg-info-soft py-2 text-xs font-semibold uppercase tracking-wider text-info-ink border border-info-line">
                        {f.weekday(r.scheduledStart)}
                        <strong className="font-display text-2xl leading-tight tracking-normal text-ink">{f.dayNum(r.scheduledStart)}</strong>
                        {f.month(r.scheduledStart)}
                      </span>
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-info-soft text-info-ink">
                        <Calendar size={24} />
                      </span>
                    )}

                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="label-caps text-[11px] bg-line-soft px-2 py-0.5 rounded">
                          Round {r.sequence} of {r.totalRounds}
                        </span>
                        <span className="rounded-full bg-blue-50 text-blue-800 text-[11px] font-semibold px-2 py-0.5 border border-blue-200">
                          {r.formatBadge}
                        </span>
                        {hasScore && (
                          <span className="rounded-full bg-teal-50 text-teal-800 text-[11px] font-bold px-2 py-0.5 border border-teal-200 flex items-center gap-1">
                            <Check size={11} /> AI Score: {sub.evaluation.score}/100 ({sub.evaluation.verdict})
                          </span>
                        )}
                      </div>

                      <h2 className="font-display text-lg font-bold text-ink leading-tight m-0">
                        {r.title}
                      </h2>
                      <p className="text-xs text-ink-muted leading-relaxed line-clamp-2 m-0">
                        {r.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-2 pt-1">
                        <span className="flex items-center gap-1 font-medium">
                          <Clock size={13} className="text-ink-muted" /> {r.durationMinutes} Mins
                        </span>
                        <span>·</span>
                        <span className="text-ink-muted">
                          Panelists: <strong className="text-ink font-semibold">{r.panelists}</strong>
                        </span>
                        {r.scheduledStart && r.scheduledEnd && (
                          <>
                            <span>·</span>
                            <span className="text-brand font-medium">
                              {f.timeRange(r.scheduledStart, r.scheduledEnd)} ({f.tzName()})
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-line-soft">
                    <Pill tone={r.status === "COMPLETED" ? "teal" : r.status === "AWAITING_BOOKING" ? "amber" : "blue"}>
                      {r.status === "COMPLETED"
                        ? "Round Passed"
                        : r.status === "ASSIGNMENT_SUBMITTED"
                        ? "Assignment Evaluated"
                        : r.status === "SCHEDULED"
                        ? "Slot Confirmed"
                        : "Awaiting Booking"}
                    </Pill>

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/${tenant.slug}/applications/${appId}/interviews/${r.id}`}
                        className="rounded-xl bg-brand text-white font-semibold text-xs px-4 py-2 hover:bg-brand-hover transition-colors no-underline flex items-center gap-1.5 shadow-xs"
                      >
                        {r.type === "ASSIGNMENT_DEFENSE" || r.type === "LEADERSHIP_SCENARIO"
                          ? "Open Assignment & Workspace"
                          : "Enter Live Session"}
                        <Arrow size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
