import { clsx } from "clsx";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { initials } from "@/lib/format";
import { Pill, type Tone } from "./Card";
import { Upload, X } from "./icons";

export function ProgressRing({ value, total, size = 104, label, children }: { value: number; total: number; size?: number; label: string; children?: ReactNode }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF2F7" strokeWidth="10" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#0F9D8A" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-xl font-bold">{children}</span>
    </div>
  );
}

export const Avatar = ({ name, size = 44, tone = "ink" }: { name: string | null | undefined; size?: number; tone?: "ink" | "teal" | "blue" }) => (
  <span
    className={clsx(
      "inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold select-none",
      tone === "ink" && "bg-ink text-white",
      tone === "teal" && "bg-ok-soft text-ok-ink",
      tone === "blue" && "bg-info-soft text-info-ink",
    )}
    style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    aria-hidden
  >
    {initials(name)}
  </span>
);

export function FileDrop({
  accept, onFile, busy, hint, label,
}: { accept: string; onFile: (f: File) => void; busy?: boolean; hint: string; label?: string }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      className={clsx(
        "flex flex-col items-center gap-2.5 rounded-2xl border-[1.5px] border-dashed px-5 py-8 text-center transition-colors",
        over ? "border-brand bg-brand-soft" : "border-[#C9D3E0] bg-[#FAFBFD]",
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-brand shadow-card"><Upload /></span>
      <p className="text-sm text-ink-2">
        {t("apply.resume.drop")}{" "}
        <button type="button" className="font-semibold text-brand underline-offset-2 hover:underline" onClick={() => input.current?.click()} disabled={busy}>
          {label ?? t("apply.resume.browse")}
        </button>
      </p>
      <p className="text-xs text-ink-muted">{busy ? t("apply.resume.uploading") : hint}</p>
      <input
        ref={input} type="file" accept={accept} className="sr-only" tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function TagInput({ value, onChange, label, max = 60 }: { value: string[]; onChange: (v: string[]) => void; label: string; max?: number }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !value.includes(v) && value.length < max) onChange([...value, v]);
    setDraft("");
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((item) => (
          <span key={item} className="inline-flex min-h-[34px] items-center gap-1 rounded-full border border-line-2 bg-white pl-3 pr-1 text-[13px] font-medium text-ink-2">
            {item}
            <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-line-soft" aria-label={t("apply.resume.removeItem", { item })} onClick={() => onChange(value.filter((x) => x !== item))}>
              <X size={14} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="min-h-[44px] flex-1 rounded-xl border border-line-2 px-3 text-sm focus:border-brand focus:outline-none"
          value={draft}
          aria-label={label}
          placeholder={t("apply.resume.itemPlaceholder")}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" onClick={add} className="min-h-[44px] rounded-xl border border-line-2 px-4 text-sm font-semibold hover:bg-canvas">
          {t("apply.resume.add")}
        </button>
      </div>
    </div>
  );
}

export const STAGE_TONES: Record<string, Tone> = {
  DRAFT: "gray",
  SUBMITTED: "blue",
  UNDER_REVIEW: "amber",
  IN_REVIEW: "amber",
  SHORTLISTED: "blue",
  ASSESSMENT: "amber",
  INTERVIEW: "blue",
  OFFER: "teal",
  ONBOARDING: "teal",
  HIRED: "teal",
  ON_HOLD: "amber",
  REJECTED: "red",
  NOT_SELECTED: "red",
  WITHDRAWN: "gray",
};

export function StagePill({ stage }: { stage: string }) {
  const tone = STAGE_TONES[stage] ?? "gray";
  const label = stage.replace(/_/g, " ");
  return (
    <Pill tone={tone} dot>
      {label}
    </Pill>
  );
}

export function ScoreBadge({
  score,
  threshold = 60,
  max = 100,
}: {
  score?: number | null;
  threshold?: number;
  max?: number;
}) {
  if (score === undefined || score === null) {
    return <span className="text-xs font-medium text-ink-muted">Not scored</span>;
  }
  const isPassing = score >= threshold;
  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className={clsx(
          "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold",
          isPassing ? "bg-ok-soft text-ok-ink" : "bg-danger-soft text-danger",
        )}
      >
        {score}
      </span>
      <span className="text-[11px] text-ink-muted">/{max}</span>
    </div>
  );
}
