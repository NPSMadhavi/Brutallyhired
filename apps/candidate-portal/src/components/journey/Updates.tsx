import type { PublicEvent } from "@verity/shared";
import { clsx } from "clsx";
import { useTranslation } from "react-i18next";
import { Check } from "@/components/ui/icons";
import { useFormat } from "@/lib/format";
import { useEventText } from "./eventText";

export function Updates({ events }: { events: PublicEvent[] }) {
  const { t } = useTranslation();
  const f = useFormat();
  const text = useEventText();
  if (events.length === 0) return <p className="text-sm text-ink-muted">{t("overview.noUpdates")}</p>;
  return (
    <ol className="flex flex-col">
      {events.map((e, i) => {
        const { title, body } = text(e);
        const latest = i === 0;
        const last = i === events.length - 1;
        return (
          <li key={e.id} className="flex gap-4">
            <span className="w-16 shrink-0 pt-0.5 text-right text-[13px] text-ink-muted">{f.relative(e.createdAt)}</span>
            <span className="flex w-5 shrink-0 flex-col items-center">
              <span
                className={clsx(
                  "flex h-5 w-5 items-center justify-center rounded-full border-2",
                  latest ? "border-[6px] border-brand bg-white" : "border-ok bg-ok text-white",
                )}
              >
                {!latest && <Check size={11} />}
              </span>
              {!last && <span className="min-h-7 w-0.5 flex-1 bg-ok" />}
            </span>
            <div className={clsx("flex min-w-0 flex-col gap-0.5", !last && "pb-6")}>
              <span className="text-[15px] font-semibold">{title}</span>
              {body && <span className="text-[13px] leading-relaxed text-ink-3">{body}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
