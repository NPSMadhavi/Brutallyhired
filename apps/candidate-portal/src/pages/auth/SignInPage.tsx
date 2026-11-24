import { returnToSchema, type AuthProviderKey } from "@verity/shared";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useJob, useMe, useProviders } from "@/api/hooks";
import { BrandMark, PoweredBy } from "@/components/layout/BrandMark";
import { Footer } from "@/components/layout/Footer";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { ButtonAnchor } from "@/components/ui/Button";
import { PageLoader } from "@/components/ui/feedback";
import { User, ProviderLogo } from "@/components/ui/icons";
import { oidcStartUrl } from "@/lib/api";
import { applyBrand } from "@/lib/brand";
import { EmailCodeForm } from "./EmailCodeForm";

function ApplyingFor({ jobRef }: { jobRef: string | null }) {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const job = useJob(tenant.slug, jobRef ?? "");

  // Look up matching job from localStorage (jobs created/published in Admin)
  let localJob: any = null;
  if (jobRef) {
    try {
      const saved = localStorage.getItem("bh_admin_jobs");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const norm = (s: string) =>
            s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          const target = norm(jobRef);
          localJob = parsed.find(
            (j: any) =>
              j.externalRef === jobRef ||
              j.id === jobRef ||
              (j.externalRef && norm(j.externalRef) === target) ||
              (j.title && norm(j.title) === target) ||
              (j.title && j.title.toLowerCase() === jobRef.toLowerCase())
          );
        }
      }
    } catch {}

    // Check draft jobs if not found in published jobs
    if (!localJob) {
      try {
        const draft = localStorage.getItem("bh_admin_job_draft");
        if (draft) {
          const parsedDraft = JSON.parse(draft);
          if (parsedDraft?.title) {
            const norm = (s: string) =>
              s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            if (norm(parsedDraft.title) === norm(jobRef)) {
              localJob = parsedDraft;
            }
          }
        }
      } catch {}
    }

    // Check application draft if any
    if (!localJob) {
      try {
        const draftKey = `bh_draft_${tenant.slug}_${jobRef}`;
        const savedAppId = localStorage.getItem(draftKey);
        if (savedAppId) {
          const draftStr = localStorage.getItem(`bh_draft_${savedAppId}`);
          if (draftStr) {
            const parsed = JSON.parse(draftStr);
            if (parsed?.job?.title) {
              localJob = parsed.job;
            }
          }
        }
      } catch {}
    }
  }

  // Fallback to title-casing the jobRef from the URL
  const formattedRefTitle = jobRef
    ? jobRef
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim()
    : "";

  const title =
    job.data?.title ||
    localJob?.title ||
    formattedRefTitle ||
    "Open Position";

  const location =
    job.data?.location ||
    localJob?.location ||
    "Remote / Hybrid";

  const employmentType =
    job.data?.employmentType ||
    localJob?.workplaceType ||
    localJob?.employmentType ||
    "Full-time";

  const meta = [tenant.name, location, employmentType].filter(Boolean).join(" · ");

  return (
    <aside className="flex flex-[0_1_420px] flex-col gap-5">
      <div className="card flex flex-col gap-3">
        <span className="label-caps">{t("auth.applyingFor")}</span>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#094c3c] text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 2 17 12 22 22 17 22 7 12 2" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <div className="flex flex-col">
            <p className="font-display text-[17px] font-bold leading-snug text-ink">{title}</p>
            <p className="text-[13px] text-ink-muted mt-0.5">{meta}</p>
          </div>
        </div>
      </div>
      <div className="card flex flex-col gap-4">
        <h2 className="text-[17px] font-bold text-ink">{t("auth.whatNext")}</h2>
        {[
          { num: 1, text: "A few details about you" },
          { num: 2, text: "Upload your CV, and a cover letter if you like" },
          { num: 3, text: "Check and submit — about 5 minutes" },
        ].map((step) => (
          <div key={step.num} className="flex items-center gap-3 text-sm text-ink-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 font-display text-xs font-bold text-blue-700 shrink-0">
              {step.num}
            </span>
            <span>{step.text}</span>
          </div>
        ))}
        <p className="border-t border-line-soft pt-3.5 text-[13px] leading-relaxed text-ink-muted">
          {t("auth.trackAfter")}
        </p>
      </div>
    </aside>
  );
}

