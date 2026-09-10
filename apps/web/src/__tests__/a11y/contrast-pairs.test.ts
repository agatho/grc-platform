// [ARCTOS-FULL-2026-08-31 · OP-049] Kontrast von Vordergrund UND Hintergrund,
// wenn beide in derselben Klassenzeichenkette stehen.
//
// ── Was OP-049 wirklich ist ──────────────────────────────────────────
//
// Gemeldet als „`bg-red-500` + kleiner weisser Text wurde nie systematisch
// gesucht; behoben ist nur `notification-bell.tsx`" (`E2E-TRIAGE-4.md` §9).
// Der Punkt steht im Register als TESTLÜCKE, und das ist genau richtig: der
// Einzelfall war behoben, die Frage war nie gestellt.
//
// Sie war auch nicht zu stellen. Der vorhandene Kontrast-Wächter
// (`theme-contrast.test.ts`, S14-11) misst Textfarben gegen die
// SEITENFLÄCHE und überspringt jede Klassenzeichenkette, die ihren eigenen
// `bg-*` mitbringt — mit ausdrücklicher und richtiger Begründung: gegen Weiss
// gemessen wäre `text-blue-100` ein Fehlalarm, obwohl es nur neben
// `bg-blue-600` vorkommt. Der übersprungene Eimer ist aber genau der, in dem
// `bg-red-500 text-white` liegt. Diese Datei leert ihn: sie nimmt die Paare,
// die der andere Wächter absichtlich stehen lässt, und misst sie gegeneinander
// statt gegen die Fläche.
//
// ── Woher die Farbwerte kommen ───────────────────────────────────────
//
// Aus derselben Quelle, aus der der Browser sie nimmt, und in derselben
// Rangfolge: zuerst `@theme` aus `styles/globals.css` (die Übersteuerungen des
// Designsystems für gray/slate/blue), dann `@theme default` aus
// `node_modules/tailwindcss/theme.css` für alles Übrige (rot, grün, gelb,
// orange …). Keine abgeschriebene Farbtabelle — eine abgeschriebene Tabelle
// misst ab dem nächsten `npm update` etwas anderes als das Produkt zeigt.
//
// ── Warum nur das helle Standardthema ────────────────────────────────
//
// Weil EN 301 549 die AUSGELIEFERTE Voreinstellung bewertet; so begründet es
// `theme-contrast.test.ts` für die `.high-contrast`-Fassung, und dieselbe
// Begründung gilt hier. Der Lauf über `.dark` ist gemacht und liefert 189
// weitere Paare — aber fast alle aus EINER Ursache: die Seiten schreiben
// `bg-white` als Literal statt `bg-surface`, und `white` kippt beim
// Themenwechsel nicht mit, während `--color-gray-*` sich umdreht. Das ist ein
// eigener, grösserer Befund über das Obsidian-Thema und keine Sammlung von
// 189 Einzelfehlern; er ist im Protokoll zu Welle 1c festgehalten und
// weitergereicht, statt hier in einen Sollstand geschrieben zu werden, den
// niemand abarbeiten kann.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const WEB = process.cwd(); // vitest-Wurzel = apps/web
const SRC = path.join(WEB, "src");
const UI = path.join(WEB, "..", "..", "packages", "ui", "src");
const BASELINE = path.join(
  SRC,
  "__tests__",
  "a11y",
  "contrast-pairs.baseline.json",
);

const GLOBALS = readFileSync(path.join(SRC, "styles", "globals.css"), "utf8");
const TAILWIND = readFileSync(
  path.join(WEB, "..", "..", "node_modules", "tailwindcss", "theme.css"),
  "utf8",
);

// ── Farbrechnung (identisch zu theme-contrast.test.ts) ──────────────────────

type Rgb = [number, number, number];

