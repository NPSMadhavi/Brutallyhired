import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import { useApplications, useJobs, useMe } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Pill } from "@/components/ui/Card";
import { EmptyState, ErrorState, PageLoader } from "@/components/ui/feedback";
import { Arrow, Briefcase, File, Sparkle } from "@/components/ui/icons";
import { useFormat } from "@/lib/format";
import { stageTone } from "./stageTone";

export function ApplicationsListPage() {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const f = useFormat();
  const me = useMe();
  const apps = useApplications(tenant.slug);
  const jobsQuery = useJobs(tenant.slug);
  const [, setVersion] = useState(0);

  useEffect(() => {
    const onUpdate = () => setVersion((v) => v + 1);
    window.addEventListener("storage", onUpdate);
    window.addEventListener("bh_application_updated", onUpdate);
    return () => {
      window.removeEventListener("storage", onUpdate);
      window.removeEventListener("bh_application_updated", onUpdate);
    };
  }, []);

  let items = apps.data ? [...apps.data] : [];
  const userEmail = me.data?.email?.toLowerCase();
  const localApps = localStorage.getItem("bh_admin_applications");
  let adminApps: any[] | null = null;
  if (localApps !== null) {
    try {
      const parsed = JSON.parse(localApps);
      if (Array.isArray(parsed)) {
        adminApps = parsed;
        for (const pa of parsed) {
          const belongsToUser = !userEmail || !pa.email || pa.email.toLowerCase() === userEmail;
          if (belongsToUser && !items.some((it) => it.id === pa.id)) {
            items.push({
              id: pa.id,
              reference: `APP-${pa.id.slice(-6)}`,
              stage: pa.stage || "SUBMITTED",
              jobTitle: pa.jobTitle || "Software Developer",
              jobLocation: "Hybrid",
              submittedAt: pa.submittedAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch {}
  }

  // Sync stages with Admin candidate list (bh_admin_applications) if matching
  if (adminApps !== null) {
    items = items.map((it) => {
      if (it.stage === "DRAFT") return it;
      const adminMatch = adminApps!.find(
        (pa) =>
          pa.id === it.id ||
          (userEmail && pa.email?.toLowerCase() === userEmail && (!pa.jobTitle || pa.jobTitle === it.jobTitle))
      );
      return adminMatch ? { ...it, stage: (adminMatch.stage || it.stage) as any } : it;
    });
  }

  // Combine open positions from backend API and Admin jobs (bh_admin_jobs)
  const openJobs: Array<{
    id: string;
    externalRef: string;
    title: string;
    department?: string;
    location?: string;
    workplaceType?: string;
    experienceText?: string;
    summary?: string;
  }> = [];

  if (jobsQuery.data && Array.isArray(jobsQuery.data)) {
    for (const j of jobsQuery.data) {
      openJobs.push({
        id: j.id,
        externalRef: j.externalRef,
        title: j.title,
        department: j.department ?? undefined,
        location: j.location,
        workplaceType: j.workplaceType ?? undefined,
        experienceText: j.experienceText || "",
        summary: j.summary || "",
      });
    }
  }

  const localJobsRaw = localStorage.getItem("bh_admin_jobs");
  if (localJobsRaw) {
    try {
      const parsed = JSON.parse(localJobsRaw);
      if (Array.isArray(parsed)) {
        for (const pj of parsed) {
          const ref = pj.externalRef || pj.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          if (!openJobs.some((j) => j.id === pj.id || j.externalRef === ref || j.title.toLowerCase() === pj.title.toLowerCase())) {
            openJobs.push({
              id: pj.id || `job-${ref}`,
              externalRef: ref,
              title: pj.title,
              department: pj.department || "Technology",
              location: pj.location || "Hybrid",
              workplaceType: pj.workplaceType || "HYBRID",
              experienceText: pj.experienceText || pj.experience || "",
              summary: pj.description || pj.summary || "",
            });
          }
        }
      }
    } catch {}
  }

  if (apps.isPending && items.length === 0 && jobsQuery.isPending && openJobs.length === 0) return <PageLoader />;
  if (apps.isError && items.length === 0 && openJobs.length === 0) return <ErrorState error={apps.error} onRetry={() => void apps.refetch()} />;

  // Only auto-redirect to an in-progress draft application, never trap candidate on a rejected screen
  if (items.length === 1 && items[0]?.stage === "DRAFT") {
    const a = items[0]!;
    return <Navigate to={`/${tenant.slug}/applications/${a.id}/apply/details`} replace />;
  }

  return (
    <div className="space-y-10">
      {/* Active Applications Section */}
      {items.length > 0 && (
        <section aria-labelledby="apps-heading">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 id="apps-heading" className="text-[28px] font-bold text-ink">
                {t("applications.title")}
              </h1>
              <p className="mt-1 text-sm text-ink-muted">
                Track your active applications, assessments, and interview round status.
              </p>
            </div>
            <span className="rounded-full bg-line-soft px-3 py-1 text-xs font-semibold text-ink-2">
              {items.length} {items.length === 1 ? "Application" : "Applications"}
            </span>
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {items.map((a) => (
              <li key={a.id}>
                <Link
                  to={a.stage === "DRAFT" ? `/${tenant.slug}/applications/${a.id}/apply/details` : `/${tenant.slug}/applications/${a.id}`}
                  className="card flex items-center gap-4 text-ink no-underline transition-shadow hover:shadow-lift"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="label-caps text-[11px]">{a.reference}</span>
                    <span className="font-display text-lg font-bold leading-snug">{a.jobTitle}</span>
                    <span className="text-[13px] text-ink-muted">
                      {a.jobLocation} · {a.submittedAt ? t("applications.applied", { date: f.date(a.submittedAt) }) : t("applications.draft")}
                    </span>
                  </div>
                  <Pill tone={stageTone(a.stage)} dot>{t(`stage.${a.stage}`)}</Pill>
                  <Arrow className="text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Available Open Roles Section */}
      <section aria-labelledby="jobs-heading" className={items.length > 0 ? "border-t border-line pt-8" : ""}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-teal-500/10 text-teal-700">
                <Briefcase size={14} />
              </span>
              <h2 id="jobs-heading" className="text-2xl font-bold text-ink">
                {items.length === 0 ? `Career Opportunities at ${tenant.name}` : "Available Open Positions"}
              </h2>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {items.length === 0
                ? "Select a role below to start your application, submit your resume, and begin the assessment rounds."
                : "Looking for another opportunity? Explore other open roles below and apply directly."}
            </p>
          </div>
          {openJobs.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              <Sparkle size={13} /> {openJobs.length} {openJobs.length === 1 ? "Role Open" : "Roles Open"}
            </span>
          )}
        </div>

        {openJobs.length === 0 && items.length === 0 ? (
          <EmptyState icon={<File size={26} />} title={t("applications.empty")} body="No positions are currently open. Please check back soon!" />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {openJobs.map((job) => (
              <li
                key={job.id}
                className="card flex flex-col justify-between gap-4 p-5 transition-shadow hover:shadow-lift border border-line hover:border-brand/40"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="label-caps rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800">
                      {job.department || "Technology"}
                    </span>
                    <span className="text-xs font-medium text-ink-muted">
                      {job.workplaceType || "Hybrid"}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold leading-snug text-ink">
                    {job.title}
                  </h3>
                  <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-3">
                    {job.summary || `Join ${tenant.name} as a ${job.title}. We offer competitive compensation and great growth potential.`}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                    <span>{job.location || "Hybrid / Remote"}</span>
                    {job.experienceText && (
                      <>
                        <span>•</span>
                        <span>{job.experienceText}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-line-soft pt-3">
                  <span className="text-xs font-medium text-ink-muted">
                    Hiring: <strong className="font-semibold text-emerald-700">Active</strong>
                  </span>
                  <Link
                    to={`/${tenant.slug}/apply/${encodeURIComponent(job.externalRef)}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white no-underline transition-colors hover:bg-ink-2 shadow-sm"
                  >
                    Apply Now <Arrow size={14} className="text-white" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
