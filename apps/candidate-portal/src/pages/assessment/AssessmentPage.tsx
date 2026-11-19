import { invalidateApplication, useAssessment, useStartAttempt } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Button } from "@/components/ui/Button";
import { CheckRow, Fact, Pill } from "@/components/ui/Card";
import { ErrorState, InlineError, Notice, PageLoader } from "@/components/ui/feedback";
import { Checkbox } from "@/components/ui/form";
import { Alert, Check, ChevronLeft, Globe, Monitor, Video, Wifi } from "@/components/ui/icons";
import { proctoringSupported, useProctoring, type CheckState } from "@/hooks/useProctoring";
import { useFormat } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import type { AttemptDto } from "@verity/shared";
import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { AssessmentRunner } from "./AssessmentRunner";

function CheckLine({ icon, label, state }: { icon: React.ReactNode; label: string; state: CheckState }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 text-sm">
      <span
        className={clsx(
          "flex h-7 w-7 items-center justify-center rounded-full",
          state === "ok" ? "bg-ok-soft text-ok-ink" : state === "fail" ? "bg-danger-soft text-danger" : "bg-line-soft text-ink-muted",
        )}
      >
        {state === "ok" ? <Check size={15} /> : state === "fail" ? <Alert size={15} /> : icon}
      </span>
      <span className="flex-1">{label}</span>
      <span className="text-[13px] text-ink-muted">
        {t(state === "ok" ? "assessment.statusOk" : state === "fail" ? "assessment.statusFail" : "assessment.statusPending")}
      </span>
    </div>
  );
}

