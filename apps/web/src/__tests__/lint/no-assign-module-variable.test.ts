// [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-078]
//
// Sechs Routen unter `src/app/api/v1/**` deklarierten ein lokales
// `const module = searchParams.get("module")`. Das ist der Modulschluessel der
// Anwendung ("risk", "isms", …) und hat mit dem CommonJS-`module` nichts zu
// tun — genau darin liegt das Problem: die Bindung verdeckt es. Next.js
// meldet das ueber `@next/next/no-assign-module-variable`; die Regel war fuer
// `src/app/api/v1/**` ausgeschaltet, weil die Routen zur Zeit von WP12 einem
// anderen Paket gehoerten.
//
// Warum das ein Tor braucht und nicht nur eine Umbenennung: die Ausnahme war
// eine geoeffnete Tuer fuer 1.355 Routendateien, nicht fuer sechs Zeilen. Ein
// Test, der nur die sechs Namen prueft, uebersaehe die siebte. Deshalb zwei
// unabhaengige Zusicherungen:
//
//   1. ESLint selbst — die effektive Konfiguration einer Datei aus dem
//      frueheren Ausnahmebereich hat die Regel wieder auf "error". Das ist
//      eine Aussage ueber die AUFLOESUNG der Flat-Config, nicht ueber ihren
//      Text: ein spaeterer Block, der die Regel erneut abschaltet, faellt hier
//      auf, ein umformatierter Kommentar nicht.
//   2. Der Baum — keine Routendatei deklariert eine Bindung namens `module`.
//      Das deckt auch die Dateien ab, die ein kuenftiges `ignores` aus dem
//      Blickfeld von ESLint nehmen wuerde.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";

const WEB = path.join(__dirname, "../../..");
const API_ROOT = path.join(WEB, "src/app/api");
const RULE = "@next/next/no-assign-module-variable";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

const ROUTE_FILES = walk(API_ROOT);

describe("OP-078 — `module` bleibt die CommonJS-Bindung", () => {
  it("hat ueberhaupt Routendateien gefunden (sonst prueft der Rest nichts)", () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(500);
  });

  it("ESLint fuehrt die Regel im frueheren Ausnahmebereich wieder als Fehler", async () => {
    const eslint = new ESLint({ cwd: WEB });
    // Eine Datei aus genau dem Bereich, fuer den die Ausnahme galt.
    const probe = path.join(WEB, "src/app/api/v1/catalogs/route.ts");
    const config = (await eslint.calculateConfigForFile(probe)) as {
      rules?: Record<string, unknown>;
    };
    const severity = Array.isArray(config.rules?.[RULE])
      ? (config.rules[RULE] as unknown[])[0]
      : config.rules?.[RULE];
    // ESLint normalisiert auf die Zahl: 0 = off, 1 = warn, 2 = error.
    expect(severity).not.toBe(0);
    expect(severity).not.toBe("off");
    expect(severity).toBeTruthy();
  });

  it("keine Routendatei deklariert eine Bindung namens `module`", () => {
    const offenders: string[] = [];
    for (const file of ROUTE_FILES) {
      const src = readFileSync(file, "utf8");
      src.split("\n").forEach((line, i) => {
        // Deklaration, nicht Verwendung: `pluginHook.module` oder
        // `searchParams.get("module")` sind unbedenklich.
        if (/\b(?:const|let|var)\s+module\b/.test(line)) {
          offenders.push(`${path.relative(WEB, file)}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
