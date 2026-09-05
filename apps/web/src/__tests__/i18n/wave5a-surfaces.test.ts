/**
 * [ARCTOS-FULL-2026-08-31 / Welle 5a · OP-070]
 *
 * OP-070 zaehlt Dateien „ohne i18n-Anbindung". Diese Zahl ist ein
 * Stellvertreter, und ein Stellvertreter laesst sich befriedigen, ohne dass
 * die Sache besser wird: ein `useTranslations`-Import, den niemand benutzt,
 * senkt die Ratsche und aendert am Bildschirm nichts. Diese Datei prueft
 * deshalb nicht den Import, sondern drei nachpruefbare Eigenschaften der in
 * dieser Welle umgestellten Oberflaechen:
 *
 *   1. Sie binden next-intl UND enthalten keinen satzfoermigen Text mehr im
 *      Quelltext (§1).
 *   2. Sie formatieren Zahlen und Datumsangaben nicht mit einem fest
 *      verdrahteten Gebietsschema (§2).
 *   3. Jeder Schluessel, den sie ansprechen, liegt in BEIDEN Katalogen (§3) —
 *      das ist der Defekt aus OP-072: fehlt der Schluessel in einer Sprache,
 *      sieht der Nutzer den Rohschluessel.
 *
 * Und §4 haelt den Befund fest, der die Umstellung ueberhaupt erst moeglich
 * gemacht hat: die Uebersetzungen der Portalseiten lagen bereits vollstaendig
 * im Katalog und wurden von keiner Aufrufstelle erreicht.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const WEB = path.join(__dirname, "../../..");
const SRC = path.join(WEB, "src");
const MESSAGES = path.join(WEB, "messages");

/** Die Oberflaechen, die Welle 5a umgestellt hat. */
const CONVERTED = [
  // Rahmen, der auf JEDER Seite mitlaeuft
  "components/layout/legal-footer.tsx",
  "components/layout/header.tsx",
  "components/ui/data-table.tsx",
  "components/ui/dialog.tsx",
  "components/ui/empty-cell.tsx",
  "components/ui/tag-input.tsx",
  // Externe, nicht angemeldete Besucher
  "app/(portal)/layout.tsx",
  "app/(portal)/dd/expired/page.tsx",
  "app/(portal)/dd/[token]/complete/page.tsx",
  "app/(portal)/report/[orgCode]/page.tsx",
  "app/(portal)/report/mailbox/[token]/page.tsx",
  "app/(portal)/trust/[orgCode]/page.tsx",
  "app/invite/[token]/page.tsx",
  // Startbildschirm
  "components/dashboard/dashboard-widget-frame.tsx",
  "components/dashboard/widgets/countdown-widget.tsx",
  "components/dashboard/widgets/data-table-widget.tsx",
];

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /(^|[^:])\/\/[^\n]*/g;

function code(rel: string): string {
  const p = path.join(SRC, rel);
  if (!existsSync(p)) throw new Error(`Datei fehlt: ${rel}`);
  return readFileSync(p, "utf8")
    .replace(BLOCK_COMMENT, "")
    .replace(LINE_COMMENT, "$1");
}

/**
 * Satzfoermiger Text: ein JSX-Textknoten oder ein Zeichenkettenliteral mit
 * mindestens zwei Woertern, das mit einem Grossbuchstaben beginnt und keine
 * Tailwind-Klassenkette ist. Bewusst enger als der Stellvertreter in
 * `scripts/audit-i18n-usage.mjs` — hier soll er auf ECHTEN Text zeigen.
 *
 * `CODEISH` ist der Grund, warum diese Pruefung mehr ist als ein `grep`: ein
 * TypeScript-Generikum wie `useState<Foo>(null)` sieht fuer eine naive
 * „zwischen `>` und `<`"-Regel wie ein JSX-Textknoten aus. Ohne diesen Filter
 * meldet der Test in JEDER Datei mit generischem Zustand einen Fund, und ein
 * Test, der immer meldet, wird abgeschaltet.
 */
