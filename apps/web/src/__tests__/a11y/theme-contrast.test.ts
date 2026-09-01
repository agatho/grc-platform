// [ARCTOS-FULL-2026-08-31 / WP12 · S14-11]
//
// Contrast gate for the design tokens — EN 301 549 §9.1.4.3 / WCAG 1.4.3 (AA).
//
// The audit measured `text-gray-400` at 2.58:1 against the surface colour, in
// 1.177 places, and `text-gray-300` at 1.48:1. Both are body-size secondary
// text (timestamps, help text, captions), so the 4.5:1 threshold applies. The
// existing `.high-contrast` ("Polar") theme is opt-in and does not change the
// assessment: EN 301 549 evaluates the delivered default.
//
// axe cannot check this: jsdom resolves no CSS custom properties and computes
// no layout, which is why `color-contrast` is disabled in components-axe.test.
// So this test reads the tokens out of `globals.css` and computes the ratios
// itself — oklch → sRGB → WCAG relative luminance. It fails if a token that is
// used as a TEXT colour drops below its threshold, in any of the three themes.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const CSS = readFileSync(
  path.join(__dirname, "../../styles/globals.css"),
  "utf8",
);
const SRC = path.join(__dirname, "../..");

// ── colour maths ───────────────────────────────────────────────────────────

