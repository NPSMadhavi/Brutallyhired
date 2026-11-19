import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { useInterviews } from "@/api/hooks";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Pill } from "@/components/ui/Card";
import { EmptyState, ErrorState, PageLoader } from "@/components/ui/feedback";
import { Arrow, Calendar } from "@/components/ui/icons";
import { useFormat } from "@/lib/format";

export function InterviewsPage() {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const f = useFormat();
  const { appId = "" } = useParams();
  const q = useInterviews(tenant.slug, appId);
  if (q.isPending) return <PageLoader />;
  if (q.isError) return <ErrorState error={q.error} />;
  return (
    <>
      <h1 className="text-[32px]">{t("interviews.title")}</h1>
      {q.data.length === 0 ? (
        <EmptyState icon={<Calendar size={26} />} title={t("interviews.none")} body={t("interviews.noneBody")} />
      ) : (
        <ul className="flex max-w-[920px] flex-col gap-4">
          {q.data.map((r) => (
            <li key={r.id}>
              <Link to={r.id} className="card flex items-center gap-4 text-ink no-underline hover:shadow-lift">
                {r.scheduledStart ? (
                  <span className="flex w-16 shrink-0 flex-col items-center rounded-2xl bg-info-soft py-2 text-xs font-semibold uppercase tracking-wider text-info-ink">
                    {f.weekday(r.scheduledStart)}
                    <strong className="font-display text-2xl leading-tight tracking-normal text-ink">{f.dayNum(r.scheduledStart)}</strong>
                    {f.month(r.scheduledStart)}
                  </span>
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-info-soft text-info-ink"><Calendar /></span>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="label-caps text-[11px]">{t("interviews.roundOf", { n: r.sequence, total: r.totalRounds })}</span>
                  <span className="font-display text-lg font-bold">{r.title}</span>
                  <span className="text-[13px] text-ink-muted">
                    {r.scheduledStart && r.scheduledEnd ? f.timeRange(r.scheduledStart, r.scheduledEnd) : t("interviews.duration", { count: r.durationMinutes })}
                  </span>
                </div>
                <Pill tone={r.status === "AWAITING_BOOKING" ? "amber" : r.status === "SCHEDULED" ? "blue" : "gray"}>{t(`interviews.status.${r.status}`)}</Pill>
                <Arrow className="text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
