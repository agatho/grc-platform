/**
 * [ARCTOS-FULL-2026-08-31 / Welle 8b · OP-202, OP-203]
 *
 * Welle 6b hat zwei Reste beziffert statt behoben, und beide sind hier dran:
 *
 *   OP-203 — 18 Dateien formatierten Geld mit `new Intl.NumberFormat("de-DE",
 *            { style: "currency" })`. Das Mittel (`formatCurrency` in
 *            `lib/format-date.ts`) hat Welle 6b bereitgestellt; angeschlossen
 *            war es an genau EINER Stelle.
 *   OP-202 — 11 Dateien banden next-intl an eine Kennung und riefen sie nie
 *            auf. Der Zaehler erkennt diese Form seit Welle 6b
 *            (`bindsButNeverCalls`), sie stecken also in der 118.
 *
 * Geprueft werden EIGENSCHAFTEN, nicht Importe — dieselbe Regel wie in
 * Welle 5a und 6b, und sie ist der Grund, warum OP-202 ueberhaupt gefunden
 * wurde: ein `useTranslations`, das niemand aufruft, senkt die Ratsche und
 * aendert am Bildschirm nichts.
 *
 *   §1 Die 18 Geldstellen benutzen `formatCurrency` und formatieren nicht
 *      mehr mit fest verdrahtetem Gebietsschema.
 *   §2 KEIN Pfad im Bildschirmbereich formatiert mehr mit
 *      `Intl.*Format("xx-XX")` — ohne Ausnahmeliste. Welle 6b musste 18
 *      Dateien namentlich fuehren; mit dieser Welle faellt die Liste.
 *   §3 Die 11 umgestellten Oberflaechen binden next-intl, RUFEN die Bindung
 *      auf und tragen keinen satzfoermigen Text mehr.
 *   §4 KEINE Datei im Bildschirmbereich bindet next-intl, ohne mindestens
 *      eine Bindung aufzurufen — baumweit, ohne Ausnahme.
 *   §5 Jeder Schluessel der bespielten Namensraeume liegt in BEIDEN
 *      Katalogen, und DE und EN sind nicht wortgleich (OP-072).
 *   §6 `risks/[id]` formatierte Geld auf `"en-US"` — der umgekehrte Fall von
 *      OP-203: ein DEUTSCHER Leser sah "€1,234". Die Funktion nimmt das
 *      Gebietsschema jetzt als Parameter.
 *   §7 Der Katalog war auch hier schon da: `dpms.tia.legalBasisValues.*`,
 *      `assets.tiers.*`, `isms.vulnerabilityStatus.*` lagen in beiden
 *      Sprachen und wurden von einer deutschen Zweitfassung verdraengt.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const WEB = path.join(__dirname, "../../..");
const SRC = path.join(WEB, "src");
const MESSAGES = path.join(WEB, "messages");

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /(^|[^:])\/\/[^\n]*/g;

function code(rel: string): string {
  const p = path.join(SRC, rel);
  if (!existsSync(p)) throw new Error(`Datei fehlt: ${rel}`);
  return readFileSync(p, "utf8")
    .replace(BLOCK_COMMENT, "")
    .replace(LINE_COMMENT, "$1");
}

/** Die 18 Dateien aus §4.2 von `docs/UMSETZUNG-WELLE-6B.md`. */
const CURRENCY_FILES = [
  "app/(dashboard)/bcms/bia/[id]/page.tsx",
  "app/(dashboard)/bcms/strategies/page.tsx",
  "app/(dashboard)/billing/page.tsx",
  "app/(dashboard)/billing/plans/page.tsx",
  "app/(dashboard)/contracts/[id]/page.tsx",
  "app/(dashboard)/contracts/list/page.tsx",
  "app/(dashboard)/contracts/page.tsx",
  "app/(dashboard)/eam/dashboards/cost-management/page.tsx",
  "app/(dashboard)/erm/fair/compare/page.tsx",
  "app/(dashboard)/erm/fair/portfolio/page.tsx",
  "app/(dashboard)/erm/fair/top-risks/page.tsx",
  "app/(dashboard)/erm/risks/[id]/fair/page.tsx",
  "app/(dashboard)/erm/risks/[id]/fair/results/page.tsx",
  "app/(dashboard)/esg/climate-scenarios/page.tsx",
  "app/(dashboard)/esg/taxonomy/page.tsx",
  "app/(dashboard)/risks/[id]/page.tsx",
  "app/(dashboard)/tax-cms/audit-preps/page.tsx",
  "app/(dashboard)/tax-cms/page.tsx",
];

