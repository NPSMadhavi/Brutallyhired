import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/icons";
import { useErrorText } from "@/lib/useErrorText";
import { ApiError } from "@/lib/api";
import { AuthShell } from "./AuthShell";

export function AuthErrorPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const text = useErrorText();
  const returnTo = params.get("returnTo") ?? "/";
  const tenantSlug = returnTo.split("/").filter(Boolean)[0] ?? null;
  return (
    <AuthShell tenantSlug={tenantSlug}>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger"><Alert size={26} /></span>
      <h1 className="text-[26px]">{t("authError.title")}</h1>
      <p className="text-[15px] text-ink-2">{text(new ApiError(401, params.get("code") ?? "login_failed"))}</p>
      <ButtonLink to={tenantSlug ? `/${tenantSlug}/signin?${new URLSearchParams({ returnTo })}` : "/"} size="lg">
        {t("authError.tryAgain")}
      </ButtonLink>
    </AuthShell>
  );
}
