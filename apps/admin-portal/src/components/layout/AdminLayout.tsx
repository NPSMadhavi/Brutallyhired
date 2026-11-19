import { useState } from "react";
import { clsx } from "clsx";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Avatar } from "@/components/ui/misc";
import {
  Bell,
  Briefcase,
  Dashboard,
  ExternalLink,
  LogOut,
  Plus,
  Settings,
  Shield,
  Users,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { initials } from "@/lib/format";
import { useTenant } from "./TenantContext";
import { AdminLoginPage } from "@/pages/AdminLoginPage";

export function AdminLayout() {
  const { tenant } = useTenant();
  const location = useLocation();
  const base = `/${tenant.slug}`;

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem("admin_authenticated") === "true";
  });

  const handleSignOut = () => {
    sessionStorage.removeItem("admin_authenticated");
    sessionStorage.removeItem("admin_email");
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <AdminLoginPage onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const navItems = [
    { to: `${base}/dashboard`, label: "Dashboard", icon: <Dashboard size={18} /> },
    { to: `${base}/candidates`, label: "Candidates", icon: <Users size={18} /> },
    { to: `${base}/jobs`, label: "Jobs", icon: <Briefcase size={18} /> },
    { to: `${base}/assessments`, label: "Assessments", icon: <Shield size={18} /> },
    { to: `${base}/staff`, label: "Team", icon: <Users size={18} /> },
    { to: `${base}/settings`, label: "Settings", icon: <Settings size={18} /> },
  ];

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      {/* Left Sidebar */}
      <aside className="sticky top-0 h-screen w-64 shrink-0 border-r border-line bg-white flex flex-col justify-between p-4 z-30 shadow-sm">
        <div className="space-y-6">
          {/* Brand Mark in Sidebar */}
          <Link to={`${base}/dashboard`} className="flex items-center gap-3 px-2 pt-2 no-underline">
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl object-contain" />
            ) : (
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand font-display text-sm font-bold text-brand-fg shadow-sm"
                aria-hidden
              >
                {initials(tenant.name)}
              </span>
            )}
            <div className="flex flex-col leading-tight min-w-0">
              <span className="font-display text-[16px] font-bold tracking-tight text-ink truncate">
                {tenant.name}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                Admin Command Center
              </span>
            </div>
          </Link>

          {/* Navigation Items (Sidebar) */}
          <nav aria-label="Admin Navigation" className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold no-underline transition-all",
                    isActive
                      ? "bg-brand text-brand-fg shadow-sm"
                      : "text-ink-2 hover:bg-canvas hover:text-ink",
                  )
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="space-y-3 border-t border-line pt-4">
          <a
            href={`http://localhost:5173/${tenant.slug}/apply`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-xl border border-line-2 bg-canvas px-3 py-2 text-xs font-semibold text-ink-2 no-underline hover:border-brand hover:text-brand transition-all"
            title="Open public careers / candidate view on port 5173"
          >
            <span className="flex items-center gap-2">
              <ExternalLink size={14} />
              Candidate Portal
            </span>
          </a>

          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar name="Tanuja HR" size={34} />
              <div className="flex flex-col text-left leading-tight min-w-0">
                <span className="text-xs font-bold text-ink truncate">Tanuja HR</span>
                <span className="text-[10px] text-ink-muted">Administrator</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out of Admin"
              className="p-1.5 text-ink-muted hover:text-rose-600 rounded-lg hover:bg-canvas transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto p-6 md:p-8 space-y-8">
        <Outlet />
      </main>
    </div>
  );
}
