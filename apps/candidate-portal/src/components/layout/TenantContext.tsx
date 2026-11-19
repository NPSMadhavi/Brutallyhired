import type { TenantPublic } from "@verity/shared";
import { createContext, useContext, useEffect } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useTenant } from "@/api/hooks";
import { ErrorState, PageLoader } from "@/components/ui/feedback";
import { applyBrand } from "@/lib/brand";

export const DEFAULT_TENANT: TenantPublic = {
  slug: "brutallyhired",
  name: "Brutallyhired",
  logoUrl: null,
  brandColor: "#094c3c",
  careersUrl: null,
  privacyNoticeUrl: null,
  termsUrl: null,
  supportEmail: null,
  timezone: "Asia/Kolkata",
  talentPoolMonths: 12,
};

const TenantCtx = createContext<TenantPublic | null>(null);

export function useTenantCtx(): TenantPublic {
  const t = useContext(TenantCtx);
  return t ?? DEFAULT_TENANT;
}

/** Loads the company from the URL (/:tenant/...) and applies its branding. */
export function TenantLayout() {
  const { tenant: slug = "" } = useParams();
  const q = useTenant(slug);

  useEffect(() => {
    if (q.data) {
      applyBrand(q.data.brandColor);
      document.title = q.data.name;
    }
  }, [q.data]);

  if (q.isPending) return <PageLoader />;
  if (q.isError) {
    if (slug === "brutallyhired" || !slug) {
      return (
        <TenantCtx.Provider value={DEFAULT_TENANT}>
          <Outlet />
        </TenantCtx.Provider>
      );
    }
    return (
      <main className="page py-16">
        <ErrorState error={q.error} />
      </main>
    );
  }
  return (
    <TenantCtx.Provider value={q.data}>
      <Outlet />
    </TenantCtx.Provider>
  );
}
