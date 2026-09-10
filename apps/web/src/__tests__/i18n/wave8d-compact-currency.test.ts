/**
 * [ARCTOS-FULL-2026-08-31 · Welle 8d]
 *
 * `formatCompactEUR` lag als BYTEWEISE identische Kopie in vier FAIR-Seiten
 * und hatte zwei Fehler — nur einer davon war das Gebietsschema:
 *
 *   1. `(v / 1000).toFixed(0) + "k"` rundet auf ganze Tausender. 999.999
 *      wurde damit zu "1000k" — direkt unter einem Tick, der "1.0M" heisst.
 *      12.500 wurde zu "13k". Das ist in JEDER Sprache falsch.
 *   2. Der Dezimaltrenner war fest der englische Punkt, obwohl die
 *      Oberflaeche daneben deutsch formatierte.
 *
 * Dieser Test sichert beides ab und zaehlt zusaetzlich die Deklarationen —
 * die Kopie ist ja gerade dadurch entstanden, dass vier Seiten dieselbe
 * Funktion mitgebracht haben.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { formatCompactCurrency } from "@/lib/format-date";

const SRC = path.join(__dirname, "../..");

/**
 * Dieselbe Regel wie in `wave5a-surfaces.test.ts`: beide Aufrufformen, mit
 * denen sich ein Gebietsschema fest verdrahten laesst. `g` wird pro Aufruf neu
 * erzeugt, weil ein geteilter `RegExp` mit `g` seinen `lastIndex` behaelt.
 */
const FESTES_GEBIETSSCHEMA = () =>
  new RegExp(
    "(?:toLocale[A-Za-z]*|Intl\\.(?:NumberFormat|DateTimeFormat|RelativeTimeFormat|ListFormat|PluralRules|Collator))\\(\\s*[\"'][a-z]{2}-[A-Z]{2}[\"']",
    "g",
  );

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /(^|[^:])\/\/.*$/gm;

/** Quelltext ohne Kommentare — sonst zaehlt die Begruendung als Fundstelle. */
function code(p: string): string {
  return readFileSync(p, "utf8")
    .replace(BLOCK_COMMENT, "")
    .replace(LINE_COMMENT, "$1");
}

function alleQuellen(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) alleQuellen(p, acc);
    else if (/\.tsx?$/.test(p)) acc.push(p);
  }
  return acc;
}

describe("Welle 8d — kompakte Waehrungsangabe", () => {
  it("kuerzt nicht mehr in ganzen Tausendern (der Fehler, der 999.999 zu „1000k“ machte)", () => {
    // Die alte Fassung, woertlich, als Gegenprobe im Test selbst:
    const alt = (v: number) =>
      v >= 1_000_000
        ? `${(v / 1_000_000).toFixed(1)}M`
        : v >= 1_000
          ? `${(v / 1_000).toFixed(0)}k`
          : v.toFixed(0);
    expect(alt(999_999)).toBe("1000k");
    expect(alt(12_500)).toBe("13k");

    // Und was jetzt herauskommt: kein Tausender-Tick oberhalb einer Million.
    expect(formatCompactCurrency("en", 999_999, "EUR")).toBe("\u20AC1M");
    expect(formatCompactCurrency("en", 12_500, "EUR")).toBe("\u20AC12.5K");
  });

  it("formatiert deutsch deutsch und englisch englisch", () => {
    // NBSP (U+00A0), nicht Leerzeichen: `Intl` trennt Zahl, Kuerzel und
    // Waehrungszeichen unumbrechbar. Ausgeschrieben, weil ein Test, der hier
    // ein normales Leerzeichen erwartet, mit zwei scheinbar identischen
    // Zeichenketten fehlschlaegt — genau das ist beim Schreiben passiert.
    expect(formatCompactCurrency("de", 15_600_000, "EUR")).toBe(
      "15,6\u00A0Mio.\u00A0\u20AC",
    );
    expect(formatCompactCurrency("en", 15_600_000, "EUR")).toBe("\u20AC15.6M");
    // Deutsch kuerzt unterhalb einer Million per CLDR gar nicht ab — das ist
    // richtiges Deutsch, kein fehlendes Kuerzel.
    expect(formatCompactCurrency("de", 12_500, "EUR")).toBe(
      "12.500\u00A0\u20AC",
    );
  });

  it("zeigt auf der Nulllinie „0 €“, nicht „0,0 €“", () => {
    expect(formatCompactCurrency("de", 0, "EUR")).toBe("0\u00A0\u20AC");
    expect(formatCompactCurrency("en", 0, "EUR")).toBe("\u20AC0");
  });

  it("gibt fuer fehlende Werte einen Gedankenstrich statt „NaN“", () => {
    expect(formatCompactCurrency("de", null, "EUR")).toBe("—");
    expect(formatCompactCurrency("de", undefined, "EUR")).toBe("—");
    expect(formatCompactCurrency("de", Number.NaN, "EUR")).toBe("—");
  });

  it("wird genau einmal deklariert, und `formatCompactEUR` gar nicht mehr", () => {
    const quellen = alleQuellen(SRC).filter((p) => !p.includes("__tests__"));
    const deklarationen = quellen.filter((p) =>
      /^\s*export function formatCompactCurrency\b/m.test(code(p)),
    );
    expect(deklarationen.map((p) => path.relative(SRC, p))).toEqual([
      "lib/format-date.ts",
    ]);

    // Im Quelltext darf der alte Name nicht mehr vorkommen; im KOMMENTAR von
    // `format-date.ts` steht er weiter, weil dort begruendet ist, was er
    // falsch gemacht hat. Deshalb `code()` und nicht der Rohtext.
    const alteKopien = quellen.filter((p) => /formatCompactEUR/.test(code(p)));
    expect(alteKopien.map((p) => path.relative(SRC, p))).toEqual([]);
  });
});

