import type { TenantPublic } from "@verity/shared";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api, tp } from "@/lib/api";
import { applyBrand } from "@/lib/brand";

export type TenantAdminInfo = TenantPublic & {
  eligibilityThreshold: number;
};

export const DEFAULT_TENANT: TenantAdminInfo = {
  slug: "brutallyhired",
  name: "Brutallyhired",
  logoUrl: null,
  brandColor: "#094c3c",
  careersUrl: null,
  privacyNoticeUrl: null,
  termsUrl: null,
  supportEmail: "hr@brutallyhired.com",
  timezone: "Asia/Kolkata",
  talentPoolMonths: 12,
  eligibilityThreshold: 60,
};

type TenantContextValue = {
  tenant: TenantAdminInfo;
  setTenantSlug: (slug: string) => void;
  isLoading: boolean;
};

const TenantContext = createContext<TenantContextValue>({
  tenant: DEFAULT_TENANT,
  setTenantSlug: () => {},
  isLoading: false,
});

export function useTenant() {
  return useContext(TenantContext);
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const navigate = useNavigate();

  const routeTenant = params.tenant || "brutallyhired";
  const [currentSlug, setCurrentSlug] = useState<string>(routeTenant);
  const [tenant, setTenant] = useState<TenantAdminInfo>(DEFAULT_TENANT);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      try {
        const data = await api<TenantAdminInfo>(tp(currentSlug, "/admin/settings"));
        if (active && data) {
          setTenant({ ...DEFAULT_TENANT, ...data });
          applyBrand(data.brandColor || "#094c3c");
          document.title = `${data.name} — Admin Dashboard`;
        }
      } catch {
        // Fallback to public tenant info or default
        try {
          const pub = await api<TenantPublic>(tp(currentSlug));
          if (active && pub) {
            setTenant({ ...DEFAULT_TENANT, ...pub });
            applyBrand(pub.brandColor || "#094c3c");
            document.title = `${pub.name} — Admin Dashboard`;
          }
        } catch {
          if (active) {
            setTenant({ ...DEFAULT_TENANT, slug: currentSlug });
            applyBrand(DEFAULT_TENANT.brandColor);
            document.title = `${DEFAULT_TENANT.name} — Admin Dashboard`;
          }
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [currentSlug]);

  const changeTenantSlug = (newSlug: string) => {
    setCurrentSlug(newSlug);
    navigate(`/${newSlug}/dashboard`);
  };

  return (
    <TenantContext.Provider value={{ tenant, setTenantSlug: changeTenantSlug, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}
