import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useMe, useOverview, useWithdraw } from "@/api/hooks";
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

export function OverviewPage() {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const f = useFormat();
  const { appId = "" } = useParams();
  const me = useMe();
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
        track: [
          { key: "SUBMITTED", label: "Application Submitted", done: true, current: stage === "SUBMITTED" },
          {
            key: "IN_REVIEW",
            label: "Under Review & Screening",
            done: ["IN_REVIEW", "SHORTLISTED", "ASSESSMENT", "INTERVIEW", "OFFER", "ONBOARDING", "HIRED"].includes(stage),
            current: stage === "IN_REVIEW",
          },
          {
            key: "ASSESSMENT",
            label: "BrutalAssessAI™ Assessment",
            done: ["ASSESSMENT", "INTERVIEW", "OFFER", "ONBOARDING", "HIRED"].includes(stage),
            current: stage === "ASSESSMENT",
          },
          {
            key: "INTERVIEW",
            label: "LiveKit Video Rounds",
            done: ["INTERVIEW", "OFFER", "ONBOARDING", "HIRED"].includes(stage),
            current: stage === "INTERVIEW",
          },
          {
            key: "OFFER",
            label: "Offer & Onboarding",
            done: ["OFFER", "ONBOARDING", "HIRED"].includes(stage),
            current: stage === "OFFER" || stage === "ONBOARDING" || stage === "HIRED",
          },
        ],
        nextAction:
          stage === "SHORTLISTED" || stage === "ASSESSMENT"
            ? { kind: "ASSESSMENT", label: "Start BrutalAssessAI™ Examination", path: `/${tenant.slug}/applications/${appId}/assessments` }
            : stage === "INTERVIEW"
            ? { kind: "INTERVIEW", label: "Join Scheduled LiveKit Interview", path: `/${tenant.slug}/applications/${appId}/interviews` }
            : stage === "OFFER"
            ? { kind: "OFFER", label: "Review & Sign Formal Offer", path: `/${tenant.slug}/applications/${appId}/offer` }
            : null,
      } as any;
    }
  }

  if (q.isPending && !o) return <PageLoader />;
  if (q.isError && !o) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!o) return <PageLoader />;
  const base = `/${tenant.slug}/applications/${o.id}`;
  const firstName = me.data?.displayName?.split(" ")[0];
  const canWithdraw = !o.closed && !["DRAFT", "HIRED"].includes(o.stage);

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="text-[15px] text-ink-muted">{f.longDate(new Date())}</p>
        <h1 className="text-[30px] leading-tight">{firstName ? t("overview.greeting", { name: firstName }) : t("overview.greetingFallback")}</h1>
      </div>

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
        {!o.closed && <JourneyTrack track={o.track} />}
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