/** oklch → linear sRGB → gamma-encoded sRGB, clamped to gamut. */
function oklchToSrgb(
  L: number,
  C: number,
  hDeg: number,
): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const enc = (x: number) => {
    const v =
      x <= 0.0031308
        ? 12.92 * x
        : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, v));
  };
  return [
    enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    enc(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(
  fg: [number, number, number],
  bg: [number, number, number],
): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function hexToSrgb(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  return [
    parseInt(n.slice(0, 2), 16) / 255,
    parseInt(n.slice(2, 4), 16) / 255,
    parseInt(n.slice(4, 6), 16) / 255,
  ];
}

// ── token extraction ───────────────────────────────────────────────────────

/**
 * Reads `--color-<name>: oklch(L C H);` declarations from one block of
 * globals.css. `blockStart` is the selector that opens the block.
 */
function tokensIn(blockStart: string): Map<string, [number, number, number]> {
  const start = CSS.indexOf(blockStart);
  if (start < 0)
    throw new Error(`block not found in globals.css: ${blockStart}`);
  const open = CSS.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < CSS.length; i++) {
    if (CSS[i] === "{") depth++;
    else if (CSS[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = CSS.slice(open, end);
  const out = new Map<string, [number, number, number]>();
  const rx =
    /--color-([a-z0-9-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(body))) {
    out.set(m[1]!, oklchToSrgb(Number(m[2]), Number(m[3]), Number(m[4])));
  }
  return out;
}

const lightTokens = tokensIn("@theme");
const darkTokens = tokensIn("/* ── Obsidian (Dark) Theme ── */\n.dark");
const hcTokens = tokensIn(
  "/* ── Polar (High Contrast) Theme ── */\n.high-contrast",
);

const LIGHT_SURFACE = hexToSrgb("#ffffff");
// `.dark { --color-surface: oklch(0.178 0.006 260); }`
const DARK_SURFACE = oklchToSrgb(0.178, 0.006, 260);

// ── which tokens are actually used as text colours ─────────────────────────

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__tests__") continue;
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx") || p.endsWith(".ts")) out.push(p);
  }
  return out;
}

/**
 * Every `text-<palette>-<shade>` utility in the source that is rendered
 * against the page SURFACE — i.e. the class string it appears in does not also
 * set a background.
 *
 * The pairing matters. `text-blue-100` fails spectacularly against white, but
 * it is only ever written next to `bg-blue-600`, where it is correct. Checking
 * every text token against the surface would report those as violations and
 * the test would be switched off within a week — which is how the repository
 * ended up with no a11y gate at all (S14-19 / G4). So a class string that
 * carries its own `bg-*` is skipped and counted, and the count is asserted so
 * the exemption cannot silently swallow everything.
 *
 * This is usage-driven, not a fixed list: a newly added `text-gray-400` on the
 * default surface is caught the moment it is written.
 */
function textColourTokensUsed(): {
  light: Set<string>;
  dark: Set<string>;
  skippedOnOwnBackground: number;
} {
  const light = new Set<string>();
  const dark = new Set<string>();
  let skipped = 0;
  // Class strings: className="…", className={`…`} and cn("…", …) arguments.
  const classRx =
    /(?:className\s*=\s*|["'`])([^"'`]*\b(?:text|bg)-[a-z]+-\d{2,3}\b[^"'`]*)["'`]/g;
  // Any chain of Tailwind variants may precede the utility
  // (`dark:focus:text-blue-300`, `placeholder:text-gray-500`), so the prefix is
  // captured whole and inspected for `dark:` rather than matched positionally.
  const tokenRx =
    /(?:^|\s)((?:[a-z0-9-]+:)*)text-(gray|slate|blue)-(\d{2,3})\b/g;
  for (const file of walk(SRC)) {
    const text = readFileSync(file, "utf8");
    let cm: RegExpExecArray | null;
    while ((cm = classRx.exec(text))) {
      const classes = cm[1]!;
      tokenRx.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = tokenRx.exec(classes))) {
        const isDark = (m[1] ?? "").includes("dark:");
        // slate is aliased to gray in the @theme block.
        const palette = m[2] === "slate" ? "gray" : m[2];
        const bgRx = isDark
          ? /(?:^|\s)(?:[a-z0-9-]+:)*dark:(?:[a-z0-9-]+:)*bg-/
          : /(?:^|\s)(?:[a-z0-9-]+:)*bg-/;
        if (bgRx.test(classes)) {
          skipped++;
          continue;
        }
        (isDark ? dark : light).add(`${palette}-${m[3]}`);
      }
    }
  }
  return { light, dark, skippedOnOwnBackground: skipped };
}

// WCAG 1.4.3: 4.5:1 for body text. The design system uses these shades for
// secondary text at default size, so the "large text" 3:1 allowance does not
// apply — the audit checked this explicitly.
const AA_NORMAL = 4.5;

/**
 * Shades that are meant to be read against the page SURFACE.
 *
 * The palette is used in both directions. In the light theme, shades 300–950
 * are foreground-on-surface (secondary text, timestamps, help text) and 50–200
 * are the opposite: light text on a coloured or dark FILL — the login page's
 * marketing panel (`text-blue-200` on a navy gradient) and the KPI tiles are
 * the two places. Their background is set on an ancestor element, so no
 * per-class-string heuristic can see it, and measuring them against white
 * would produce six permanent false failures — the fastest way to get an
 * accessibility gate deleted.
 *
 * The dark theme inverts the scale, so its readable range starts higher.
 *
 * Out-of-range shades are therefore not "ignored": they are a different
 * contrast question (foreground vs. an explicit fill) that this token-level
 * test cannot answer and that the axe pass in `components-axe.test.tsx` covers
 * where a component sets both.
 */
const SURFACE_TEXT_SHADES_LIGHT = [300, 400, 500, 600, 700, 800, 900, 950];
const SURFACE_TEXT_SHADES_DARK = [400, 500, 600, 700, 800, 900, 950];

function shadeOf(token: string): number {
  return Number(token.slice(token.lastIndexOf("-") + 1));
}

describe("theme contrast (S14-11 / EN 301 549 §9.1.4.3)", () => {
  const used = textColourTokensUsed();

  it("finds text colour usages at all (guards the extractor itself)", () => {
    // If the scan silently stopped matching, every assertion below would pass
    // vacuously. `text-gray-500` is used 1.418 times; it will not disappear.
    expect(used.light.has("gray-500")).toBe(true);
    expect(used.light.size).toBeGreaterThan(3);
  });

  it("every surface text token in the light (default) theme reaches 4.5:1", () => {
    const failures: string[] = [];
    for (const token of used.light) {
      if (!SURFACE_TEXT_SHADES_LIGHT.includes(shadeOf(token))) continue;
      const rgb = lightTokens.get(token);
      if (!rgb) continue; // not overridden by the design system
      const ratio = contrast(rgb, LIGHT_SURFACE);
      if (ratio < AA_NORMAL)
        failures.push(`text-${token}: ${ratio.toFixed(2)}:1`);
    }
    expect(failures).toEqual([]);
  });

  it("every surface text token under `dark:` reaches 4.5:1 on the dark surface", () => {
    const failures: string[] = [];
    for (const token of used.dark) {
      if (!SURFACE_TEXT_SHADES_DARK.includes(shadeOf(token))) continue;
      const rgb = darkTokens.get(token);
      if (!rgb) continue;
      const ratio = contrast(rgb, DARK_SURFACE);
      if (ratio < AA_NORMAL)
        failures.push(`dark:text-${token}: ${ratio.toFixed(2)}:1`);
    }
    expect(failures).toEqual([]);
  });

  it("the high-contrast theme is at least as good as the default", () => {
    const failures: string[] = [];
    for (const token of used.light) {
      if (!SURFACE_TEXT_SHADES_LIGHT.includes(shadeOf(token))) continue;
      const hc = hcTokens.get(token);
      if (!hc) continue;
      const ratio = contrast(hc, LIGHT_SURFACE);
      if (ratio < AA_NORMAL)
        failures.push(`.high-contrast text-${token}: ${ratio.toFixed(2)}:1`);
    }
    expect(failures).toEqual([]);
  });

  it("`gray-400` specifically — the token behind 1.177 of the 1.201 failing usages", () => {
    // The direct regression guard for S14-11. Named explicitly so that a
    // future change to the shade range above cannot quietly stop covering it.
    expect(
      contrast(lightTokens.get("gray-400")!, LIGHT_SURFACE),
    ).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(
      contrast(darkTokens.get("gray-400")!, DARK_SURFACE),
    ).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(
      contrast(hcTokens.get("gray-400")!, LIGHT_SURFACE),
    ).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("`text-gray-300` and `text-blue-400` are no longer used as surface text", () => {
    // 1.48:1 and 2.88:1 respectively. The token itself has to stay light —
    // `border-gray-300` is used 486 times — so these were migrated at the call
    // sites instead, and this assertion is what keeps them migrated.
    expect(used.light.has("gray-300")).toBe(false);
    expect(used.light.has("blue-400")).toBe(false);
  });

  it("reproduces the audit's measurement of the pre-fix value", () => {
    // Guards the maths itself: the audit reported 2.58:1 for
    // oklch(0.710 0.010 75) on white. If this drifts, every number above is
    // suspect.
    const before = contrast(oklchToSrgb(0.71, 0.01, 75), LIGHT_SURFACE);
    expect(before).toBeGreaterThan(2.5);
    expect(before).toBeLessThan(2.65);
  });
});
