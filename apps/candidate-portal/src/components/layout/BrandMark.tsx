import { useTranslation } from "react-i18next";
import { initials } from "@/lib/format";
import { useTenantCtx } from "./TenantContext";

export function BrandMark({ sub, size = 36 }: { sub?: string; size?: number }) {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-3">
      {tenant.logoUrl ? (
        <img src={tenant.logoUrl} alt="" width={size} height={size} className="rounded-[10px] object-contain" />
      ) : (
        <span className="flex items-center justify-center rounded-[10px] bg-brand font-display text-sm font-bold text-brand-fg" style={{ width: size, height: size }} aria-hidden>
          {initials(tenant.name)}
        </span>
      )}
      <span className="flex flex-col leading-tight">
        <span className="font-display text-[17px] font-bold tracking-tight text-ink">{tenant.name}</span>
      </span>
    </span>
  );
}

export function PoweredBy() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
      <svg width="14" height="14" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#2F5BEA" />
        <path d="M9 11l7 11 7-11" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t("common.poweredBy")}
    </span>
  );
}
