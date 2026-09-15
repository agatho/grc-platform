// [ARCTOS-FULL-2026-08-31 · OP-269] Ein Helfer, der weggeraeumt wird, bevor
// seine Aufrufer laufen.
//
// `seed_cross_framework_mappings.sql` definierte `insert_mapping()` und
// entfernte es in der letzten Zeile wieder (`DROP FUNCTION IF EXISTS`). Die
// vier Folgedateien v2 bis v5 rufen dieselbe Funktion auf und definieren sie
// nirgends. Jeder ihrer 854 Aufrufe scheiterte mit
//
//   ERROR:  function insert_mapping(unknown, ..., integer, unknown) does not exist
//
// auf jeder Installation, seit es die Dateien gibt. Gemessen am 2026-09-15 auf
// `grc_platform`: 88 Zuordnungen, also genau die 89 Aufrufe von v1 minus einem.
// Sichtbar wurde es nie, weil `deploy/seed-catalogs.sh` seine Fehlerzeilen auf
// den Zeilenanfang verankerte, waehrend psql `psql:/dev/stdin:24: ` voranstellt.
//
// Diese Tests pruefen die Datei-Ebene, nicht die Datenbank: welche Datei eine
// SQL-Funktion definiert, benutzt und loescht, steht im Text.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const SQL_DIR = join(__dirname, "..", "..", "sql");
const SRC_DIR = join(__dirname, "..", "..", "src");

const sqlDateien = readdirSync(SQL_DIR).filter((f) => f.endsWith(".sql"));

/** "insert_mapping" → { definiert, benutzt, geloescht } je Datei. */
function analysiere(datei: string) {
  const text = readFileSync(join(SQL_DIR, datei), "utf-8");
  // Kommentarzeilen zaehlen nicht — der Hinweis auf den frueheren DROP steht
  // absichtlich als Kommentar in v1.
  const code = text
    .split(/\r?\n/)
    .filter((z) => !/^\s*--/.test(z))
    .join("\n");
  return {
    definiert: /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+insert_mapping/i.test(
      code,
    ),
    benutzt: /\binsert_mapping\s*\(/.test(code),
    geloescht: /DROP\s+FUNCTION[^;]*\binsert_mapping/i.test(code),
  };
}

describe("SQL-Seed-Helfer (OP-269)", () => {
  it("keine Seed-Datei loescht insert_mapping()", () => {
    const loeschende = sqlDateien.filter((f) => analysiere(f).geloescht);
    expect(
      loeschende,
      "Der Helfer wird von v2 bis v5 gebraucht, die ihn nicht selbst definieren. " +
        "Wer ihn loescht, macht 854 Zuordnungen unsichtbar kaputt.",
    ).toEqual([]);
  });

  it("genau eine Datei definiert insert_mapping(), und sie ist v1", () => {
    const definierende = sqlDateien.filter((f) => analysiere(f).definiert);
    expect(definierende).toEqual(["seed_cross_framework_mappings.sql"]);
  });

  it("jede Datei, die insert_mapping() benutzt, ist in beiden Runnern verdrahtet — hinter v1", () => {
    const benutzer = sqlDateien
      .filter((f) => {
        const a = analysiere(f);
        return a.benutzt && !a.definiert;
      })
      .sort();
    expect(benutzer.length).toBeGreaterThan(0);

    for (const runner of ["seed-all.ts", "seed-demo.ts"]) {
      const src = readFileSync(join(SRC_DIR, runner), "utf-8");
      const v1 = src.indexOf('"seed_cross_framework_mappings.sql"');
      expect(v1, `${runner}: v1 nicht verdrahtet`).toBeGreaterThan(0);
      for (const datei of benutzer) {
        const pos = src.indexOf(`"${datei}"`);
        expect(
          pos,
          `${runner}: ${datei} ruft insert_mapping() auf, steht aber in keiner Liste — ` +
            `ihre Zuordnungen landen nirgends.`,
        ).toBeGreaterThan(0);
        expect(
          pos,
          `${runner}: ${datei} muss NACH seed_cross_framework_mappings.sql stehen, ` +
            `die den Helfer definiert.`,
        ).toBeGreaterThan(v1);
      }
    }
  });

  it("jeder in einem Mapping verlangte Katalog-Schluessel wird von einem Katalog-Seed deklariert", () => {
    // `insert_mapping()` schweigt, wenn eine der beiden Nachschlagungen ins
    // Leere geht (`IF v_source_id IS NOT NULL AND v_target_id IS NOT NULL`).
    // Ein Tippfehler im Katalog-Schluessel kostet daher Zuordnungen ohne eine
    // einzige Meldung — `eu_ai_act_2024_1689` gegen `eu_ai_act` waren sieben.
    // Bewusst grob: jedes einfach zitierte Kleinbuchstaben-Literal aus einem
    // `seed_catalog_*.sql` gilt als deklariert. Eine genauere Fassung, die nur
    // die `source`-Spalte des `INSERT INTO catalog` las, meldete beim ersten
    // Lauf sieben korrekte Schluessel als unbekannt — sie scheiterte an den
    // `ON CONFLICT`-Varianten der Anweisung. Fuer den Fehler, um den es geht —
    // ein Schluessel, den KEIN Katalog kennt —, genuegt die grobe Fassung, und
    // sie meldet nichts Falsches.
    const deklariert = new Set<string>();
    for (const f of sqlDateien.filter((f) => f.startsWith("seed_catalog_"))) {
      const text = readFileSync(join(SQL_DIR, f), "utf-8");
      for (const lit of text.matchAll(/'([a-z0-9_]{4,})'/g)) {
        if (lit[1]) deklariert.add(lit[1]);
      }
    }

    const verlangt = new Map<string, string>();
    for (const f of sqlDateien.filter((f) =>
      f.startsWith("seed_cross_framework_mappings"),
    )) {
      const text = readFileSync(join(SQL_DIR, f), "utf-8");
      for (const m of text.matchAll(
        /insert_mapping\(\s*'[^']*'\s*,\s*'([^']+)'\s*,\s*'[^']*'\s*,\s*'([^']+)'/g,
      )) {
        const [, quellKatalog, zielKatalog] = m;
        if (quellKatalog) verlangt.set(quellKatalog, f);
        if (zielKatalog) verlangt.set(zielKatalog, f);
      }
    }
    expect(verlangt.size).toBeGreaterThan(5);

    const unbekannt = [...verlangt.entries()]
      .filter(([key]) => !deklariert.has(key))
      .map(([key, datei]) => `${key} (${datei})`);
    expect(
      unbekannt,
      "Diese Katalog-Schluessel verlangt eine Mapping-Datei, aber kein seed_catalog_*.sql deklariert sie. " +
        "insert_mapping() ueberspringt solche Aufrufe stillschweigend.",
    ).toEqual([]);
  });
});
