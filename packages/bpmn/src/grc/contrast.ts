/**
 * Farbrechnung für die Marker-Token (Plan §4.4).
 *
 * Alles hier ist reine Arithmetik nach veröffentlichten Formeln — WCAG 2.2
 * (Relative Luminanz, Kontrastverhältnis), CIE L* aus der Luminanz und die
 * Farbsehsimulation nach Viénot/Brettel/Mollon (1999) über den linearen
 * LMS-Raum. Kein Bildvergleich, keine Bibliothek: die Kontrastregeln sollen als
 * deterministischer Unit-Test prüfbar sein und nicht als Screenshot.
 */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** `#rgb` oder `#rrggbb` → 0…255-Kanäle. */
export function parseHex(hex: string): Rgb {
  const value = hex.trim().replace(/^#/, "");
  const expanded =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`keine Farbe: ${hex}`);
  }
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

export function toHex(rgb: Rgb): string {
  const clamp = (v: number): string =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${clamp(rgb.r)}${clamp(rgb.g)}${clamp(rgb.b)}`;
}

/** sRGB-Kanal → linearer Wert (WCAG 2.x, identisch zu IEC 61966-2-1). */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function delinearize(value: number): number {
  const c = Math.max(0, Math.min(1, value));
  return (
    (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255
  );
}

/** Relative Luminanz nach WCAG 2.2. */
export function relativeLuminance(color: string): number {
  const { r, g, b } = parseHex(color);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Kontrastverhältnis nach WCAG 2.2 (1…21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * CIE L* (Helligkeit) aus der relativen Luminanz.
 *
 * Plan §4.4 Regel 3 verlangt L* ≥ 80 für jede Heatmap-Füllung — nur dann hält
 * die Elementbeschriftung ihre 4,5:1 gegen die Füllung.
 */
export function lightness(color: string): number {
  const y = relativeLuminance(color);
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
}

export type ColorVisionDeficiency =
  "protanopia" | "deuteranopia" | "tritanopia";

/**
 * Simuliert Farbfehlsichtigkeit (Viénot, Brettel & Mollon 1999).
 *
 * Zweck ist nicht Bildschöne, sondern der Nachweis aus §4.4 Regel 5: wenn zwei
 * Signale nach der Simulation ununterscheidbar werden, muss ein Formzeichen
 * dazukommen. Der Test in `test/grc/contrast.test.ts` prüft genau das.
 */
export function simulateCvd(
  color: string,
  kind: ColorVisionDeficiency,
): string {
  const { r, g, b } = parseHex(color);
  const rl = linearize(r);
  const gl = linearize(g);
  const bl = linearize(b);

  // linearer sRGB → LMS (Hunt-Pointer-Estevez, wie bei Viénot 1999)
  const l = 0.31399022 * rl + 0.63951294 * gl + 0.04649755 * bl;
  const m = 0.15537241 * rl + 0.75789446 * gl + 0.08670142 * bl;
  const s = 0.01775239 * rl + 0.10944209 * gl + 0.87256922 * bl;

  let l2 = l;
  let m2 = m;
  let s2 = s;
  if (kind === "protanopia") {
    l2 = 1.05118294 * m - 0.05116099 * s;
  } else if (kind === "deuteranopia") {
    m2 = 0.9513092 * l + 0.04866992 * s;
  } else {
    s2 = -0.86744736 * l + 1.86727089 * m;
  }

  const r2 = 5.47221206 * l2 - 4.6419601 * m2 + 0.16963708 * s2;
  const g2 = -1.1252419 * l2 + 2.29317094 * m2 - 0.1678952 * s2;
  const b2 = 0.02980165 * l2 - 0.19318073 * m2 + 1.16364789 * s2;

  return toHex({ r: delinearize(r2), g: delinearize(g2), b: delinearize(b2) });
}

/**
 * Wahrnehmungsabstand zweier Farben im OKLab-Raum.
 *
 * Wird nur benutzt, um zu *belegen*, dass zwei Tönungen nach einer
 * CVD-Simulation zusammenfallen — nicht, um Design zu betreiben.
 */
export function perceptualDistance(a: string, b: string): number {
  const [la, aa, ba] = toOklab(a);
  const [lb, ab, bb] = toOklab(b);
  return Math.hypot(la - lb, aa - ab, ba - bb);
}

function toOklab(color: string): [number, number, number] {
  const { r, g, b } = parseHex(color);
  const rl = linearize(r);
  const gl = linearize(g);
  const bl = linearize(b);

  const l = Math.cbrt(
    0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl,
  );
  const m = Math.cbrt(
    0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl,
  );
  const s = Math.cbrt(
    0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl,
  );

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
