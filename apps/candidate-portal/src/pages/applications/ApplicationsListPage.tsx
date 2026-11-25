import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import { useApplications, useMe } from "@/api/hooks";
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
  const me = useMe();
  const apps = useApplications(tenant.slug);
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

  // Sync stages with Admin candidate list (bh_admin_applications); any submitted app removed from Admin is Rejected
  if (adminApps !== null) {
    items = items.map((it) => {
      if (it.stage === "DRAFT") return it;
      const adminMatch = adminApps!.find(
        (pa) =>
          pa.id === it.id ||
          (userEmail && pa.email?.toLowerCase() === userEmail && (!pa.jobTitle || pa.jobTitle === it.jobTitle))
      );
      return adminMatch ? { ...it, stage: (adminMatch.stage || it.stage) as any } : { ...it, stage: "REJECTED" as any };
    });
  }

  const rejectedRaw = localStorage.getItem("bh_rejected_applications");
  if (rejectedRaw) {
    try {
      const rejectedList = JSON.parse(rejectedRaw);
      if (Array.isArray(rejectedList)) {
        items = items.map((it) => {
          const isRejected = rejectedList.some(
            (r: any) =>
              r.id === it.id ||
              (userEmail && r.email?.toLowerCase() === userEmail && (!r.jobTitle || r.jobTitle === it.jobTitle))
          );
          return isRejected ? { ...it, stage: "REJECTED" as any } : it;
        });
        for (const ra of rejectedList) {
          const matchesUser = !userEmail || !ra.email || ra.email.toLowerCase() === userEmail;
          if (matchesUser && !items.some((it) => it.id === ra.id || it.jobTitle === ra.jobTitle)) {
            items.push({
              id: ra.id,
              reference: `APP-${String(ra.id).slice(-6)}`,
              stage: "REJECTED" as any,
              jobTitle: ra.jobTitle || "Software Developer",
              jobLocation: "Hybrid",
              submittedAt: ra.rejectedAt || new Date().toISOString(),
              updatedAt: ra.rejectedAt || new Date().toISOString(),
            });
          }
        }
      }
    } catch {}
  }

  if (apps.isPending && items.length === 0) return <PageLoader />;
  if (apps.isError && items.length === 0) return <ErrorState error={apps.error} onRetry={() => void apps.refetch()} />;
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
