import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { useInterviews } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Pill } from "@/components/ui/Card";
import { EmptyState, PageLoader } from "@/components/ui/feedback";
import { Arrow, Calendar, Check, ChevronLeft, Clock, Video } from "@/components/ui/icons";
import { useFormat } from "@/lib/format";

export interface StoredRoundData {
  id: string;
  sequence: number;
  totalRounds: number;
  title: string;
  subtitle: string;
  type: "ASSIGNMENT_DEFENSE" | "LIVEKIT_VIDEO" | "LEADERSHIP_SCENARIO";
  durationMinutes: number;
  status: "AWAITING_BOOKING" | "SCHEDULED" | "ASSIGNMENT_SUBMITTED" | "COMPLETED" | "LOCKED";
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  bookedSlotLabel?: string | null;
  jobTitle?: string;
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
  const [practicalAssessmentLink, setPracticalAssessmentLink] = useState<string>(
    `/${tenant.slug}/applications/${appId}/assessments/invite-${appId}`
  );
  const [practicalAssessmentLinkR2, setPracticalAssessmentLinkR2] = useState<string>(
    `/${tenant.slug}/applications/${appId}/assessments/invite-${appId}-round-2`
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [dbRound1, setDbRound1] = useState<any>(null);
  const [dbRound2, setDbRound2] = useState<any>(null);

  useEffect(() => {
    if (!appId) return;
    fetch(`/api/t/${tenant.slug}/workflow/applications/${appId}/round1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.invite) setDbRound1(d.invite); })
      .catch(() => {});
    fetch(`/api/t/${tenant.slug}/workflow/applications/${appId}/round2`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.project) setDbRound2(d.project); })
      .catch(() => {});
  }, [appId, tenant.slug, refreshKey]);

  useEffect(() => {
    const handleUpdate = () => setRefreshKey((k) => k + 1);
    window.addEventListener("storage", handleUpdate);
    window.addEventListener("bh_application_updated", handleUpdate);
    return () => {
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("bh_application_updated", handleUpdate);
    };
  }, []);

  useEffect(() => {
    // Load candidate application from localStorage (strictly matching appId)
    let candidateApp: any = null;
    let adminListPresent = false;
    try {
      const rawApps = localStorage.getItem("bh_admin_applications");
      if (rawApps !== null) {
        adminListPresent = true;
        const parsed = JSON.parse(rawApps);
        if (Array.isArray(parsed)) {
          candidateApp = parsed.find((a: any) => a.id === appId) || null;
        }
      }
    } catch {}

    let isRejectedOrClosed = false;
    try {
      const rawRej = localStorage.getItem("bh_rejected_applications");
      if (rawRej) {
        const rejList = JSON.parse(rawRej);
        if (Array.isArray(rejList) && rejList.some((r: any) => r.id === appId)) {
          isRejectedOrClosed = true;
        }
      }
    } catch {}

    if (
      (adminListPresent && !candidateApp) ||
      ["REJECTED", "NOT_SELECTED", "WITHDRAWN"].includes(candidateApp?.stage || "")
    ) {
      isRejectedOrClosed = true;
    }

    if (isRejectedOrClosed) {
      setRounds([]);
      return;
    }

    // Load scheduled interviews from localStorage
    let storedScheduled: Record<string, any> = {};
    let scheduledList: any[] = [];
    try {
      const raw = localStorage.getItem("bh_admin_interviews");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          scheduledList = parsed;
        } else if (parsed && typeof parsed === "object") {
          storedScheduled = parsed;
        }
      }
    } catch {}

    // Load assignment submissions
    let storedSubmissions: Record<string, any> = {};
    try {
      const raw = localStorage.getItem("bh_assignment_submissions");
      if (raw) storedSubmissions = JSON.parse(raw);
    } catch {}

    const r1Sched = storedScheduled[`${appId}_round-1`] || scheduledList.find((s) => s.appId === appId && (s.roundNumber === 1 || s.roundId === "round-1" || s.id === "round-1"));
    const r2Sched = storedScheduled[`${appId}_round-2`] || scheduledList.find((s) => s.appId === appId && (s.roundNumber === 2 || s.roundId === "round-2" || s.id === "round-2"));
    const r3Sched = storedScheduled[`${appId}_round-3`] || scheduledList.find((s) => s.appId === appId && (s.roundNumber === 3 || s.roundId === "round-3" || s.id === "round-3"));

    const r1Sub = storedSubmissions[`${appId}_round-1`] || storedSubmissions["round-1"];
    const r2Sub = storedSubmissions[`${appId}_round-2`] || storedSubmissions["round-2"];
    const r3Sub = storedSubmissions[`${appId}_round-3`] || storedSubmissions["round-3"];

    // Check if Round 1 is assigned by HR
    const isRound1Assigned = Boolean(
      candidateApp?.round1Assigned ||
      candidateApp?.round1Link ||
      candidateApp?.assessmentUrl ||
      ["SHORTLISTED", "ASSESSMENT", "TEST_SUBMITTED", "ASSESSMENT_SUBMITTED", "ROUND_1_PASSED", "INTERVIEW", "OFFER", "HIRED"].includes(
        candidateApp?.stage || ""
      )
    );

    // Retrieve practical assessment link sent from admin portal to candidate
    let computedAssessmentLink =
      candidateApp?.round1Link ||
      candidateApp?.assessmentUrl ||
      `/${tenant.slug}/applications/${appId}/assessments/invite-${appId}`;

    try {
      const rawEmails = localStorage.getItem("bh_sent_emails");
      if (rawEmails) {
        const sentList = JSON.parse(rawEmails);
        if (Array.isArray(sentList)) {
          const match = sentList.find(
            (e: any) =>
              (e.recipient === candidateApp?.email || e.portalUrl?.includes(appId)) &&
              (e.stage === "ASSESSMENT" || e.stage === "SHORTLISTED")
          );
          if (match?.portalUrl) {
            computedAssessmentLink = match.portalUrl;
          }
        }
      }
    } catch {}

    // Ensure link directs directly to the assessment examination session (3rd image)
    if (computedAssessmentLink.endsWith("/assessments") || computedAssessmentLink.endsWith("/assessments/")) {
      computedAssessmentLink = `${computedAssessmentLink.replace(/\/+$/, "")}/invite-${appId}`;
    }

    // Convert same-origin full URLs to relative router links
    if (computedAssessmentLink.startsWith("http")) {
      try {
        const u = new URL(computedAssessmentLink);
        if (typeof window !== "undefined" && u.origin === window.location.origin) {
          computedAssessmentLink = u.pathname + u.search + u.hash;
        }
      } catch {}
    }

    setPracticalAssessmentLink(computedAssessmentLink);

    // Retrieve practical assessment link for Round 2
    let computedR2AssessmentLink =
      candidateApp?.round2Link ||
      candidateApp?.round2AssessmentUrl ||
      `/${tenant.slug}/applications/${appId}/assessments/invite-${appId}-round-2`;

    try {
      const rawEmails = localStorage.getItem("bh_sent_emails");
      if (rawEmails) {
        const sentList = JSON.parse(rawEmails);
        if (Array.isArray(sentList)) {
          const match = sentList.find(
            (e: any) =>
              (e.recipient === candidateApp?.email || e.portalUrl?.includes(appId)) &&
              (e.stage === "ROUND_2" || e.stage === "INTERVIEW" || e.portalUrl?.includes("round-2"))
          );
          if (match?.portalUrl) {
            computedR2AssessmentLink = match.portalUrl;
          }
        }
      }
    } catch {}

    if (computedR2AssessmentLink.endsWith("/assessments") || computedR2AssessmentLink.endsWith("/assessments/")) {
      computedR2AssessmentLink = `${computedR2AssessmentLink.replace(/\/+$/, "")}/invite-${appId}-round-2`;
    }

    if (computedR2AssessmentLink.startsWith("http")) {
      try {
        const u = new URL(computedR2AssessmentLink);
        if (typeof window !== "undefined" && u.origin === window.location.origin) {
          computedR2AssessmentLink = u.pathname + u.search + u.hash;
        }
      } catch {}
    }

    setPracticalAssessmentLinkR2(computedR2AssessmentLink);

    // Check if test has been submitted (DB + localStorage)
    const isR1Submitted = Boolean(
      dbRound1?.status === "SUBMITTED" ||
      candidateApp?.round1Submitted ||
      candidateApp?.stage === "TEST_SUBMITTED" ||
      candidateApp?.stage === "ASSESSMENT_SUBMITTED" ||
      r1Sub
    );

    const isR2Submitted = Boolean(
      dbRound2?.submittedAt ||
      ["SUBMITTED", "AI_EVALUATION_COMPLETED", "PASSED", "REJECTED"].includes(dbRound2?.status || "") ||
      candidateApp?.round2Submitted ||
      candidateApp?.stage === "ROUND_2_SUBMITTED" ||
      r2Sub
    );

    // Check if candidate is passed / selected for Round 1 by HR
    const isR1Passed = Boolean(
      dbRound1?.hrReviewStatus === "APPROVED" ||
      Boolean(dbRound2) ||
      candidateApp?.round1Passed ||
      candidateApp?.round1Selected ||
      candidateApp?.round2Unlocked ||
      candidateApp?.round2SlotsSent ||
      r1Sched?.status === "COMPLETED" ||
      (candidateApp?.stage === "INTERVIEW" && isR1Submitted) ||
      ["OFFER", "HIRED"].includes(candidateApp?.stage || "")
    );

    const dbR3 = q.data?.find((r) => r.sequence === 3);
    const r1Done = isR1Passed || r1Sched?.status === "COMPLETED";
    const r2Done = Boolean(dbRound2?.status === "PASSED" || dbRound2?.hrDecision === "APPROVED" || candidateApp?.round2Passed || r2Sched?.status === "COMPLETED");
    const r3Done = Boolean(dbR3?.status === "COMPLETED" || r3Sched?.status === "COMPLETED");

    // Compute Round 1 Status & Dates (only show when actually booked by candidate)
    const r1Booked = candidateApp?.round1BookedSlot as { id: string; label: string; isoStart: string } | undefined;
    const isRound1Booked = Boolean(r1Booked || r1Sched?.status === "SCHEDULED" || r1Sched?.status === "COMPLETED");
    const r1Status: StoredRoundData["status"] = r1Done
      ? "COMPLETED"
      : isRound1Booked
      ? "SCHEDULED"
      : isR1Submitted
      ? "ASSIGNMENT_SUBMITTED"
      : "AWAITING_BOOKING";

    const r1Start = r1Booked?.isoStart || r1Sched?.startsAt || null;
    const r1End = r1Sched?.endsAt || null;
    const r1SlotLabel = r1Booked?.label || null;

    // Compute Round 2 Status & Dates (only show when actually booked by candidate)
    const r2Booked = candidateApp?.round2BookedSlot as { id: string; label: string; isoStart: string } | undefined;
    const isRound2Booked = Boolean(r2Booked || candidateApp?.round2SlotBooked || r2Sched?.status === "SCHEDULED" || r2Sched?.status === "COMPLETED");
    const r2Status: StoredRoundData["status"] = !r1Done
      ? "LOCKED"
      : r2Done
      ? "COMPLETED"
      : isR2Submitted
      ? "ASSIGNMENT_SUBMITTED"
      : isRound2Booked
      ? "SCHEDULED"
      : "AWAITING_BOOKING";

    const r2Start =
      (r2Status === "SCHEDULED" || r2Status === "COMPLETED") && (r2Booked?.isoStart || r2Sched?.startsAt)
        ? (r2Booked?.isoStart || r2Sched.startsAt)
        : candidateApp?.round2ScheduledStart || null;
    const r2End =
      (r2Status === "SCHEDULED" || r2Status === "COMPLETED") && r2Sched?.endsAt
        ? r2Sched.endsAt
        : candidateApp?.round2ScheduledEnd || null;

    // Compute Round 3 Status & Dates (only show when actually booked by candidate)
    const r3Booked = candidateApp?.round3BookedSlot as { id: string; label: string; isoStart: string } | undefined;
    const isRound3Booked = Boolean(r3Booked || candidateApp?.round3SlotBooked || r3Sched?.status === "SCHEDULED" || r3Sched?.status === "COMPLETED");
    const r3Status: StoredRoundData["status"] = !r2Done
      ? "LOCKED"
      : r3Done
      ? "COMPLETED"
      : isRound3Booked
      ? "SCHEDULED"
      : r3Sub
      ? "ASSIGNMENT_SUBMITTED"
      : "AWAITING_BOOKING";

    const r3Start =
      (r3Status === "SCHEDULED" || r3Status === "COMPLETED") && (r3Booked?.isoStart || r3Sched?.startsAt)
        ? (r3Booked?.isoStart || r3Sched.startsAt)
        : null;
    const r3End =
      (r3Status === "SCHEDULED" || r3Status === "COMPLETED") && r3Sched?.endsAt
        ? r3Sched.endsAt
        : null;

    const visibleRounds: StoredRoundData[] = [];
    const jobRole = candidateApp?.jobTitle || "Applied Role";

    // ONLY show the rounds that the candidate has actually booked
    if (isRound1Booked) {
      visibleRounds.push({
        id: "round-1",
        sequence: 1,
        totalRounds: 3,
        title: "Round 1: Technical & Architecture Practical Assignment",
        subtitle: "In-Portal Assignment + System Architecture Defense",
        type: "ASSIGNMENT_DEFENSE",
        durationMinutes: 60,
        status: r1Status,
        scheduledStart: r1Start,
        scheduledEnd: r1End,
        bookedSlotLabel: r1SlotLabel,
        jobTitle: jobRole,
        panelists: "Arun K. (Principal Architect) · Vikram M. (Staff Engineer)",
        formatBadge: "In-Portal Assignment & Defense",
        description:
          "Submit your distributed system architecture & proctored pipeline implementation, evaluated by Qwen 3.5:9b AI.",
      });
    }

    if (isRound2Booked) {
      visibleRounds.push({
        id: "round-2",
        sequence: 2,
        totalRounds: 3,
        title: "Round 2: Technical & Practical Assessment",
        subtitle: "In-Portal Timed Practical Assessment",
        type: "ASSIGNMENT_DEFENSE",
        durationMinutes: 45,
        status: r2Status,
        scheduledStart: r2Start,
        scheduledEnd: r2End,
        jobTitle: jobRole,
        panelists: "Chandra S. (VP of Engineering)",
        formatBadge: "In-Portal Assessment",
        description:
          "Complete your Round 2 technical evaluation questions and proctored assessment, evaluated by AI and engineering panel.",
      });
    }

    if (isRound3Booked) {
      visibleRounds.push({
        id: "round-3",
        sequence: 3,
        totalRounds: 3,
        title: "Round 3: Leadership, Product Strategy & Culture Alignment",
        subtitle: "Leadership Scenario Challenge + Executive Panel",
        type: "LEADERSHIP_SCENARIO",
        durationMinutes: 45,
        status: r3Status,
        scheduledStart: r3Start,
        scheduledEnd: r3End,
        jobTitle: jobRole,
        panelists: "Tanuja HR (Head of Talent) · Ananya R. (Director of Product)",
        formatBadge: "Executive & Culture Alignment",
        description:
          "Solve a crisis incident scenario, discuss product engineering vision, and align on leadership principles.",
      });
    }

    setRounds(visibleRounds);
  }, [appId, refreshKey, dbRound1, dbRound2, q.data]);

  const isRejectedApp = (() => {
    try {
      const rawRej = localStorage.getItem("bh_rejected_applications");
      if (rawRej) {
        const rejList = JSON.parse(rawRej);
        if (Array.isArray(rejList) && rejList.some((r: any) => r.id === appId)) return true;
      }
      const rawApps = localStorage.getItem("bh_admin_applications");
      if (rawApps !== null) {
        const parsed = JSON.parse(rawApps);
        if (Array.isArray(parsed)) {
          const found = parsed.find((a: any) => a.id === appId);
          if (!found || ["REJECTED", "NOT_SELECTED", "WITHDRAWN"].includes(found.stage || "")) return true;
        }
      }
    } catch {}
    return false;
  })();

  if (q.isPending && !rounds.length && !isRejectedApp) return <PageLoader />;

  if (isRejectedApp || rounds.length === 0) {
    return (
      <div className="space-y-4">
        <Link to={`/${tenant.slug}/applications/${appId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand no-underline">
          <ChevronLeft size={16} />
          {t("common.backToOverview")}
        </Link>
        <EmptyState
          icon={<Calendar size={26} />}
          title={isRejectedApp ? "Application Rejected" : "No Interviews Scheduled Yet"}
          body={
            isRejectedApp
              ? "This application was not selected to move forward, so interview rounds are closed."
              : "Interview rounds will appear here once scheduled by the hiring team."
          }
        />
      </div>
    );
  }

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

      {/* Progress Track for Booked Rounds */}
      <div className="card p-4 rounded-2xl bg-canvas border border-line flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white font-bold text-sm">
            {rounds.length}
          </span>
          <div>
            <p className="text-sm font-bold text-ink">Scheduled Evaluation Track</p>
            <p className="text-xs text-ink-muted">Confirmed rounds scheduled for your application.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {rounds.map((r) => {
            const isCompleted = r.status === "COMPLETED";
            const isScheduled = r.status === "SCHEDULED";
            return (
              <span
                key={r.id}
                className={clsx(
                  "px-2.5 py-1 rounded-full font-semibold border flex items-center gap-1",
                  isCompleted
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : isScheduled
                    ? "bg-blue-50 text-blue-800 border-blue-200"
                    : "bg-brand-soft text-brand border-brand/20"
                )}
              >
                {isCompleted && <Check size={12} />}
                Round {r.sequence} {isCompleted ? "Passed" : isScheduled ? "Booked" : "Active"}
              </span>
            );
          })}
        </div>
      </div>

      {rounds.length === 0 ? (
        <div className="card p-8 rounded-2xl bg-canvas border border-line text-center max-w-lg mx-auto space-y-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand mx-auto">
            <Calendar size={24} />
          </span>
          <h3 className="font-bold text-base text-ink">Interview Rounds Pending</h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            HR has not assigned Round 1 yet. Once your application screening is completed and HR assigns Round 1, your Practical Assessment will appear here and an assessment link will be emailed to you.
          </p>
        </div>
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
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-canvas border border-line-2 text-ink-muted">
                        <Calendar size={24} />
                      </span>
                    )}

                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="label-caps text-[11px] bg-line-soft px-2 py-0.5 rounded">
                          Round {r.sequence} of {r.totalRounds}
                        </span>
                        {r.jobTitle && (
                          <span className="rounded-full bg-teal-50 text-teal-800 text-[11px] font-semibold px-2.5 py-0.5 border border-teal-200">
                            Role: {r.jobTitle}
                          </span>
                        )}
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
                        {r.bookedSlotLabel ? (
                          <>
                            <span>·</span>
                            <span className="text-brand font-semibold">
                              Booked: {r.bookedSlotLabel}
                            </span>
                          </>
                        ) : r.scheduledStart && r.scheduledEnd ? (
                          <>
                            <span>·</span>
                            <span className="text-brand font-medium">
                              {f.timeRange(r.scheduledStart, r.scheduledEnd)} ({f.tzName()})
                            </span>
                          </>
                        ) : r.scheduledStart ? (
                          <>
                            <span>·</span>
                            <span className="text-brand font-medium">
                              Booked: {f.dateTime(r.scheduledStart)}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-line-soft">
                    {r.status === "LOCKED" ? (
                      <span className="rounded-full bg-line-soft text-ink-muted text-xs font-semibold px-3 py-1 border border-line">
                        {r.sequence === 2 ? "Locked · Round 1 Pending" : "Locked · Round 2 Pending"}
                      </span>
                    ) : (
                      <Pill tone={r.status === "COMPLETED" ? "teal" : r.status === "ASSIGNMENT_SUBMITTED" ? "amber" : r.status === "SCHEDULED" ? "blue" : "amber"}>
                        {r.status === "COMPLETED"
                          ? "Round Passed"
                          : r.status === "ASSIGNMENT_SUBMITTED"
                          ? "Practical Assessment Submitted"
                          : r.status === "SCHEDULED"
                          ? "Slot Confirmed"
                          : "Awaiting Slot Selection"}
                      </Pill>
                    )}

                    <div className="flex items-center gap-2">
                      {(() => {
                        const isAssessment = r.id === "round-1" || r.id === "round-2";
                        const targetAssessmentLink = r.id === "round-2" ? practicalAssessmentLinkR2 : practicalAssessmentLink;

                        if (r.status === "LOCKED") {
                          return (
                            <button
                              type="button"
                              disabled
                              className="rounded-xl bg-line-soft text-ink-muted/70 font-semibold text-xs px-4 py-2 cursor-not-allowed border border-line"
                            >
                              Locked
                            </button>
                          );
                        }

                        if (r.status === "COMPLETED") {
                          if (isAssessment) {
                            return targetAssessmentLink.startsWith("http") ? (
                              <a
                                href={targetAssessmentLink}
                                className="rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-xs px-4 py-2 transition-colors no-underline flex items-center gap-1.5 border border-teal-200 cursor-pointer"
                              >
                                View Assessment
                                <Arrow size={14} />
                              </a>
                            ) : (
                              <Link
                                to={targetAssessmentLink}
                                className="rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-xs px-4 py-2 transition-colors no-underline flex items-center gap-1.5 border border-teal-200"
                              >
                                View Assessment
                                <Arrow size={14} />
                              </Link>
                            );
                          }
                          return (
                            <Link
                              to={`/${tenant.slug}/applications/${appId}/interviews/${r.id}`}
                              className="rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold text-xs px-4 py-2 transition-colors no-underline flex items-center gap-1.5 border border-teal-200"
                            >
                              View Evaluation & Defense
                              <Arrow size={14} />
                            </Link>
                          );
                        }

                        if (r.status === "SCHEDULED") {
                          return targetAssessmentLink.startsWith("http") ? (
                            <a
                              href={targetAssessmentLink}
                              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2 transition-colors no-underline flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              Join Scheduled Room
                              <Arrow size={14} />
                            </a>
                          ) : (
                            <Link
                              to={targetAssessmentLink}
                              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2 transition-colors no-underline flex items-center gap-1.5 shadow-xs"
                            >
                              Join Scheduled Room
                              <Arrow size={14} />
                            </Link>
                          );
                        }

                        if (r.status === "ASSIGNMENT_SUBMITTED") {
                          if (isAssessment) {
                            return targetAssessmentLink.startsWith("http") ? (
                              <a
                                href={targetAssessmentLink}
                                className="rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-semibold text-xs px-4 py-2 transition-colors no-underline flex items-center gap-1.5 shadow-xs cursor-pointer"
                              >
                                View Submitted Assessment
                                <Arrow size={14} />
                              </a>
                            ) : (
                              <Link
                                to={targetAssessmentLink}
                                className="rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-semibold text-xs px-4 py-2 transition-colors no-underline flex items-center gap-1.5 shadow-xs"
                              >
                                View Submitted Assessment
                                <Arrow size={14} />
                              </Link>
                            );
                          }
                          return (
                            <Link
                              to={`/${tenant.slug}/applications/${appId}/interviews/${r.id}`}
                              className="rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-semibold text-xs px-4 py-2 transition-colors no-underline flex items-center gap-1.5 shadow-xs"
                            >
                              View Submitted Assessment
                              <Arrow size={14} />
                            </Link>
                          );
                        }

                        if (isAssessment) {
                          return targetAssessmentLink.startsWith("http") ? (
                            <a
                              href={targetAssessmentLink}
                              className="rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-xs px-4 py-2 transition-colors no-underline flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              Start Practical Assessment
                              <Arrow size={14} />
                            </a>
                          ) : (
                            <Link
                              to={targetAssessmentLink}
                              className="rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-xs px-4 py-2 transition-colors no-underline flex items-center gap-1.5 shadow-xs"
                            >
                              Start Practical Assessment
                              <Arrow size={14} />
                            </Link>
                          );
                        }

                        return (
                          <Link
                            to={`/${tenant.slug}/applications/${appId}/interviews/${r.id}`}
                            className="rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-xs px-4 py-2 transition-colors no-underline flex items-center gap-1.5 shadow-xs"
                          >
                            Select Interview Slot
                            <Arrow size={14} />
                          </Link>
                        );
                      })()}
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
