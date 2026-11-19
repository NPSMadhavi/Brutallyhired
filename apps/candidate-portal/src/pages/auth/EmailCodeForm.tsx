import { zodResolver } from "@hookform/resolvers/zod";
import { emailCodeRequestSchema } from "@verity/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { useRequestCode, useVerifyCode } from "@/api/hooks";
import { Button } from "@/components/ui/Button";
import { InlineError, Notice } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";

const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) });

export function EmailCodeForm({
  tenantSlug, fixedEmail, intentId, onDone, sendLabel,
}: { tenantSlug?: string; fixedEmail?: string; intentId?: string; onDone: (returnTo: string | null) => void; sendLabel?: string }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const request = useRequestCode();
  const verify = useVerifyCode();

  const emailForm = useForm<z.infer<typeof emailCodeRequestSchema>>({
    resolver: zodResolver(emailCodeRequestSchema),
    defaultValues: { email: fixedEmail ?? "" },
  });
  const codeForm = useForm<z.infer<typeof codeSchema>>({ resolver: zodResolver(codeSchema), defaultValues: { code: "" } });

  const send = (value: string) =>
    request.mutateAsync({ email: value, tenant: tenantSlug }).then(() => setEmail(value));

  if (!email) {
    return (
      <form className="flex flex-col gap-3" onSubmit={emailForm.handleSubmit((v) => send(v.email))} noValidate>
        {!fixedEmail && (
          <Field label={t("auth.emailLabel")} htmlFor="email" error={emailForm.formState.errors.email && t("errors.validation_failed")}>
            <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" inputMode="email" {...emailForm.register("email")} aria-invalid={!!emailForm.formState.errors.email} />
          </Field>
        )}
        <Button type="submit" size="lg" block loading={request.isPending} className="!bg-[#2563eb] !text-white hover:!bg-[#1d4ed8]">
          {sendLabel ?? t("auth.sendCode")}
        </Button>
        <p className="text-xs text-ink-muted">{t("auth.codeHint")}</p>
        <InlineError error={request.error} />
      </form>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={codeForm.handleSubmit((v) => verify.mutateAsync({ email, code: v.code, intentId }).then((r) => onDone(r.returnTo)))}
    >
      <Notice tone="info">{t("auth.codeSent", { email })}</Notice>
      <Field label={t("auth.codeLabel")} htmlFor="code" error={codeForm.formState.errors.code && t("errors.validation_failed")}>
        <Input
          id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="text-center text-xl tracking-[0.4em]"
          {...codeForm.register("code")} aria-invalid={!!codeForm.formState.errors.code}
        />
      </Field>
      <Button type="submit" size="lg" block loading={verify.isPending}>{t("auth.verify")}</Button>
      <InlineError error={verify.error} />
      {resent && <p className="text-xs text-ok-ink" role="status">{t("auth.resent")}</p>}
      <div className="flex flex-wrap justify-between gap-2">
        {!fixedEmail && <Button variant="text" onClick={() => setEmail(null)}>{t("auth.useDifferentEmail")}</Button>}
        <Button variant="text" onClick={() => send(email).then(() => setResent(true))} loading={request.isPending}>{t("auth.resend")}</Button>
      </div>
    </form>
  );
}
