import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { useMe, useOverview, useProfile, useWithdraw } from "@/api/hooks";
import { JourneyTrack } from "@/components/journey/JourneyTrack";
import { Updates } from "@/components/journey/Updates";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import { CheckRow, Pill } from "@/components/ui/Card";
import { ErrorState, InlineError, PageLoader } from "@/components/ui/feedback";
import { Arrow, Calendar, Check, Clock, File, Lock, Mail } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/misc";
import { useFormat } from "@/lib/format";
import { stageTone } from "./stageTone";

function buildCandidateJourneyTrack(
  stage: string,
  submittedAt?: string | null,
  opts?: { screeningTestSent?: boolean; screeningTestSubmitted?: boolean }
) {
  const normStage = (stage || "SUBMITTED").toUpperCase();
  const hasScreeningActivity = Boolean(opts?.screeningTestSent || opts?.screeningTestSubmitted);

  const isInReviewDone =
    [
      "SCREENING_TEST",
      "ASSESSMENT",
      "TEST_SUBMITTED",
      "ASSESSMENT_SUBMITTED",
      "ROUND_1_PASSED",
      "SHORTLISTED",
      "INTERVIEW",
      "INTERVIEW_SCHEDULE",
      "INTERVIEW_SCHEDULED",
      "OFFER",
      "SELECTED",
      "ONBOARDING",
      "HIRED",
    ].includes(normStage) ||
    ((normStage === "IN_REVIEW" || normStage === "UNDER_REVIEW") && hasScreeningActivity);

  const isInReviewCurrent =
    (normStage === "IN_REVIEW" || normStage === "UNDER_REVIEW") && !hasScreeningActivity;

  const isScreeningDone =
    [
      "SHORTLISTED",
      "ROUND_1_PASSED",
      "INTERVIEW",
      "INTERVIEW_SCHEDULE",
      "INTERVIEW_SCHEDULED",
      "OFFER",
      "SELECTED",
      "ONBOARDING",
      "HIRED",
    ].includes(normStage) ||
    ((normStage === "IN_REVIEW" || normStage === "UNDER_REVIEW") && Boolean(opts?.screeningTestSubmitted));

  const isScreeningCurrent =
    normStage === "SCREENING_TEST" ||
    normStage === "ASSESSMENT" ||
    normStage === "TEST_SUBMITTED" ||
    normStage === "ASSESSMENT_SUBMITTED" ||
    ((normStage === "IN_REVIEW" || normStage === "UNDER_REVIEW") &&
      Boolean(opts?.screeningTestSent) &&
      !opts?.screeningTestSubmitted);

  const isShortlistedDone = [
    "INTERVIEW",
    "INTERVIEW_SCHEDULE",
    "INTERVIEW_SCHEDULED",
    "OFFER",
    "SELECTED",
    "ONBOARDING",
    "HIRED",
  ].includes(normStage);
  const isShortlistedCurrent = normStage === "SHORTLISTED";

  const isInterviewDone = ["OFFER", "SELECTED", "ONBOARDING", "HIRED"].includes(normStage);
  const isInterviewCurrent =
    normStage === "INTERVIEW" ||
    normStage === "INTERVIEW_SCHEDULE" ||
    normStage === "INTERVIEW_SCHEDULED" ||
    normStage.includes("INTERVIEW");

  const isOfferDone = ["ONBOARDING", "HIRED"].includes(normStage);
  const isOfferCurrent = normStage === "OFFER" || normStage === "SELECTED";

  const isOnboardingDone = normStage === "HIRED";
  const isOnboardingCurrent = normStage === "ONBOARDING";

  return [
    {
      key: "APPLIED",
      label: "Applied",
      state: (normStage === "DRAFT" ? "current" : "done") as "done" | "current" | "upcoming",
      at: submittedAt || null,
    },
    {
      key: "IN_REVIEW",
      label: "In review",
      state: (isInReviewDone ? "done" : isInReviewCurrent ? "current" : "upcoming") as "done" | "current" | "upcoming",
      at: null,
    },
    {
      key: "SCREENING_TEST",
      label: "Screening test",
      state: (isScreeningDone ? "done" : isScreeningCurrent ? "current" : "upcoming") as "done" | "current" | "upcoming",
      at: null,
    },
    {
      key: "SHORTLISTED",
      label: "Shortlisted",
      state: (isShortlistedDone ? "done" : isShortlistedCurrent ? "current" : "upcoming") as "done" | "current" | "upcoming",
      at: null,
    },
    {
      key: "INTERVIEW_SCHEDULE",
      label: "Interview schedule",
      state: (isInterviewDone ? "done" : isInterviewCurrent ? "current" : "upcoming") as "done" | "current" | "upcoming",
      at: null,
      showRounds: isInterviewCurrent,
      rounds: [
        { name: "Round 1", state: isInterviewCurrent ? "current" : isInterviewDone ? "done" : "upcoming" },
        { name: "Round 2", state: isInterviewDone ? "done" : "upcoming" },
        { name: "Round 3", state: isInterviewDone ? "done" : "upcoming" },
      ],
    },
    {
      key: "OFFER",
      label: "Offer",
      state: (isOfferDone ? "done" : isOfferCurrent ? "current" : "upcoming") as "done" | "current" | "upcoming",
      at: null,
    },
    {
      key: "ONBOARDING",
      label: "Onboarding",
      state: (isOnboardingDone ? "done" : isOnboardingCurrent ? "current" : "upcoming") as "done" | "current" | "upcoming",
      at: null,
    },
  ];
}

