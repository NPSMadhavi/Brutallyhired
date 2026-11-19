import type { ApplicationOverview } from "@verity/shared";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { Check } from "@/components/ui/icons";
import { useFormat } from "@/lib/format";

export function JourneyTrack({ track }: { track: ApplicationOverview["track"] }) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <div className="overflow-x-auto">
      <ol aria-label={t("overview.progressLabel")} className="grid min-w-[720px]" style={{ gridTemplateColumns: `repeat(${track.length}, minmax(0, 1fr))` }}>
        {track.map((m, i) => (
          <li key={m.key} data-state={m.state} className="track-item relative flex flex-col gap-2 pr-2.5" aria-current={m.state === "current" ? "step" : undefined}>
            <span
              className={clsx(
                "flex h-10 w-10 items-center justify-center rounded-full border-2 font-display text-sm font-bold",
                m.state === "done" && "border-ok bg-ok text-white",
                m.state === "current" && "border-brand bg-brand text-brand-fg shadow-[0_0_0_6px_rgb(var(--brand)/0.12)]",
                m.state === "upcoming" && "border-[#E4E9F0] bg-[#F1F4F8] text-ink-muted",
              )}
            >
              {m.state === "done" ? <Check size={18} /> : i + 1}
            </span>
            <span className={clsx("text-sm", m.state === "upcoming" ? "font-medium text-ink-muted" : "font-semibold", m.state === "current" && "text-brand")}>
              {t(`milestone.${m.key}`)}
            </span>
            <span className="min-h-4 text-xs text-ink-muted">{m.at ? f.dayMonth(m.at) : ""}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
