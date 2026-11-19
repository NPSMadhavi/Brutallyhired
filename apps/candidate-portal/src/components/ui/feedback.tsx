import { clsx } from "clsx";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useErrorText } from "@/lib/useErrorText";
import { Alert as AlertIcon } from "./icons";

export const Spinner = ({ size = 20, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={clsx("animate-spin", className)} aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" fill="none" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
  </svg>
);

export function PageLoader() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3 text-ink-muted" role="status">
      <Spinner />
      <span>{t("common.loading")}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const text = useErrorText();
  return (
    <div className="card flex flex-col items-center gap-3 py-12 text-center" role="alert">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-line-soft text-ink-muted"><AlertIcon size={26} /></span>
      <p className="max-w-md text-[15px] text-ink-2">{text(error)}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="min-h-[44px] rounded-xl px-4 text-sm font-semibold text-brand hover:bg-brand-soft">
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, body, children }: { icon?: ReactNode; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-12 text-center">
      {icon && <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-line-soft text-ink-muted">{icon}</span>}
      <h2 className="text-[19px]">{title}</h2>
      {body && <p className="max-w-md leading-relaxed text-ink-muted">{body}</p>}
      {children}
    </div>
  );
}

export function InlineError({ error }: { error: unknown }) {
  const text = useErrorText();
  if (!error) return null;
  return (
    <p role="alert" className="flex items-center gap-2 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
      <AlertIcon size={18} />
      {text(error)}
    </p>
  );
}

export function Notice({ tone = "info", icon, children }: { tone?: "info" | "ok" | "warn"; icon?: ReactNode; children: ReactNode }) {
  return (
    <div
      className={clsx(
        "flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm leading-relaxed",
        tone === "info" && "border-[#DCE5FF] bg-[#F5F8FF] text-ink-2",
        tone === "ok" && "border-transparent bg-ok-soft text-ok-ink",
        tone === "warn" && "border-[#F0D9AE] bg-[#FFF9EE] text-warn-ink",
      )}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
