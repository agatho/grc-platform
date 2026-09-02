/// <reference lib="dom" />

import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  lightness,
  perceptualDistance,
  simulateCvd,
  type ColorVisionDeficiency,
} from "../../src/grc/contrast";
import {
  BADGE_TEXT,
  CANVAS_BACKGROUND,
  ELEMENT_TEXT,
  GRC_PALETTE,
  TONE_GLYPH,
  TONE_WORD,
  type GrcTone,
} from "../../src/grc/tokens";
import { DEFAULT_PALETTE } from "../../src/draw/theme";

/**
 * Die Kontrastregeln aus Plan §4.4 — gerechnet, nicht behauptet.
 *
 * `axe-core` schaltet `color-contrast` in jsdom ab, weil es die tatsächlichen
 * Farben nicht ermitteln kann. Deshalb wird hier gegen die Token-Werte gerechnet:
 * ein deterministischer Test, der ein „nur mal eben heller" sofort auffliegen
 * lässt. Die gemessenen Werte stehen als Tabelle im Protokoll.
 */

const TONES = Object.keys(GRC_PALETTE) as GrcTone[];

describe("§4.4 Regel 1 — Badge-Text zu Badge-Fläche ≥ 4,5:1", () => {
  for (const tone of TONES) {
    it(`${tone}: weißer Text auf ${GRC_PALETTE[tone].solid}`, () => {
      expect(
        contrastRatio(BADGE_TEXT, GRC_PALETTE[tone].solid),
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("§4.4 Regel 2 — Badge-Fläche zu Shape-Füllung und Canvas ≥ 3:1", () => {
  it("gegen den Canvas-Hintergrund", () => {
    for (const tone of TONES) {
      expect(
        contrastRatio(GRC_PALETTE[tone].solid, CANVAS_BACKGROUND),
        tone,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("gegen die weiße Standardfüllung der Shapes", () => {
    for (const tone of TONES) {
      expect(
        contrastRatio(GRC_PALETTE[tone].solid, DEFAULT_PALETTE.fill),
        tone,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("gegen jede Heatmap-Tönung — Badges überlappen die Kante, beide Nachbarschaften zählen", () => {
    for (const badge of TONES) {
      for (const fill of TONES) {
        const ratio = contrastRatio(
          GRC_PALETTE[badge].solid,
          GRC_PALETTE[fill].tint,
        );
        expect(ratio, `${badge} auf ${fill}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("§4.4 Regel 3 — Heatmap-Füllungen mit L* ≥ 80", () => {
  for (const tone of TONES) {
    it(`${tone}: ${GRC_PALETTE[tone].tint}`, () => {
      expect(lightness(GRC_PALETTE[tone].tint)).toBeGreaterThanOrEqual(80);
      // Folge daraus: die Elementbeschriftung hält ihre 4,5:1 gegen die Füllung.
      expect(
        contrastRatio(ELEMENT_TEXT, GRC_PALETTE[tone].tint),
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("§4.4 Regel 4 — die Elementkontur bleibt in jeder Kodierung erhalten", () => {
  it("Kontur zu jeder Tönung ≥ 3:1", () => {
    for (const tone of TONES) {
      expect(
        contrastRatio(DEFAULT_PALETTE.stroke, GRC_PALETTE[tone].tint),
        tone,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("Schraffurstrich zu seiner Tönung ≥ 3:1", () => {
    for (const tone of TONES) {
      expect(
        contrastRatio(GRC_PALETTE[tone].hatch, GRC_PALETTE[tone].tint),
        tone,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("§4.4 Regel 5 — kein Rot/Grün allein", () => {
  it("jeder Ton trägt ein eigenes Formzeichen und ein eigenes Wort", () => {
    const glyphs = TONES.map((tone) => TONE_GLYPH[tone]);
    const words = TONES.map((tone) => TONE_WORD[tone]);
    expect(new Set(glyphs).size).toBe(TONES.length);
    expect(new Set(words).size).toBe(TONES.length);
  });

  const deficiencies: ColorVisionDeficiency[] = [
    "protanopia",
    "deuteranopia",
    "tritanopia",
  ];

  for (const kind of deficiencies) {
    it(`${kind}: der Text bleibt lesbar, auch wenn Farben zusammenfallen`, () => {
      for (const tone of TONES) {
        const solid = simulateCvd(GRC_PALETTE[tone].solid, kind);
        const tint = simulateCvd(GRC_PALETTE[tone].tint, kind);
        expect(
          contrastRatio(BADGE_TEXT, solid),
          `${tone} solid`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(ELEMENT_TEXT, tint),
          `${tone} tint`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("belegt, warum das Formzeichen nötig ist: kritisch und auffällig fallen zusammen", () => {
    // Genau der Nachweis, den Regel 5 verlangt: Nach der Simulation liegen die
    // beiden Warnfarben so dicht beieinander, dass Farbe allein nicht trägt.
    const critical = simulateCvd(GRC_PALETTE.critical.solid, "deuteranopia");
    const warn = simulateCvd(GRC_PALETTE.warn.solid, "deuteranopia");
    const distanceBefore = perceptualDistance(
      GRC_PALETTE.critical.solid,
      GRC_PALETTE.warn.solid,
    );
    const distanceAfter = perceptualDistance(critical, warn);
    expect(distanceAfter).toBeLessThan(distanceBefore);
    expect(TONE_GLYPH.critical).not.toBe(TONE_GLYPH.warn);
  });
});

describe("Farbrechnung", () => {
  it("rechnet bekannte Kontraste korrekt", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    // Referenzwert aus der WCAG-Beispielrechnung.
    expect(contrastRatio("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("rechnet L* an den Randpunkten korrekt", () => {
    expect(lightness("#ffffff")).toBeCloseTo(100, 3);
    expect(lightness("#000000")).toBeCloseTo(0, 3);
  });

  it("lässt Grau unter Farbfehlsichtigkeit unverändert", () => {
    const grey = "#808080";
    for (const kind of ["protanopia", "deuteranopia", "tritanopia"] as const) {
      expect(
        Math.abs(lightness(simulateCvd(grey, kind)) - lightness(grey)),
      ).toBeLessThan(2);
    }
  });
});
