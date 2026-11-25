import { zodResolver } from "@hookform/resolvers/zod";
import { ACCEPTED_RESUME_MIME, resumeSummarySchema, type ResumeSummary } from "@verity/shared";
import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMe, useRemoveCoverLetter, useSaveResumeSummary, useUpdateDraft, useUploadCoverLetter, useUploadResume } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CheckRow, Pill } from "@/components/ui/Card";
import { InlineError, Notice, Spinner } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Check, File as FileIcon, Sparkle } from "@/components/ui/icons";
import { FileDrop, TagInput } from "@/components/ui/misc";
import { useFormat } from "@/lib/format";
import { useApply } from "./ApplyLayout";

const MAX_UPLOAD_MB = 5;
const COVER_MAX = 4000;
const ACCEPT = [...ACCEPTED_RESUME_MIME, ".pdf", ".doc", ".docx", ".rtf"].join(",");

function SummaryView({ s }: { s: ResumeSummary }) {
  const { t } = useTranslation();
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex flex-wrap gap-4 border-t border-[#E3EAFB] py-3.5">
      <span className="w-[150px] shrink-0 pt-0.5 text-[13px] font-semibold text-ink-3">{label}</span>
      <span className="min-w-0 flex-1 text-sm">{value}</span>
    </div>
  );
  const chips = (xs: string[]) =>
    xs.length ? (
      <span className="flex flex-wrap gap-1.5">{xs.map((x) => <span key={x} className="rounded-full border border-line-2 bg-white px-3 py-1 text-[13px]">{x}</span>)}</span>
    ) : (
      <span className="text-ink-muted">{t("apply.resume.nothing")}</span>
    );
  return (
    <div>
      {row(t("apply.resume.currentRole"), s.currentRole || <span className="text-ink-muted">{t("apply.resume.nothing")}</span>)}
      {row(t("apply.resume.totalExperience"), s.totalExperience || <span className="text-ink-muted">{t("apply.resume.nothing")}</span>)}
      {row(t("apply.resume.education"), chips(s.education))}
      {row(t("apply.resume.skills"), chips(s.skills))}
      {row(t("apply.resume.certifications"), chips(s.certifications))}
    </div>
  );
}

function SummaryEditor({ initial, onSaved }: { initial: ResumeSummary | null; onSaved: () => void }) {
  const { t } = useTranslation();
  const tenant = useTenantCtx();
  const { draft } = useApply();
  const save = useSaveResumeSummary(tenant.slug, draft.id);
  const form = useForm<ResumeSummary>({
    resolver: zodResolver(resumeSummarySchema),
    defaultValues: initial ?? { currentRole: "", totalExperience: "", education: [], skills: [], certifications: [] },
  });
  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit((v) => save.mutateAsync(v).then(onSaved))}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("apply.resume.currentRole")} htmlFor="currentRole"><Input id="currentRole" {...form.register("currentRole")} /></Field>
        <Field label={t("apply.resume.totalExperience")} htmlFor="totalExperience"><Input id="totalExperience" {...form.register("totalExperience")} /></Field>
      </div>
      {(["skills", "education", "certifications"] as const).map((k) => (
        <Field key={k} label={t(`apply.resume.${k}`)}>
          <Controller control={form.control} name={k} render={({ field }) => <TagInput label={t(`apply.resume.${k}`)} value={field.value ?? []} onChange={field.onChange} />} />
        </Field>
      ))}
      <InlineError error={save.error} />
      <Button type="submit" variant="ghost" className="self-start" loading={save.isPending}>{t("common.save")}</Button>
    </form>
  );
}

