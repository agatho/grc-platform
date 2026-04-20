// Sprint 13a: Color utility functions for branding
// HSL conversions & WCAG contrast computations

export interface HslColor {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

/**
 * Convert a hex color string (#RRGGBB) to HSL.
 */
export function hexToHsl(hex: string): HslColor {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6;
  } else {
    h = ((r - g) / d + 4) / 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert HSL values to a hex color string (#RRGGBB).
 */
export function hslToHex(hsl: HslColor): string {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  if (s === 0) {
    const val = Math.round(l * 255);
    return `#${val.toString(16).padStart(2, "0")}${val.toString(16).padStart(2, "0")}${val.toString(16).padStart(2, "0")}`;
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Compute the best foreground color (black or white) for WCAG AA contrast
 * against the given background hex color.
 *
 * Uses the relative luminance formula:
 *   luminance = (0.299 * R + 0.587 * G + 0.114 * B) / 255
 */
export function computeContrastForeground(hexColor: string): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#0f172a" : "#ffffff";
}

/**
 * Lighten a hex color by a given percentage via HSL adjustment.
 * Used to auto-compute dark mode colors from light mode brand colors.
 */
export function computeDarkModeColor(
  hexColor: string,
  lightenPercent: number = 15,
): string {
  const hsl = hexToHsl(hexColor);
  hsl.l = Math.min(100, hsl.l + lightenPercent);
  return hslToHex(hsl);
}

/**
 * Check WCAG AA contrast ratio between two hex colors.
 * Returns the contrast ratio (minimum 4.5:1 for AA on normal text).
 */
export function getContrastRatio(
  foreground: string,
  background: string,
): number {
  const getLuminance = (hex: string): number => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const toLinear = (c: number): number =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a color combination passes WCAG AA for normal text (4.5:1).
 */
export function passesWcagAA(foreground: string, background: string): boolean {
  return getContrastRatio(foreground, background) >= 4.5;
}