/**
 * §2 — Das feste Gebietsschema ausserhalb der Bildschirmpfade.
 *
 * Welle 5a und 6b haben die Regel „kein fest verdrahtetes Gebietsschema" fuer
 * `app/(dashboard)`, `app/(portal)` und `components` durchgesetzt. Was
 * uebrigbleibt, liegt in Exportpfaden — und dort ist die Umstellung KEINE
 * Formatierungsfrage: die Dokumente sind durchgehend deutsch geschrieben
 * („Erstellt am", „Organisation", „Stand"). Ein englisch formatiertes Datum in
 * einem deutschen Bericht macht ihn nicht richtiger, sondern uneinheitlich —
 * dasselbe Argument, mit dem Welle 5a ihre Teilaenderung an `admin/rls-audit`
 * zurueckgenommen hat: ganz oder gar nicht.
 *
 * Dieser Test ist deshalb kein Verbot, sondern eine BEZIFFERUNG. Er haelt die
 * Liste fest, damit sie nicht waechst und damit die Ausnahme gezaehlt ist statt
 * behauptet. Wer eine Datei uebersetzt, streicht sie hier — wer eine neue
 * anlegt, faellt auf.
 */
describe("Welle 8d — festes Gebietsschema ausserhalb der Bildschirmpfade", () => {
  const BEZIFFERT: Record<string, number> = {
    "app/api/v1/ai-act/annual-report/[year]/pdf/route.ts": 1,
    "app/api/v1/ai-act/incidents-monitor/pdf/route.ts": 3,
    "app/api/v1/bcms/readiness-monitor/pdf/route.ts": 5,
    "app/api/v1/dashboards/[id]/export-pdf/route.ts": 1,
    "app/api/v1/dpms/annual-report/[year]/pdf/route.ts": 1,
    "app/api/v1/dpms/deadline-monitor/pdf/route.ts": 3,
    "app/api/v1/dpms/dpia/[id]/export-pdf/route.ts": 5,
    "app/api/v1/isms/cap-monitor/pdf/route.ts": 1,
    "app/api/v1/isms/reviews/[id]/export/pdf/route.ts": 1,
    "app/api/v1/signature-requests/[requestId]/certificate/route.ts": 2,
    "lib/pdf.ts": 1,
    "lib/ropa-export.ts": 1,
  };

  it("die Liste der Exportpfade mit festem Gebietsschema ist unveraendert", () => {
    const gemessen: Record<string, number> = {};
    for (const p of alleQuellen(SRC)) {
      if (p.includes("__tests__")) continue;
      const rel = path.relative(SRC, p).split(path.sep).join("/");
      // Bildschirmpfade sind bereits durch wave5a-surfaces.test.ts gedeckt.
      if (
        rel.startsWith("app/(dashboard)") ||
        rel.startsWith("app/(portal)") ||
        rel.startsWith("components/")
      )
        continue;
      const n = [...code(p).matchAll(FESTES_GEBIETSSCHEMA())].length;
      if (n > 0) gemessen[rel] = n;
    }
    expect(gemessen).toEqual(BEZIFFERT);
  });

  it("die Fristmitteilung nennt das Datum nicht mehr mehrdeutig", () => {
    // Ein englischer Satz mit deutschem Datum: `acknowledge by 01.12.2026`
    // liest sich fuer den englischen Empfaenger als 12. Januar. Jetzt ISO 8601.
    const src = code(
      path.join(
        SRC,
        "app/api/v1/policies/distributions/[id]/activate/route.ts",
      ),
    );
    expect(src).toContain("Please read and acknowledge by");
    expect(src).not.toMatch(/acknowledge by \$\{[^}]*toLocale/);
    expect(src).toMatch(/toISOString\(\)\.slice\(0, 10\)/);
  });
});