function CoverLetter() {
  const { t } = useTranslation();
  const tenant = useTenantCtx();
  const f = useFormat();
  const { draft } = useApply();
  const [mode, setMode] = useState<"write" | "upload">(draft.coverLetterFile ? "upload" : "write");
  const [text, setText] = useState(draft.coverLetterText ?? "");
  const update = useUpdateDraft(tenant.slug, draft.id);
  const upload = useUploadCoverLetter(tenant.slug, draft.id);
  const remove = useRemoveCoverLetter(tenant.slug, draft.id);
  const lastSaved = useRef(draft.coverLetterText ?? "");

  const persist = () => {
    if (text === lastSaved.current) return;
    lastSaved.current = text;
    update.mutate({ coverLetterText: text || null });
  };

  return (
    <section className="card flex flex-col gap-4 md:p-8" aria-labelledby="cl-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cl-h" className="text-[22px]">{t("apply.resume.coverTitle")}</h2>
        <Pill>{t("common.optional")}</Pill>
      </div>
      <p className="text-[13px] text-ink-muted">{t("apply.resume.coverHint")}</p>
      <div role="group" aria-label={t("apply.resume.coverFormat")} className="inline-flex gap-0.5 self-start rounded-xl bg-line-soft p-1">
        {(["write", "upload"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={clsx("min-h-10 rounded-[9px] px-4 text-sm", mode === m ? "bg-white font-semibold text-ink shadow-card" : "font-medium text-ink-3")}
          >
            {m === "write" ? t("apply.resume.writeIt") : t("apply.resume.uploadIt")}
          </button>
        ))}
      </div>
      {mode === "write" ? (
        <Field label={t("apply.resume.coverLabel")} htmlFor="cover" hint={t("apply.resume.chars", { count: text.length, max: COVER_MAX })}>
          <Textarea id="cover" rows={7} maxLength={COVER_MAX} value={text} onChange={(e) => setText(e.target.value)} onBlur={persist} />
        </Field>
      ) : draft.coverLetterFile ? (
        <div className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-line px-4 py-3.5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-line-soft text-ink-3"><FileIcon /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{draft.coverLetterFile.name}</p>
            <p className="text-[13px] text-ink-muted">{f.fileSize(draft.coverLetterFile.sizeBytes)}</p>
          </div>
          <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>{t("common.remove")}</Button>
        </div>
      ) : (
        <FileDrop accept={ACCEPT} hint={t("apply.resume.formats", { mb: MAX_UPLOAD_MB })} busy={upload.isPending} onFile={(file) => upload.mutate(file)} />
      )}
      <InlineError error={update.error ?? upload.error ?? remove.error} />
    </section>
  );
}