function oklchToSrgb(L: number, C: number, hDeg: number): Rgb {
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

function relativeLuminance([r, g, b]: Rgb): number {
  const f = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(fg: Rgb, bg: Rgb): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Liest `--color-<name>: oklch(…)` aus einem Block. Tailwind schreibt die
 * Helligkeit in Prozent (`oklch(63.7% …)`), `globals.css` als Anteil
 * (`oklch(0.548 …)`) — beide Schreibweisen sind gültiges CSS und beide kommen
 * hier vor.
 */
function tokensIn(css: string, blockStart: string): Map<string, Rgb> {
  const start = css.indexOf(blockStart);
  if (start < 0) throw new Error(`Block nicht gefunden: ${blockStart}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = css.slice(open, end);
  const out = new Map<string, Rgb>();
  const rx =
    /--color-([a-z0-9-]+):\s*oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(body))) {
    const L = m[3] === "%" ? Number(m[2]) / 100 : Number(m[2]);
    out.set(m[1]!, oklchToSrgb(L, Number(m[4]), Number(m[5])));
  }
  return out;
}

const TAILWIND_PALETTE = tokensIn(TAILWIND, "@theme default");
const DESIGN_SYSTEM = tokensIn(GLOBALS, "@theme");

/** Auflösung in der Rangfolge des Browsers: Designsystem schlägt Tailwind. */
function resolve(name: string): Rgb | null {
  if (name === "white") return [1, 1, 1];
  if (name === "black") return [0, 0, 0];
  // `--color-slate-*: var(--color-gray-*)` im @theme-Block.
  const key = name.replace(/^slate-/, "gray-");
  return DESIGN_SYSTEM.get(key) ?? TAILWIND_PALETTE.get(key) ?? null;
}

// ── Schwellenwert je Fundstelle ────────────────────────────────────────────

const SIZE_PX: Record<string, number> = {
  "text-xs": 12,
  "text-sm": 14,
  "text-base": 16,
  "text-lg": 18,
  "text-xl": 20,
  "text-2xl": 24,
  "text-3xl": 30,
  "text-4xl": 36,
  "text-5xl": 48,
  "text-6xl": 60,
  "text-7xl": 72,
  "text-8xl": 96,
  "text-9xl": 128,
};

/**
 * WCAG 1.4.3: 4,5:1, ausser bei „grossem Text" — ab 18 pt (24 px) normal oder
 * 14 pt (18,66 px) fett; dann genügen 3:1. Ohne Grössenklasse gilt die
 * Grundschrift, 16 px.
 *
 * Die Ausnahme wird hier bewusst eng gefasst: `text-lg` sind 18 px, und 18 px
 * fett sind 13,5 pt — knapp UNTER der Grenze. Ein Wächter, der grosszügig
 * rundet, spricht Fundstellen frei, die axe im Browser meldet.
 */
function threshold(classes: string): {
  px: number;
  bold: boolean;
  min: number;
} {
  let px = 16;
  const arb = classes.match(
    /(?:^|\s)(?:[a-z0-9-]+:)*text-\[(\d+(?:\.\d+)?)px\]/,
  );
  if (arb) px = Number(arb[1]);
  else {
    for (const [cls, size] of Object.entries(SIZE_PX)) {
      if (new RegExp(`(?:^|\\s)(?:[a-z0-9-]+:)*${cls}\\b`).test(classes)) {
        px = size;
        break;
      }
    }
  }
  const bold =
    /(?:^|\s)(?:[a-z0-9-]+:)*font-(semibold|bold|extrabold|black)\b/.test(
      classes,
    );
  const large = px >= 24 || (bold && px >= 18.66);
  return { px, bold, min: large ? 3.0 : 4.5 };
}

// ── Fundstellensuche ───────────────────────────────────────────────────────

const PALETTES =
  "gray|slate|blue|red|green|yellow|amber|orange|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose|lime|stone|neutral|zinc";
const COLOR = `(?:white|black|(?:${PALETTES})-\\d{2,3})`;

interface Pair {
  file: string;
  line: number;
  fg: string;
  bg: string;
  ratio: number;
  min: number;
  px: number;
  bold: boolean;
}

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__tests__") continue;
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (p.endsWith(".tsx") || p.endsWith(".ts")) out.push(p);
  }
  return out;
}

/**
 * Letzte Nennung gewinnt — so verhält sich auch CSS bei gleicher Spezifität,
 * und so schreiben die Dateien es: `cn("bg-gray-100", aktiv && "bg-blue-600")`.
 * Ausdrücklich NICHT berücksichtigt sind Varianten mit Präfix (`hover:`,
 * `dark:`, `group-hover:`): sie beschreiben einen anderen Zustand oder ein
 * anderes Thema und lassen sich nicht mit dem Grundzustand mischen, ohne
 * Paare zu erfinden, die es nie gleichzeitig gibt.
 */
function lastUnprefixed(classes: string, util: string): string | null {
  const rx = new RegExp(
    `(?:^|\\s)${util}-(${COLOR})(?:\\/\\d+)?(?=\\s|$)`,
    "g",
  );
  let m: RegExpExecArray | null;
  let last: string | null = null;
  while ((m = rx.exec(classes))) last = m[1]!;
  return last;
}

function scan(): Pair[] {
  const found: Pair[] = [];
  const classRx =
    /(?:className\s*=\s*|["'`])([^"'`]*\b(?:text|bg|from|to)-[a-z]+(?:-\d{2,3})?\b[^"'`]*)["'`]/g;

  const roots: Array<[string, string]> = [
    [SRC, ""],
    [UI, "packages/ui/src/"],
  ];
  for (const [root, prefix] of roots) {
    for (const file of sources(root)) {
      const text = readFileSync(file, "utf8");
      const lineStarts = [0];
      for (let i = 0; i < text.length; i++)
        if (text[i] === "\n") lineStarts.push(i + 1);
      const lineOf = (idx: number) => {
        let lo = 0;
        let hi = lineStarts.length - 1;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (lineStarts[mid]! <= idx) lo = mid;
          else hi = mid - 1;
        }
        return lo + 1;
      };

      classRx.lastIndex = 0;
      let cm: RegExpExecArray | null;
      while ((cm = classRx.exec(text))) {
        const classes = cm[1]!;
        const fgName = lastUnprefixed(classes, "text");
        if (!fgName) continue;
        // Ein Verlauf hat keinen einen Hintergrund — beide Enden zählen,
        // denn der Text steht über beiden (`from-red-500 to-red-600`).
        const bgNames = ["bg", "from", "to"]
          .map((u) => lastUnprefixed(classes, u))
          .filter((n): n is string => n !== null);
        if (bgNames.length === 0) continue;
        const fg = resolve(fgName);
        if (!fg) continue;
        const th = threshold(classes);
        for (const bgName of new Set(bgNames)) {
          const bg = resolve(bgName);
          if (!bg) continue;
          const ratio = contrast(fg, bg);
          if (ratio < th.min) {
            found.push({
              file:
                prefix + path.relative(root, file).split(path.sep).join("/"),
              line: lineOf(cm.index),
              fg: fgName,
              bg: bgName,
              ratio: Math.round(ratio * 100) / 100,
              min: th.min,
              px: th.px,
              bold: th.bold,
            });
          }
        }
      }
    }
  }
  return found;
}

// ── Der Wächter ────────────────────────────────────────────────────────────

describe("OP-049 · Vordergrund/Hintergrund-Paare im hellen Standardthema", () => {
  const pairs = scan();
  const counts: Record<string, number> = {};
  for (const p of pairs) counts[p.file] = (counts[p.file] ?? 0) + 1;

  if (process.env.CONTRAST_PAIRS_UPDATE === "1") {
    const sortiert: Record<string, number> = {};
    for (const f of Object.keys(counts).sort()) sortiert[f] = counts[f]!;
    writeFileSync(
      BASELINE,
      JSON.stringify({ files: sortiert }, null, 2) + "\n",
    );
  }
  const baseline: Record<string, number> = JSON.parse(
    readFileSync(BASELINE, "utf8"),
  ).files;

  it("die Farbtabellen sind da (sonst prüft alles Weitere leer)", () => {
    // Ohne diese Zusicherung wäre ein leerer `@theme default`-Block ein
    // grüner Lauf statt eines Fehlers — genau die Falle, in die Welle 0 bei
    // zwei anderen Toren gelaufen ist.
    expect(TAILWIND_PALETTE.size).toBeGreaterThan(200);
    expect(DESIGN_SYSTEM.get("gray-400")).toBeDefined();
    // Die Messung selbst, gegen den Wert, den axe auf der laufenden Instanz
    // gemeldet hat: weiss auf `bg-red-500` (#fb2c36) = 3,8:1
    // (E2E-TRIAGE-4 §6.2.2).
    const weissAufRot500 = contrast([1, 1, 1], resolve("red-500")!);
    expect(weissAufRot500).toBeGreaterThan(3.75);
    expect(weissAufRot500).toBeLessThan(3.9);
    // und die dort gewählte Abhilfe, ebenfalls nachgerechnet: 6,5:1.
    expect(contrast([1, 1, 1], resolve("red-700")!)).toBeGreaterThan(6.3);
  });

  it("die Suche findet überhaupt Paare (Wächter über den Wächter)", () => {
    // `scan()` liefert nur VERSTÖSSE. Bleibt der Bestand irgendwann bei
    // null, muss diese Zusicherung durch eine über die Zahl der GEPRÜFTEN
    // Paare ersetzt werden — bis dahin ist ein leeres Ergebnis ein Zeichen
    // dafür, dass die Klassensuche nicht mehr greift, nicht dafür, dass
    // alles behoben ist.
    expect(Object.keys(baseline).length).toBeGreaterThan(0);
  });

  it("die Designsystem-Bausteine sind frei — dort gilt keine Duldung", () => {
    // `components/**` und `packages/ui/**` sind die Stellen, an denen ein
    // einziges Klassenpaar in Hunderte Seiten eingeht. Der destruktive
    // Knopf und der destruktive Badge standen beide auf `red-500`; das war
    // dieselbe Kombination wie am Benachrichtigungszähler, nur mit sehr
    // viel grösserer Reichweite.
    const rest = Object.keys(counts).filter(
      (f) => f.startsWith("components/") || f.startsWith("packages/ui/"),
    );
    expect(rest).toEqual([]);
  });

  it("keine NEUE Datei mit unterschrittenen Paaren", () => {
    const neu = Object.keys(counts)
      .filter((f) => baseline[f] === undefined)
      .sort();
    expect(
      neu,
      `Neue Fundstellen:\n${pairs
        .filter((p) => baseline[p.file] === undefined)
        .map(
          (p) =>
            `  ${p.file}:${p.line}  text-${p.fg} auf bg-${p.bg} = ${p.ratio}:1 ` +
            `(gefordert ${p.min}:1 bei ${p.px}px${p.bold ? " fett" : ""})`,
        )
        .join("\n")}`,
    ).toEqual([]);
  });

  it("keine Datei mit MEHR unterschrittenen Paaren als im Sollstand", () => {
    const gestiegen = Object.entries(counts)
      .filter(([f, n]) => baseline[f] !== undefined && n > baseline[f]!)
      .map(([f, n]) => `${f}: ${baseline[f]} → ${n}`);
    expect(gestiegen).toEqual([]);
  });

  it("der Sollstand nennt keine Datei, die sauber ist", () => {
    const erledigt = Object.entries(baseline)
      .filter(([f, n]) => (counts[f] ?? 0) < n)
      .map(([f, n]) => `${f}: ${n} → ${counts[f] ?? 0}`);
    expect(
      erledigt,
      "Behoben — bitte contrast-pairs.baseline.json nachziehen " +
        "(CONTRAST_PAIRS_UPDATE=1 npx vitest run src/__tests__/a11y/contrast-pairs.test.ts).",
    ).toEqual([]);
  });
});
