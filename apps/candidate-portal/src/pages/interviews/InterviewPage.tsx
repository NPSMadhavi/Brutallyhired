import { zodResolver } from "@hookform/resolvers/zod";
import { rescheduleRequestSchema, type InterviewRoundDto } from "@verity/shared";
import { clsx } from "clsx";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { z } from "zod";
import { useBookSlot, useInterview, useRescheduleRequest } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Button, ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Card";
import { ErrorState, InlineError, Notice, PageLoader } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/form";
import { Calendar, Check, ChevronLeft, Clock, Video } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/misc";
import { icsUrl } from "@/lib/api";
import { useFormat } from "@/lib/format";

const JOIN_EARLY_MINUTES = 10;

function AskOtherTimes({ roundId }: { roundId: string }) {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ask = useRescheduleRequest(tenant.slug, roundId);
  const form = useForm<z.infer<typeof rescheduleRequestSchema>>({ resolver: zodResolver(rescheduleRequestSchema), defaultValues: { message: "" } });
  if (ask.isSuccess) return <Notice tone="ok">{t("interviews.sent")}</Notice>;
  if (!open) return <Button variant="text" className="self-start" onClick={() => setOpen(true)}>{t("interviews.askOther")}</Button>;
  return (
    <form className="flex flex-col gap-3 rounded-2xl bg-[#F7F9FC] p-4" onSubmit={form.handleSubmit((v) => ask.mutate(v.message))} noValidate>
      <p className="font-semibold">{t("interviews.askTitle")}</p>
      <Field label={t("interviews.askLabel")} htmlFor="ask" error={form.formState.errors.message && t("errors.validation_failed")}>
        <Textarea id="ask" rows={3} {...form.register("message")} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="ghost" loading={ask.isPending}>{t("interviews.send")}</Button>
        <Button variant="text" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
      </div>
      <InlineError error={ask.error} />
    </form>
  );
}

