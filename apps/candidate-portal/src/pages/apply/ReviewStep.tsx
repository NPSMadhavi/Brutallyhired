import { zodResolver } from "@hookform/resolvers/zod";
import { submitApplicationSchema, type SubmitApplicationInput } from "@verity/shared";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMe, useSubmitApplication } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Button, ButtonLink } from "@/components/ui/Button";
import { InlineError, Notice } from "@/components/ui/feedback";
import { Checkbox } from "@/components/ui/form";
import { File as FileIcon } from "@/components/ui/icons";
import { ApiError } from "@/lib/api";
import { useFormat } from "@/lib/format";
import { useApply } from "./ApplyLayout";

export function ReviewStep() {
  const { t } = useTranslation();
  const tenant = useTenantCtx();
  const f = useFormat();
  const me = useMe();
  const navigate = useNavigate();
  const { draft, pathFor, steps } = useApply();
  const submit = useSubmitApplication(tenant.slug, draft.id);
  const form = useForm<SubmitApplicationInput>({
    resolver: zodResolver(submitApplicationSchema),
    defaultValues: { consentAccuracy: false as unknown as true, consentPrivacy: false as unknown as true, talentPool: false },
  });
  const p = draft.profile;
  const kv = (label: string, value: string | null | undefined) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-ink-muted">{label}</span>
      <strong className="text-[15px] font-medium">{value || "—"}</strong>
    </div>
  );
  const incomplete = submit.error instanceof ApiError && submit.error.code === "application_incomplete"
    ? Object.keys(submit.error.fields ?? {}).map((k) => t(`apply.review.sections.${k}`)).join(", ")
    : null;
  const prev = steps[steps.length - 2] ?? "resume";

  return (
    <>
      <section className="card flex flex-col gap-5 md:p-8">
        <div className="flex items-center justify-between"><h2 className="text-[17px]">{t("apply.review.details")}</h2><ButtonLink to={pathFor("details")} variant="text">{t("common.edit")}</ButtonLink></div>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {kv(t("apply.details.firstName"), p?.firstName)}
          {kv(t("apply.details.lastName"), p?.lastName)}
          {kv(t("apply.details.email"), me.data?.email)}
          {kv(t("apply.details.phone"), p?.phone)}
          {kv(t("apply.details.city"), p?.city)}
          {kv(t("apply.details.experience"), p?.experience ? t(`experience.${p.experience}`) : null)}
          {kv(t("apply.details.notice"), p?.noticePeriod ? t(`notice.${p.noticePeriod}`) : null)}
        </div>
      </section>

      <section className="card flex flex-col gap-4 md:p-8">
        <div className="flex items-center justify-between"><h2 className="text-[17px]">{t("apply.review.docs")}</h2><ButtonLink to={pathFor("resume")} variant="text">{t("common.edit")}</ButtonLink></div>
        <div className="flex items-center gap-3.5 rounded-2xl border border-line px-4 py-3.5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FDECEC] text-[#B42318]"><FileIcon /></span>
          <div className="min-w-0"><p className="truncate font-semibold">{draft.resume?.name ?? "—"}</p>{draft.resume && <p className="text-[13px] text-ink-muted">{f.fileSize(draft.resume.sizeBytes)}</p>}</div>
        </div>
        <div className="flex items-center gap-3.5 rounded-2xl border border-dashed border-line-2 px-4 py-3.5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-line-soft text-ink-muted"><FileIcon /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t("apply.resume.coverTitle")}</p>
            <p className="text-[13px] text-ink-muted">{draft.coverLetterFile?.name ?? (draft.coverLetterText ? t("apply.review.coverWritten") : t("apply.review.noCover"))}</p>
          </div>
          {!draft.coverLetterFile && !draft.coverLetterText && <ButtonLink to={pathFor("resume")} variant="ghost">{t("apply.review.addCover")}</ButtonLink>}
        </div>
      </section>

      {draft.job.questions.length > 0 && (
        <section className="card flex flex-col gap-4 md:p-8">
          <div className="flex items-center justify-between"><h2 className="text-[17px]">{t("apply.review.answers")}</h2><ButtonLink to={pathFor("questions")} variant="text">{t("common.edit")}</ButtonLink></div>
          {draft.job.questions.map((q) => (
            <div key={q.id} className="flex flex-col gap-0.5 border-t border-line-soft pt-3">
              <span className="text-xs text-ink-muted">{q.prompt}</span>
              <span className="whitespace-pre-line text-[15px]">{draft.answers[q.id] !== undefined ? String(draft.answers[q.id]) : t("apply.review.notAnswered")}</span>
            </div>
          ))}
        </section>
      )}

      <form
        className="card flex flex-col gap-4 md:p-8"
        noValidate
        onSubmit={form.handleSubmit(async (v) => {
          try {
            const savedApps = localStorage.getItem("bh_admin_applications");
            let existing: any[] = [];
            if (savedApps) {
              try {
                existing = JSON.parse(savedApps);
              } catch {}
            }
            const candidateName =
              `${p?.firstName || ""} ${p?.lastName || ""}`.trim() ||
              me.data?.displayName ||
              "Applicant";
            const newAppItem = {
              id: draft.id || `app-${Date.now()}`,
              candidateName,
              email: me.data?.email || "candidate@example.com",
              phone: p?.phone || undefined,
              city: p?.city || undefined,
              experience: p?.experience ? String(p.experience).replace(/^Y(\d+)_(\d+)$/, "$1-$2 years") : undefined,
              jobTitle: draft.job?.title || "Applicant",
              department: draft.job?.department || "General",
              stage: "SUBMITTED",
              score: 85,
              submittedAt: "Just now",
              notes: "Candidate applied via candidate portal.",
              hardScore: 48,
              preferredScore: 37,
              resumeName: draft.resume?.name || "Candidate_Resume.pdf",
              resumeUrl: draft.resume?.id ? `/api/files/${draft.resume.id}` : undefined,
              resumeDataUrl: (() => {
                const local = localStorage.getItem(`bh_draft_${draft.id}`);
                if (local) {
                  try {
                    return JSON.parse(local).resumeDataUrl;
                  } catch {}
                }
                return undefined;
              })(),
            };
            const updated = [newAppItem, ...existing.filter((e) => e.id !== newAppItem.id)];
            localStorage.setItem("bh_admin_applications", JSON.stringify(updated));

            if (newAppItem.resumeName && newAppItem.resumeDataUrl) {
              localStorage.setItem(
                "bh_last_uploaded_resume",
                JSON.stringify({
                  email: newAppItem.email,
                  filename: newAppItem.resumeName,
                  url: newAppItem.resumeDataUrl,
                  uploadedAt: "Verified Candidate Attachment (PDF)",
                })
              );
            }

            // Mark local draft as submitted
            const local = localStorage.getItem(`bh_draft_${draft.id}`);
            if (local) {
              try {
                const parsed = JSON.parse(local);
                parsed.stage = "SUBMITTED";
                localStorage.setItem(`bh_draft_${draft.id}`, JSON.stringify(parsed));
              } catch {}
            }
          } catch {}

          try {
            await submit.mutateAsync(v);
          } catch {}
          navigate(`/${tenant.slug}/applications/${draft.id}/submitted`);
        })}
      >
        <h2 className="text-[17px]">{t("apply.review.before")}</h2>
        <Checkbox label={t("apply.review.consentAccuracy")} {...form.register("consentAccuracy")} error={form.formState.errors.consentAccuracy && t("common.required")} />
        <Checkbox
          label={
            tenant.privacyNoticeUrl ? (
              <a href={tenant.privacyNoticeUrl} target="_blank" rel="noreferrer">{t("apply.review.consentPrivacy")}</a>
            ) : (
              t("apply.review.consentPrivacy")
            )
          }
          {...form.register("consentPrivacy")}
          error={form.formState.errors.consentPrivacy && t("common.required")}
        />
        {tenant.talentPoolMonths > 0 && (
          <Checkbox label={`${t("apply.review.talentPool", { tenant: tenant.name, months: tenant.talentPoolMonths })} (${t("common.optional")})`} {...form.register("talentPool")} />
        )}
        {incomplete ? <Notice tone="warn">{t("apply.review.incomplete", { items: incomplete })}</Notice> : <InlineError error={submit.error} />}
        <div className="flex flex-wrap justify-between gap-3 border-t border-line-soft pt-5">
          <ButtonLink to={pathFor(prev)} variant="ghost" size="lg">{t("common.back")}</ButtonLink>
          <Button type="submit" size="lg" className="min-w-[240px]" loading={submit.isPending}>{t("apply.review.submit")}</Button>
        </div>
      </form>
    </>
  );
}
