/** Apply a tenant's brand colour as CSS variables, picking a readable foreground. */
export function applyBrand(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // Contrast against white vs near-black; pick the stronger.
  const vsWhite = 1.05 / (luminance + 0.05);
  const vsInk = (luminance + 0.05) / 0.0587;
  const root = document.documentElement.style;
  root.setProperty("--brand", `${r} ${g} ${b}`);
  root.setProperty("--brand-fg", vsWhite >= vsInk ? "255 255 255" : "14 23 38");
}