export function AssessmentPage() {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const f = useFormat();
  const qc = useQueryClient();
  const { appId = "", inviteId = "" } = useParams();
  const q = useAssessment(tenant.slug, inviteId);
  const start = useStartAttempt(tenant.slug, inviteId);
  const proctor = useProctoring(tenant.slug);
  const [attempt, setAttempt] = useState<AttemptDto | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    if (video.current) video.current.srcObject = proctor.camera;
  }, [proctor.camera]);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (q.isPending) return <PageLoader />;
  if (q.isError) return <ErrorState error={q.error} />;
  const inv = q.data;
  const back = (
    <Link to={`/${tenant.slug}/applications/${appId}`} className="inline-flex items-center gap-1 text-sm font-semibold no-underline">
      <ChevronLeft size={16} />
      {t("common.backToOverview")}
    </Link>
  );

  if (done || inv.status === "SUBMITTED") {
    return (
      <>
        {back}
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ok-soft text-ok-ink">
            <Check size={32} />
          </span>
          <h1 className="text-2xl">{t("assessment.submittedTitle")}</h1>
          <p className="text-ink-muted">{t("assessment.submittedBody")}</p>
          <p className="max-w-lg text-[13px] text-ink-muted">{t("assessment.resultNote")}</p>
        </div>
      </>
    );
  }
  if (attempt) {
    return (
      <AssessmentRunner
        attempt={attempt}
        proctor={proctor}
        onDone={() => {
          setDone(true);
          invalidateApplication(qc, tenant.slug, appId);
        }}
      />
    );
  }

  const supported = proctoringSupported();
  const ready = !inv.proctored || (proctor.checks.camera === "ok" && proctor.checks.screen === "ok");
  const open = inv.status === "INVITED" || inv.status === "IN_PROGRESS";

  const begin = async () => {
    if (inv.proctored) await document.documentElement.requestFullscreen().catch(() => undefined);
    const a = await start.mutateAsync();
    if (inv.proctored) proctor.start(a.id);
    setAttempt(a);
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          {back}
          <h1 className="text-[30px] leading-tight">{inv.title}</h1>
          {inv.description && <p className="max-w-3xl text-[15px] text-ink-muted">{inv.description}</p>}
        </div>
        <Pill tone={open ? "amber" : "gray"} dot className="px-3 py-1.5 text-[13px]">
          {open ? t("assessment.closes", { date: f.dateTime(inv.dueAt) }) : t(`assessment.status.${inv.status}`)}
        </Pill>
      </div>
      <div className="grid gap-3.5 sm:grid-cols-3">
        <Fact label={t("assessment.questions")} value={inv.questionCount} />
        <Fact label={t("assessment.time")} value={t("assessment.minutes", { count: inv.durationMinutes })} />
        <Fact label={t("assessment.format")} value={inv.proctored ? t("assessment.proctored") : t("assessment.notProctored")} />
      </div>

      {open && (
        <div className="flex flex-wrap items-start gap-6">
          <section className="card flex min-w-0 flex-[999_1_520px] flex-col gap-5 md:p-8" aria-labelledby="chk-h">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="chk-h" className="text-[22px]">
                {t("assessment.checkTitle")}
              </h2>
              {inv.proctored && (
                <Pill tone={ready ? "teal" : "amber"} dot>
                  {ready ? t("assessment.allGood") : t("assessment.needsAttention")}
                </Pill>
              )}
            </div>
            <div className="flex flex-wrap gap-6">
              {inv.proctored && (
                <div className="relative flex aspect-video min-h-[200px] flex-[1_1_280px] items-center justify-center overflow-hidden rounded-2xl bg-[#1B2638]">
                  <video ref={video} autoPlay muted playsInline className="h-full w-full object-cover" />
                </div>
              )}
              <div className="flex flex-[1_1_260px] flex-col justify-center gap-3.5">
                {inv.proctored && <CheckLine icon={<Video size={15} />} label={t("assessment.camera")} state={proctor.checks.camera} />}
                {inv.proctored && <CheckLine icon={<Monitor size={15} />} label={t("assessment.screen")} state={proctor.checks.screen} />}
                <CheckLine icon={<Globe size={15} />} label={t("assessment.browser")} state={supported || !inv.proctored ? "ok" : "fail"} />
                <CheckLine icon={<Wifi size={15} />} label={t("assessment.connection")} state={online ? "ok" : "fail"} />
                {inv.proctored && (
                  <Button variant="text" className="self-start" onClick={() => void proctor.acquire()} disabled={!supported}>
                    {proctor.checks.camera === "pending" ? t("assessment.runCheck") : t("assessment.runAgain")}
                  </Button>
                )}
              </div>
            </div>
            {proctor.screenWarning && <Notice tone="warn">{t("assessment.shareWholeScreen")}</Notice>}
            <hr className="border-line-soft" />
            {inv.proctored && <Checkbox label={t("assessment.consent")} checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                disabled={!online || (inv.proctored && (!ready || !agreed))}
                loading={start.isPending}
                onClick={() => void begin()}
              >
                {inv.status === "IN_PROGRESS" ? t("assessment.resume") : t("assessment.start")}
              </Button>
              <span className="text-[13px] text-ink-muted">{t("assessment.timerNote")}</span>
            </div>
            <InlineError error={start.error} />
          </section>
          <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
            {inv.topics.length > 0 && (
              <section className="card flex flex-col gap-3.5">
                <h2 className="text-[17px]">{t("assessment.covers")}</h2>
                <div className="flex flex-wrap gap-2">
                  {inv.topics.map((x) => (
                    <span key={x} className="rounded-full border border-line-2 px-3 py-1 text-[13px]">
                      {x}
                    </span>
                  ))}
                </div>
              </section>
            )}
            <section className="card flex flex-col gap-3.5">
              <h2 className="text-[17px]">{t("assessment.goodToKnow")}</h2>
              <CheckRow icon={<Check size={15} />}>{t("assessment.tip1")}</CheckRow>
              <CheckRow icon={<Check size={15} />}>{t("assessment.tip2")}</CheckRow>
            </section>
            <p className="rounded-2xl bg-[#F7F9FC] p-4 text-[13px] leading-relaxed text-ink-2">{t("assessment.resultNote")}</p>
          </aside>
        </div>
      )}
    </>
  );
}
