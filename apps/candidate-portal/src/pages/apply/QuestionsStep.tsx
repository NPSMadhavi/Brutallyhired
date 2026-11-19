import { zodResolver } from "@hookform/resolvers/zod";
import type { JobPublic } from "@verity/shared";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useUpdateDraft } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Button, ButtonLink } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useApply } from "./ApplyLayout";

/** Build validation from the hiring team's questions — nothing about them is hardcoded. */
function schemaFor(questions: JobPublic["questions"]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const q of questions) {
    let s: z.ZodTypeAny =
      q.type === "NUMBER"
        ? z.union([z.literal(""), z.coerce.number().finite()])
        : q.type === "SINGLE_CHOICE"
          ? z.union([z.literal(""), z.enum(q.options as [string, ...string[]])])
          : z.string().trim().max(4000);
    if (q.required) s = s.refine((v) => v !== "" && v !== undefined, { message: "required" });
    shape[q.id] = s;
  }
  return z.object(shape);
}

export function QuestionsStep() {
  const { t } = useTranslation();
  const tenant = useTenantCtx();
  const navigate = useNavigate();
  const { draft, nextPath, pathFor } = useApply();
  const update = useUpdateDraft(tenant.slug, draft.id);
  const schema = useMemo(() => schemaFor(draft.job.questions), [draft.job.questions]);
  const form = useForm<Record<string, string | number>>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(draft.job.questions.map((q) => [q.id, draft.answers[q.id] ?? ""])),
  });

  return (
    <form
      className="card flex flex-col gap-6 md:p-8"
      noValidate
      onSubmit={form.handleSubmit((v) => update.mutateAsync({ answers: v }).then(() => navigate(nextPath("questions"))))}
    >
      {draft.job.questions.map((q) => {
        const error = form.formState.errors[q.id] ? t("errors.validation_failed") : undefined;
        const label = (
          <>
            {q.prompt} {!q.required && <span className="font-normal text-ink-muted">({t("common.optional")})</span>}
          </>
        );
        if (q.type === "SINGLE_CHOICE") {
          return (
            <fieldset key={q.id} className="flex flex-col gap-2.5">
              <legend className="mb-1 text-[13px] font-medium text-ink-2">{label}</legend>
              {q.helpText && <p className="text-xs text-ink-muted">{q.helpText}</p>}
              {q.options.map((opt) => (
                <label key={opt} className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-line-2 px-4 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                  <input type="radio" value={opt} className="h-4 w-4 accent-[rgb(var(--brand))]" {...form.register(q.id)} />
                  {opt}
                </label>
              ))}
              {error && <p className="text-xs font-medium text-danger" role="alert">{error}</p>}
            </fieldset>
          );
        }
        return (
          <Field key={q.id} label={label} htmlFor={q.id} hint={q.helpText ?? undefined} error={error}>
            {q.type === "NUMBER" ? (
              <Input id={q.id} type="number" inputMode="decimal" {...form.register(q.id)} aria-invalid={!!error} />
            ) : (
              <Textarea id={q.id} rows={4} {...form.register(q.id)} aria-invalid={!!error} />
            )}
          </Field>
        );
      })}
      <InlineError error={update.error} />
      <div className="flex flex-wrap justify-between gap-3 border-t border-line-soft pt-5">
        <ButtonLink to={pathFor("resume")} variant="ghost" size="lg">{t("common.back")}</ButtonLink>
        <Button type="submit" size="lg" loading={update.isPending}>{t("apply.questions.next")}</Button>
      </div>
    </form>
  );
}
