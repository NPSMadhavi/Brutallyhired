import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMarkAllRead, useMarkRead, useMe, useNotifications } from "@/api/hooks";
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
  const me = useMe();
  const q = useNotifications(tenant.slug);
  const markRead = useMarkRead(tenant.slug);
  const markAll = useMarkAllRead(tenant.slug);
  const [, setVersion] = useState(0);

  useEffect(() => {
    const onUpdate = () => setVersion((v) => v + 1);
    window.addEventListener("storage", onUpdate);
    window.addEventListener("bh_application_updated", onUpdate);
    return () => {
      window.removeEventListener("storage", onUpdate);
      window.removeEventListener("bh_application_updated", onUpdate);
    };
  }, []);

  if (q.isPending) return <PageLoader />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;

  const apiItems = q.data.pages.flatMap((p) => p.items);
  const userEmail = me.data?.email?.toLowerCase();

  let readIds: string[] = [];
  try {
    const rawRead = localStorage.getItem("bh_read_notifications");
    if (rawRead) {
      const parsed = JSON.parse(rawRead);
      if (Array.isArray(parsed)) readIds = parsed;
    }
  } catch {}
  const readSet = new Set(readIds);

  const localItems: Array<{
    id: string;
    type: any;
    data: any;
    createdAt: string;
    readAt: string | null;
    applicationId: string | null;
    isLocal: boolean;
  }> = [];

  try {
    const rawEv = localStorage.getItem("bh_application_events");
    if (rawEv) {
      const parsedEv = JSON.parse(rawEv);
      if (Array.isArray(parsedEv)) {
        for (const item of parsedEv) {
          const belongs = !userEmail || !item.email || item.email.toLowerCase() === userEmail;
          if (belongs && item.event && !apiItems.some((a) => a.id === item.event.id)) {
            localItems.push({
              id: item.event.id,
              type: item.event.type,
              data: item.event.data || {},
              createdAt: item.event.createdAt || new Date().toISOString(),
              readAt: readSet.has(item.event.id) ? item.event.createdAt : null,
              applicationId: item.appId || null,
              isLocal: true,
            });
          }
        }
      }
    }
  } catch {}

  const items = [
    ...localItems,
    ...apiItems.map((a) => ({ ...a, isLocal: false })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const unread = (q.data.pages[0]?.unread ?? 0) + localItems.filter((i) => !i.readAt).length;

  const markLocalRead = (id: string) => {
    try {
      const next = Array.from(new Set([...readIds, id]));
      localStorage.setItem("bh_read_notifications", JSON.stringify(next));
      window.dispatchEvent(new Event("storage"));
    } catch {}
  };

  const markAllLocalRead = () => {
    try {
      const next = Array.from(new Set([...readIds, ...localItems.map((i) => i.id)]));
      localStorage.setItem("bh_read_notifications", JSON.stringify(next));
      window.dispatchEvent(new Event("storage"));
    } catch {}
  };

  const clearAllNotifications = () => {
    try {
      localStorage.removeItem("bh_application_events");
      localStorage.removeItem("bh_read_notifications");
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new CustomEvent("bh_application_updated", { detail: { action: "CLEARED" } }));
      setVersion((v) => v + 1);
    } catch {}
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[32px]">{t("notifications.title")}</h1>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <Button
              variant="text"
              loading={markAll.isPending}
              onClick={() => {
                markAllLocalRead();
                markAll.mutate();
              }}
            >
              {t("notifications.markAll")}
            </Button>
          )}
          {items.length > 0 && (
            <button
              type="button"
              className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted hover:border-danger/30 hover:bg-danger-soft hover:text-danger transition-colors"
              onClick={clearAllNotifications}
            >
              Clear All Notifications
            </button>
          )}
        </div>
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
                    if (!n.readAt) {
                      if (n.isLocal) markLocalRead(n.id);
                      else markRead.mutate(n.id);
                    }
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