const TAILWINDISH = /^[a-z0-9:/[\]\-.%()#&_,'"+*<>=@!~ ]+$/;
const CODEISH = /[=;(){}[\]]|^[,).]|\.\w+\(|=>/;

/**
 * Namentliche Ausnahmen, jede mit ihrem Grund. Die Liste ist absichtlich
 * kurz und absichtlich HIER und nicht im Quelltext der Komponenten: eine
 * Ausnahme, die im Test steht, muss beim Lesen des Tests begruendet werden.
 */
const ALLOWED: Record<string, string[]> = {
  // Eigenname des Produkts — wird in keiner Sprache uebersetzt.
  "app/invite/[token]/page.tsx": ["ARCTOS GRC Platform"],
  // KEIN Anzeigetext: die Zeichenkette wird mit dem Fehlerschluessel der
  // Route VERGLICHEN (`error === "Module not activated"`), um zwischen zwei
  // Katalogmeldungen zu waehlen. Uebersetzt gehoert das Ergebnis des
  // Vergleichs, nicht sein Operand.
  "components/dashboard/dashboard-widget-frame.tsx": ["Module not activated"],
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

describe("[OP-070] Welle 5a — die umgestellten Oberflaechen", () => {
  // ── §1 ───────────────────────────────────────────────────────────────────
  it.each(CONVERTED)("%s bindet next-intl", (rel) => {
    expect(code(rel)).toMatch(/\b(useTranslations|getTranslations)\s*\(/);
  });

  it.each(CONVERTED)("%s traegt keinen satzfoermigen Text mehr", (rel) => {
    expect(literalText(rel, code(rel))).toEqual([]);
  });

  // ── §2 ───────────────────────────────────────────────────────────────────
  //
  // Die zweite, unsichtbarere Haelfte von OP-070. Eine Datei kann jeden Satz
  // aus dem Katalog holen und dem englischen Leser trotzdem „1.234,5" und
  // „31.12.2026" zeigen, wenn sie `toLocaleString("de-DE")` schreibt. Die
  // i18n-Ratsche sieht das nicht: sie prueft den Import, nicht das
  // Gebietsschema.
  const LOCALE_SENSITIVE = [
    ...CONVERTED,
    "components/dashboard/widgets/bar-chart-widget.tsx",
    "components/dashboard/widgets/line-chart-widget.tsx",
    "components/dashboard/widgets/donut-chart-widget.tsx",
    "components/dashboard/widgets/radar-chart-widget.tsx",
    "components/dashboard/widgets/gauge-widget.tsx",
    "components/dashboard/widgets/kpi-card-widget.tsx",
  ];

  it.each(LOCALE_SENSITIVE)(
    "%s formatiert nicht mit einem fest verdrahteten Gebietsschema",
    (rel) => {
      const hits = [
        ...code(rel).matchAll(
          /toLocale[A-Za-z]*\(\s*["'][a-z]{2}-[A-Z]{2}["']/g,
        ),
      ].map((m) => m[0]);
      expect(hits).toEqual([]);
    },
  );

  /**
   * Und derselbe Wachposten fuer den ganzen Baum, den diese Welle erreicht
   * hat. `app/api/**` und `src/lib/**` liegen ausserhalb der Dateihoheit von
   * Welle 5a und sind deshalb ausgenommen — mit ihrer Zahl, damit die Ausnahme
   * beim naechsten Lesen beziffert ist und nicht bloss behauptet.
   */
  it("kein Bildschirmpfad unter app/(dashboard) und components formatiert mit festem Gebietsschema", () => {
    const roots = [
      path.join(SRC, "app/(dashboard)"),
      path.join(SRC, "app/(portal)"),
      path.join(SRC, "components"),
    ];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(p) && !p.endsWith(".test.tsx")) {
          const src = readFileSync(p, "utf8")
            .replace(BLOCK_COMMENT, "")
            .replace(LINE_COMMENT, "$1");
          for (const m of src.matchAll(
            /toLocale[A-Za-z]*\(\s*["'][a-z]{2}-[A-Z]{2}["']/g,
          )) {
            offenders.push(`${path.relative(SRC, p)}: ${m[0]}`);
          }
        }
      }
    };
    roots.forEach(walk);
    // Namentliche Ausnahme mit Grund: `admin/rls-audit` fuehrt seine eigene
    // Zweisprachigkeit (`const t = (de, en) => …`) und waehlt in JEDEM der
    // beiden Zweige das passende Tag — `de-DE` im deutschen, `en-US` im
    // englischen. Ein `numberLocale` an dieser Stelle machte die Datei nicht
    // richtiger, sondern inkonsistent: der deutsche Zweig folgte dann dem
    // Cookie, der englische bliebe fest. Die Datei gehoert vollstaendig auf
    // den Katalog umgestellt; das ist ein eigener Schnitt und steht als
    // solcher in `docs/UMSETZUNG-WELLE-5A.md`.
    const EXEMPT = ["app/(dashboard)/admin/rls-audit/page.tsx"];
    expect(
      offenders.filter((o) => !EXEMPT.some((e) => o.startsWith(e))),
    ).toEqual([]);
  });

  // ── §3 ───────────────────────────────────────────────────────────────────
  //
  // OP-072: ein Schluessel, der nur in einer Sprache existiert, rendert in der
  // anderen seinen eigenen Pfad als sichtbaren Text. Geprueft wird gegen die
  // Namensraum-DATEIEN, nicht gegen das gebaute Buendel — ein veraltetes
  // Buendel darf diesen Test nicht gruen faerben.
  function leaves(obj: unknown, prefix: string, out: Set<string>): void {
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) leaves(v, key, out);
      else out.add(key);
    }
  }

  function catalogue(locale: string): Set<string> {
    const out = new Set<string>();
    for (const file of ["common", "dashboard"]) {
      const p = path.join(MESSAGES, locale, `${file}.json`);
      const json = JSON.parse(readFileSync(p, "utf8"));
      // `common.json` wird in `src/i18n/request.ts` in die WURZEL gespreizt
      // und zusaetzlich als `common` gefuehrt; `dashboard.json` nur unter
      // seinem Namen.
      leaves(json, file === "common" ? "" : file, out);
      if (file === "common") leaves(json, "common", out);
    }
    return out;
  }

  /** Die Namensraeume, die diese Welle neu oder erweitert bespielt. */
  const TOUCHED_NAMESPACES = [
    "table",
    "footer",
    "a11y",
    "tags",
    "localeSwitch",
    "portal",
    "wbPortal",
    "trust",
    "dashboard.widget",
  ];

  it("jeder Schluessel der bespielten Namensraeume liegt in DE und EN", () => {
    const de = catalogue("de");
    const en = catalogue("en");
    const inScope = (k: string) =>
      TOUCHED_NAMESPACES.some((ns) => k === ns || k.startsWith(`${ns}.`));

    const onlyDe = [...de].filter((k) => inScope(k) && !en.has(k));
    const onlyEn = [...en].filter((k) => inScope(k) && !de.has(k));

    expect({ onlyDe, onlyEn }).toEqual({ onlyDe: [], onlyEn: [] });
  });

  it("kein bespielter Schluessel ist in beiden Sprachen wortgleich leer", () => {
    for (const locale of ["de", "en"]) {
      const p = path.join(MESSAGES, locale, "common.json");
      const json = JSON.parse(readFileSync(p, "utf8")) as Record<
        string,
        unknown
      >;
      for (const ns of ["portal", "wbPortal", "trust", "localeSwitch"]) {
        const node = json[ns];
        expect(node, `${locale}: ${ns} fehlt`).toBeTruthy();
        const out = new Set<string>();
        leaves(node, "", out);
        expect(out.size, `${locale}: ${ns} ist leer`).toBeGreaterThan(0);
      }
    }
  });

  // ── §4 ───────────────────────────────────────────────────────────────────
  //
  // Der Befund, der diese Welle traegt: die Portaltexte MUSSTEN nicht
  // uebersetzt werden. Sie lagen fertig im Katalog, in beiden Sprachen, und
  // die Seiten trugen daneben ihre eigene, fest verdrahtete Zweitfassung.
  // Dieser Test haelt fest, dass die Seiten jetzt den Katalog benutzen —
  // namentlich fuer die Nachrichten, deren englische Fassung frueher WORT
  // FUER WORT im Quelltext von `dd/expired` stand.
  it("dd/expired benutzt die Katalognachrichten statt einer Zweitfassung", () => {
    const src = code("app/(portal)/dd/expired/page.tsx");
    const de = JSON.parse(
      readFileSync(path.join(MESSAGES, "de", "common.json"), "utf8"),
    );
    const en = JSON.parse(
      readFileSync(path.join(MESSAGES, "en", "common.json"), "utf8"),
    );

    for (const key of ["expired", "expiredMessage", "expiredNoContact"]) {
      expect(src).toContain(`t("${key}")`);
      expect(de.portal[key]).toBeTruthy();
      expect(en.portal[key]).toBeTruthy();
      // Und die beiden Fassungen sind wirklich verschieden — ein Katalog, in
      // dem EN die deutsche Zeichenkette wiederholt, waere OP-070 mit
      // zusaetzlichen Schritten.
      expect(en.portal[key]).not.toBe(de.portal[key]);
    }
  });
});
