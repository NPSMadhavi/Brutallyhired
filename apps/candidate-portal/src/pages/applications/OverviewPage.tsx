import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useMe, useOverview, useProfile, useWithdraw } from "@/api/hooks";
import { JourneyTrack } from "@/components/journey/JourneyTrack";
import { Updates } from "@/components/journey/Updates";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import { CheckRow, Pill } from "@/components/ui/Card";
import { ErrorState, InlineError, PageLoader } from "@/components/ui/feedback";
import { Check, Lock, Mail } from "@/components/ui/icons";
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
  const [nowTs, setNowTs] = useState<number>(() => Date.now());

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

  const deletedFromAdmin =
    adminListPresent &&
    !matchingApp &&
    (o?.stage || draftParsed.stage) &&
    (o?.stage || draftParsed.stage) !== "DRAFT";

  const localStage =
    rejectedMatch || deletedFromAdmin
      ? "REJECTED"
      : (matchingApp?.stage || draftParsed.stage || null);
  let effectiveStage: string = o?.stage || "SUBMITTED";
  if (rejectedMatch || deletedFromAdmin) {
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
  if (!o) return <PageLoader />;
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
          <div className="rounded-2xl border border-line bg-canvas p-5 space-y-1">
            <h3 className="text-base font-bold text-ink">
              {(o.stage as string) === "REJECTED"
                ? "Application rejected"
                : o.stage === "WITHDRAWN"
                ? "You withdrew this application"
                : "This application is closed"}
            </h3>
            <p className="text-xs text-ink-muted">
              {(o.stage as string) === "REJECTED"
                ? "Thank you for applying. Unfortunately, your application was not selected to move forward."
                : "This application is closed. Thank you for your interest."}
            </p>
          </div>
        )}

        {!o.closed && o.stage === "IN_REVIEW" && matchingApp?.screeningTestSent && !matchingApp?.screeningTestSubmitted && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-teal-200 bg-teal-50/40 p-5">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-ink">Screening Test Ready</h3>
              <p className="text-xs text-ink-muted">
                Complete your screening test questions configured by the hiring team.
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
        {!o.closed && ((o.stage as string) === "SHORTLISTED" || (o.stage as string) === "INTERVIEW_SCHEDULED") && matchingApp?.round1SlotsSent && Array.isArray(matchingApp?.round1Slots) && matchingApp.round1Slots.length > 0 && (
          <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-5 space-y-4">
            {!matchingApp.round1BookedSlot ? (
              <>
                <div>
                  <h3 className="text-base font-bold text-ink">Select Your Round 1 Assessment Time Slot</h3>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Choose an available date and time below. Your Round 1 assessment button will enable 10 minutes before your scheduled slot.
                  </p>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {matchingApp.round1Slots.map((slot: { id: string; label: string; isoStart: string }) => {
                    const isPicked = selectedR1SlotId === slot.id;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setSelectedR1SlotId(slot.id)}
                        className={`rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition-all cursor-pointer ${
                          isPicked
                            ? "border-brand bg-brand/10 text-brand ring-2 ring-brand/20"
                            : "border-line bg-white text-ink hover:bg-canvas"
                        }`}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!selectedR1SlotId}
                    onClick={() => {
                      const chosen = matchingApp.round1Slots.find((s: any) => s.id === selectedR1SlotId);
                      if (!chosen) return;
                      try {
                        const rawApps = localStorage.getItem("bh_admin_applications");
                        if (rawApps) {
                          const apps = JSON.parse(rawApps);
                          const updated = apps.map((a: any) =>
                            a.id === matchingApp.id
                              ? { ...a, stage: "INTERVIEW_SCHEDULED", round1BookedSlot: chosen }
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
                              scheduledAt: chosen.label,
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
                                data: { when: chosen.label },
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
        )}
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
