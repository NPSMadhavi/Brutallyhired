import { clsx } from "clsx";
import type { ReactNode } from "react";
import { Alert as AlertIcon, X } from "./icons";

export const Spinner = ({ size = 20, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={clsx("animate-spin", className)} aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" fill="none" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
  </svg>
);

export function PageLoader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3 text-ink-muted" role="status">
      <Spinner size={24} />
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong while loading data.";
  return (
    <div className="card flex flex-col items-center gap-3 py-12 text-center" role="alert">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-line-soft text-danger">
        <AlertIcon size={26} />
      </span>
      <p className="max-w-md text-[15px] font-medium text-ink-2">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-[40px] rounded-xl bg-brand px-4 text-sm font-semibold text-brand-fg hover:brightness-95"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  children,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 py-12 text-center">
      {icon && <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-line-soft text-ink-muted">{icon}</span>}
      <h3 className="text-[18px] font-bold text-ink">{title}</h3>
      {body && <p className="max-w-md text-sm leading-relaxed text-ink-muted">{body}</p>}
      {children}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className={clsx("relative w-full rounded-2xl border border-line bg-white p-6 shadow-lift", maxWidth)}>
        <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <h3 className="text-lg font-bold text-ink">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-canvas hover:text-ink"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
