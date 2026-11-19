import type { PublicEvent } from "@verity/shared";
import { useTranslation } from "react-i18next";
import { useFormat } from "@/lib/format";

/** Public events carry only ids, titles and dates; text comes from the message catalog. */
export function useEventText() {
  const { t } = useTranslation();
  const f = useFormat();
  return (e: Pick<PublicEvent, "type" | "data">) => {
    const d = (e.data ?? {}) as Record<string, string | undefined>;
    const dateSrc = d.respondBy ?? d.startDate ?? d.dueAt;
    const vars = {
      ...d,
      when: d.startsAt ? f.dateTime(d.startsAt) : "",
      date: dateSrc ? f.date(dateSrc) : "",
    };
    return { title: t(`events.${e.type}.title`, vars), body: t(`events.${e.type}.body`, vars) };
  };
}
