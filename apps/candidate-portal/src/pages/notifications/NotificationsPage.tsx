import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMarkAllRead, useMarkRead, useNotifications } from "@/api/hooks";
import { useEventText } from "@/components/journey/eventText";
import { useTenantCtx } from "@/components/layout/TenantContext";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, PageLoader } from "@/components/ui/feedback";
import { Bell } from "@/components/ui/icons";
import { useFormat } from "@/lib/format";

export function NotificationsPage() {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const f = useFormat();
  const text = useEventText();
  const navigate = useNavigate();
  const q = useNotifications(tenant.slug);
  const markRead = useMarkRead(tenant.slug);
  const markAll = useMarkAllRead(tenant.slug);
  if (q.isPending) return <PageLoader />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const items = q.data.pages.flatMap((p) => p.items);
  const unread = q.data.pages[0]?.unread ?? 0;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[32px]">{t("notifications.title")}</h1>
        {unread > 0 && <Button variant="text" loading={markAll.isPending} onClick={() => markAll.mutate()}>{t("notifications.markAll")}</Button>}
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<Bell size={26} />} title={t("notifications.empty")} />
      ) : (
        <ul className="card max-w-[920px] overflow-hidden p-0">
          {items.map((n) => {
            const { title, body } = text(n);
            return (
              <li key={n.id} className="border-t border-line-soft first:border-t-0">
                <button
                  type="button"
                  className={clsx("flex w-full items-start gap-3.5 px-5 py-4 text-left hover:bg-[#F7F9FC]", !n.readAt && "bg-brand/[0.04]")}
                  onClick={() => {
                    if (!n.readAt) markRead.mutate(n.id);
                    if (n.applicationId) navigate(`/${tenant.slug}/applications/${n.applicationId}`);
                  }}
                >
                  <span className={clsx("mt-2 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand")} />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap justify-between gap-3"><span className="text-sm font-semibold">{title}</span><span className="text-[13px] text-ink-muted">{f.relative(n.createdAt)}</span></span>
                    {body && <span className="text-[13px] leading-relaxed text-ink-3">{body}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {q.hasNextPage && <Button variant="ghost" className="self-start" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>{t("notifications.loadMore")}</Button>}
    </>
  );
}
