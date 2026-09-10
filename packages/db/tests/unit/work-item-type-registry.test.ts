// [Welle 5b · OP-051] Der Test, den Migration 0439 versprochen hat.
//
// `packages/db/drizzle/0439_work_item_type_catalog_gaps.sql:38-40` schreibt:
//
//   `packages/db/tests/unit/work-item-type-registry.test.ts` haelt die
//   Gegenprobe dauerhaft: ein neuer `typeKey` im Code ohne Katalogeintrag
//   macht den Test rot, statt spaeter eine 500 zu erzeugen.
//
// Die Datei existierte nicht (`find` leer, E2E-TRIAGE-3 §6 / -4 §9). Die
// Migration belegte damit etwas, das es nicht gab — und der Defekt, den sie
// behob (fuenf Routen schrieben `work_item`-Zeilen mit einem `type_key`, den
// der Katalog nicht kannte), konnte jederzeit wiederkommen.
//
// Der Test braucht keine Datenbank: beide Seiten stehen im Repository. Die
// Katalogseite sind die `INSERT INTO work_item_type`-Anweisungen der
// Migrationen, die Codeseite sind die `typeKey: "…"`-Literale in den Routen.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";

const REPO = resolve(__dirname, "..", "..", "..", "..");
const DRIZZLE = join(REPO, "packages", "db", "drizzle");

// ── Katalogseite: welche type_key legen die Migrationen an? ──────────

/**
 * Liest die erste Spalte jedes VALUES-Tupels aus allen
 * `INSERT INTO work_item_type`-Anweisungen.
 *
 * Bewusst ueber alle Migrationen und nicht nur ueber 0439: der Katalog
 * entsteht aus 0005, 0301, 0310, 0369 und 0439 zusammen.
 */
function catalogueKeys(): Set<string> {
  const keys = new Set<string>();
  for (const file of readdirSync(DRIZZLE).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(join(DRIZZLE, file), "utf8");
    if (!/INSERT\s+INTO\s+work_item_type/i.test(sql)) continue;
    // Jede Anweisung ab `INSERT INTO work_item_type` bis zum Semikolon.
    // Kommentarzeilen ZUERST raus, dann erst am Semikolon trennen: 0439
    // enthaelt in einem Erklaerkommentar ein `;` mitten in der Anweisung
    // ("… Tabelle audit_finding); diese hier haengt an …"). Wer erst trennt,
    // schneidet die Anweisung dort ab und liest fuenf Schluessel weniger —
    // der Test waere gruen gewesen, weil er nichts gefunden hat.
    const stripped = sql
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    const statements = stripped
      .split(/INSERT\s+INTO\s+work_item_type/i)
      .slice(1);
    for (const code of statements) {
      const body = code.split(";")[0] ?? "";
      const values = body.slice(body.search(/VALUES/i));
      for (const m of values.matchAll(/\(\s*'([a-z0-9_]+)'\s*,/g)) {
        if (m[1]) keys.add(m[1]);
      }
    }
  }
  return keys;
}

// ── Codeseite: welche type_key schreiben die Routen? ─────────────────

function walk(dir: string, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === "coverage" || name === ".next")
      continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

/**
 * `typeKey: "<key>"` im Drizzle-Insert-Objekt. Nur String-Literale — eine
 * Variable kann dieser Test nicht aufloesen, und genau deshalb ist ein
 * Literal an dieser Stelle die richtige Schreibweise.
 */
function typeKeysUsedInCode(): Map<string, string[]> {
  const used = new Map<string, string[]>();
  for (const root of [
    join(REPO, "apps", "web", "src"),
    join(REPO, "apps", "worker", "src"),
  ]) {
    for (const file of walk(root)) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/typeKey:\s*"([a-z0-9_]+)"/g)) {
        const key = m[1];
        if (!key) continue;
        const rel = file.slice(REPO.length + 1).replace(/\\/g, "/");
        used.set(key, [...(used.get(key) ?? []), rel]);
      }
    }
  }
  return used;
}

describe("work_item_type: Katalog und Code stimmen ueberein (OP-051, Migration 0439)", () => {
  const catalogue = catalogueKeys();
  const used = typeKeysUsedInCode();

  it("liest ueberhaupt Katalogeintraege aus den Migrationen", () => {
    // Ohne diese Sicherung wuerde ein kaputtes Muster eine leere Menge
    // liefern und der Test gruen durchlaufen, ohne etwas zu pruefen.
    expect(catalogue.size).toBeGreaterThanOrEqual(20);
    // Die vier, die 0439 nachgetragen hat, sowie zwei alte als Stichprobe.
    for (const key of [
      "data_breach",
      "dsr",
      "ropa_entry",
      "tia",
      "risk",
      "management_review_action",
    ]) {
      expect(catalogue.has(key), `Katalogeintrag '${key}' fehlt`).toBe(true);
    }
  });

  it("findet ueberhaupt typeKey-Literale im Anwendungscode", () => {
    expect(used.size).toBeGreaterThanOrEqual(10);
  });

  it("jeder im Code geschriebene typeKey ist im Katalog registriert", () => {
    const missing = [...used.entries()]
      .filter(([key]) => !catalogue.has(key))
      .map(([key, files]) => `${key} (${files.join(", ")})`);
    expect(
      missing,
      "Diese typeKey werden in work_item geschrieben, aber von keiner " +
        "Migration in work_item_type angelegt. Eine Zeile mit einem " +
        "unbekannten type_key laeuft je nach Route in einen Fremdschluessel- " +
        "oder Anzeigefehler — genau der Defekt aus 0439.",
    ).toEqual([]);
  });

  it("die Pruefung wuerde einen fehlenden Eintrag auch melden", () => {
    // Negativkontrolle. Acht Tore sind in diesem Audit gefunden worden, die
    // nicht ausloesen konnten; ein Test, der nur die gute Richtung zeigt,
    // belegt nicht, dass er die schlechte erkennt.
    const erfunden = "diesen_typ_gibt_es_nicht";
    expect(catalogue.has(erfunden)).toBe(false);
    const missing = [erfunden].filter((k) => !catalogue.has(k));
    expect(missing).toEqual([erfunden]);
  });
});