export function OverviewPage() {
  const tenant = useTenantCtx();
  const { t, i18n } = useTranslation();
  const f = useFormat();
  const { appId = "" } = useParams();
  const me = useMe();
  const profile = useProfile(tenant.slug);
  const q = useOverview(tenant.slug, appId);
  const withdraw = useWithdraw(tenant.slug, appId);
  const [confirming, setConfirming] = useState(false);
  const [version, setVersion] = useState(0);

  const [selectedR1SlotId, setSelectedR1SlotId] = useState<string>("");
  const [selectedR1Date, setSelectedR1Date] = useState<string>("");
  const [nowTs, setNowTs] = useState<number>(() => Date.now());
  const [serverR1Slots, setServerR1Slots] = useState<Array<{ id: string; label: string; isoStart: string; date?: string; startTime?: string; endTime?: string }>>([]);

  useEffect(() => {
    fetch(`/api/t/${encodeURIComponent(tenant.slug)}/interview-slots`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.slots && Array.isArray(data.slots)) {
          const now = Date.now();
          const mapped = data.slots
            .filter((s: any) => s.roundNumber === 1 && s.status === "AVAILABLE")
            .map((s: any) => {
              const isoStart = s.date && s.startTime ? `${s.date}T${s.startTime}:00` : new Date().toISOString();
              return {
                id: s.id,
                label: `${s.date} · ${s.startTime} - ${s.endTime}`,
                isoStart,
                date: s.date,
                startTime: s.startTime,
                endTime: s.endTime,
              };
            })
            .filter((s: any) => {
              const t = new Date(s.isoStart).getTime();
              return Number.isFinite(t) && t > now - 15 * 60 * 1000;
            })
            .sort((a: any, b: any) => (a.isoStart || "").localeCompare(b.isoStart || ""));
          setServerR1Slots(mapped);
        }
      })
      .catch(() => {});
  }, [tenant.slug]);

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onUpdate = () => setVersion((v) => v + 1);
    window.addEventListener("storage", onUpdate);
    window.addEventListener("bh_application_updated", onUpdate);
    return () => {
      window.removeEventListener("storage", onUpdate);
      window.removeEventListener("bh_application_updated", onUpdate);
    };
  }, []);

  const localDraft = localStorage.getItem(`bh_draft_${appId}`);
  const localApps = localStorage.getItem("bh_admin_applications");
  let matchingApp: any = null;
  let adminListPresent = false;
  const userEmail = me.data?.email?.toLowerCase();
  if (localApps !== null) {
    try {
      const parsed = JSON.parse(localApps);
      if (Array.isArray(parsed)) {
        adminListPresent = true;
        matchingApp = parsed.find(
          (a: any) =>
            a.id === appId ||
            a.reference === appId ||
            a.externalRef === appId ||
            (userEmail && a.email?.toLowerCase() === userEmail && q.data?.job?.title && a.jobTitle === q.data.job.title)
        );
      }
    } catch {}
  }

  let rejectedMatch: any = null;
  const rejectedRaw = localStorage.getItem("bh_rejected_applications");
  if (rejectedRaw) {
    try {
      const parsed = JSON.parse(rejectedRaw);
      if (Array.isArray(parsed)) {
        rejectedMatch = parsed.find(
          (r: any) =>
            r.id === appId ||
            (!matchingApp &&
              userEmail &&
              r.email?.toLowerCase() === userEmail &&
              (!q.data?.job?.title || !r.jobTitle || r.jobTitle === q.data.job.title))
        );
      }
    } catch {}
  }

  let draftParsed: any = {};
  if (localDraft) {
    try {
      draftParsed = JSON.parse(localDraft);
    } catch {}
  }

  let o = q.data ? { ...q.data } : undefined;

  // Determine stage by taking the most advanced stage between API data and local admin storage
  const stagePriority: Record<string, number> = {
    DRAFT: 0,
    SUBMITTED: 1,
    IN_REVIEW: 2,
    UNDER_REVIEW: 2,
    SCREENING_TEST: 3,
    ASSESSMENT: 3,
    SHORTLISTED: 4,
    INTERVIEW: 5,
    INTERVIEW_SCHEDULE: 5,
    INTERVIEW_SCHEDULED: 5,
    OFFER: 6,
    SELECTED: 6,
    ONBOARDING: 7,
    HIRED: 8,
    REJECTED: 99,
    NOT_SELECTED: 99,
    WITHDRAWN: 99,
  };

  const localStage =
    rejectedMatch
      ? "REJECTED"
      : (matchingApp?.stage || draftParsed.stage || null);
  let effectiveStage: string = o?.stage || "SUBMITTED";
  if (rejectedMatch) {
    effectiveStage = "REJECTED";
  } else if (matchingApp?.stage) {
    // Admin stage in bh_admin_applications is authoritative (supports forward and backward changes)
    effectiveStage = matchingApp.stage;
  } else if (localStage && stagePriority[localStage] !== undefined) {
    const apiPriority = stagePriority[o?.stage || "SUBMITTED"] || 1;
    const locPriority = stagePriority[localStage] || 1;
    if (locPriority > apiPriority) {
      effectiveStage = localStage;
    }
  }

  if (!o) {
    if (localDraft || matchingApp || rejectedMatch) {
      o = {
        id: appId,
        reference: matchingApp?.reference || draftParsed.reference || `APP-${appId.slice(-6)}`,
        stage: effectiveStage,
        closed: effectiveStage === "REJECTED" || effectiveStage === "NOT_SELECTED" || effectiveStage === "WITHDRAWN",
        job: draftParsed.job || { title: matchingApp?.jobTitle || rejectedMatch?.jobTitle || "Software Developer", location: "Hybrid / Flexible" },
        submittedAt: matchingApp?.submittedAt || draftParsed.submittedAt || rejectedMatch?.rejectedAt || new Date().toISOString(),
        events: [
          {
            id: `ev-${appId}-sub`,
            type: "application_submitted",
            createdAt: draftParsed.submittedAt || new Date().toISOString(),
            data: {
              reference: matchingApp?.reference || draftParsed.reference || `APP-${appId.slice(-6)}`,
              jobTitle: matchingApp?.jobTitle || rejectedMatch?.jobTitle || "Software Developer",
            },
          },
        ],
        track: buildCandidateJourneyTrack(effectiveStage, draftParsed.submittedAt || matchingApp?.submittedAt),
        nextAction: null as any,
      } as any;
    }
  }

  // If application exists, synchronize its stage, events, and computed nextAction
  if (o) {
    o.stage = effectiveStage as any;
    o.closed = effectiveStage === "REJECTED" || effectiveStage === "NOT_SELECTED" || effectiveStage === "WITHDRAWN" ? true : o.closed;
    o.track = buildCandidateJourneyTrack(effectiveStage, o.submittedAt, {
      screeningTestSent: matchingApp?.screeningTestSent,
      screeningTestSubmitted: matchingApp?.screeningTestSubmitted,
    }) as any;

    const stageEventMap: Record<string, { type: string; data: Record<string, string> }> = {
      IN_REVIEW: { type: "review_started", data: {} },
      UNDER_REVIEW: { type: "review_started", data: {} },
      ASSESSMENT: {
        type: "assessment_invited",
        data: {
          title: "Round 1 Technical Assessment",
          dueAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        },
      },
      SCREENING_TEST: {
        type: "screening_invited",
        data: {},
      },
      SHORTLISTED: { type: "shortlisted", data: {} },
      INTERVIEW: { type: "interview_invited", data: { title: o.job?.title || "Technical Interview" } },
      INTERVIEW_SCHEDULE: { type: "interview_invited", data: { title: o.job?.title || "Technical Interview" } },
      INTERVIEW_SCHEDULED: { type: "interview_invited", data: { title: o.job?.title || "Technical Interview" } },
      OFFER: { type: "offer_sent", data: { respondBy: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() } },
      ONBOARDING: { type: "onboarding_started", data: {} },
      HIRED: { type: "hired", data: {} },
      ON_HOLD: { type: "on_hold", data: {} },
      REJECTED: { type: "application_rejected", data: {} },
      NOT_SELECTED: { type: "application_closed", data: {} },
    };

    const existingEvents = Array.isArray(o.events) ? [...o.events] : [];
    const recordedEvents: any[] = [];
    try {
      const rawEv = localStorage.getItem("bh_application_events");
      if (rawEv) {
        const parsedEv = JSON.parse(rawEv);
        if (Array.isArray(parsedEv)) {
          for (const item of parsedEv) {
            const matchesApp =
              item.appId === appId ||
              item.appId === o.id ||
              (userEmail && item.email?.toLowerCase() === userEmail && (!item.jobTitle || item.jobTitle === o.job?.title));
            if (matchesApp && item.event && !existingEvents.some((e) => e.id === item.event.id)) {
              recordedEvents.push(item.event);
            }
          }
        }
      }
    } catch {}

    let mergedEvents = [...recordedEvents, ...existingEvents];
    const mapped = stageEventMap[(effectiveStage || "").toUpperCase()];
    if (mapped && !mergedEvents.some((e) => e.type === mapped.type)) {
      mergedEvents = [
        {
          id: `ev-stage-${effectiveStage}-${o.id}`,
          type: mapped.type as any,
          createdAt: new Date().toISOString(),
          data: mapped.data,
        },
        ...mergedEvents,
      ];
    }
    o.events = mergedEvents;
    o.nextAction = (
      effectiveStage === "WITHDRAWN"
        ? { type: "CLOSED", reason: "WITHDRAWN" }
        : effectiveStage === "REJECTED"
        ? { type: "CLOSED", reason: "REJECTED" }
        : effectiveStage === "NOT_SELECTED"
        ? { type: "CLOSED", reason: "NOT_SELECTED" }
        : effectiveStage === "IN_REVIEW" && matchingApp?.screeningTestSent && !matchingApp?.screeningTestSubmitted
        ? {
            type: "SCREENING_TEST",
            path: `/${tenant.slug}/applications/${appId}/screening`,
          }
        : effectiveStage === "IN_REVIEW" && matchingApp?.screeningTestSubmitted
        ? {
            type: "AWAIT_DECISION",
            title: "Screening Test Submitted",
          }
        : effectiveStage === "SCREENING_TEST" || effectiveStage === "ASSESSMENT"
        ? {
            type: "TAKE_ASSESSMENT",
            title: "Round 1 Proctored Technical Assessment Ready",
            dueAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
            durationMinutes: 45,
            inviteId: appId,
            path: `/${tenant.slug}/applications/${appId}/assessments/assess-1`,
            label: "Start Proctored Assessment Now →",
          }
        : effectiveStage === "SHORTLISTED"
        ? {
            type: "AWAIT_DECISION",
            title: "Shortlisted for Interviews",
          }
        : effectiveStage === "INTERVIEW" || effectiveStage === "INTERVIEW_SCHEDULE" || effectiveStage === "INTERVIEW_SCHEDULED"
        ? {
            type: "ATTEND_INTERVIEW",
            title: "3-Round Practical Evaluation & Interview Schedule",
            startsAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
            endsAt: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
            path: `/${tenant.slug}/applications/${appId}/interviews`,
            label: "Proceed to 3-Round Interview Process →",
          }
        : effectiveStage === "OFFER" || effectiveStage === "SELECTED"
        ? {
            type: "RESPOND_TO_OFFER",
            respondBy: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
            path: `/${tenant.slug}/applications/${appId}/offer`,
            label: "Review Formal Job Offer & Sign →",
          }
        : effectiveStage === "ONBOARDING" || effectiveStage === "HIRED"
        ? {
            type: "COMPLETE_ONBOARDING",
            pending: 2,
            startDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
          }
        : { type: "AWAIT_REVIEW" }
    ) as any;
  }

  if (q.isPending && !o) return <PageLoader />;
  if (q.isError && !o) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!o) {
    return (
      <div className="space-y-6 py-10">
        <div className="card mx-auto flex max-w-lg flex-col items-center justify-center p-8 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-line-soft text-ink-muted">
            <File size={24} />
          </div>
          <h2 className="text-xl font-bold text-ink">Application Not Found</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            This application record does not exist or has been removed. You can browse active job openings and submit a fresh application.
          </p>
          <div className="mt-6">
            <Link
              to={`/${tenant.slug}/applications`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-ink-2 shadow-sm"
            >
              Browse Open Positions <Arrow size={14} className="text-white" />
            </Link>
          </div>
        </div>
      </div>
    );
  }
  const base = `/${tenant.slug}/applications/${o.id}`;
  let candidateNameFallback = "";
  if (!me.data?.displayName && !profile.data?.profile?.firstName) {
    try {
      const localApps = localStorage.getItem("bh_admin_applications");
      if (localApps) {
        const parsed = JSON.parse(localApps);
        if (Array.isArray(parsed)) {
          const m = parsed.find((a: any) => a.id === appId);
          if (m?.candidateName) candidateNameFallback = m.candidateName.trim().split(/\s+/)[0];
        }
      }
    } catch {}
  }
  const firstName =
    me.data?.displayName?.trim()?.split(/\s+/)[0] ||
    profile.data?.profile?.firstName ||
    profile.data?.displayName?.trim()?.split(/\s+/)[0] ||
    candidateNameFallback ||
    "";
  const canWithdraw = !o.closed && !["DRAFT", "HIRED"].includes(o.stage);
  const now = new Date();
  const weekday = new Intl.DateTimeFormat(i18n.language || "en", { weekday: "long" }).format(now);

  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-6 rounded-3xl bg-ink p-8 md:p-10">
        <div className="flex max-w-[720px] flex-col gap-3">
          <h1
            className="text-[34px] leading-tight text-white md:text-[40px] font-serif"
            style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
          >
            {firstName ? (
              <>
                Hi {firstName},
                <br />
                Your journey starts here.
              </>
            ) : (
              <>
                Hi,
                <br />
                Your journey starts here.
              </>
            )}
          </h1>
          <p className="text-base leading-relaxed text-[#C9D3E0]">
            Track your application, stay updated on your progress, and discover what comes next in your hiring journey.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[13px] text-[#C9D3E0]">{weekday}</span>
          <span className="font-display text-2xl font-bold text-white">{f.date(now)}</span>
          <span className="rounded-full bg-[#7FD1C4]/15 px-2.5 py-1 text-xs font-semibold text-[#7FD1C4]">Today</span>
        </div>
      </section>

      <section className="card flex flex-col gap-8 md:p-8" aria-labelledby="app-h">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="label-caps">{t("overview.yourApplication", { reference: o.reference })}</span>
            <h2 id="app-h" className="text-[26px] leading-tight">{o.job.title}</h2>
            <p className="text-sm text-ink-muted">
              {[tenant.name, o.job.location, o.submittedAt ? t("overview.appliedOn", { date: f.date(o.submittedAt) }) : null].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Pill tone={stageTone(o.stage)} dot className="px-3 py-1.5 text-[13px]">{t(`stage.${o.stage}`)}</Pill>
        </div>
        {!o.closed && (
          <JourneyTrack
            track={buildCandidateJourneyTrack(o.stage, o.submittedAt, {
              screeningTestSent: matchingApp?.screeningTestSent,
              screeningTestSubmitted: matchingApp?.screeningTestSubmitted,
            })}
          />
        )}

        {o.closed && (
          <div className="rounded-2xl border border-line bg-canvas p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-ink">
                {(o.stage as string) === "REJECTED"
                  ? "Application rejected"
                  : o.stage === "WITHDRAWN"
                  ? "You withdrew this application"
                  : "This application is closed"}
              </h3>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                {(o.stage as string) === "REJECTED"
                  ? "Thank you for applying. Unfortunately, your application was not selected to move forward."
                  : "This application is closed. Thank you for your interest."}
              </p>
            </div>
            <div className="border-t border-line-soft pt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-ink-muted">Ready to explore other opportunities with {tenant.name}?</span>
              <Link
                to={`/${tenant.slug}/applications`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-1.5 text-xs font-semibold text-white no-underline hover:bg-ink-2 shadow-sm"
              >
                Explore Open Positions & Apply <Arrow size={13} className="text-white" />
              </Link>
            </div>
          </div>
        )}

        {!o.closed && (o.stage as string) === "ON_HOLD" && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-amber-950">Application Placed On Hold</h3>
              <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">ON HOLD</span>
            </div>
            <p className="text-xs text-amber-900 leading-relaxed">
              {matchingApp?.holdReason ||
                matchingApp?.screeningAiReason ||
                "Your screening responses require further review and your application has been placed on hold."}
            </p>
          </div>
        )}

        {!o.closed && o.stage === "IN_REVIEW" && !matchingApp?.screeningTestSubmitted && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-200 bg-teal-50/40 p-5">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-ink">Screening Test Ready</h3>
              <p className="text-xs text-ink-muted">
                Complete your screening test questions. Our AI will evaluate your responses automatically.
              </p>
            </div>
            <ButtonAnchor href={`/${tenant.slug}/applications/${appId}/screening`} variant="primary">
              Start Screening Test →
            </ButtonAnchor>
          </div>
        )}

        {!o.closed && o.stage === "OFFER" && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-200 bg-teal-50/40 p-5">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-ink">Formal Job Offer Ready</h3>
              <p className="text-xs text-ink-muted">Review your formal employment offer letter and sign.</p>
            </div>
            <ButtonAnchor href={`/${tenant.slug}/applications/${appId}/offer`} variant="primary">
              Review Formal Job Offer & Sign →
            </ButtonAnchor>
          </div>
        )}

        {!o.closed && (o.stage === "ONBOARDING" || o.stage === "HIRED") && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-200 bg-teal-50/40 p-5">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-ink">Onboarding Checklist</h3>
              <p className="text-xs text-ink-muted">Complete your onboarding documents and joining details.</p>
            </div>
            <ButtonAnchor href={`/${tenant.slug}/applications/${appId}/onboarding`} variant="primary">
              Open Onboarding →
            </ButtonAnchor>
          </div>
        )}

        {/* Round 1 Slot Selection & 10-minute Assessment Unlock when Shortlisted / Interview Scheduled */}
        {!o.closed && ((o.stage as string) === "SHORTLISTED" || (o.stage as string) === "INTERVIEW_SCHEDULED") && (() => {
          const rawSlots: Array<{ id: string; label: string; isoStart: string; date?: string; startTime?: string; endTime?: string }> =
            Array.isArray(matchingApp?.round1Slots) && matchingApp.round1Slots.length > 0
              ? matchingApp.round1Slots
              : serverR1Slots;

          // Filter out past slots and sort chronologically ascending
          const availableR1Slots = rawSlots
            .filter((s) => {
              const iso = s.isoStart || (s.date && s.startTime ? `${s.date}T${s.startTime}:00` : "");
              if (!iso) return false;
              const t = new Date(iso).getTime();
              return Number.isFinite(t) && t > nowTs - 15 * 60 * 1000;
            })
            .sort((a, b) => {
              const aIso = a.isoStart || `${a.date}T${a.startTime}:00`;
              const bIso = b.isoStart || `${b.date}T${b.startTime}:00`;
              return aIso.localeCompare(bIso);
            });

          if (!matchingApp?.round1BookedSlot && availableR1Slots.length === 0) return null;

          // Group by Date YYYY-MM-DD
          const dateMap: { [dateStr: string]: typeof availableR1Slots } = {};
          for (const slot of availableR1Slots) {
            const dStr = slot.date || (slot.isoStart ? slot.isoStart.slice(0, 10) : "");
            if (!dStr) continue;
            if (!dateMap[dStr]) dateMap[dStr] = [];
            dateMap[dStr].push(slot);
          }
          const sortedDates = Object.keys(dateMap).sort();
          const activeDate = (selectedR1Date && sortedDates.includes(selectedR1Date))
            ? selectedR1Date
            : sortedDates[0] || "";
          const activeSlots = activeDate ? (dateMap[activeDate] || []) : [];

          const formatSlotDate = (dStr: string) => {
            const rawParts = dStr.split("-");
            if (rawParts.length !== 3) return { weekday: "", day: dStr, full: dStr, isToday: false, isTomorrow: false };
            const y = Number(rawParts[0]) || 2026;
            const m = Number(rawParts[1]) || 1;
            const d = Number(rawParts[2]) || 1;
            const dt = new Date(y, m - 1, d);
            const today = new Date();
            const isToday = dt.toDateString() === today.toDateString();
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            const isTomorrow = dt.toDateString() === tomorrow.toDateString();
            const weekday = dt.toLocaleDateString("en-US", { weekday: "short" });
            const month = dt.toLocaleDateString("en-US", { month: "short" });
            return {
              weekday,
              day: `${d} ${month}`,
              full: dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
              isToday,
              isTomorrow,
            };
          };

          const formatSlotTime = (tStr?: string) => {
            if (!tStr) return "";
            const rawParts = tStr.split(":");
            const first = rawParts[0] ?? "";
            let h = parseInt(first, 10);
            const m = rawParts[1] ?? "00";
            if (isNaN(h)) return tStr;
            const ampm = h >= 12 ? "PM" : "AM";
            h = h % 12 || 12;
            return `${h}:${m} ${ampm}`;
          };

          return (
          <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-5 space-y-4">
            {!matchingApp?.round1BookedSlot ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-teal-100">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-100 text-teal-800">
                      <Calendar size={16} />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-ink">Schedule Round 1 Assessment</h3>
                      <p className="text-xs text-ink-muted">
                        Select an available date & time. Your Round 1 AI questions will be emailed 1 hour before.
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-teal-800 bg-teal-100/90 px-2.5 py-1 rounded-full">
                    {availableR1Slots.length} Available Slots
                  </span>
                </div>

                {/* Date Selector Tabs */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block mb-2">
                    1. Select Date
                  </span>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {sortedDates.map((dStr) => {
                      const info = formatSlotDate(dStr);
                      const isSelected = activeDate === dStr;
                      const count = dateMap[dStr]?.length ?? 0;
                      return (
                        <button
                          key={dStr}
                          type="button"
                          onClick={() => {
                            setSelectedR1Date(dStr);
                            const currentSlot = availableR1Slots.find((s) => s.id === selectedR1SlotId);
                            if (currentSlot && (currentSlot.date || currentSlot.isoStart?.slice(0, 10)) !== dStr) {
                              setSelectedR1SlotId("");
                            }
                          }}
                          className={`flex min-w-[105px] flex-col items-center justify-center rounded-xl border px-3 py-2 text-center transition-all cursor-pointer ${
                            isSelected
                              ? "border-teal-700 bg-teal-700 text-white shadow-xs"
                              : "border-teal-200/90 bg-white text-ink hover:border-teal-400 hover:bg-teal-50/50"
                          }`}
                        >
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? "text-teal-100" : "text-ink-muted"}`}>
                            {info.isToday ? "Today" : info.isTomorrow ? "Tomorrow" : info.weekday}
                          </span>
                          <span className="text-sm font-extrabold mt-0.5">{info.day}</span>
                          <span className={`text-[10px] font-medium mt-0.5 ${isSelected ? "text-teal-100" : "text-teal-700"}`}>
                            {count} {count === 1 ? "slot" : "slots"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time Slots Grid for Active Date */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                      2. Select Time ({activeDate ? formatSlotDate(activeDate).full : ""})
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-ink-muted">
                      <Clock size={12} /> 60 mins duration
                    </span>
                  </div>
                  {activeSlots.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      No more available slots for this date. Please pick another date above.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {activeSlots.map((slot) => {
                        const isPicked = selectedR1SlotId === slot.id;
                        const timeLabel = slot.startTime && slot.endTime
                          ? `${formatSlotTime(slot.startTime)} - ${formatSlotTime(slot.endTime)}`
                          : slot.label;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSelectedR1SlotId(slot.id)}
                            className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-3 text-xs font-semibold transition-all cursor-pointer ${
                              isPicked
                                ? "border-teal-700 bg-teal-700 text-white shadow-xs ring-2 ring-teal-600/30"
                                : "border-line bg-white text-ink hover:border-teal-500 hover:bg-teal-50/30"
                            }`}
                          >
                            {isPicked && <Check size={12} className="stroke-[3]" />}
                            <span>{timeLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Selected Slot Confirmation Footer */}
                {(() => {
                  const chosen = availableR1Slots.find((s) => s.id === selectedR1SlotId);
                  const chosenDateInfo = chosen?.date ? formatSlotDate(chosen.date) : null;
                  const chosenTime = chosen?.startTime ? `${formatSlotTime(chosen.startTime)} - ${formatSlotTime(chosen.endTime)}` : "";
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-teal-100">
                      <div className="text-xs">
                        {chosen ? (
                          <div className="flex items-center gap-2 text-ink">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-teal-800">
                              <Check size={12} className="stroke-[3]" />
                            </span>
                            <span>
                              Selected: <strong>{chosenDateInfo?.full}</strong> · <strong>{chosenTime}</strong>
                            </span>
                          </div>
                        ) : (
                          <span className="text-ink-muted italic">Please choose an examination time slot above to proceed.</span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="primary"
                        disabled={!selectedR1SlotId}
                        onClick={() => {
                          if (!chosen) return;
                          const formattedLabel = `${chosenDateInfo?.full || chosen.date} · ${chosenTime || chosen.startTime}`;
                          const slotWithFormattedLabel = { ...chosen, label: formattedLabel };

                          void fetch(`/api/t/${encodeURIComponent(tenant.slug)}/workflow/applications/${encodeURIComponent(appId)}/round1/book-slot`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "x-verity-csrf": "1" },
                            body: JSON.stringify({
                              slotId: chosen.id,
                              startsAtIso: chosen.isoStart,
                              date: chosen.date,
                              startTime: chosen.startTime,
                              endTime: chosen.endTime,
                            }),
                          }).catch(() => {});
                          try {
                            const rawApps = localStorage.getItem("bh_admin_applications");
                            if (rawApps) {
                              const apps = JSON.parse(rawApps);
                              const updated = apps.map((a: any) =>
                                a.id === appId || a.id === matchingApp?.id
                                  ? { ...a, stage: "INTERVIEW_SCHEDULED", round1BookedSlot: slotWithFormattedLabel }
                                  : a
                              );
                              localStorage.setItem("bh_admin_applications", JSON.stringify(updated));
                            }

                            // Mark slot as BOOKED in bh_interview_slots_all
                            const rawAllSlots = localStorage.getItem("bh_interview_slots_all");
                            if (rawAllSlots) {
                              const allSlots = JSON.parse(rawAllSlots);
                              if (Array.isArray(allSlots)) {
                                const nextSlots = allSlots.map((s: any) =>
                                  s.id === chosen.id
                                    ? {
                                        ...s,
                                        status: "BOOKED",
                                        bookedCandidateId: matchingApp.id,
                                        bookedCandidateName: matchingApp.candidateName || "Candidate",
                                        bookedCandidateEmail: matchingApp.email || me.data?.email,
                                      }
                                    : s
                                );
                                localStorage.setItem("bh_interview_slots_all", JSON.stringify(nextSlots));
                              }
                            }

                            // Add to bh_admin_interviews for Dashboard Upcoming Interviews
                            const rawInts = localStorage.getItem("bh_admin_interviews");
                            const ints = rawInts ? JSON.parse(rawInts) : [];
                            if (Array.isArray(ints)) {
                              const nextInts = [
                                {
                                  id: `int-r1-${matchingApp.id}`,
                                  roundName: "Round 1: Technical & Architecture Assessment",
                                  candidateName: matchingApp.candidateName || me.data?.displayName || "Candidate",
                                  jobTitle: o.job?.title || matchingApp.jobTitle || "Role",
                                  scheduledAt: formattedLabel,
                                  interviewerName: "HR & Assessment Panel",
                                },
                                ...ints.filter((i: any) => i.id !== `int-r1-${matchingApp.id}`),
                              ];
                              localStorage.setItem("bh_admin_interviews", JSON.stringify(nextInts));
                            }

                            const rawEv = localStorage.getItem("bh_application_events");
                            const list = rawEv ? JSON.parse(rawEv) : [];
                            localStorage.setItem(
                              "bh_application_events",
                              JSON.stringify([
                                {
                                  appId: matchingApp.id,
                                  email: me.data?.email,
                                  jobTitle: o.job?.title,
                                  event: {
                                    id: `ev-r1-slot-${matchingApp.id}-${Date.now()}`,
                                    type: "round1_slot_booked",
                                    createdAt: new Date().toISOString(),
                                    data: { when: formattedLabel },
                                  },
                                },
                                ...(Array.isArray(list) ? list : []),
                              ])
                            );
                          } catch {}
                          window.dispatchEvent(new Event("storage"));
                          window.dispatchEvent(new CustomEvent("bh_application_updated", { detail: { appId: matchingApp.id, stage: "INTERVIEW_SCHEDULED" } }));
                        }}
                      >
                        Confirm Round 1 Slot →
                      </Button>
                    </div>
                  );
                })()}
              </>
            ) : (
              (() => {
                const booked = matchingApp.round1BookedSlot as { id: string; label: string; isoStart: string };
                const startMs = new Date(booked.isoStart).getTime();
                const unlockMs = Number.isFinite(startMs) ? startMs - 10 * 60 * 1000 : 0;
                const isUnlocked = Boolean(matchingApp.round1Assigned) || (Number.isFinite(startMs) && nowTs >= unlockMs);

                return (
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 text-teal-800 px-2.5 py-0.5 text-[11px] font-bold">
                        <Check size={12} /> Round 1 Slot Confirmed
                      </span>
                      <h3 className="text-base font-bold text-ink">{booked.label}</h3>
                      <p className="text-xs text-ink-muted">
                        {isUnlocked
                          ? "Your Round 1 assessment is now enabled and ready."
                          : "Start Round 1 Assessment button will enable 10 minutes before your scheduled slot."}
                      </p>
                    </div>
                    {isUnlocked ? (
                      <ButtonAnchor href={`/${tenant.slug}/applications/${appId}/assessments/invite-${appId}`} variant="primary">
                        Start Round 1 Assessment →
                      </ButtonAnchor>
                    ) : (
                      <Button type="button" variant="primary" disabled>
                        Start Round 1 Assessment →
                      </Button>
                    )}
                  </div>
                );
              })()
            )}
          </div>
          );
        })()}
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <section className="card flex min-w-0 flex-[999_1_520px] flex-col gap-5 md:p-8" aria-labelledby="up-h">
          <div className="flex items-center justify-between">
            <h2 id="up-h" className="text-[17px]">{t("overview.updates")}</h2>
            <span className="text-[13px] text-ink-muted">{t("overview.newestFirst")}</span>
          </div>
          <Updates events={o.events || []} />
        </section>

        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
          {o.recruiter && (
            <section className="card flex flex-col gap-4" aria-labelledby="rc-h">
              <h2 id="rc-h" className="text-[17px]">{t("overview.recruiter")}</h2>
              <div className="flex items-center gap-3.5">
                <Avatar name={o.recruiter.name ?? o.recruiter.email} size={48} tone="teal" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{o.recruiter.name ?? o.recruiter.email}</p>
                  {o.recruiter.title && <p className="text-[13px] text-ink-muted">{o.recruiter.title}</p>}
                </div>
              </div>
              <ButtonAnchor href={`mailto:${o.recruiter.email}`} variant="ghost" icon={<Mail size={16} />}>
                {t("overview.emailRecruiter", { name: o.recruiter.name?.split(" ")[0] ?? o.recruiter.email })}
              </ButtonAnchor>
            </section>
          )}
          <section className="card flex flex-col gap-3.5" aria-labelledby="see-h">
            <h2 id="see-h" className="text-[17px]">{t("overview.transparencyTitle")}</h2>
            <CheckRow icon={<Check size={15} />}>{t("overview.t1")}</CheckRow>
            <CheckRow icon={<Check size={15} />}>{t("overview.t2")}</CheckRow>
            <CheckRow muted icon={<Lock size={15} />}>{t("overview.t3")}</CheckRow>
            <p className="border-t border-line-soft pt-3 text-[13px] leading-relaxed text-ink-muted">{t("overview.fair")}</p>
          </section>
          {canWithdraw && (
            <section className="flex flex-col gap-3 px-1">
              {!confirming ? (
                <Button variant="danger" className="self-start" onClick={() => setConfirming(true)}>{t("overview.withdraw")}</Button>
              ) : (
                <div className="flex flex-col gap-3 rounded-2xl border border-danger-line bg-danger-soft p-4">
                  <p className="text-sm text-danger">{t("overview.withdrawConfirm")}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button className="bg-danger text-white hover:brightness-95" loading={withdraw.isPending} onClick={() => withdraw.mutate()}>{t("overview.withdrawYes")}</Button>
                    <Button variant="ghost" onClick={() => setConfirming(false)}>{t("common.cancel")}</Button>
                  </div>
                  <InlineError error={withdraw.error} />
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
