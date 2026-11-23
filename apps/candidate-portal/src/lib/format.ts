import { useTranslation } from "react-i18next";

export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Locale-aware date helpers in the viewer's own time zone. */
export function useFormat() {
  const { i18n } = useTranslation();
  const locale = i18n.language || "en";

  const parseDate = (v: string | Date | null | undefined): Date | null => {
    if (!v) return null;
    const d = typeof v === "string" ? new Date(v) : v;
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const safeFormat = (
    v: string | Date | null | undefined,
    options: Intl.DateTimeFormatOptions,
    fallback = ""
  ): string => {
    if (!v) return fallback;
    const d = parseDate(v);
    if (!d) return typeof v === "string" ? v : fallback;
    try {
      return new Intl.DateTimeFormat(locale, options).format(d);
    } catch {
      return typeof v === "string" ? v : fallback;
    }
  };

  return {
    date: (v: string | Date) =>
      safeFormat(v, { day: "numeric", month: "short", year: "numeric" }),
    dayMonth: (v: string | Date) =>
      safeFormat(v, { day: "numeric", month: "short" }),
    longDate: (v: string | Date) =>
      safeFormat(v, { weekday: "long", day: "numeric", month: "long" }),
    weekday: (v: string | Date) =>
      safeFormat(v, { weekday: "short" }),
    dayNum: (v: string | Date) =>
      safeFormat(v, { day: "numeric" }),
    month: (v: string | Date) =>
      safeFormat(v, { month: "short" }),
    time: (v: string | Date) =>
      safeFormat(v, { hour: "2-digit", minute: "2-digit" }),
    dateTime: (v: string | Date) =>
      safeFormat(v, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }),
    timeRange: (a: string | Date, b: string | Date) => {
      const da = parseDate(a);
      const db = parseDate(b);
      if (!da || !db) return `${a ?? ""}–${b ?? ""}`;
      try {
        const fmt = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
        return `${fmt.format(da)}–${fmt.format(db)}`;
      } catch {
        return `${a ?? ""}–${b ?? ""}`;
      }
    },
    relative: (v: string | Date) => {
      const d = parseDate(v);
      if (!d) return typeof v === "string" ? v : "";
      try {
        const diff = (d.getTime() - Date.now()) / 1000;
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
        const abs = Math.abs(diff);
        if (abs < 60) return rtf.format(Math.round(diff), "second");
        if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
        if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
        if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), "day");
        return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(d);
      } catch {
        return typeof v === "string" ? v : "";
      }
    },
    daysUntil: (v: string | Date) => {
      const d = parseDate(v);
      if (!d) return 0;
      return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86_400_000));
    },
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
  const parts = trimmed.split(" ").filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0]!.length > 0) {
    return parts[0]![0]!.toUpperCase();
  }
  return fallback;
};
