import { useTranslation } from "react-i18next";

export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Locale-aware date helpers in the viewer's own time zone. */
export function useFormat() {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  const d = (v: string | Date) => (typeof v === "string" ? new Date(v) : v);
  return {
    date: (v: string | Date) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(d(v)),
    dayMonth: (v: string | Date) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(d(v)),
    longDate: (v: string | Date) => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(d(v)),
    weekday: (v: string | Date) => new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d(v)),
    dayNum: (v: string | Date) => new Intl.DateTimeFormat(locale, { day: "numeric" }).format(d(v)),
    month: (v: string | Date) => new Intl.DateTimeFormat(locale, { month: "short" }).format(d(v)),
    time: (v: string | Date) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(d(v)),
    dateTime: (v: string | Date) =>
      new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(d(v)),
    timeRange: (a: string | Date, b: string | Date) => {
      const f = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
      return `${f.format(d(a))}–${f.format(d(b))}`;
    },
    relative: (v: string | Date) => {
      const diff = (d(v).getTime() - Date.now()) / 1000;
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
      const abs = Math.abs(diff);
      if (abs < 60) return rtf.format(Math.round(diff), "second");
      if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
      if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
      if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), "day");
      return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(d(v));
    },
    daysUntil: (v: string | Date) => Math.max(0, Math.ceil((d(v).getTime() - Date.now()) / 86_400_000)),
    fileSize: (bytes: number) =>
      bytes < 1024 * 1024
        ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(bytes / 1024)} KB`
        : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`,
    tzName: () => browserTimeZone(),
  };
}

export const initials = (name: string | null | undefined, fallback = "") => {
  if (!name) return fallback;
  const trimmed = name.trim();
  if (!trimmed) return fallback;

  // If email address, only take first character of the username before @ (never domain letters like 'G' from gmail)
  if (trimmed.includes("@")) {
    const userPart = trimmed.split("@")[0] || "";
    return (userPart[0] || fallback).toUpperCase();
  }

  // Name with multiple words (e.g. "Sahu Pavan" -> "SP", "John Smith" -> "JS", "Rahul Kumar" -> "RK", "Priya Sharma" -> "PS")
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0]!.length > 0) {
    return parts[0]![0]!.toUpperCase();
  }
  return fallback;
};
