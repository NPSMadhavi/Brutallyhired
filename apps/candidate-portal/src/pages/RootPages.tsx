import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { ButtonLink } from "@/components/ui/Button";

export function NotFoundPage() {
  const { t } = useTranslation();
  const { tenant } = useParams();
  return (
    <div className="card flex flex-col items-center gap-3 py-12 text-center">
      <h1 className="text-2xl">{t("notFound.title")}</h1>
      <p className="text-ink-muted">{t("notFound.body")}</p>
      {tenant && <ButtonLink to={`/${tenant}/applications`} variant="ghost">{t("notFound.home")}</ButtonLink>}
    </div>
  );
}
