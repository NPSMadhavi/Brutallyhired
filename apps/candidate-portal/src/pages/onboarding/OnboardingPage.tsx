import { ACCEPTED_DOCUMENT_MIME, type OnboardingDto } from "@verity/shared";
import { clsx } from "clsx";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useOnboarding, useUploadOnboardingFile } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Button } from "@/components/ui/Button";
import { Pill, type Tone } from "@/components/ui/Card";
import { EmptyState, ErrorState, InlineError, PageLoader } from "@/components/ui/feedback";
import { Bag, Check, Clock, Hourglass, Lock, Pin, Upload, User } from "@/components/ui/icons";
import { ProgressRing } from "@/components/ui/misc";
import { ApiError } from "@/lib/api";
import { useFormat } from "@/lib/format";

const MAX_MB = 10;
const toneFor: Record<OnboardingDto["tasks"][number]["status"], Tone> = { PENDING: "amber", SUBMITTED: "blue", VERIFIED: "teal", REJECTED: "red" };

function TaskRow({ task, appId }: { task: OnboardingDto["tasks"][number]; appId: string }) {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const upload = useUploadOnboardingFile(tenant.slug, appId);
  const input = useRef<HTMLInputElement>(null);
  const open = task.status === "PENDING" || task.status === "REJECTED";
  return (
    <li className="flex flex-col gap-2 border-t border-line-soft py-4 first:border-t-0">
      <div className="flex flex-wrap items-center gap-4">
        <span
          className={clsx(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            task.status === "VERIFIED" && "bg-ok text-white",
            task.status === "SUBMITTED" && "bg-info-soft text-info-ink",
            open && "border-2 border-dashed border-[#C9D3E0] text-ink-muted",
          )}
        >
          {task.status === "VERIFIED" ? <Check size={16} /> : task.status === "SUBMITTED" ? <Hourglass size={16} /> : null}
        </span>
        <div className="flex min-w-[220px] flex-1 flex-col gap-0.5">
          <p className="text-[15px] font-semibold">{task.title}{!task.required && <span className="font-normal text-ink-muted"> · {t("common.optional")}</span>}</p>
          {task.description && <p className="text-[13px] text-ink-muted">{task.description}</p>}
          {task.file && <p className="text-[13px] text-ink-muted">{task.file.name}</p>}
        </div>
        <Pill tone={toneFor[task.status]}>{t(`onboarding.status.${task.status}`)}</Pill>
        {open && (
          <>
            <Button variant="ghost" icon={<Upload size={16} />} loading={upload.isPending} onClick={() => input.current?.click()}>{t("common.upload")}</Button>
            <input
              ref={input} type="file" className="sr-only" tabIndex={-1} accept={[...ACCEPTED_DOCUMENT_MIME, ".pdf", ".jpg", ".jpeg", ".png"].join(",")}
              onChange={(e) => { const file = e.target.files?.[0]; if (file) upload.mutate({ taskId: task.id, file }); e.target.value = ""; }}
            />
          </>
        )}
      </div>
      {task.status === "REJECTED" && task.reviewerNote && <p className="ml-12 text-[13px] text-danger">{t("onboarding.reviewerNote", { note: task.reviewerNote })}</p>}
      <div className="ml-12"><InlineError error={upload.error} /></div>
    </li>
  );
}

export function OnboardingPage() {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const f = useFormat();
  const { appId = "" } = useParams();
  const q = useOnboarding(tenant.slug, appId);

  if (q.isPending) return <PageLoader />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.code === "onboarding_locked") return <EmptyState icon={<Lock size={26} />} title={t("onboarding.locked")} />;
    return <ErrorState error={q.error} />;
  }
  const { tasks, joining } = q.data;
  const done = tasks.filter((x) => x.status === "SUBMITTED" || x.status === "VERIFIED").length;
  const remaining = tasks.filter((x) => x.required && (x.status === "PENDING" || x.status === "REJECTED")).length;

  const kv = (icon: React.ReactNode, label: string, value: string | null) =>
    value ? (
      <div className="flex items-start gap-3.5">
        <span className="mt-0.5 text-ink-muted">{icon}</span>
        <div><p className="text-[13px] text-ink-muted">{label}</p><p className="whitespace-pre-line text-sm font-semibold">{value}</p></div>
      </div>
    ) : null;

  return (
    <>
      <section className="card flex flex-wrap items-center justify-between gap-7 md:p-8">
        <div className="flex min-w-[300px] flex-1 flex-col gap-2.5">
          <h1 className="text-[30px] leading-tight">{joining ? t("onboarding.title", { date: f.longDate(joining.startDate) }) : t("onboarding.titleNoDate")}</h1>
          <p className="text-[15px] leading-relaxed text-ink-muted">
            {joining ? `${t("onboarding.daysToGo", { count: f.daysUntil(joining.startDate) })} ` : ""}{t("onboarding.sub")}
          </p>
        </div>
        {tasks.length > 0 && (
          <div className="flex items-center gap-4">
            <ProgressRing value={done} total={tasks.length} label={t("onboarding.progressLabel", { done, total: tasks.length })}>
              {Math.round((done / tasks.length) * 100)}%
            </ProgressRing>
            <div className="flex flex-col gap-0.5">
              <p className="font-display text-xl font-bold">{t("onboarding.progress", { done, total: tasks.length })}</p>
              <p className="text-[13px] text-ink-muted">{remaining ? t("onboarding.remaining", { count: remaining }) : t("onboarding.allDone")}</p>
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <section className="card flex min-w-0 flex-[999_1_560px] flex-col gap-2 md:p-8" aria-labelledby="docs-h">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 id="docs-h" className="text-[22px]">{t("onboarding.docs")}</h2>
            <span className="text-[13px] text-ink-muted">{t("onboarding.formats", { mb: MAX_MB })}</span>
          </div>
          {tasks.length === 0 ? <p className="text-sm text-ink-muted">{t("onboarding.empty")}</p> : <ul>{tasks.map((task) => <TaskRow key={task.id} task={task} appId={appId} />)}</ul>}
          <p className="border-t border-line-soft pt-3.5 text-[13px] text-ink-muted">{t("onboarding.secure")}</p>
        </section>
        <aside className="card flex min-w-0 flex-[1_1_340px] flex-col gap-4 md:p-8">
          <h2 className="text-[17px]">{t("onboarding.firstDay")}</h2>
          {joining ? (
            <>
              {kv(<Clock size={20} />, t("onboarding.arrive"), joining.arrivalTime)}
              {kv(<Pin size={20} />, t("onboarding.where"), joining.location)}
              {kv(<User size={20} />, t("onboarding.contact"), [joining.contactName, joining.contactTitle].filter(Boolean).join(" · ") || null)}
              {kv(<Bag size={20} />, t("onboarding.bring"), joining.whatToBring)}
              {joining.notes && <p className="whitespace-pre-line rounded-2xl bg-[#F7F9FC] p-4 text-[13px] leading-relaxed text-ink-2">{joining.notes}</p>}
            </>
          ) : (
            <p className="text-sm text-ink-muted">{t("onboarding.detailsSoon")}</p>
          )}
        </aside>
      </div>
    </>
  );
}
