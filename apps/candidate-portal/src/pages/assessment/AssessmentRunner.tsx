import { saveAnswers, useSubmitAttempt } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Button } from "@/components/ui/Button";
import { InlineError, Notice } from "@/components/ui/feedback";
import type { useProctoring } from "@/hooks/useProctoring";
import type { AttemptDto } from "@verity/shared";
import { clsx } from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/** The timed, proctored question runner. Answers autosave; time-up submits automatically. */
export function AssessmentRunner({
  attempt,
  onDone,
  proctor,
}: {
  attempt: AttemptDto;
  onDone: () => void;
  proctor: ReturnType<typeof useProctoring>;
}) {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const submit = useSubmitAttempt(tenant.slug, attempt.id);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState(attempt.answers);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const offset = useMemo(() => new Date(attempt.serverNow).getTime() - Date.now(), [attempt.serverNow]);
  const deadline = new Date(attempt.deadlineAt).getTime();
  const [left, setLeft] = useState(() => deadline - (Date.now() + offset));
  const pending = useRef<Record<string, number[] | string>>({});
  const saveTimer = useRef<number>();
  const finished = useRef(false);

  const flushAnswers = useCallback(async () => {
    const batch = pending.current;
    pending.current = {};
    if (Object.keys(batch).length === 0) return;
    setSaving(true);
    await saveAnswers(tenant.slug, attempt.id, batch).catch(() => Object.assign(pending.current, batch));
    setSaving(false);
  }, [attempt.id, tenant.slug]);

  const finish = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;
    await flushAnswers();
    await proctor.stop();
    await submit.mutateAsync().catch(() => undefined);
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    onDone();
  }, [flushAnswers, onDone, proctor, submit]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const remaining = deadline - (Date.now() + offset);
      setLeft(remaining);
      if (remaining <= 0) void finish();
    }, 1000);
    return () => window.clearInterval(id);
  }, [deadline, offset, finish]);

  const set = (qid: string, v: number[] | string) => {
    setAnswers((a) => ({ ...a, [qid]: v }));
    pending.current[qid] = v;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void flushAnswers(), 800);
  };

  const q = attempt.questions[i]!;
  const unanswered = attempt.questions.filter(
    (x) => answers[x.id] === undefined || (Array.isArray(answers[x.id]) ? (answers[x.id] as number[]).length === 0 : answers[x.id] === ""),
  ).length;
  const mm = Math.max(0, Math.floor(left / 60000));
  const ss = Math.max(0, Math.floor((left % 60000) / 1000));
  const value = answers[q.id];

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink px-5 py-3 text-white">
        <span className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#E5484D]" />
          {t("assessment.recording")}
        </span>
        <span className="text-sm text-white/80">{saving ? t("assessment.saving") : t("assessment.saved")}</span>
        <span
          className="font-display text-xl font-bold tabular-nums"
          aria-live="off"
          aria-label={t("assessment.timeLeft")}
        >{`${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`}</span>
      </div>
      {!document.fullscreenElement && (
        <Button
          variant="ghost"
          className="self-start"
          onClick={() => void document.documentElement.requestFullscreen().catch(() => undefined)}
        >
          {t("assessment.returnFullscreen")}
        </Button>
      )}
      {proctor.screenWarning && <Notice tone="warn">{t("assessment.shareWholeScreen")}</Notice>}
      <div className="flex flex-wrap items-start gap-6">
        <section className="card flex min-w-0 flex-[999_1_560px] flex-col gap-5 md:p-8" aria-labelledby="q-h">
          <span className="label-caps">{t("assessment.questionN", { n: i + 1, total: attempt.questions.length })}</span>
          <h2 id="q-h" className="whitespace-pre-line font-sans text-lg font-semibold leading-relaxed tracking-normal">
            {q.prompt}
          </h2>
          {q.type === "TEXT" ? (
            <textarea
              aria-labelledby="q-h"
              rows={8}
              className="rounded-xl border border-line-2 p-3.5 text-[15px] leading-relaxed focus:border-brand focus:outline-none"
              placeholder={t("assessment.typeAnswer")}
              value={typeof value === "string" ? value : ""}
              onChange={(e) => set(q.id, e.target.value)}
            />
          ) : (
            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-1 text-[13px] text-ink-muted">
                {q.type === "SINGLE_CHOICE" ? t("assessment.chooseOne") : t("assessment.chooseMany")}
              </legend>
              {q.options.map((opt, idx) => {
                const chosen = Array.isArray(value) && value.includes(idx);
                return (
                  <label
                    key={idx}
                    className={clsx(
                      "flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-4 text-[15px]",
                      chosen ? "border-brand bg-brand-soft" : "border-line-2",
                    )}
                  >
                    <input
                      type={q.type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                      name={q.id}
                      className="h-4 w-4 accent-[rgb(var(--brand))]"
                      checked={chosen}
                      onChange={() => {
                        const cur = Array.isArray(value) ? value : [];
                        set(q.id, q.type === "SINGLE_CHOICE" ? [idx] : chosen ? cur.filter((x) => x !== idx) : [...cur, idx]);
                      }}
                    />
                    {opt}
                  </label>
                );
              })}
            </fieldset>
          )}
          <div className="flex flex-wrap justify-between gap-3 border-t border-line-soft pt-5">
            <Button variant="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>
              {t("assessment.prev")}
            </Button>
            {i < attempt.questions.length - 1 ? (
              <Button onClick={() => setI(i + 1)}>{t("assessment.next")}</Button>
            ) : (
              <Button onClick={() => setConfirm(true)}>{t("assessment.submit")}</Button>
            )}
          </div>
          {confirm && (
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-[#F7F9FC] p-4">
              <p className="text-sm">{t("assessment.submitConfirm")}</p>
              {unanswered > 0 && <p className="text-[13px] text-warn-ink">{t("assessment.unanswered", { count: unanswered })}</p>}
              <div className="flex gap-2">
                <Button loading={submit.isPending} onClick={() => void finish()}>
                  {t("assessment.submit")}
                </Button>
                <Button variant="ghost" onClick={() => setConfirm(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
              <InlineError error={submit.error} />
            </div>
          )}
        </section>
        <nav className="card flex flex-[1_1_240px] flex-col gap-3" aria-label={t("assessment.questionNav")}>
          <span className="label-caps">{t("assessment.questionNav")}</span>
          <div className="grid grid-cols-6 gap-2">
            {attempt.questions.map((x, idx) => {
              const a = answers[x.id];
              const done = a !== undefined && (Array.isArray(a) ? a.length > 0 : a !== "");
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setI(idx)}
                  aria-current={idx === i ? "step" : undefined}
                  className={clsx(
                    "h-11 rounded-lg text-sm font-semibold",
                    idx === i ? "bg-ink text-white" : done ? "bg-ok-soft text-ok-ink" : "bg-line-soft text-ink-3",
                  )}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
