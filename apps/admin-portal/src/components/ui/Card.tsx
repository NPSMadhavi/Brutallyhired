import { clsx } from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

export const Card = ({ className, lg, ...rest }: HTMLAttributes<HTMLElement> & { lg?: boolean; as?: "section" | "div" }) => (
  <section className={clsx("card", lg && "md:p-8", className)} {...rest} />
);

export type Tone = "blue" | "teal" | "amber" | "gray" | "red" | "purple";
const tones: Record<Tone, string> = {
  blue: "bg-info-soft text-info-ink",
  teal: "bg-ok-soft text-ok-ink",
  amber: "bg-warn-soft text-warn-ink",
  gray: "bg-line-soft text-ink-3",
  red: "bg-danger-soft text-danger",
  purple: "bg-[#F3E8FF] text-[#6B21A8]",
};

export const Pill = ({ tone = "gray", dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) => (
  <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)}>
    {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
    {children}
  </span>
);

export const SectionTitle = ({ children, action, id, subtitle }: { children: ReactNode; action?: ReactNode; id?: string; subtitle?: ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 id={id} className="text-[20px] font-bold tracking-tight text-ink">{children}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const Fact = ({ label, value, sub, icon, trend }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; trend?: "up" | "down" | "neutral" }) => (
  <div className="flex flex-col gap-1 rounded-2xl bg-[#F7F9FC] p-4 transition-all hover:bg-[#F2F5FA]">
    <div className="flex items-center justify-between gap-2">
      <span className="label-caps text-[11px]">{label}</span>
      {icon && <span className="text-ink-muted">{icon}</span>}
    </div>
    <div className="mt-1 flex items-baseline gap-2">
      <strong className="text-[24px] font-bold tracking-tight text-ink">{value}</strong>
      {trend && (
        <span className={clsx("text-xs font-semibold", trend === "up" ? "text-ok" : trend === "down" ? "text-danger" : "text-ink-muted")}>
          {trend === "up" ? "↑" : trend === "down" ? "↓" : "•"}
        </span>
      )}
    </div>
    {sub && <span className="text-xs text-ink-muted">{sub}</span>}
  </div>
);
