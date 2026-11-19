import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useConfirmIntent, useIntent, useLogout, useMe, useProviders } from "@/api/hooks";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import { ErrorState, InlineError, PageLoader } from "@/components/ui/feedback";
import { ProviderLogo } from "@/components/ui/icons";
import { ApiError, oidcStartUrl } from "@/lib/api";
import { AuthShell } from "./AuthShell";
import { EmailCodeForm } from "./EmailCodeForm";

/** Explicit identity linking: the account owner signs in with an existing method, then confirms. */
export function LinkAccountPage() {
  const { intentId = "" } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const intent = useIntent(intentId);
  const me = useMe();
  const providers = useProviders();
  const confirm = useConfirmIntent(intentId);
  const logout = useLogout();

  if (intent.isPending || me.isPending) return <PageLoader />;
  if (intent.isError) return <AuthShell tenantSlug={null}><ErrorState error={new ApiError(404, "intent_not_found")} /></AuthShell>;
  const i = intent.data;
  const provider = t(`providers.${i.provider}`);
  const here = `/auth/link/${i.id}`;

  return (
    <AuthShell tenantSlug={i.tenantSlug}>
      <h1 className="text-[26px] leading-tight">{t("link.title", { provider })}</h1>
      {!me.data && (
        <>
          <p className="text-[15px] leading-relaxed text-ink-2">{t("link.body", { email: i.email })}</p>
          <div className="flex flex-col gap-3">
            {i.existingProviders
              .filter((p) => p !== "EMAIL" && providers.data?.includes(p))
              .map((p) => (
                <ButtonAnchor key={p} href={oidcStartUrl(p, here)} variant="ghost" size="lg" block icon={<ProviderLogo provider={p} />}>
                  {t("link.signInWith", { provider: t(`providers.${p}`) })}
                </ButtonAnchor>
              ))}
          </div>
          <EmailCodeForm tenantSlug={i.tenantSlug ?? undefined} fixedEmail={i.email} onDone={() => void me.refetch()} />
        </>
      )}
      {me.data && me.data.email === i.email && (
        <>
          <p className="text-[15px] leading-relaxed text-ink-2">{t("link.confirmBody", { provider, email: i.email })}</p>
          <Button size="lg" icon={<ProviderLogo provider={i.provider} />} loading={confirm.isPending} onClick={() => confirm.mutate(undefined, { onSuccess: (r) => navigate(r.returnTo, { replace: true }) })}>
            {t("link.confirm", { provider })}
          </Button>
          <InlineError error={confirm.error} />
        </>
      )}
      {me.data && me.data.email !== i.email && (
        <>
          <p className="text-[15px] leading-relaxed text-ink-2">{t("link.wrongAccount", { current: me.data.email, email: i.email })}</p>
          <Button variant="ghost" onClick={() => logout.mutate(undefined, { onSuccess: () => void me.refetch() })}>{t("common.signOut")}</Button>
        </>
      )}
    </AuthShell>
  );
}
