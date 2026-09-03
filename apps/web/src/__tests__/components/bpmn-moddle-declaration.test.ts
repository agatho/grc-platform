/**
 * [ARCTOS-FULL-2026-08-31 · OP-038] Zwei ambiente `declare module "bpmn-moddle"`.
 *
 * **Was das Register behauptet** (`OFFENE-PUNKTE-REGISTER.md`, OP-038, aus
 * `STUFE2-B2-EINBINDUNG.md` §5.1 Punkt 2): „die schmalere App-Fassung kennt
 * weder `ModdleWarning` noch die zweiargumentige `toXML`-Signatur".
 *
 * **Gegen den Code geprüft stimmt das nicht mehr.** Gemessen am 2026-09-02
 * führen beide Dateien `ModdleWarning`, `FromXmlResult`, `ToXmlOptions` und
 * `toXML(element, options)`; `apps/web/src/types/bpmn-moddle.d.ts` sagt in
 * seinem eigenen Kopf: „The declarations are now identical in substance; when
 * one changes, change both." Der gemeldete Typfehler beim Import von
 * `@grc/bpmn` aus `apps/web` tritt nicht mehr auf — `npx tsc --noEmit -p
 * apps/web/tsconfig.json` läuft mit den `@grc/bpmn/grc`- und
 * `@grc/bpmn/draw`-Importen der Diagrammfläche fehlerfrei durch.
 *
 * **Was bleibt**, ist der Befund dahinter: zwei ambiente Deklarationen
 * desselben Moduls in zwei TypeScript-Programmen sind ein stiller Fehlerherd,
 * und der Satz „change both" ist ein Kommentar, kein Wächter. Genau dieser
 * fehlende Wächter ist die Ursache, aus der die Drift überhaupt entstehen
 * konnte.
 *
 * **Warum hier ein Wächter und nicht die Zusammenführung.** Die
 * Zusammenführung berührt `packages/bpmn/src/model/bpmn-moddle.d.ts`
 * (Dateihoheit eines anderen Strangs) und `apps/web/src/types/`. Dieser Test
 * hält die beiden Fassungen so lange in Deckung, bis der zuständige Strang sie
 * vereinigt; er ist die billigere Hälfte und die, die sofort beisst.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..", "..", "..", "..");
const APP_DECL = join(ROOT, "apps", "web", "src", "types", "bpmn-moddle.d.ts");
const PKG_DECL = join(
  ROOT,
  "packages",
  "bpmn",
  "src",
  "model",
  "bpmn-moddle.d.ts",
);

/**
 * Der Deklarationsblock ohne Kommentare und Leerraum.
 *
 * Verglichen wird die **Substanz**, nicht der Text: die beiden Dateien
 * begründen sich unterschiedlich, und das sollen sie auch. Was übereinstimmen
 * muss, ist die Typfläche.
 */
function surface(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/\s*([{};,()<>|])\s*/g, "$1")
    .trim();
}

describe("OP-038 — die beiden bpmn-moddle-Deklarationen", () => {
  it("beschreiben dieselbe Typfläche", () => {
    // Reisst dieser Vergleich, ist genau der Fehlerherd zurück, den das
    // Register beschreibt: ein Programm kennt eine Signatur, das andere nicht,
    // und derselbe Quelltext übersetzt an einer Stelle und an der anderen
    // nicht.
    expect(surface(APP_DECL)).toBe(surface(PKG_DECL));
  });

  it("führen beide die Teile, deren Fehlen das Register meldet", () => {
    // Der Nachweis zur Korrektur am Register: die konkret genannten Lücken
    // („kennt weder ModdleWarning noch die zweiargumentige toXML-Signatur")
    // sind in **beiden** Fassungen geschlossen.
    for (const path of [APP_DECL, PKG_DECL]) {
      const text = readFileSync(path, "utf8");
      expect(text, `${path}: ModdleWarning fehlt`).toContain(
        "interface ModdleWarning",
      );
      expect(text, `${path}: ToXmlOptions fehlt`).toContain(
        "interface ToXmlOptions",
      );
      expect(
        /toXML\(\s*element:\s*ModdleElement,\s*options\?:\s*ToXmlOptions,?\s*\)/.test(
          text,
        ),
        `${path}: zweiargumentige toXML-Signatur fehlt`,
      ).toBe(true);
    }
  });

  it("es gibt genau diese zwei und keine dritte", () => {
    // Eine dritte Fassung wäre die nächste Stufe desselben Fehlers. Der Test
    // zählt sie, statt darauf zu vertrauen, dass niemand eine anlegt.
    const found = declarationsUnder(join(ROOT, "apps"))
      .concat(declarationsUnder(join(ROOT, "packages")))
      .sort();
    expect(found).toEqual([APP_DECL, PKG_DECL].sort());
  });
});

/** Alle `.d.ts` unter `dir`, die `declare module "bpmn-moddle"` enthalten. */
function declarationsUnder(dir: string): string[] {
  const { readdirSync, statSync } =
    require("node:fs") as typeof import("node:fs");
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      if (entry === "node_modules" || entry === ".next" || entry === "dist") {
        continue;
      }
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!full.endsWith(".d.ts")) continue;
      if (
        /declare\s+module\s+["']bpmn-moddle["']/.test(
          readFileSync(full, "utf8"),
        )
      ) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}
