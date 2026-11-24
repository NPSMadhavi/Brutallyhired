import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useMe, useOverview, useProfile, useWithdraw } from "@/api/hooks";
import { NextStepCard } from "@/components/journey/NextStep";
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

function buildCandidateJourneyTrack(stage: string, submittedAt?: string | null) {
  const normStage = (stage || "SUBMITTED").toUpperCase();

  const isInReviewDone = [
    "SCREENING_TEST",
    "ASSESSMENT",
    "SHORTLISTED",
    "INTERVIEW",
    "INTERVIEW_SCHEDULE",
    "INTERVIEW_SCHEDULED",
    "OFFER",
    "SELECTED",
    "ONBOARDING",
    "HIRED",
  ].includes(normStage);
  const isInReviewCurrent =
    normStage === "SUBMITTED" || normStage === "IN_REVIEW" || normStage === "UNDER_REVIEW";

  const isScreeningDone = [
    "SHORTLISTED",
    "INTERVIEW",
    "INTERVIEW_SCHEDULE",
    "INTERVIEW_SCHEDULED",
    "OFFER",
    "SELECTED",
    "ONBOARDING",
    "HIRED",
  ].includes(normStage);
  const isScreeningCurrent = normStage === "SCREENING_TEST" || normStage === "ASSESSMENT";

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
      state: (isInReviewDone || isInReviewCurrent ? "done" : "current") as "done" | "current" | "upcoming",
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

  let o = q.data;
  if (!o) {
    const localDraft = localStorage.getItem(`bh_draft_${appId}`);
    const localApps = localStorage.getItem("bh_admin_applications");
    let matchingApp: any = null;
    if (localApps) {
      try {
        const parsed = JSON.parse(localApps);
        if (Array.isArray(parsed)) {
          matchingApp = parsed.find((a: any) => a.id === appId);
        }
      } catch {}
    }
    if (localDraft || matchingApp) {
      let draftParsed: any = {};
      try {
        if (localDraft) draftParsed = JSON.parse(localDraft);
      } catch {}
      const stage = matchingApp?.stage || draftParsed.stage || "SUBMITTED";
      o = {
        id: appId,
        reference: draftParsed.reference || `APP-${appId.slice(-6)}`,
        stage,
        closed: stage === "REJECTED" || stage === "NOT_SELECTED" || stage === "WITHDRAWN",
        job: draftParsed.job || { title: matchingApp?.jobTitle || "Software Developer", location: "Hybrid" },
        submittedAt: new Date().toISOString(),
        events: [
          {
            id: `ev-${appId}-sub`,
            type: "application_submitted",
            createdAt: draftParsed.submittedAt || new Date().toISOString(),
            data: { jobTitle: matchingApp?.jobTitle || "Software Developer" },
          },
          ...(stage !== "SUBMITTED"
            ? [
                {
                  id: `ev-${appId}-stage`,
                  type:
                    stage === "SHORTLISTED" || stage === "ASSESSMENT"
                      ? "assessment_invited"
                      : stage === "INTERVIEW"
                      ? "interview_invited"
                      : stage === "OFFER"
                      ? "offer_sent"
                      : stage === "HIRED"
                      ? "hired"
                      : "review_started",
                  createdAt: new Date().toISOString(),
                  data: { jobTitle: matchingApp?.jobTitle || "Software Developer" },
                },
              ]
            : []),
        ],
        track: buildCandidateJourneyTrack(stage, draftParsed.submittedAt || matchingApp?.submittedAt),
        nextAction:
          stage === "WITHDRAWN"
            ? { type: "CLOSED", reason: "WITHDRAWN" }
            : stage === "REJECTED" || stage === "NOT_SELECTED"
            ? { type: "CLOSED", reason: "NOT_SELECTED" }
            : stage === "SCREENING_TEST" || stage === "ASSESSMENT"
            ? {
                type: "TAKE_ASSESSMENT",
                title: "Screening Test",
                dueAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
                durationMinutes: 30,
                inviteId: appId,
              }
            : stage === "SHORTLISTED"
            ? {
                type: "AWAIT_DECISION",
              }
            : stage === "INTERVIEW" || stage === "INTERVIEW_SCHEDULE" || stage === "INTERVIEW_SCHEDULED"
            ? {
                type: "ATTEND_INTERVIEW",
                title: "Interview Schedule (Round 1, Round 2, Round 3)",
                startsAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
                endsAt: new Date(Date.now() + 25 * 3600 * 1000).toISOString(),
                roundId: appId,
              }
            : stage === "OFFER" || stage === "SELECTED"
            ? {
                type: "RESPOND_TO_OFFER",
                respondBy: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
              }
            : stage === "ONBOARDING" || stage === "HIRED"
            ? {
                type: "COMPLETE_ONBOARDING",
                pending: 2,
                startDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
              }
            : { type: "AWAIT_REVIEW" },
      } as any;
    }
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
        {!o.closed && <JourneyTrack track={buildCandidateJourneyTrack(o.stage, o.submittedAt)} />}
        <NextStepCard action={o.nextAction} base={base} draftPath={o.stage === "DRAFT" ? `${base}/apply/details` : null} />
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
