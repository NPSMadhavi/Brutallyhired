import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useMe, useStartApplication } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { ErrorState, PageLoader } from "@/components/ui/feedback";

/** Landing point for the company's Apply link: /:tenant/apply/:jobRef */
export function ApplyEntry() {
  const tenant = useTenantCtx();
  const { jobRef = "" } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useMe();
  const start = useStartApplication(tenant.slug);
  const started = useRef(false);

  useEffect(() => {
    if (!me.data || started.current) return;
    started.current = true;
    start.mutate(jobRef, {
      onSuccess: (r) =>
        navigate(r.stage === "DRAFT" ? `/${tenant.slug}/applications/${r.id}/apply/details` : `/${tenant.slug}/applications/${r.id}`, { replace: true }),
    });
  }, [me.data, jobRef, navigate, start, tenant.slug]);

  if (me.isPending) return <PageLoader />;
  if (!me.data) {
    const returnTo = `/${tenant.slug}/apply/${encodeURIComponent(jobRef)}`;
    return <Navigate to={`/${tenant.slug}/signin?${new URLSearchParams({ returnTo })}`} replace />;
  }
  if (start.isError) {
    return (
      <main className="page py-16">
        <ErrorState error={start.error} />
      </main>
    );
  }
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-ink-muted" role="status">
      {t("apply.starting")}
    </div>
  );
}
