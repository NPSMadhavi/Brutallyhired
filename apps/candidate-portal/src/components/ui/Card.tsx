import { clsx } from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

export const Card = ({ className, lg, ...rest }: HTMLAttributes<HTMLElement> & { lg?: boolean; as?: "section" | "div" }) => (
  <section className={clsx("card", lg && "md:p-8", className)} {...rest} />
);

export type Tone = "blue" | "teal" | "amber" | "gray" | "red";
const tones: Record<Tone, string> = {
  blue: "bg-info-soft text-info-ink",
  teal: "bg-ok-soft text-ok-ink",
  amber: "bg-warn-soft text-warn-ink",
  gray: "bg-line-soft text-ink-3",
  red: "bg-danger-soft text-danger",
};

export const Pill = ({ tone = "gray", dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) => (
  <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)}>
    {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
    {children}
  </span>
);

export const SectionTitle = ({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <h2 id={id} className="text-[19px]">{children}</h2>
    {action}
  </div>
);

export const Fact = ({
  label,
  value,
  sub,
  icon,
  trend,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
}) => (
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

export const CheckRow = ({ children, muted, icon }: { children: ReactNode; muted?: boolean; icon: ReactNode }) => (
  <div className="flex items-start gap-3 text-sm leading-relaxed text-ink-2">
    <span className={clsx("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", muted ? "bg-line-soft text-ink-muted" : "bg-ok-soft text-ok-ink")}>
      {icon}
    </span>
    <span className="pt-1">{children}</span>
  </div>
);
