// [ARCTOS-FULL-2026-08-31 / Welle 4c · OP-069] Die Allowlist für
// `custom_sql`-Regeln der kontinuierlichen Prüfung.
//
// Warum diese Datei
// -----------------
// `validateCustomAuditSql` ist die Antwort auf #S04-01 (Critical): davor war
// die Prüfung eine reine Stichwort-SPERRLISTE, und der Modulkopf listet fünf
// Eingaben auf, die sie nachweislich umgangen haben — bis hin zu
// `COPY … FROM PROGRAM 'id'` als Datenbank-Superuser. Ersetzt wurde sie durch
// eine Allowlist, und der Worker ruft dieselbe Funktion vor der Ausführung
// noch einmal auf.
//
// Gemessen am 2026-09-03 war von den sechs Funktionen dieser Datei keine
// gedeckt: die fünf dokumentierten Umgehungen standen als Kommentar im Code,
// nachgemessen hat sie niemand. Genau das leisten die ersten Tests — sie sind
// als Regressionsfälle formuliert, damit eine spätere „Vereinfachung" der
// Regeln an ihnen scheitert und nicht erst an einem Vorfall.
//
// Ein Befund aus dieser Arbeit ist NICHT hier abgebildet, weil er ein
// ungelöster Defekt ist und ein Test ihn sonst festschreiben würde:
// `SELECT "pg_sleep"(3600)` — der Funktionsname in doppelten
// Anführungszeichen — passiert die Ausnahmeliste. Siehe
// docs/UMSETZUNG-WELLE-4C.md §6, Befund F-3.

import { describe, it, expect } from "vitest";
import {
  validateCustomAuditSql,
  isReadOnlySql,
  isValidWpTransition,
  computeQaScore,
  generateWpReference,
  CUSTOM_SQL_MAX_LENGTH,
} from "../src/schemas/audit-advanced";

describe("validateCustomAuditSql — die fünf dokumentierten Umgehungen aus S04-01", () => {
  it.each([
    [
      "SELECT … INTO (DDL+DML ohne Stichwort)",
      "SELECT * INTO evil FROM organization",
    ],
    ["Mehrfachanweisung mit DO-Block", "SELECT 1; DO $$ BEGIN END $$"],
    ["COPY … FROM PROGRAM (RCE)", "SELECT 1; COPY t FROM PROGRAM 'id'"],
    [
      "GRANT (Rechteausweitung)",
      "SELECT 1; GRANT ALL ON organization TO PUBLIC",
    ],
    ["pg_sleep (DoS)", "SELECT pg_sleep(3600)"],
  ])("lehnt %s ab", (_name, query) => {
    const res = validateCustomAuditSql(query);
    expect(res.ok).toBe(false);
    expect(res.reason).toBeTruthy();
    expect(res.sql).toBeUndefined();
  });
});

