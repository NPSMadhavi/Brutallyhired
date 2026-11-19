import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useTenant } from "@/api/hooks";
import { applyBrand } from "@/lib/brand";
import { initials } from "@/lib/format";

/** Minimal shell for auth pages that live outside a tenant route; picks up branding when known. */
export function AuthShell({ tenantSlug, children }: { tenantSlug: string | null; children: ReactNode }) {
  const { t } = useTranslation();
  const tenant = useTenant(tenantSlug ?? "");
  const data = tenantSlug ? tenant.data : undefined;
  useEffect(() => {
    if (data) applyBrand(data.brandColor);
  }, [data]);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-white">
        <div className="page flex min-h-[72px] items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand font-display text-sm font-bold text-brand-fg" aria-hidden>
            {initials(data?.name ?? t("common.appName"))}
          </span>
          <span className="font-display text-[17px] font-bold">{data?.name ?? t("common.appName")}</span>
        </div>
      </header>
      <main className="page flex justify-center py-14">
        <section className="card flex w-full max-w-[520px] flex-col gap-6 md:p-8">{children}</section>
      </main>
    </div>
  );
}
