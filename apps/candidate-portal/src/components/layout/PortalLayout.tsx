import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useMatch, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useLogout, useMe, useNotifications, useOverview, useProfile } from "@/api/hooks";
import { Bell, Lock, LogOut, Shield } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/misc";
import { useRealtime } from "@/hooks/useRealtime";
import { BrandMark } from "./BrandMark";
import { Footer } from "./Footer";
import { useTenantCtx } from "./TenantContext";

function AppTabs({ appId }: { appId: string }) {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const overview = useOverview(tenant.slug, appId);
  if (!overview.data || overview.data.stage === "DRAFT") return null;
  const { sections, badges } = overview.data;
  const base = `/${tenant.slug}/applications/${appId}`;
  const tabs = [
    { to: base, label: t("nav.overview"), end: true, state: "available" as const, badge: 0 },
    ...(sections.assessment === "none" ? [] : [{ to: `${base}/assessments`, label: t("nav.assessment"), end: false, state: sections.assessment, badge: badges.assessment }]),
    { to: `${base}/interviews`, label: t("nav.interviews"), end: false, state: sections.interviews, badge: badges.interviews },
    { to: `${base}/offer`, label: t("nav.offer"), end: false, state: sections.offer, badge: badges.offer },
    { to: `${base}/onboarding`, label: t("nav.onboarding"), end: false, state: sections.onboarding, badge: badges.onboarding },
  ];
  return (
    <nav aria-label={t("nav.main")} className="flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-line-soft p-1">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          aria-label={tab.state === "locked" ? t("nav.locked", { section: tab.label }) : undefined}
          className={({ isActive }) =>
            clsx(
              "inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm no-underline",
              isActive ? "bg-white font-semibold text-ink shadow-[0_1px_3px_rgba(14,23,38,.14)]" : "font-medium text-ink-3 hover:bg-[#E3E9F1] hover:text-ink",
            )
          }
        >
          {tab.state === "locked" && <Lock size={14} className="opacity-70" />}
          {tab.label}
          {tab.badge > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold text-brand-fg">{tab.badge}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

export function PortalLayout() {
  const tenant = useTenantCtx();
  const { t } = useTranslation();
  const me = useMe();
  const navigate = useNavigate();
  const logout = useLogout();
  const appMatch = useMatch("/:tenant/applications/:appId/*");
  const appId = appMatch?.params.appId && appMatch.params.appId !== "" ? appMatch.params.appId : null;
  const notifications = useNotifications(tenant.slug, Boolean(me.data));
  const [, setNotifVersion] = useState(0);

  useEffect(() => {
    const onUpdate = () => setNotifVersion((v) => v + 1);
    window.addEventListener("storage", onUpdate);
    window.addEventListener("bh_application_updated", onUpdate);
    return () => {
      window.removeEventListener("storage", onUpdate);
      window.removeEventListener("bh_application_updated", onUpdate);
    };
  }, []);

  const localUnread = (() => {
    try {
      const rawEv = localStorage.getItem("bh_application_events");
      if (!rawEv) return 0;
      const parsedEv = JSON.parse(rawEv);
      if (!Array.isArray(parsedEv)) return 0;
      const rawRead = localStorage.getItem("bh_read_notifications");
      const readSet = new Set(rawRead ? JSON.parse(rawRead) : []);
      const userEmail = me.data?.email?.toLowerCase();
      return parsedEv.filter(
        (item: any) =>
          (!userEmail || !item.email || item.email.toLowerCase() === userEmail) &&
          item.event?.id &&
          !readSet.has(item.event.id)
      ).length;
    } catch {
      return 0;
    }
  })();

  const unread = (notifications.data?.pages[0]?.unread ?? 0) + localUnread;
  useRealtime(tenant.slug, Boolean(me.data));

  const profile = useProfile(tenant.slug);
  const candidateName =
    [profile.data?.profile?.firstName, profile.data?.profile?.lastName].filter(Boolean).join(" ") ||
    profile.data?.displayName ||
    me.data?.displayName ||
    me.data?.email;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-white">
        <div className="page flex min-h-[76px] flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3">
          <Link to={`/${tenant.slug}/applications`} className="min-h-[44px] no-underline">
            <BrandMark />
          </Link>
          {appId && <AppTabs appId={appId} />}
          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
              Candidate Portal
            </span>
            <Link
              to={`/${tenant.slug}/notifications`}
              className="relative flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink-2 hover:bg-canvas"
              aria-label={unread ? t("common.notificationsUnread", { count: unread }) : t("common.notifications")}
            >
              <Bell />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-brand px-1 text-[11px] font-bold text-brand-fg">
                  {unread}
                </span>
              )}
            </Link>
            <Link to={`/${tenant.slug}/profile`} aria-label={t("common.myProfile")} className="rounded-full no-underline">
              <Avatar name={candidateName} />
            </Link>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink-2 hover:bg-canvas"
              aria-label={t("common.signOut")}
              onClick={() => logout.mutate(undefined, { onSuccess: () => navigate(`/${tenant.slug}/signin`) })}
            >
              <LogOut />
            </button>
          </div>
        </div>
      </header>
      <main className="page flex flex-1 flex-col gap-6 py-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