describe("validateCustomAuditSql — die Regeln der Allowlist", () => {
  it("lässt eine schlichte, lesende Abfrage durch und gibt sie getrimmt zurück", () => {
    const res = validateCustomAuditSql(
      "  SELECT count(*) FROM risk WHERE status = 'open'  ",
    );
    expect(res.ok).toBe(true);
    expect(res.sql).toBe("SELECT count(*) FROM risk WHERE status = 'open'");
    expect(res.reason).toBeUndefined();
  });

  it("verlangt eine Zeichenkette", () => {
    for (const bad of [null, undefined, 42, {}, ["SELECT 1"]]) {
      expect(validateCustomAuditSql(bad).ok).toBe(false);
    }
  });

  it("lehnt leer und nur-Leerraum ab", () => {
    expect(validateCustomAuditSql("").reason).toMatch(/must not be empty/);
    expect(validateCustomAuditSql("   \n\t ").reason).toMatch(
      /must not be empty/,
    );
  });

  it("begrenzt die Länge", () => {
    const lang = "SELECT " + "1,".repeat(CUSTOM_SQL_MAX_LENGTH) + "1";
    expect(validateCustomAuditSql(lang).reason).toMatch(/maximum length/);
  });

  it("lehnt Steuerzeichen ab, die Nutzlast vor dem Prüfer verbergen", () => {
    // Als Escape geschrieben und nicht als unsichtbares Zeichen: ein Test,
    // dessen Eingabe man nicht lesen kann, prüft beim nächsten Editorlauf
    // vielleicht etwas anderes.
    expect(validateCustomAuditSql("SELECT 1\u0001 FROM risk").ok).toBe(false);
    expect(validateCustomAuditSql("SELECT 1\u001b[2K FROM risk").ok).toBe(
      false,
    );
    expect(validateCustomAuditSql("SELECT 1\u0000 FROM risk").ok).toBe(false);
  });

  it("erlaubt dabei Zeilenumbruch und Tabulator — eine formatierte Abfrage bleibt gültig", () => {
    expect(validateCustomAuditSql("SELECT id,\n\ttitle\nFROM risk").ok).toBe(
      true,
    );
  });

  it("lehnt JEDES Semikolon ab, auch das abschliessende", () => {
    // Ein abschliessendes Semikolon ist nach der Verkettung nicht vom Beginn
    // einer zweiten Anweisung zu unterscheiden.
    expect(validateCustomAuditSql("SELECT 1;").ok).toBe(false);
    expect(validateCustomAuditSql("SELECT 1 ; SELECT 2").ok).toBe(false);
  });

  it("lehnt Kommentare in allen drei Schreibweisen ab", () => {
    expect(validateCustomAuditSql("SELECT 1 -- harmlos").ok).toBe(false);
    expect(validateCustomAuditSql("SELECT /* x */ 1").ok).toBe(false);
    expect(validateCustomAuditSql("SELECT 1 */").ok).toBe(false);
  });

  it("lehnt Dollar-Quoting ab, benannt wie unbenannt", () => {
    expect(validateCustomAuditSql("SELECT $$a$$").ok).toBe(false);
    expect(validateCustomAuditSql("SELECT $tag$a$tag$").ok).toBe(false);
  });

  it("verlangt SELECT am Anfang und lehnt WITH ab", () => {
    // `WITH x AS (INSERT … RETURNING …) SELECT …` ist ein Schreibzugriff in
    // der Verkleidung eines SELECT — deshalb ist WITH ganz gesperrt.
    expect(
      validateCustomAuditSql("WITH x AS (SELECT 1) SELECT * FROM x").ok,
    ).toBe(false);
    expect(validateCustomAuditSql("TABLE risk").ok).toBe(false);
    expect(validateCustomAuditSql("VALUES (1)").ok).toBe(false);
  });

  it("akzeptiert SELECT unabhängig von der Schreibweise", () => {
    expect(validateCustomAuditSql("select 1").ok).toBe(true);
    expect(validateCustomAuditSql("SeLeCt 1").ok).toBe(true);
  });

  it.each([
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "ALTER",
    "TRUNCATE",
    "CREATE",
    "GRANT",
    "REVOKE",
    "COPY",
    "SET",
    "EXECUTE",
    "PROGRAM",
  ])("lehnt das Stichwort %s auch ohne Semikolon ab", (kw) => {
    const res = validateCustomAuditSql(`SELECT 1 FROM risk WHERE x = ${kw} y`);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain(kw);
  });

  it("greift auch, wenn das Stichwort in einem Zeichenkettenliteral steht", () => {
    // Der Abgleich läuft über die GANZE Zeichenkette, ohne SQL zu
    // tokenisieren. Das ist der Grund, warum `query_to_xml('DELETE …')` und
    // ähnliche Konstruktionen mit ausführbarem Text hier hängenbleiben.
    expect(
      validateCustomAuditSql("SELECT query_to_xml('DELETE FROM risk')").ok,
    ).toBe(false);
  });

  it.each([
    "pg_sleep",
    "pg_read_file",
    "pg_ls_dir",
    "lo_import",
    "dblink",
    "pg_terminate_backend",
    "set_config",
    "current_setting",
  ])("lehnt die Serverfunktion %s ab", (fn) => {
    const res = validateCustomAuditSql(`SELECT ${fn}('x')`);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/is not allowed/);
  });

  it("erkennt eine gesperrte Funktion auch mit Leerraum vor der Klammer und qualifiziert", () => {
    expect(validateCustomAuditSql("SELECT pg_sleep  (1)").ok).toBe(false);
    expect(validateCustomAuditSql("SELECT pg_catalog.pg_sleep(1)").ok).toBe(
      false,
    );
    expect(validateCustomAuditSql("SELECT PG_SLEEP(1)").ok).toBe(false);
  });

  it("verwechselt einen Spaltennamen mit gleichem Präfix nicht mit der Funktion", () => {
    // `\\b…\\s*\\(` verlangt die Klammer; eine Spalte `pg_sleep_count` darf
    // eine ansonsten harmlose Abfrage nicht unbrauchbar machen.
    expect(
      validateCustomAuditSql("SELECT pg_sleep_count FROM metrics").ok,
    ).toBe(true);
  });
});

describe("isReadOnlySql — der boolesche Mantel", () => {
  it("bildet exakt das ok-Feld von validateCustomAuditSql ab", () => {
    for (const q of [
      "SELECT 1",
      "SELECT 1;",
      "SELECT pg_sleep(1)",
      "DELETE FROM risk",
      "",
    ]) {
      expect(isReadOnlySql(q)).toBe(validateCustomAuditSql(q).ok);
    }
  });
});

