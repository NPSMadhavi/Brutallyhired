import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = ({ size = 20, ...p }: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});

export const Check = (p: P) => <svg {...base(p)} strokeWidth={2.4}><path d="M20 6 9 17l-5-5" /></svg>;
export const Lock = (p: P) => <svg {...base(p)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
export const Bell = (p: P) => <svg {...base(p)}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;
export const LogOut = (p: P) => <svg {...base(p)}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" /></svg>;
export const Calendar = (p: P) => <svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
export const Clipboard = (p: P) => <svg {...base(p)}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 13l2 2 4-4" /></svg>;
export const Folder = (p: P) => <svg {...base(p)}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>;
export const File = (p: P) => <svg {...base(p)}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>;
export const Upload = (p: P) => <svg {...base(p)}><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>;
export const Download = (p: P) => <svg {...base(p)}><path d="M12 4v12M7 11l5 5 5-5M4 20h16" /></svg>;
export const Clock = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const Video = (p: P) => <svg {...base(p)}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m16 10 6-3v10l-6-3" /></svg>;
export const Pin = (p: P) => <svg {...base(p)}><path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
export const User = (p: P) => <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
export const Shield = (p: P) => <svg {...base(p)}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /></svg>;
export const Mail = (p: P) => <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
export const Arrow = (p: P) => <svg {...base(p)} strokeWidth={2}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const ChevronLeft = (p: P) => <svg {...base(p)} strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>;
export const X = (p: P) => <svg {...base(p)} strokeWidth={2}><path d="M18 6 6 18M6 6l12 12" /></svg>;
export const Alert = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>;
export const Sparkle = (p: P) => <svg {...base(p)}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></svg>;
export const Hourglass = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 1.5" /></svg>;
export const Bag = (p: P) => <svg {...base(p)}><path d="M6 7h12l-1 13H7z" /><path d="M9 7V5a3 3 0 0 1 6 0v2" /></svg>;
export const Monitor = (p: P) => <svg {...base(p)}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>;
export const Wifi = (p: P) => <svg {...base(p)}><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0" /><circle cx="12" cy="19.5" r="1" /></svg>;
export const Globe = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>;

export function ProviderLogo({ provider, size = 20 }: { provider: string; size?: number }) {
  const s = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const };
  switch (provider) {
    case "GOOGLE":
      return (
        <svg {...s}>
          <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" fill="#4285F4" />
          <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853" />
          <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z" fill="#FBBC05" />
          <path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 5.9 12 5.9z" fill="#EA4335" />
        </svg>
      );
    case "MICROSOFT":
      return (
        <svg {...s}>
          <rect x="2" y="2" width="9.5" height="9.5" fill="#F25022" />
          <rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00" />
          <rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF" />
          <rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900" />
        </svg>
      );
    case "LINKEDIN":
      return (
        <svg {...s}>
          <rect width="24" height="24" rx="4" fill="#0A66C2" />
          <path d="M7 10h2.6v7.5H7zM8.3 6.2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM11.2 10h2.5v1.1c.4-.7 1.3-1.3 2.6-1.3 2.6 0 3.1 1.7 3.1 3.9v3.8h-2.6v-3.4c0-.8 0-1.9-1.2-1.9s-1.4.9-1.4 1.8v3.5h-2.6z" fill="#fff" />
        </svg>
      );
    default:
      return <Mail size={size} />;
  }
}