/** Die 11 Dateien mit Scheinbindung aus §4.1 von Welle 6b. */
const FAKE_BINDING_FILES = [
  "app/(dashboard)/access-reviews/page.tsx",
  "app/(dashboard)/connectors/[id]/page.tsx",
  "app/(dashboard)/dpms/tia/[id]/page.tsx",
  "app/(dashboard)/esg/climate-scenarios/page.tsx",
  "app/(dashboard)/esg/materiality/page.tsx",
  "app/(dashboard)/esg/taxonomy/page.tsx",
  "app/(dashboard)/isms/assets/[id]/page.tsx",
  "app/(dashboard)/isms/threats/[id]/page.tsx",
  "app/(dashboard)/isms/vulnerabilities/[id]/page.tsx",
  "app/(dashboard)/tprm/risks/page.tsx",
  "components/catalog/catalog-workqueue.tsx",
];

const FIXED_LOCALE = /Intl\.[A-Za-z]*Format\(\s*["'][a-z]{2}-[A-Z]{2}["']/;

/**
 * Satzfoermiger Text — dieselbe Definition wie in Welle 5a und 6b.
 * `CODEISH` haelt TypeScript-Generika (`useState<Foo>(null)`) heraus.
 */
const TAILWINDISH = /^[a-z0-9:/[\]\-.%()#&_,'"+*<>=@!~ ]+$/;
const CODEISH = /[=;(){}[\]]|^[,).]|\.\w+\(|=>/;

/**
 * Namentliche Ausnahmen, jede mit ihrem Grund — absichtlich HIER und nicht im
 * Quelltext. Diese Welle braucht genau eine.
 */
const ALLOWED: Record<string, string[]> = {
  // KEIN Anzeigetext: die Zeichenkette ist der Vergleichswert eines
  // Datenfeldes (`catalogType === "risk"`), nicht die Beschriftung. Die
  // Beschriftung daneben kommt aus `catalogs.workqueue.createRisk` /
  // `…createControl` — bewusst ZWEI Schluessel statt einer zusammengesetzten
  // Zeichenkette, weil "Risiko erstellen" in anderen Sprachen keine
  // Aneinanderreihung von "Risiko" und "erstellen" ist.
  "components/catalog/catalog-workqueue.tsx": [],
};

function literalText(rel: string, src: string): string[] {
  const allowed = ALLOWED[rel] ?? [];
  const found: string[] = [];
  for (const m of src.matchAll(/>\s*([^<>{}\n][^<>{}]*)</g)) {
    const t = m[1].trim();
    if (CODEISH.test(t)) continue;
    if (/\p{Lu}/u.test(t) && /\s/.test(t)) found.push(t);
  }
  for (const m of src.matchAll(
    /["'`]([^"'`\n]*\p{L}[^"'`\n]* [^"'`\n]*\p{L}[^"'`\n]*)["'`]/gu,
  )) {
    const t = m[1].trim();
    if (!TAILWINDISH.test(t) && /^\p{Lu}/u.test(t)) found.push(t);
  }
  return found.filter((t) => !allowed.includes(t));
}

/**
 * Dieselbe Regel wie `bindsButNeverCalls` in `scripts/audit-i18n-usage.mjs`,
 * mit zwei Verschaerfungen und einer Praezisierung.
 *
 * Verschaerft: geprueft wird je BINDUNG, nicht „alle Bindungen einer Datei".
 * Eine Datei mit einem benutzten und einem toten `t` faellt dem Zaehler nicht
 * auf und ist trotzdem derselbe Sachverhalt — drei Dateien sahen so aus.
 *
 * Praezisiert: „benutzt" heisst hier, dass die Kennung ausserhalb ihrer
 * eigenen Deklaration ueberhaupt VORKOMMT, nicht dass sie an Ort und Stelle
 * AUFGERUFEN wird. `assets/page.tsx` reicht `tCia` als Eigenschaft an drei
 * Unterkomponenten weiter, die es dort aufrufen — die Bindung lebt, nur
 * nicht in dieser Datei. Eine Regel, die das als Fund meldet, wird
 * abgeschaltet; die tote Bindung erkennt man auch so, denn sie kommt genau
 * einmal vor: in ihrer eigenen Zeile.
 */
function deadBindings(src: string): string[] {
  const names = [
    ...src.matchAll(
      /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(/g,
    ),
  ].map((m) => m[1]);
  return names.filter(
    (n) =>
      [...src.matchAll(new RegExp(`(?<![\\w$.])${escapeRegex(n)}\\b`, "g"))]
        .length <= 1,
  );
}

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkTsx(p, out);
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const SCREEN_ROOTS = [
  path.join(SRC, "app/(dashboard)"),
  path.join(SRC, "app/(portal)"),
  path.join(SRC, "components"),
];

// ── Katalog ────────────────────────────────────────────────────────────────

function leaves(obj: unknown, prefix: string, out: Set<string>): void {
  if (!obj || typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) leaves(v, key, out);
    else out.add(key);
  }
}

function readNs(locale: string, file: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.join(MESSAGES, locale, `${file}.json`), "utf8"),
  ) as Record<string, unknown>;
}

function nsLeaves(locale: string, file: string): Set<string> {
  const out = new Set<string>();
  leaves(readNs(locale, file), "", out);
  return out;
}

// ───────────────────────────────────────────────────────────────────────────

/** Vollstaendiges Escaping fuer einen in ein RegExp interpolierten Bezeichner.
 *  Gleiche Form wie `escapeRegex` in
 *  `src/components/bpmn/arctos-grc-extractor.ts`. Vorher stand hier
 *  `name.replace(/\$/g, "\\$")` — nur `$`, und damit eine Zusicherung, die
 *  weniger haelt als sie sagt (OP-257, js/incomplete-sanitization). */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("Welle 8b §1 — OP-203: die 18 Geldformatierer", () => {
  for (const rel of CURRENCY_FILES) {
    it(`${rel} formatiert Geld ueber das gemeinsame Mittel`, () => {
      const src = code(rel);
      expect(src).toMatch(/formatCurrency|useDateFormat/);
      expect(FIXED_LOCALE.test(src)).toBe(false);
    });
  }
});

describe("Welle 8b §2 — kein festes Gebietsschema, ohne Ausnahmeliste", () => {
  it("kein Pfad im Bildschirmbereich formatiert mit Intl.*Format('xx-XX')", () => {
    const offenders: string[] = [];
    for (const root of SCREEN_ROOTS) {
      for (const p of walkTsx(root)) {
        const src = readFileSync(p, "utf8")
          .replace(BLOCK_COMMENT, "")
          .replace(LINE_COMMENT, "$1");
        if (FIXED_LOCALE.test(src)) offenders.push(path.relative(SRC, p));
      }
    }
    // Welle 6b hat hier 18 Dateien NAMENTLICH gefuehrt und auf Gleichheit
    // geprueft. Die Liste ist mit dieser Welle leer — und darum steht sie
    // nicht mehr da. Eine Ausnahmeliste, die niemand mehr braucht, ist eine
    // Einladung, die naechste Ausnahme hineinzuschreiben.
    expect(offenders.sort()).toEqual([]);
  });

  it("das Mittel existiert und traegt den Waehrungscode als Pflichtargument", () => {
    const lib = code("lib/format-date.ts");
    expect(lib).toMatch(/export function formatCurrency\(/);
    expect(lib).toMatch(/currency: string,/);
    expect(lib).toMatch(/formatCurrency: \(/);
  });
});

describe("Welle 8b §3 — OP-202: die 11 Oberflaechen mit Scheinbindung", () => {
  for (const rel of FAKE_BINDING_FILES) {
    it(`${rel} bindet next-intl UND ruft die Bindung auf`, () => {
      const src = code(rel);
      expect(src).toMatch(/useTranslations\s*\(/);
      expect(deadBindings(src)).toEqual([]);
    });

    it(`${rel} traegt keinen satzfoermigen Text mehr`, () => {
      expect(literalText(rel, code(rel))).toEqual([]);
    });
  }
});

describe("Welle 8b §4 — keine tote next-intl-Bindung im Bildschirmbereich", () => {
  it("jede gebundene Kennung wird mindestens einmal aufgerufen", () => {
    const offenders: string[] = [];
    for (const root of SCREEN_ROOTS) {
      for (const p of walkTsx(root)) {
        const src = readFileSync(p, "utf8")
          .replace(BLOCK_COMMENT, "")
          .replace(LINE_COMMENT, "$1");
        const dead = deadBindings(src);
        if (dead.length)
          offenders.push(`${path.relative(SRC, p)}: ${dead.join(",")}`);
      }
    }
    // Schaerfer als der Zaehler: `bindsButNeverCalls` verlangt, dass ALLE
    // Bindungen einer Datei tot sind. Drei Dateien trugen eine tote NEBEN
    // einer benutzten — fuer den Zaehler unsichtbar, fuer die naechste
    // Scheinbindung der ideale Platz.
    expect(offenders.sort()).toEqual([]);
  });
});

describe("Welle 8b §5 — OP-072: beide Kataloge, und nicht wortgleich", () => {
  for (const ns of ["common", "connectors", "esg-advanced"]) {
    it(`${ns}: DE und EN fuehren dieselben Schluessel`, () => {
      const de = [...nsLeaves("de", ns)].sort();
      const en = [...nsLeaves("en", ns)].sort();
      expect(de.filter((k) => !en.includes(k))).toEqual([]);
      expect(en.filter((k) => !de.includes(k))).toEqual([]);
    });
  }

  it("die neuen Knoten sind uebersetzt und nicht kopiert", () => {
    const de = readNs("de", "common") as Record<string, never>;
    const en = readNs("en", "common") as Record<string, never>;
    const paths = [
      ["accessReview", "title"],
      ["tprm", "riskOverview", "title"],
      ["assets", "detail", "notClassified"],
      ["isms", "vulnDetail", "noAsset"],
      ["dpms", "tia", "detail", "riskMedium"],
      ["catalogs", "workqueue", "empty"],
    ];
    for (const p of paths) {
      const pick = (o: unknown) =>
        p.reduce<unknown>(
          (acc, k) => (acc as Record<string, unknown> | undefined)?.[k],
          o,
        );
      const d = pick(de);
      const e = pick(en);
      expect(typeof d, p.join(".")).toBe("string");
      expect(typeof e, p.join(".")).toBe("string");
      expect(d, p.join(".")).not.toBe(e);
    }
  });
});

describe("Welle 8b §6 — der umgekehrte Fall von OP-203", () => {
  it("risks/[id] formatiert Geld nicht mehr fest auf en-US", () => {
    const src = code("app/(dashboard)/risks/[id]/page.tsx");
    expect(src).not.toMatch(/["']en-US["']/);
    // Die Funktion steht ausserhalb der Komponente; das Gebietsschema kommt
    // als Parameter — nicht aus einem Hook, den sie nicht lesen kann.
    expect(src).toMatch(/function formatCurrency\(\s*locale: string,/);
  });
});

describe("Welle 8b §7 — der Katalog war schon da", () => {
  // Welle 5a hat gemessen, dass 185 „tote" Schluessel wortgleich als Literal
  // in den Seiten standen, die als „ohne i18n" galten. Welle 6b hat fuer
  // ihre vier Bereiche gemessen, dass sich das dort NICHT wiederholt. Hier
  // wiederholt es sich: drei fertige, zweisprachige Knoten wurden von einer
  // deutschen Zweitfassung im Quelltext verdraengt.
  const reuse: Array<[string, string]> = [
    ["app/(dashboard)/dpms/tia/[id]/page.tsx", "tia.legalBasisValues."],
    ["app/(dashboard)/isms/assets/[id]/page.tsx", "tiers."],
    [
      "app/(dashboard)/isms/vulnerabilities/[id]/page.tsx",
      "vulnerabilityStatus.",
    ],
  ];
  for (const [rel, key] of reuse) {
    it(`${rel} benutzt ${key}* statt einer Zweitfassung`, () => {
      expect(code(rel)).toContain(key);
    });
  }

  it("die verdraengten Knoten liegen in beiden Sprachen", () => {
    for (const locale of ["de", "en"]) {
      const l = nsLeaves(locale, "common");
      expect(l.has("dpms.tia.legalBasisValues.adequacy")).toBe(true);
      expect(l.has("assets.tiers.primary_asset")).toBe(true);
      expect(l.has("isms.vulnerabilityStatus.accepted_risk")).toBe(true);
    }
  });
});
