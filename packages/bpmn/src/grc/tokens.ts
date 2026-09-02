/**
 * Darstellungstoken der GRC-Schicht (Plan §3.3.1, §4.4).
 *
 * Zwei Dinge werden hier festgelegt und nirgends sonst:
 *
 * 1. **Die Farb- und Formzeichen-Paare.** Jeder Ton hat eine Fläche *und* ein
 *    Formzeichen; Farbe ist nie der einzige Träger (§3.3.5 Regel 2). Die Werte
 *    sind gegen die Regeln aus §4.4 gerechnet — `test/grc/contrast.test.ts`
 *    rechnet sie bei jedem Lauf nach, damit ein „nur mal eben heller" auffliegt.
 * 2. **Die Geometrie der Slots.** Badges, Gutter, Pin-Schiene und LoD-Kante
 *    haben feste Maße; kein Layer darf eigene erfinden.
 */

/** Die sechs Signaltöne. Mehr gibt es nicht — Layer wählen aus dieser Liste. */
export type GrcTone =
  "neutral" | "ok" | "info" | "warn" | "critical" | "accent";

/**
 * Formzeichen je Ton (§3.3.5 Regel 2, §4.4 Regel 5).
 *
 * Ausgewählt aus dem geometrischen Block von Unicode und dem Latin-1-Vorrat,
 * weil diese Zeichen in jeder verbreiteten Schrift vorhanden sind und beim
 * Rastern nicht zu Kästchen werden. Das ist keine Vorsicht auf Verdacht: die
 * erste Fassung benutzte ◆, ↗, ⚑ und 📄 — im gerasterten Beleg standen dort
 * leere Rechtecke. Emoji und Pfeilsymbole sind hier ein Fehler.
 */
export const TONE_GLYPH: Readonly<Record<GrcTone, string>> = {
  critical: "▲", // ▲ hoch
  warn: "■", // ■ mittel
  ok: "●", // ● niedrig
  info: "▪", // ▪ Hinweis
  neutral: "○", // ○ ohne Befund
  accent: "§", // § Sonderkanal (Datenschutz, Rechtsbezug)
};

/** Wortmarke je Ton — für Textalternative und Live-Region. */
export const TONE_WORD: Readonly<Record<GrcTone, string>> = {
  critical: "kritisch",
  warn: "auffällig",
  ok: "unauffällig",
  info: "Hinweis",
  neutral: "ohne Befund",
  accent: "besonders",
};

export interface ToneColors {
  /** Badge-Fläche: dunkel, weißer Text (≥ 4,5:1), ≥ 3:1 gegen Weiß. */
  readonly solid: string;
  /** Heatmap-Tönung: L* ≥ 80, Beschriftung hält 4,5:1. */
  readonly tint: string;
  /** Schraffurstrich auf der Tönung. */
  readonly hatch: string;
}

/**
 * Die Palette.
 *
 * Gerechnete Kennwerte (WCAG 2.2, siehe `contrast.ts`):
 *
 * | Ton      | solid   | Weißtext | vs. Weiß | tint    | L\*  | Text 4,5:1 |
 * |----------|---------|---------:|---------:|---------|-----:|-----------:|
 * | critical | #A4262C |     7,26 |     7,26 | #F5C2BC | 82,7 |      11,33 |
 * | warn     | #8A5A00 |     5,93 |     5,93 | #FBE3A2 | 90,8 |      14,12 |
 * | ok       | #1F6B3A |     6,52 |     6,52 | #C9E7D2 | 89,0 |      13,47 |
 * | info     | #1C4E80 |     8,57 |     8,57 | #D6E4F7 | 90,1 |      13,86 |
 * | neutral  | #444D56 |     8,60 |     8,60 | #EEF1F4 | 95,0 |      15,75 |
 * | accent   | #5B3E9B |     8,05 |     8,05 | #E4D8F5 | 88,1 |      13,13 |
 *
 * Schlechtestes Badge-gegen-Tönung-Paar: `warn` auf `critical`-Tönung mit
 * 3,76:1 — über der Schwelle 3:1 aus §4.4 Regel 2.
 */
