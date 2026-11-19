import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { PoweredBy } from "./BrandMark";
import { useTenantCtx } from "./TenantContext";

export function Footer() {
  const { t } = useTranslation();
  const tenant = useTenantCtx();
  return (
    <footer className="mt-auto border-t border-line">
      <div className="page flex flex-wrap items-center justify-between gap-4 py-6 text-[13px] text-ink-muted">
        <span className="flex flex-wrap items-center gap-3">
          {t("common.copyright", { year: new Date().getFullYear(), tenant: tenant.name })}
          <PoweredBy />
        </span>
        <nav className="flex items-center gap-5" aria-label={t("common.help")}>
          {tenant.privacyNoticeUrl && <a href={tenant.privacyNoticeUrl} target="_blank" rel="noreferrer" className="text-brand">{t("common.privacyNotice")}</a>}
          {tenant.termsUrl && <a href={tenant.termsUrl} target="_blank" rel="noreferrer" className="text-brand">{t("common.terms")}</a>}
          {tenant.supportEmail && <a href={`mailto:${tenant.supportEmail}`} className="text-brand">{t("common.help")}</a>}
        </nav>
      </div>
    </footer>
  );
}
