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

export const Fact = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex flex-col gap-1 rounded-2xl bg-[#F7F9FC] px-4 py-3.5">
    <span className="label-caps text-[11px]">{label}</span>
    <strong className="text-[15px] font-semibold">{value}</strong>
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
