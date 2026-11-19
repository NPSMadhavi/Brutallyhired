const fmt = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function buildIcs(opts: {
  uid: string;
  start: Date;
  end: Date;
  title: string;
  description: string;
  url: string;
  organizer: string;
}) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Brutallyhired//Candidate Portal//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(opts.start)}`,
    `DTEND:${fmt(opts.end)}`,
    `SUMMARY:${esc(opts.title)}`,
    `DESCRIPTION:${esc(opts.description)}`,
    `URL:${opts.url}`,
    `ORGANIZER;CN=${esc(opts.organizer)}:mailto:no-reply@invalid`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
