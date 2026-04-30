// Tests für Color-Utilities (Branding, WCAG)
// Bezug: packages/shared/src/color-utils.ts

import { describe, it, expect } from "vitest";
import {
  hexToHsl,
  hslToHex,
  computeContrastForeground,
  computeDarkModeColor,
  getContrastRatio,
  passesWcagAA,
} from "../src/color-utils";

describe("hexToHsl", () => {
  it("converts black", () => {
    expect(hexToHsl("#000000")).toEqual({ h: 0, s: 0, l: 0 });
  });

  it("converts white", () => {
    expect(hexToHsl("#ffffff")).toEqual({ h: 0, s: 0, l: 100 });
  });

  it("converts pure red", () => {
    const r = hexToHsl("#ff0000");
    expect(r.h).toBe(0);
    expect(r.s).toBe(100);
    expect(r.l).toBe(50);
  });

  it("converts pure green", () => {
    const r = hexToHsl("#00ff00");
    expect(r.h).toBe(120);
    expect(r.s).toBe(100);
    expect(r.l).toBe(50);
  });

  it("converts pure blue", () => {
    const r = hexToHsl("#0000ff");
    expect(r.h).toBe(240);
    expect(r.s).toBe(100);
    expect(r.l).toBe(50);
  });

  it("converts greyscale (saturation 0)", () => {
    expect(hexToHsl("#808080").s).toBe(0);
  });
});

describe("hslToHex", () => {
  it("converts black HSL", () => {
    expect(hslToHex({ h: 0, s: 0, l: 0 })).toBe("#000000");
  });

  it("converts white HSL", () => {
    expect(hslToHex({ h: 0, s: 0, l: 100 })).toBe("#ffffff");
  });

  it("round-trip: red", () => {
    const r = hslToHex(hexToHsl("#ff0000"));
    expect(r).toBe("#ff0000");
  });

  it("round-trip: arbitrary blue", () => {
    const original = "#3b82f6";
    const result = hslToHex(hexToHsl(original));
    // Allow ±1 per channel due to rounding
    const origR = parseInt(original.slice(1, 3), 16);
    const resR = parseInt(result.slice(1, 3), 16);
    expect(Math.abs(origR - resR)).toBeLessThanOrEqual(1);
  });
});

describe("computeContrastForeground", () => {
  it("returns dark text for light background", () => {
    expect(computeContrastForeground("#ffffff")).toBe("#0f172a");
    expect(computeContrastForeground("#f0f0f0")).toBe("#0f172a");
  });

  it("returns white text for dark background", () => {
    expect(computeContrastForeground("#000000")).toBe("#ffffff");
    expect(computeContrastForeground("#1e293b")).toBe("#ffffff");
  });

  it("returns white text for medium-dark blue", () => {
    expect(computeContrastForeground("#3b82f6")).toBe("#ffffff");
  });
});

describe("computeDarkModeColor", () => {
  it("lightens a dark color", () => {
    const dark = "#1e293b";
    const lightened = computeDarkModeColor(dark, 20);
    const darkHsl = hexToHsl(dark);
    const lightHsl = hexToHsl(lightened);
    expect(lightHsl.l).toBeGreaterThan(darkHsl.l);
  });

  it("clamps lightness to 100", () => {
    const r = computeDarkModeColor("#f0f0f0", 50);
    const hsl = hexToHsl(r);
    expect(hsl.l).toBeLessThanOrEqual(100);
  });

  it("default lightening is 15 %", () => {
    const dark = "#000000";
    const r1 = computeDarkModeColor(dark);
    const r2 = computeDarkModeColor(dark, 15);
    expect(r1).toBe(r2);
  });
});

describe("getContrastRatio", () => {
  it("black on white = 21:1 (max)", () => {
    expect(getContrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("white on white = 1:1 (min)", () => {
    expect(getContrastRatio("#ffffff", "#ffffff")).toBe(1);
  });

  it("symmetric: ratio(a,b) === ratio(b,a)", () => {
    expect(getContrastRatio("#1e293b", "#ffffff")).toBeCloseTo(
      getContrastRatio("#ffffff", "#1e293b"),
      5,
    );
  });
});

describe("passesWcagAA", () => {
  it("black on white passes AA", () => {
    expect(passesWcagAA("#000000", "#ffffff")).toBe(true);
  });

  it("light grey on white fails AA", () => {
    expect(passesWcagAA("#cccccc", "#ffffff")).toBe(false);
  });

  it("white on dark navy passes AA", () => {
    expect(passesWcagAA("#ffffff", "#0f172a")).toBe(true);
  });

  it("threshold is 4.5", () => {
    // Find a color combination right at the boundary — verify behaviour
    // (we trust the AA threshold is what the function says)
    const fg = "#767676"; // approximately 4.5 against white
    const bg = "#ffffff";
    const ratio = getContrastRatio(fg, bg);
    expect(passesWcagAA(fg, bg)).toBe(ratio >= 4.5);
  });
});
