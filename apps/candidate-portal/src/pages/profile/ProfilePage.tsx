import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type AuthProviderKey, type ProfileInput } from "@verity/shared";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useMe, useProfile, useProviders, useSaveProfile, useUnlink } from "@/api/hooks";
import { ProfileFields } from "@/pages/apply/DetailsStep";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { useToast } from "@/components/layout/Toasts";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Card";
import { ErrorState, InlineError, PageLoader } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { Check, ProviderLogo, Shield } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/misc";
import { oidcStartUrl } from "@/lib/api";

export function ProfilePage() {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const loc = useLocation();
  const me = useMe();
  const providers = useProviders();
  const profile = useProfile(tenant.slug);
  const save = useSaveProfile(tenant.slug);
  const unlink = useUnlink();
  const toast = useToast();
  const [saveSuccess, setSaveSuccess] = useState(false);

  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    const p = profile.data?.profile;
    if (p) {
      form.reset({
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone ?? "",
        city: p.city ?? "",
        experience: p.experience ?? undefined,
        noticePeriod: p.noticePeriod ?? undefined,
      });
    }
  }, [profile.data, form]);

  if (profile.isPending || me.isPending) return <PageLoader />;
  if (profile.isError) return <ErrorState error={profile.error} />;
  const linked = new Set(me.data?.identities.map((i) => i.provider));

  // Determine candidate display name dynamically for initials & header
  const watchedFirst = form.watch("firstName");
  const watchedLast = form.watch("lastName");
  const candidateName =
    [watchedFirst, watchedLast].filter(Boolean).join(" ") ||
    [profile.data?.profile?.firstName, profile.data?.profile?.lastName].filter(Boolean).join(" ") ||
    profile.data?.displayName ||
    me.data?.displayName ||
    me.data?.email;

  const onSubmit = async (data: ProfileInput) => {
    try {
      await save.mutateAsync({
        ...data,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        city: data.city.trim(),
      });
      setSaveSuccess(true);
      toast("Profile updated successfully");
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch {
      // InlineError component handles save.error
    }
  };

  return (
    <>
      {/* Profile Header with Dynamic User Avatar */}
      <div className="card flex items-center gap-5 p-6 md:p-7">
        <Avatar name={candidateName} size={64} />
        <div className="flex flex-col min-w-0">
          <h1 className="font-display text-2xl font-bold text-ink truncate leading-tight">
            {candidateName || "Candidate"}
          </h1>
          <p className="text-sm text-ink-muted truncate mt-0.5">
            {me.data?.email}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <form className="card flex min-w-0 flex-[999_1_560px] flex-col gap-5 md:p-8" noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex items-center justify-between">
            <h2 className="text-[19px]">{t("profile.personal")}</h2>
            {saveSuccess && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ok-ink bg-ok-soft px-2.5 py-1 rounded-full">
                <Check size={14} /> Profile saved
              </span>
            )}
          </div>
          <Field label={t("profile.email")} htmlFor="pemail">
            <div className="relative">
              <Input id="pemail" value={me.data?.email ?? ""} readOnly />
              {me.data?.emailVerified && (
                <Pill tone="teal" dot className="absolute right-3 top-3">
                  {t("common.verified")}
                </Pill>
              )}
            </div>
          </Field>
          <ProfileFields form={form} />
          <InlineError error={save.error} />
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" loading={save.isPending} disabled={save.isPending}>
              {t("profile.save")}
            </Button>
            {saveSuccess && !form.formState.isDirty && (
              <span className="text-[13px] text-ok-ink" role="status">
                {t("profile.saved")}
              </span>
            )}
          </div>
        </form>
        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
          <section className="card flex flex-col gap-1">
            <h2 className="text-[19px]">{t("profile.signIn")}</h2>
            <p className="mb-2 text-[13px] text-ink-muted">{t("profile.signInBody")}</p>
            {(providers.data ?? []).map((p: AuthProviderKey) => (
              <div key={p} className="flex flex-wrap items-center gap-3 border-t border-line-soft py-3.5">
                <ProviderLogo provider={p} />
                <span className="flex-1 text-sm font-semibold">{t(`providers.${p}`)}</span>
                {linked.has(p) ? (
                  <>
                    <Pill tone="teal">{t("profile.linked")}</Pill>
                    {linked.size > 1 && <Button variant="text" loading={unlink.isPending} onClick={() => unlink.mutate(p)}>{t("profile.unlink")}</Button>}
                  </>
                ) : p !== "EMAIL" ? (
                  <ButtonAnchor href={oidcStartUrl(p, loc.pathname, true)} variant="ghost">{t("profile.link")}</ButtonAnchor>
                ) : null}
              </div>
            ))}
            <InlineError error={unlink.error} />
          </section>
          <div className="flex items-start gap-3 rounded-2xl border border-[#DCE5FF] bg-[#F5F8FF] p-4">
            <Shield size={20} className="mt-0.5 shrink-0 text-info-ink" />
            <p className="text-[13px] leading-relaxed text-ink-2">{t("apply.privacy")}</p>
          </div>
        </aside>
      </div>
    </>
  );
}