export const GRC_PALETTE: Readonly<Record<GrcTone, ToneColors>> = {
  critical: { solid: "#A4262C", tint: "#F5C2BC", hatch: "#7A2B27" },
  warn: { solid: "#8A5A00", tint: "#FBE3A2", hatch: "#6B4A00" },
  ok: { solid: "#1F6B3A", tint: "#C9E7D2", hatch: "#17512C" },
  info: { solid: "#1C4E80", tint: "#D6E4F7", hatch: "#2F4858" },
  neutral: { solid: "#444D56", tint: "#EEF1F4", hatch: "#4A5158" },
  accent: { solid: "#5B3E9B", tint: "#E4D8F5", hatch: "#452E77" },
};

/** Text auf einer Badge-Fläche. */
export const BADGE_TEXT = "#FFFFFF";
/** Elementbeschriftung — dieselbe Farbe wie in `draw/theme.ts`. */
export const ELEMENT_TEXT = "#12181f";
/** Canvas-Hintergrund — Bezugsfläche für Regel 2 aus §4.4. */
export const CANVAS_BACKGROUND = "#ffffff";

/**
 * Schraffurdichte. Die Stufe trägt die Intensität *zusätzlich* zur Farbe
 * (§4.4 Regel 3): abgestuft über Linienabstand, nicht über Farbsättigung.
 */
export type HatchDensity = "none" | "light" | "medium" | "heavy";

export const HATCH_SPACING: Readonly<Record<HatchDensity, number>> = {
  none: 0,
  light: 10,
  medium: 6,
  heavy: 4,
};

/* ------------------------------------------------------------------ *
 * Geometrie
 * ------------------------------------------------------------------ */

export const BADGE = {
  height: 18,
  minWidth: 20,
  paddingX: 5,
  radius: 4,
  fontSize: 11,
  /** Wie weit das Badge über die Elementkante ragt. */
  overhang: 7,
  /** Zeichenbreite bei `fontSize` — Schätzung, wie in `draw/text.ts`. */
  charWidth: 6.2,
} as const;

export const GUTTER = {
  offsetY: 6,
  height: 15,
  fontSize: 10.5,
  /** Höchstens drei Kennzahlen in einer Zeile (§3.3.1). */
  maxEntries: 3,
} as const;

export const PIN = {
  /** Abstand der Pin-Schiene links außerhalb des Shapes. */
  offsetX: 15,
  radius: 8,
  fontSize: 10,
} as const;

export const LOD_STRIPE = {
  width: 4,
  /** Abstand nach links, damit die Kante die Kontur nicht überdeckt. */
  offsetX: 3,
} as const;

export const ARC = {
  strokeWidth: 2,
  dash: "7,4",
  /** Wie weit der Bogen aus der direkten Verbindung ausschert. */
  bulge: 55,
  lockSize: 11,
  /** Der Bogen beschriftet sich kurz — sonst legt sich der Text über das Bild. */
  maxLabelWidth: 150,
} as const;

export const EDGE_DECORATION = {
  /** Breite der äußeren Linie der Doppelkante (Vertrauensgrenze). */
  outerWidth: 7,
  innerWidth: 3,
  chipHeight: 16,
  chipFontSize: 10,
  /** Strichstärkenbereich für die Häufigkeitskodierung. */
  minFlowWidth: 1.5,
  maxFlowWidth: 6,
} as const;

export const BANNER = {
  height: 26,
  fontSize: 12,
  paddingX: 10,
  offsetY: 34,
} as const;

export const LEGEND = {
  offsetY: 24,
  rowHeight: 18,
  swatch: 13,
  fontSize: 11,
  paddingX: 8,
} as const;

/** Geschätzte Breite eines Badges für `text`. */
export function badgeWidth(text: string): number {
  return Math.max(
    BADGE.minWidth,
    Math.round(text.length * BADGE.charWidth + BADGE.paddingX * 2),
  );
}
