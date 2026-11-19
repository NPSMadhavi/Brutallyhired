import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tenant brand colour is injected at runtime as an "R G B" triplet.
        brand: { DEFAULT: "rgb(var(--brand) / <alpha-value>)", fg: "rgb(var(--brand-fg) / <alpha-value>)", soft: "rgb(var(--brand) / 0.08)" },
        ink: { DEFAULT: "#0E1726", 2: "#2A3647", 3: "#3B4757", muted: "#5B6676" },
        line: { DEFAULT: "#E9EDF3", 2: "#DCE3EC", soft: "#EEF2F7" },
        canvas: "#F4F6FA",
        ok: { DEFAULT: "#0F9D8A", soft: "#E3F6F2", ink: "#0B6B5E" },
        warn: { soft: "#FFF3DC", ink: "#8A5300" },
        info: { soft: "#EAF0FF", ink: "#1E3FAE" },
        danger: { DEFAULT: "#9B2C2C", soft: "#FDF5F5", line: "#F0CACA" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ['"Plus Jakarta Sans"', "Inter", "sans-serif"],
      },
      borderRadius: { xl2: "20px" },
      boxShadow: { card: "0 1px 2px rgba(14,23,38,.04)", lift: "0 12px 32px rgba(14,23,38,.08)" },
      maxWidth: { page: "1240px" },
    },
  },
  plugins: [],
} satisfies Config;
