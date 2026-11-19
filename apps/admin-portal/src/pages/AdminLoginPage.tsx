import { useState } from "react";
import { initials } from "@/lib/format";
import { useTenant } from "@/components/layout/TenantContext";
import { Lock, Mail, Shield, Alert, ExternalLink } from "@/components/ui/icons";

interface AdminLoginPageProps {
  onLoginSuccess?: () => void;
}

export function AdminLoginPage({ onLoginSuccess }: AdminLoginPageProps) {
  const { tenant } = useTenant();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Expected credentials are read strictly from environment (.env) with default fallback
  const expectedEmail = (
    import.meta.env.VITE_ADMIN_EMAIL ||
    import.meta.env.ADMIN_EMAIL ||
    "admin@brutallyhired.com"
  ).trim();

  const expectedPassword = (
    import.meta.env.VITE_ADMIN_PASSWORD ||
    import.meta.env.ADMIN_PASSWORD ||
    "Admin@123456"
  ).trim();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const enteredEmail = email.trim().toLowerCase();
      const validEmail = expectedEmail.toLowerCase();

      if (enteredEmail === validEmail && password === expectedPassword) {
        sessionStorage.setItem("admin_authenticated", "true");
        sessionStorage.setItem("admin_email", email.trim());
        setIsLoading(false);
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      } else {
        setIsLoading(false);
        setError("Invalid email or password. Please check your admin credentials.");
      }
    }, 250);
  };

  return (
    <div className="flex min-h-screen flex-col justify-between bg-canvas text-ink">
      {/* Top Header */}
      <header className="border-b border-line bg-white/90 backdrop-blur px-6 py-4">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand font-display text-sm font-bold text-brand-fg shadow-sm"
              aria-hidden
            >
              {initials(tenant.name)}
            </span>
            <div className="flex flex-col leading-tight">
              <span className="font-display text-base font-bold tracking-tight text-ink">
                {tenant.name}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Admin Command Center
              </span>
            </div>
          </div>

          <a
            href="http://localhost:5173"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold text-ink-2 no-underline hover:text-brand transition-colors"
          >
            <span>Candidate Portal</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </header>

      {/* Login Card */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-sm space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <Shield size={24} />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Admin Sign In
            </h1>
            <p className="text-xs text-ink-muted max-w-xs">
              Enter your administrator credentials to access the recruitment & management dashboard.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <Alert size={16} className="shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="admin-email"
                className="block text-xs font-semibold uppercase tracking-wider text-ink-muted"
              >
                Admin Email
              </label>
              <div className="relative">
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@brutallyhired.com"
                  className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 pl-10 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand transition-all"
                />
                <span className="absolute left-3 top-3 text-ink-muted">
                  <Mail size={16} />
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold uppercase tracking-wider text-ink-muted"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 pl-10 text-sm text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand transition-all"
                />
                <span className="absolute left-3 top-3 text-ink-muted">
                  <Lock size={16} />
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 px-4 font-display text-sm font-bold text-brand-fg shadow-sm hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <Lock size={16} />
                  <span>Sign In as Admin</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-3 text-center border-t border-line space-y-2">
            <span className="text-[11px] text-ink-muted block">
              Default demo admin: <code className="bg-slate-100 px-1 py-0.5 rounded text-ink font-semibold">admin@brutallyhired.com</code> / <code className="bg-slate-100 px-1 py-0.5 rounded text-ink font-semibold">Admin@123456</code>
            </span>
            <a
              href="http://localhost:5173/signin"
              className="text-xs font-semibold text-brand hover:underline inline-block"
            >
              Are you a job candidate? Return to Candidate Sign In →
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-line py-4 px-6 text-center text-xs text-ink-muted">
        © {new Date().getFullYear()} {tenant.name} · Admin Control Center
      </footer>
    </div>
  );
}
