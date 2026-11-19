import { zodResolver } from "@hookform/resolvers/zod";
import { EXPERIENCE_BANDS, NOTICE_PERIODS, profileSchema, type ProfileInput } from "@verity/shared";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMe, useSaveProfile } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Card";
import { InlineError, Notice } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { useApply } from "./ApplyLayout";

export function ProfileFields({ form }: { form: ReturnType<typeof useForm<ProfileInput>> }) {
  const { t } = useTranslation();
  const { register, formState, control } = form;
  const err = (k: keyof ProfileInput) => formState.errors[k]?.message;
  return (
    <div className="grid gap-[18px] sm:grid-cols-2">
      <Field label={t("apply.details.firstName")} htmlFor="firstName" error={err("firstName")}>
        <Input id="firstName" autoComplete="given-name" placeholder="First name" {...register("firstName")} aria-invalid={!!formState.errors.firstName} />
      </Field>
      <Field label={t("apply.details.lastName")} htmlFor="lastName" error={err("lastName")}>
        <Input id="lastName" autoComplete="family-name" placeholder="Last name" {...register("lastName")} aria-invalid={!!formState.errors.lastName} />
      </Field>
      <Field label={t("apply.details.phone")} htmlFor="phone" hint={t("apply.details.phoneHint")} error={err("phone")}>
        <Controller
          name="phone"
          control={control}
          render={({ field }) => (
            <PhoneInput
              id="phone"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              hasError={!!formState.errors.phone}
            />
          )}
        />
      </Field>
      <Field label={t("apply.details.city")} htmlFor="city" error={err("city")}>
        <Input id="city" autoComplete="address-level2" placeholder="City (e.g. Mumbai)" {...register("city")} aria-invalid={!!formState.errors.city} />
      </Field>
      <Field label={t("apply.details.experience")} htmlFor="experience" error={err("experience")}>
        <Select id="experience" {...register("experience")} aria-invalid={!!formState.errors.experience}>
          <option value="">{t("apply.details.select")}</option>
          {EXPERIENCE_BANDS.map((v) => <option key={v} value={v}>{t(`experience.${v}`)}</option>)}
        </Select>
      </Field>
      <Field label={t("apply.details.notice")} htmlFor="noticePeriod" error={err("noticePeriod")}>
        <Select id="noticePeriod" {...register("noticePeriod")} aria-invalid={!!formState.errors.noticePeriod}>
          <option value="">{t("apply.details.select")}</option>
          {NOTICE_PERIODS.map((v) => <option key={v} value={v}>{t(`notice.${v}`)}</option>)}
        </Select>
      </Field>
    </div>
  );
}

export function DetailsStep() {
  const { t } = useTranslation();
  const tenant = useTenantCtx();
  const { draft, nextPath } = useApply();
  const me = useMe();
  const navigate = useNavigate();
  const save = useSaveProfile(tenant.slug);
  const [first, ...rest] = (me.data?.displayName ?? "").split(" ");
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      firstName: draft.profile?.firstName ?? first ?? "",
      lastName: draft.profile?.lastName ?? rest.join(" "),
      phone: draft.profile?.phone ?? "",
      city: draft.profile?.city ?? "",
      experience: draft.profile?.experience ?? undefined,
      noticePeriod: draft.profile?.noticePeriod ?? undefined,
    },
  });

  return (
    <form
      className="card flex flex-col gap-6 md:p-8"
      noValidate
      onSubmit={form.handleSubmit((v) => {
        const cleanProfile = {
          ...v,
          firstName: v.firstName.trim(),
          lastName: v.lastName.trim(),
          city: v.city.trim(),
        };
        const local = localStorage.getItem(`bh_draft_${draft.id}`);
        if (local) {
          try {
            const parsed = JSON.parse(local);
            parsed.profile = cleanProfile;
            localStorage.setItem(`bh_draft_${draft.id}`, JSON.stringify(parsed));
          } catch {}
        }
        save
          .mutateAsync(cleanProfile)
          .catch(() => {})
          .finally(() => navigate(nextPath("details")));
      })}
    >
      <Notice tone="info">{t("apply.details.signedInAs", { email: me.data?.email ?? "" })}</Notice>
      <Field label={t("apply.details.email")} htmlFor="email">
        <div className="relative">
          <Input id="email" value={me.data?.email ?? ""} readOnly />
          {me.data?.emailVerified && <Pill tone="teal" dot className="absolute right-3 top-3">{t("common.verified")}</Pill>}
        </div>
      </Field>
      <ProfileFields form={form} />
      <p className="text-[13px] text-ink-muted">{t("apply.details.note")}</p>
      <InlineError error={save.error} />
      <div className="flex flex-wrap justify-between gap-3 border-t border-line-soft pt-5">
        <ButtonLink to={`/${tenant.slug}/applications`} variant="ghost" size="lg">{t("common.back")}</ButtonLink>
        <Button type="submit" size="lg" loading={save.isPending}>{t("apply.details.next")}</Button>
      </div>
    </form>
  );
}
