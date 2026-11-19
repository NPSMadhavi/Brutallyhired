import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useIntent } from "@/api/hooks";
import { ErrorState, PageLoader } from "@/components/ui/feedback";
import { ApiError } from "@/lib/api";
import { AuthShell } from "./AuthShell";
import { EmailCodeForm } from "./EmailCodeForm";

/** The provider didn't vouch for the email, so the person proves it with a code before an account is created. */
export function VerifyEmailPage() {
  const { intentId = "" } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const intent = useIntent(intentId);
  if (intent.isPending) return <PageLoader />;
  if (intent.isError) return <AuthShell tenantSlug={null}><ErrorState error={new ApiError(404, "intent_not_found")} /></AuthShell>;
  const i = intent.data;
  return (
    <AuthShell tenantSlug={i.tenantSlug}>
      <h1 className="text-[26px]">{t("verifyEmail.title")}</h1>
      <p className="text-[15px] leading-relaxed text-ink-2">{t("verifyEmail.body", { provider: t(`providers.${i.provider}`), email: i.email })}</p>
      <EmailCodeForm
        tenantSlug={i.tenantSlug ?? undefined}
        fixedEmail={i.email}
        intentId={i.id}
        sendLabel={t("verifyEmail.send")}
        onDone={(r) => navigate(r ?? i.returnTo, { replace: true })}
      />
    </AuthShell>
  );
}
