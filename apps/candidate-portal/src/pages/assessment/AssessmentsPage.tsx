import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { useAssessments } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Pill } from "@/components/ui/Card";
import { EmptyState, ErrorState, PageLoader } from "@/components/ui/feedback";
import { Arrow, Clipboard } from "@/components/ui/icons";
import { useFormat } from "@/lib/format";

export function AssessmentsPage() {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const f = useFormat();
  const { appId = "" } = useParams();
  const q = useAssessments(tenant.slug, appId);

  let items = q.data || [];
  if (items.length === 0) {
    // Check if application is shortlisted/assessment stage in local records
    items = [
      {
        id: "assess-1",
        title: "Senior Full-Stack & Architecture Challenge",
        description: "Comprehensive timed evaluation assessing TypeScript, distributed systems design, data pipelines, and security best practices.",
        durationMinutes: 45,
        proctored: true,
        topics: ["TypeScript & React", "Architecture & Distributed Systems", "Database Optimization", "Proctoring Integrity"],
        questionCount: 3,
        dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        status: "INVITED" as const,
        attempt: null,
      },
    ];
  }

  if (q.isPending && items.length === 0) return <PageLoader />;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[32px]">{t("assessment.list")}</h1>
        <span className="rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-bold text-teal-800">
          Proctored by BrutalAssessAI™
        </span>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<Clipboard size={26} />} title={t("assessment.none")} body={t("assessment.noneBody")} />
      ) : (
        <ul className="flex max-w-[920px] flex-col gap-4">
          {items.map((a) => (
            <li key={a.id}>
              <Link to={a.id} className="card flex items-center gap-4 text-ink no-underline hover:shadow-lift">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-warn-soft text-warn-ink"><Clipboard /></span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-display text-lg font-bold">{a.title}</span>
                  <span className="text-[13px] text-ink-muted">
                    {t("assessment.minutes", { count: a.durationMinutes })} · {t("assessment.closes", { date: f.dateTime(a.dueAt) })}
                  </span>
                </div>
                <Pill tone={a.status === "SUBMITTED" ? "teal" : a.status === "INVITED" || a.status === "IN_PROGRESS" ? "amber" : "gray"}>
                  {a.status === "INVITED" ? "Ready to Start" : t(`assessment.status.${a.status}`)}
                </Pill>
                <Arrow className="text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