describe("isValidWpTransition — der Statusgraph des Arbeitspapiers", () => {
  it("erlaubt genau die vorgesehenen Übergänge", () => {
    expect(isValidWpTransition("draft", "in_review")).toBe(true);
    expect(isValidWpTransition("in_review", "needs_revision")).toBe(true);
    expect(isValidWpTransition("in_review", "reviewed")).toBe(true);
    expect(isValidWpTransition("reviewed", "approved")).toBe(true);
  });

  it("verweigert Rückwege und Sprünge — approved ist eine Senke", () => {
    expect(isValidWpTransition("approved", "draft")).toBe(false);
    expect(isValidWpTransition("approved", "in_review")).toBe(false);
    // Der Sprung von draft direkt auf approved würde die Vier-Augen-Prüfung
    // überspringen; das ist die eigentliche Aussage dieses Graphen.
    expect(isValidWpTransition("draft", "approved")).toBe(false);
    expect(isValidWpTransition("draft", "reviewed")).toBe(false);
  });

  it("verweigert einen unbekannten Ausgangsstatus", () => {
    expect(isValidWpTransition("erfunden", "approved")).toBe(false);
  });
});

describe("computeQaScore — gewichtete QA-Bewertung", () => {
  it("gibt 100/green bei durchweg konform", () => {
    expect(
      computeQaScore([
        { compliance: "compliant", weight: 3 },
        { compliance: "compliant", weight: 1 },
      ]),
    ).toEqual({ score: 100, rating: "green" });
  });

  it("wertet teilweise konform mit der Hälfte", () => {
    expect(
      computeQaScore([{ compliance: "partially_compliant", weight: 1 }]),
    ).toEqual({ score: 50, rating: "red" });
  });

  it("gewichtet — dieselben Antworten, andere Gewichte, anderes Ergebnis", () => {
    const leicht = computeQaScore([
      { compliance: "compliant", weight: 3 },
      { compliance: "non_compliant", weight: 1 },
    ]);
    const schwer = computeQaScore([
      { compliance: "compliant", weight: 1 },
      { compliance: "non_compliant", weight: 3 },
    ]);
    expect(leicht).toEqual({ score: 75, rating: "yellow" });
    expect(schwer).toEqual({ score: 25, rating: "red" });
  });

  it("lässt not_applicable und null unbewertet, statt sie als 0 zu zählen", () => {
    // Der Unterschied ist erheblich: als 0 gezählt würde jede nicht
    // anwendbare Frage die Bewertung drücken.
    expect(
      computeQaScore([
        { compliance: "compliant", weight: 1 },
        { compliance: "not_applicable", weight: 5 },
        { compliance: null, weight: 5 },
      ]),
    ).toEqual({ score: 100, rating: "green" });
  });

  it("gibt 0/red zurück, wenn nichts zu bewerten ist", () => {
    expect(computeQaScore([])).toEqual({ score: 0, rating: "red" });
    expect(
      computeQaScore([{ compliance: "not_applicable", weight: 1 }]),
    ).toEqual({ score: 0, rating: "red" });
  });

  it("setzt die Schwellen bei 80 (green) und 60 (yellow)", () => {
    const bei = (n: number) =>
      computeQaScore([
        { compliance: "compliant", weight: n },
        { compliance: "non_compliant", weight: 100 - n },
      ]).rating;
    expect(bei(80)).toBe("green");
    expect(bei(79)).toBe("yellow");
    expect(bei(60)).toBe("yellow");
    expect(bei(59)).toBe("red");
  });
});

describe("generateWpReference — fortlaufende Arbeitspapier-Nummer je Ordner", () => {
  it("beginnt bei 1, wenn der Ordner leer ist", () => {
    expect(generateWpReference("A", [])).toBe("A.1");
  });

  it("nimmt die höchste vergebene Nummer plus eins, nicht die Anzahl", () => {
    // Nach dem Löschen von A.2 und A.3 wäre „Anzahl + 1" = A.3 — eine
    // Referenz, die es schon gab. Arbeitspapier-Referenzen dürfen sich nicht
    // wiederholen.
    expect(generateWpReference("A", ["A.1", "A.7"])).toBe("A.8");
  });

  it("behandelt den Ordnercode als Text, nicht als regulären Ausdruck", () => {
    // Ein Code wie `A.1` enthält einen Punkt; ohne Maskierung würde er auf
    // jedes Zeichen passen und `AX1.4` fälschlich mitzählen.
    expect(generateWpReference("A.1", ["A.1.4", "AX1.9"])).toBe("A.1.5");
  });

  it("ignoriert fremde und unvollständige Einträge des Ordners", () => {
    expect(generateWpReference("B", ["A.9", "B", "B.x", "B.2"])).toBe("B.3");
  });
});