function SlotPicker({ round, appId, onBooked }: { round: InterviewRoundDto; appId: string; onBooked: () => void }) {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const f = useFormat();
  const book = useBookSlot(tenant.slug, round.id, appId);
  const days = useMemo(() => {
    const map = new Map<string, InterviewRoundDto["slots"]>();
    for (const s of round.slots) {
      const key = new Date(s.startsAt).toDateString();
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()].map(([key, slots]) => ({ key, date: slots[0]!.startsAt, slots }));
  }, [round.slots]);
  const [day, setDay] = useState(days[0]?.key ?? "");
  const [slotId, setSlotId] = useState<string | null>(null);
  useEffect(() => {
    if (!days.some((d) => d.key === day)) setDay(days[0]?.key ?? "");
  }, [days, day]);
  const current = days.find((d) => d.key === day);
  const chosen = round.slots.find((s) => s.id === slotId);

  if (days.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="warn">{t("interviews.noSlots")}</Notice>
        <AskOtherTimes roundId={round.id} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-[17px]">{t("interviews.chooseDay")}</h2>
      <div className="flex gap-2.5 overflow-x-auto pb-1" role="group" aria-label={t("interviews.chooseDay")}>
        {days.map((d) => (
          <button
            key={d.key} type="button" aria-pressed={d.key === day} onClick={() => { setDay(d.key); setSlotId(null); }}
            className={clsx("flex min-h-[88px] w-[84px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border", d.key === day ? "border-ink bg-ink text-white" : "border-line-2 bg-white hover:border-[#B5C2D3]")}
          >
            <span className={clsx("text-xs font-semibold uppercase tracking-wider", d.key === day ? "text-[#C9D3E0]" : "text-ink-muted")}>{f.weekday(d.date)}</span>
            <span className="font-display text-2xl font-bold">{f.dayNum(d.date)}</span>
            <span className={clsx("text-xs font-semibold", d.key === day ? "text-[#C9D3E0]" : "text-ok-ink")}>{t("interviews.slots", { count: d.slots.length })}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between"><h2 className="text-[17px]">{t("interviews.chooseTime")}</h2>{current && <span className="text-[13px] text-ink-muted">{f.longDate(current.date)}</span>}</div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="group" aria-label={t("interviews.chooseTime")}>
        {current?.slots.map((s) => (
          <button
            key={s.id} type="button" aria-pressed={s.id === slotId} onClick={() => setSlotId(s.id)}
            className={clsx("min-h-[48px] rounded-xl border text-sm", s.id === slotId ? "border-brand bg-brand font-semibold text-brand-fg" : "border-line-2 bg-white font-medium hover:border-[#B5C2D3]")}
          >
            {f.time(s.startsAt)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-[#F7F9FC] px-5 py-4">
        <div className="flex min-w-[240px] flex-1 flex-col gap-0.5">
          <span className="label-caps text-[11px]">{t("interviews.yourChoice")}</span>
          <p className="text-[17px] font-semibold">{chosen ? `${f.longDate(chosen.startsAt)} · ${f.timeRange(chosen.startsAt, chosen.endsAt)}` : t("interviews.pickTime")}</p>
        </div>
        <Button size="lg" disabled={!slotId} loading={book.isPending} onClick={() => slotId && book.mutate(slotId, { onSuccess: onBooked })}>
          {round.status === "SCHEDULED" ? t("interviews.confirmChange") : t("interviews.confirm")}
        </Button>
      </div>
      <InlineError error={book.error} />
      <AskOtherTimes roundId={round.id} />
    </div>
  );
}

export function InterviewPage() {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const f = useFormat();
  const { appId = "", roundId = "" } = useParams();
  const q = useInterview(tenant.slug, roundId);
  const [changing, setChanging] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((x) => x + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (q.isPending) return <PageLoader />;
  if (q.isError) return <ErrorState error={q.error} />;
  const r = q.data;
  const now = Date.now();
  const canJoin = r.status === "SCHEDULED" && r.joinOpensAt && r.joinClosesAt && now >= new Date(r.joinOpensAt).getTime() && now <= new Date(r.joinClosesAt).getTime();
  const ended = r.status === "COMPLETED" || (r.joinClosesAt && now > new Date(r.joinClosesAt).getTime());
  const picking = r.status === "AWAITING_BOOKING" || changing;

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link to={`/${tenant.slug}/applications/${appId}`} className="inline-flex items-center gap-1 text-sm font-semibold no-underline"><ChevronLeft size={16} />{t("common.backToOverview")}</Link>
        <h1 className="text-[30px] leading-tight">{picking ? t("interviews.bookTitle", { title: r.title }) : r.title}</h1>
        {picking && (
          <p className="text-[15px] text-ink-muted">
            {r.bookByAt ? t("interviews.bookBodyBy", { date: f.date(r.bookByAt), tz: f.tzName() }) : t("interviews.bookBody", { tz: f.tzName() })}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <aside className="card flex min-w-0 flex-[1_1_340px] flex-col gap-5 md:p-8">
          <div className="flex flex-col gap-1.5">
            <span className="label-caps">{t("interviews.roundOf", { n: r.sequence, total: r.totalRounds })}</span>
            <h2 className="text-[22px]">{r.title}</h2>
            {r.description && <p className="text-sm leading-relaxed text-ink-2">{r.description}</p>}
          </div>
          <div className="flex flex-col gap-2.5 text-sm text-ink-2">
            <p className="flex items-center gap-3"><Clock size={18} className="text-ink-muted" />{t("interviews.duration", { count: r.durationMinutes })}</p>
            <p className="flex items-center gap-3"><Video size={18} className="text-ink-muted" />{t("interviews.video")}</p>
          </div>
          {r.panelists.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-line-soft pt-4">
              <span className="label-caps">{t("interviews.meet")}</span>
              {r.panelists.map((p) => (
                <div key={p.name} className="flex items-center gap-3">
                  <Avatar name={p.name} size={40} tone="blue" />
                  <div><p className="text-sm font-semibold">{p.name}</p>{p.title && <p className="text-[13px] text-ink-muted">{p.title}</p>}</div>
                </div>
              ))}
            </div>
          )}
          {r.preparation && (
            <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
              <span className="label-caps">{t("interviews.prepare")}</span>
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-2">{r.preparation}</p>
            </div>
          )}
        </aside>

        <section className="card flex min-w-0 flex-[999_1_560px] flex-col gap-6 md:p-8">
          {picking ? (
            <SlotPicker round={r} appId={appId} onBooked={() => setChanging(false)} />
          ) : r.status === "SCHEDULED" && r.scheduledStart && r.scheduledEnd ? (
            <div className="flex flex-col items-start gap-5">
              <div className="flex items-center gap-4">
                <span className="flex w-[76px] shrink-0 flex-col items-center rounded-2xl bg-info-soft py-2 text-xs font-semibold uppercase tracking-wider text-info-ink">
                  {f.weekday(r.scheduledStart)}
                  <strong className="font-display text-[28px] leading-tight tracking-normal text-ink">{f.dayNum(r.scheduledStart)}</strong>
                  {f.month(r.scheduledStart)}
                </span>
                <div className="flex flex-col gap-1">
                  <Pill tone="blue" dot className="self-start">{t("interviews.status.SCHEDULED")}</Pill>
                  <p className="text-[19px] font-semibold">{f.longDate(r.scheduledStart)}</p>
                  <p className="text-sm text-ink-muted">{f.timeRange(r.scheduledStart, r.scheduledEnd)} · {f.tzName()}</p>
                </div>
              </div>
              {ended ? (
                <Notice tone="info">{t("interviews.ended")}</Notice>
              ) : canJoin ? (
                <ButtonLink to="join" size="lg" icon={<Video size={18} />}>{t("interviews.join")}</ButtonLink>
              ) : (
                <>
                  <Notice tone="ok" icon={<Check size={18} />}>
                    <p className="font-semibold">{t("interviews.booked")}</p>
                    <p>{t("interviews.bookedBody", { minutes: JOIN_EARLY_MINUTES })}</p>
                  </Notice>
                  {r.joinOpensAt && <p className="text-sm text-ink-muted">{t("interviews.joinOpens", { when: f.dateTime(r.joinOpensAt) })}</p>}
                </>
              )}
              <div className="flex flex-wrap gap-2.5">
                <ButtonAnchor href={icsUrl(tenant.slug, r.id)} variant="ghost" icon={<Calendar size={16} />}>{t("interviews.addCalendar")}</ButtonAnchor>
                {!ended && <Button variant="text" onClick={() => setChanging(true)}>{t("interviews.change")}</Button>}
              </div>
            </div>
          ) : (
            <Notice tone="info">{t(`interviews.status.${r.status}`)}</Notice>
          )}
        </section>
      </div>
    </>
  );
}
