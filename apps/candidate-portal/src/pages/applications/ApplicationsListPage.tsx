import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import { useApplications } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Pill } from "@/components/ui/Card";
import { EmptyState, ErrorState, PageLoader } from "@/components/ui/feedback";
import { Arrow, File } from "@/components/ui/icons";
import { useFormat } from "@/lib/format";
import { stageTone } from "./stageTone";

export function ApplicationsListPage() {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const f = useFormat();
  const apps = useApplications(tenant.slug);
  if (apps.isPending) return <PageLoader />;
  if (apps.isError) return <ErrorState error={apps.error} onRetry={() => void apps.refetch()} />;
  const items = apps.data;
  if (items.length === 1) {
    const a = items[0]!;
    return <Navigate to={a.stage === "DRAFT" ? `/${tenant.slug}/applications/${a.id}/apply/details` : `/${tenant.slug}/applications/${a.id}`} replace />;
  }
  return (
    <>
      <h1 className="text-[32px]">{t("applications.title")}</h1>
      {items.length === 0 ? (
        <EmptyState icon={<File size={26} />} title={t("applications.empty")} body={t("root.body")} />
      ) : (
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
      )}
    </>
  );
}
