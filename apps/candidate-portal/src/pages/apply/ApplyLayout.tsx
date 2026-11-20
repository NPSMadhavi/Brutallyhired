import { profileSchema, type ApplicationDraftDto } from "@verity/shared";
import { clsx } from "clsx";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, Outlet, useLocation, useOutletContext, useParams } from "react-router-dom";
import { useDraft } from "@/api/hooks";
import { BrandMark } from "@/components/layout/BrandMark";
import { Footer } from "@/components/layout/Footer";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { ButtonLink } from "@/components/ui/Button";
import { ErrorState, PageLoader } from "@/components/ui/feedback";
import { Check, Shield } from "@/components/ui/icons";
import { ApiError } from "@/lib/api";

export type StepKey = "details" | "resume" | "questions" | "review";
export interface ApplyCtx {
  draft: ApplicationDraftDto;
  steps: StepKey[];
  nextPath: (from: StepKey) => string;
  pathFor: (s: StepKey) => string;
}
export const useApply = () => useOutletContext<ApplyCtx>();

export function stepDone(draft: ApplicationDraftDto, s: StepKey) {
  if (s === "details") return profileSchema.safeParse(draft.profile ?? {}).success;
  if (s === "resume") return Boolean(draft.resume);
  if (s === "questions") return draft.job.questions.filter((q) => q.required).every((q) => draft.answers[q.id] !== undefined && draft.answers[q.id] !== "");
  return false;
}

export function ApplyLayout() {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const { appId = "" } = useParams();
  const { pathname } = useLocation();
  const step = pathname.split("/").filter(Boolean).pop() ?? "details";
  const draft = useDraft(tenant.slug, appId);

  let d: ApplicationDraftDto | undefined = draft.data;
  if (!d) {
    const local = localStorage.getItem(`bh_draft_${appId}`);
    if (local) {
      try {
        d = JSON.parse(local);
      } catch {}
    }
  }

  if (draft.isPending && !d) return <PageLoader />;
  if (draft.isError && !d) {
    if (draft.error instanceof ApiError && draft.error.code === "already_submitted") {
      return <Navigate to={`/${tenant.slug}/applications/${appId}`} replace />;
    }
    return <main className="page py-16"><ErrorState error={draft.error} onRetry={() => void draft.refetch()} /></main>;
  }

  if (!d) return <PageLoader />;

  const steps: StepKey[] = ["details", "resume", ...(d.job.questions.length ? (["questions"] as const) : []), "review"];
  const current = steps.indexOf(step as StepKey);
  if (current === -1) return <Navigate to={`/${tenant.slug}/applications/${appId}/apply/details`} replace />;
  const pathFor = (s: StepKey) => `/${tenant.slug}/applications/${appId}/apply/${s}`;
  const ctx: ApplyCtx = { draft: d, steps, pathFor, nextPath: (from) => pathFor(steps[steps.indexOf(from) + 1] ?? "review") };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-white">
        <div className="page flex min-h-[72px] flex-wrap items-center justify-between gap-4 py-2.5">
          <BrandMark />
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-[13px] text-ink-muted sm:inline-flex">
              <Check size={16} className="text-ok" />
              {t("common.draftSaved")}
            </span>
            <ButtonLink to={`/${tenant.slug}/applications`} variant="ghost">{t("common.saveAndExit")}</ButtonLink>
          </div>
        </div>
      </header>
      <main className="page flex flex-col gap-7 py-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-2">
            <span className="label-caps">{t("apply.stepOf", { n: current + 1, total: steps.length })}</span>
            <h1 className="text-[30px] leading-tight">{t(`apply.${steps[current]}.title`)}</h1>
          </div>
          <ol className="flex flex-wrap items-center gap-2.5" aria-label={t("apply.stepsLabel")}>
            {steps.map((s, i) => {
              const done = i < current || (i !== current && stepDone(d, s));
              return (
                <Fragment key={s}>
                  {i > 0 && <li aria-hidden className={clsx("h-0.5 w-8 rounded", i <= current ? "bg-ok" : "bg-line-2")} />}
                  <li>
                    <Link
                      to={pathFor(s)}
                      aria-current={i === current ? "step" : undefined}
                      className={clsx("flex items-center gap-2.5 text-sm no-underline", i === current ? "font-semibold text-ink" : "font-medium text-ink-muted")}
                    >
                      <span
                        className={clsx(
                          "flex h-[30px] w-[30px] items-center justify-center rounded-full font-display text-[13px] font-bold",
                          i === current ? "bg-brand text-brand-fg" : done ? "bg-ok-soft text-ok-ink" : "bg-line-soft text-ink-muted",
                        )}
                      >
                        {done && i !== current ? <Check size={14} /> : i + 1}
                      </span>
                      {t(`apply.steps.${s}`)}
                    </Link>
                  </li>
                </Fragment>
              );
            })}
          </ol>
        </div>
        <div className="flex flex-wrap items-start gap-7">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
            <Outlet context={ctx} />
          </div>
          <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
            <div className="card flex flex-col gap-3">
              <span className="label-caps">{t("apply.applyingFor")}</span>
              <p className="font-display text-[17px] font-bold leading-snug">{d.job.title}</p>
              <p className="text-[13px] text-ink-muted">{[tenant.name, d.job.location, d.job.employmentType].join(" · ")}</p>
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold text-brand">{t("apply.viewJob")}</summary>
                {d.job.summary.includes("<") ? (
                  <div
                    className="mt-3 prose prose-sm max-w-none text-ink-2 leading-relaxed [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-ink [&_h2]:mt-3 [&_h2]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_p]:mb-2"
                    dangerouslySetInnerHTML={{ __html: d.job.summary }}
                  />
                ) : (
                  <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-2">{d.job.summary}</p>
                )}
              </details>
            </div>
            <div className="card flex items-start gap-3">
              <Shield size={20} className="mt-0.5 shrink-0 text-info-ink" />
              <p className="text-[13px] leading-relaxed text-ink-2">{t("apply.privacy")}</p>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