export function SignInPage() {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const me = useMe();
  const providers = useProviders();
  const rawReturnTo = params.get("returnTo") ?? "";
  const defaultPath = tenant.slug ? `/${tenant.slug}/applications` : "/applications";
  const parsed = returnToSchema.safeParse(rawReturnTo || defaultPath);
  const returnTo = parsed.success ? parsed.data : defaultPath;
  const pathMatch =
    /(?:^|\/)apply\/([^/?#]+)/.exec(rawReturnTo) ||
    /(?:^|\/)apply\/([^/?#]+)/.exec(returnTo) ||
    /(?:^|\/)apply\/([^/?#]+)/.exec(window.location.pathname);
  const jobRef =
    params.get("job") ||
    params.get("jobRef") ||
    params.get("ref") ||
    (pathMatch ? decodeURIComponent(pathMatch[1]!) : null);

  useEffect(() => {
    applyBrand(tenant.brandColor || "#0F5E59");
    document.title = tenant.name ? `${tenant.name} · Candidate Portal` : "Candidate Portal";
  }, [tenant.brandColor, tenant.name]);

  if (me.isPending) return <PageLoader />;
  if (me.data) {
    const fallback = `/${tenant.slug || "brutallyhired"}/applications`;
    const target =
      returnTo && returnTo !== "/" && returnTo !== "/signin" && returnTo !== "/applications"
        ? returnTo
        : me.data.staffOf[0]?.tenantSlug
          ? `/${me.data.staffOf[0].tenantSlug}/applications`
          : fallback;

    if (window.location.pathname !== target) {
      return <Navigate to={target} replace />;
    }
  }

  // Always display Google, Microsoft, and LinkedIn sign-in options
  const oidc: AuthProviderKey[] = ["GOOGLE", "MICROSOFT", "LINKEDIN"];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-white">
        <div className="page flex min-h-[72px] items-center justify-between gap-4 py-2.5">
          {tenant.careersUrl ? <a href={tenant.careersUrl} className="no-underline"><BrandMark /></a> : <BrandMark />}
          <PoweredBy />
        </div>
      </header>
      <main className="page flex flex-wrap items-start justify-center gap-8 py-14">
        <section className="card flex flex-[0_1_480px] flex-col gap-6 md:p-8" aria-labelledby="signin-h">
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-800">
              Candidate Portal
            </span>
            <h1 id="signin-h" className="text-[32px] font-bold leading-tight text-ink">
              Candidate Sign In
            </h1>
            <p className="text-[15px] leading-relaxed text-ink-muted">
              Sign in to track your applications, complete proctored assessments, and review offers.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {oidc.map((p) => (
              <ButtonAnchor
                key={p}
                href={oidcStartUrl(p, returnTo)}
                variant="ghost"
                size="lg"
                block
                icon={<ProviderLogo provider={p} />}
                className="justify-center border border-slate-200 hover:bg-slate-50 font-medium text-[15px]"
              >
                {p === "GOOGLE"
                  ? "Continue with Google"
                  : p === "MICROSOFT"
                    ? "Continue with Microsoft"
                    : p === "LINKEDIN"
                      ? "Continue with LinkedIn"
                      : t("auth.continueWith", { provider: t(`providers.${p}`) })}
              </ButtonAnchor>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[13px] text-ink-muted my-1">
            <span className="h-px flex-1 bg-line" />
            {t("auth.orEmail")}
            <span className="h-px flex-1 bg-line" />
          </div>
          <EmailCodeForm tenantSlug={tenant.slug || undefined} onDone={(r) => navigate(r ?? returnTo, { replace: true })} />
          <div className="flex items-start gap-3 border-t border-line-soft pt-5">
            <User size={18} className="mt-0.5 shrink-0 text-info-ink" />
            <p className="text-[13px] leading-relaxed text-ink-2">{t("auth.oneAccount")}</p>
          </div>
          {(tenant.termsUrl || tenant.privacyNoticeUrl) && (
            <p className="text-[13px] text-ink-muted">
              {t("auth.agree")}{" "}
              {tenant.termsUrl && <a href={tenant.termsUrl} target="_blank" rel="noreferrer">{t("common.terms")}</a>}
              {tenant.termsUrl && tenant.privacyNoticeUrl && ` ${t("auth.and")} `}
              {tenant.privacyNoticeUrl && <a href={tenant.privacyNoticeUrl} target="_blank" rel="noreferrer">{t("common.privacyNotice")}</a>}.
            </p>
          )}

          {/* Differentiating Staff/Admin Login Link */}
          <div className="mt-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
            <div className="flex flex-col">
              <span className="font-bold text-slate-800">Recruiter or Administrator?</span>
              <span className="text-[11px] text-slate-500">Sign in to manage requisitions, candidate reviews, and scoring.</span>
            </div>
            <Link
              to="/admin/login"
              className="inline-flex items-center gap-1 font-bold text-teal-700 hover:text-teal-900 shrink-0 ml-3 underline"
            >
              <span>HR Admin Sign In →</span>
            </Link>
          </div>
        </section>
        <ApplyingFor jobRef={jobRef} />
      </main>
      <Footer />
    </div>
  );
}
