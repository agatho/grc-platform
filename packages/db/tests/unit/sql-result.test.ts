// [ARCTOS-FULL-2026-08-31 / Welle 4b, Strang 6 · OP-065]
// `packages/db/src/sql-result.ts` — die Normalisierung des Treiber-Rückgabe-
// werts, und die Entnahme genau einer Zeile.
//
// Warum diese Datei
// -----------------
// Der Modulkopf von `sql-result.ts` beschreibt eine Fehlerklasse, die diesem
// Repository schon einmal teuer geworden ist: `.rows` gibt es beim
// `postgres-js`-Treiber nicht, und `res.rows[0]` war deshalb zur Laufzeit
// `undefined` — nicht ein Typfehler, sondern eine POST-Route, die
// `data: undefined` zurückgab. Gedeckt war von den vier Helfern dieses Moduls
// bis zum 2026-09-03 keiner.
//
// `requireRow` kam in dieser Welle dazu. Es ersetzt in acht Seed- und
// Betriebsskripten den Zugriff `const [row] = await sql\`… RETURNING id\``, der
// unter `noUncheckedIndexedAccess` als `T | undefined` sichtbar wurde. Die
// Entscheidung, die es trifft — kein Datensatz heisst Abbruch, nicht
// „weitermachen mit undefined als UUID" —, steht damit an einer Stelle und
// wird hier festgehalten.

import { describe, it, expect } from "vitest";
import { toRows, firstRow, rowCount, requireRow } from "../../src/sql-result";

describe("toRows — beide Treiberformen", () => {
  it("nimmt ein Array (postgres-js RowList) unverändert", () => {
    expect(toRows([{ id: 1 }, { id: 2 }])).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("packt ein `pg`-QueryResult aus", () => {
    expect(toRows({ rows: [{ id: 1 }] })).toEqual([{ id: 1 }]);
  });

  it("liefert für null/undefined ein leeres Array statt zu werfen", () => {
    expect(toRows(null)).toEqual([]);
    expect(toRows(undefined)).toEqual([]);
    expect(toRows({})).toEqual([]);
  });
});

describe("firstRow / rowCount", () => {
  it("firstRow gibt die erste Zeile oder undefined", () => {
    expect(firstRow([{ id: 1 }, { id: 2 }])).toEqual({ id: 1 });
    expect(firstRow([])).toBeUndefined();
    expect(firstRow(null)).toBeUndefined();
  });

  it("rowCount zählt beide Formen gleich", () => {
    expect(rowCount([{ id: 1 }, { id: 2 }])).toBe(2);
    expect(rowCount({ rows: [{ id: 1 }] })).toBe(1);
    expect(rowCount(null)).toBe(0);
  });
});

describe("requireRow — kein Datensatz heisst Abbruch", () => {
  it("gibt die erste Zeile zurück", () => {
    expect(requireRow([{ id: "a" }, { id: "b" }], "Test")).toEqual({ id: "a" });
  });

  it("wirft mit der übergebenen Bezeichnung, wenn keine Zeile da ist", () => {
    // Das ist der ganze Zweck: der Fehlschlag entsteht dort, wo die Zeile
    // fehlt, und sagt welche. Vorher lief ein Seed mit `undefined` als UUID
    // weiter und scheiterte irgendwo später — oder gar nicht, und meldete am
    // Ende trotzdem Erfolg.
    expect(() => requireRow([], "Vorlage ISO27001 anlegen")).toThrow(
      /Vorlage ISO27001 anlegen: Abfrage lieferte keine Zeile/,
    );
  });

  it("unterscheidet eine fehlende Zeile von einer leeren Zeile", () => {
    // `{}` ist eine Zeile. Nur ein leeres Ergebnis ist keine.
    expect(requireRow([{}], "Test")).toEqual({});
  });
});