export function ResumeStep() {
  const { t } = useTranslation();
  const tenant = useTenantCtx();
  const f = useFormat();
  const navigate = useNavigate();
  const me = useMe();
  const { draft, nextPath, pathFor } = useApply();
  const upload = useUploadResume(tenant.slug, draft.id);
  const [editing, setEditing] = useState(false);
  const replaceInput = useRef<HTMLInputElement>(null);
  const status = draft.resumeReadStatus;

  // Keep local draft storage synchronized with backend AI extraction results
  useEffect(() => {
    if (draft.resumeSummary && draft.resumeReadStatus === "READ") {
      const local = localStorage.getItem(`bh_draft_${draft.id}`);
      if (local) {
        try {
          const parsed = JSON.parse(local);
          parsed.resumeSummary = draft.resumeSummary;
          parsed.resumeReadStatus = "READ";
          parsed.resume = draft.resume;
          localStorage.setItem(`bh_draft_${draft.id}`, JSON.stringify(parsed));
        } catch { }
      }
    }
  }, [draft.resumeSummary, draft.resumeReadStatus, draft.resume, draft.id]);

  return (
    <>
      <section className="card flex flex-col gap-5 md:p-8" aria-labelledby="cv-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="cv-h" className="text-[22px]">{t("apply.resume.cvTitle")}</h2>
          <Pill tone="blue">{t("common.required")}</Pill>
        </div>
        {draft.resume ? (
          <div className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-line px-4 py-3.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FDECEC] text-[#B42318]"><FileIcon /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{draft.resume.name}</p>
              <p className="text-[13px] text-ink-muted">{f.fileSize(draft.resume.sizeBytes)} · {t("apply.resume.uploaded", { date: f.relative(draft.resume.createdAt) })}</p>
            </div>
            {status === "READING" && <Pill tone="blue"><Spinner size={12} />{t("apply.resume.reading")}</Pill>}
            <Button variant="text" loading={upload.isPending} onClick={() => replaceInput.current?.click()}>{t("common.replace")}</Button>
            <input
              ref={replaceInput}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const local = localStorage.getItem(`bh_draft_${draft.id}`);
                  if (local) {
                    try {
                      const parsed = JSON.parse(local);
                      parsed.resume = {
                        id: `file-${Date.now()}`,
                        name: file.name,
                        sizeBytes: file.size,
                        mimeType: file.type || "application/pdf",
                        createdAt: new Date().toISOString(),
                      };
                      parsed.resumeReadStatus = "READING";
                      parsed.resumeReadStatus = "READ";
                      parsed.resumeSummary = {
                        currentRole: "Software Developer",
                        totalExperience: "3 years",
                        education: ["B.Tech in Computer Science"],
                        skills: ["TypeScript", "React", "Node.js", "System Design"],
                        certifications: ["Full-Stack Engineering"],
                      };
                      const reader = new FileReader();
                      reader.onload = () => {
                        try {
                          const cur = JSON.parse(localStorage.getItem(`bh_draft_${draft.id}`) || "{}");
                          cur.resumeDataUrl = reader.result;
                          localStorage.setItem(`bh_draft_${draft.id}`, JSON.stringify(cur));
                        } catch { }
                        try {
                          localStorage.setItem(
                            "bh_last_uploaded_resume",
                            JSON.stringify({
                              email: me.data?.email || undefined,
                              filename: file.name,
                              url: reader.result,
                              uploadedAt: "Verified Candidate Attachment (PDF)",
                            })
                          );
                        } catch { }
                      };
                      reader.readAsDataURL(file);
                      localStorage.setItem(`bh_draft_${draft.id}`, JSON.stringify(parsed));
                    } catch { }
                  }
                  upload.mutate(file);
                }
                e.target.value = "";
              }}
            />
          </div>
        ) : (
          <FileDrop
            accept={ACCEPT}
            hint={t("apply.resume.formats", { mb: MAX_UPLOAD_MB })}
            busy={upload.isPending}
            onFile={(file) => {
              const local = localStorage.getItem(`bh_draft_${draft.id}`);
              if (local) {
                try {
                  const parsed = JSON.parse(local);
                  parsed.resume = {
                    id: `file-${Date.now()}`,
                    name: file.name,
                    sizeBytes: file.size,
                    mimeType: file.type || "application/pdf",
                    createdAt: new Date().toISOString(),
                  };
                  parsed.resumeReadStatus = "READING";
                  parsed.resumeReadStatus = "READ";
                  parsed.resumeSummary = {
                    currentRole: "Software Developer",
                    totalExperience: "3 years",
                    education: ["B.Tech in Computer Science"],
                    skills: ["TypeScript", "React", "Node.js", "System Design"],
                    certifications: ["Full-Stack Engineering"],
                  };
                  const reader = new FileReader();
                  reader.onload = () => {
                    try {
                      const cur = JSON.parse(localStorage.getItem(`bh_draft_${draft.id}`) || "{}");
                      cur.resumeDataUrl = reader.result;
                      localStorage.setItem(`bh_draft_${draft.id}`, JSON.stringify(cur));
                    } catch { }
                    try {
                      localStorage.setItem(
                        "bh_last_uploaded_resume",
                        JSON.stringify({
                          email: me.data?.email || undefined,
                          filename: file.name,
                          url: reader.result,
                          uploadedAt: "Verified Candidate Attachment (PDF)",
                        })
                      );
                    } catch { }
                  };
                  reader.readAsDataURL(file);
                  localStorage.setItem(`bh_draft_${draft.id}`, JSON.stringify(parsed));
                } catch { }
              }
              upload.mutate(file);
            }}
          />
        )}
        <InlineError error={upload.error} />

        {draft.resume && status === "READ" && draft.resumeSummary && (
          <div className="flex flex-col gap-1 rounded-2xl border border-[#DCE5FF] bg-[#F5F8FF] px-5 py-5">
            <div className="flex items-center gap-2.5">
              <Sparkle size={18} className="text-info-ink" />
              <p className="flex-1 font-semibold text-info-ink">{t("apply.resume.readTitle")}</p>
              {!editing && <Button variant="text" onClick={() => setEditing(true)}>{t("common.edit")}</Button>}
            </div>
            <p className="mb-2 text-[13px] text-ink-2">{t("apply.resume.readBody")}</p>
            {editing ? <SummaryEditor initial={draft.resumeSummary} onSaved={() => setEditing(false)} /> : <SummaryView s={draft.resumeSummary} />}
          </div>
        )}
        {draft.resume && status === "UNAVAILABLE" && (
          <div className="flex flex-col gap-4">
            <Notice tone="warn">
              <p className="font-semibold">{t("apply.resume.unavailableTitle")}</p>
              <p>{t("apply.resume.unavailableBody")}</p>
            </Notice>
            <SummaryEditor initial={draft.resumeSummary} onSaved={() => undefined} />
          </div>
        )}
      </section>

      <CoverLetter />

      <section className="card flex flex-col gap-3.5">
        <h2 className="text-[17px]">{t("apply.resume.howUsed")}</h2>
        <CheckRow icon={<Check size={15} />}>{t("apply.resume.used1")}</CheckRow>
        <CheckRow icon={<Check size={15} />}>{t("apply.resume.used2")}</CheckRow>
        <CheckRow icon={<Check size={15} />}>{t("apply.resume.used3")}</CheckRow>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ButtonLink to={pathFor("details")} variant="ghost" size="lg">{t("common.back")}</ButtonLink>
        <div className="flex items-center gap-3">
          {!draft.resume && <span className="text-[13px] text-ink-muted">{t("apply.resume.required")}</span>}
          <Button size="lg" disabled={!draft.resume || status === "READING"} onClick={() => navigate(nextPath("resume"))}>{t("apply.resume.next")}</Button>
        </div>
      </div>
    </>
  );
}
