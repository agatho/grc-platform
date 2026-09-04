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
// Drei Befunde aus jener Arbeit blieben zunächst ohne Test, weil ein Test sie
// festgeschrieben statt behoben hätte: F-3 (`SELECT "pg_sleep"(3600)`
// passierte die Ausnahmeliste), F-4 (`isValidWpTransition` warf bei
// Prototyp-Schlüsseln) und F-5 (`computeQaScore` lieferte NaN). Alle drei sind
// in Welle 4b, Strang 6 behoben; die Tests dazu stehen am Ende dieser Datei
// und halten das gemessene ALTE Verhalten je im Kommentar fest. Siehe
// docs/UMSETZUNG-WELLE-4C.md §6 und docs/UMSETZUNG-WELLE-4B-6.md §2.

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

// ─────────────────────────────────────────────────────────────────────────
// [Welle 4b, Strang 6] Die drei Defekte, die Welle 4c als F-3, F-4 und F-5
// benannt und belegt liegen gelassen hat. Bis hierher stand über ihnen
// „ein Test würde den Zustand festschreiben" — jetzt schreiben sie den
// BEHOBENEN Zustand fest.
// ─────────────────────────────────────────────────────────────────────────

describe("validateCustomAuditSql — F-3: der doppelt zitierte Funktionsname", () => {
  // Gemessen am 2026-09-03 gegen 01d0e4cc: `SELECT pg_sleep(3600)` wurde
  // abgelehnt, `SELECT "pg_sleep"(3600)` DURCHGELASSEN. Das Muster
  // `\b(name)\s*\(` verlangt die Klammer unmittelbar hinter dem Namen; das
  // schliessende `"` bricht es. Die Stichwortliste war nicht betroffen, weil
  // ihre Alternativen auf `\b` enden.
  it.each([
    ["pg_sleep (DoS)", `SELECT "pg_sleep"(3600)`],
    ["pg_read_file (Dateizugriff)", `SELECT "pg_read_file"('/etc/passwd')`],
    ["current_setting (Sitzungsgeheimnisse)", `SELECT "current_setting"('x')`],
    ["dblink (ausgehende Verbindung)", `SELECT "dblink"('a','b')`],
    ["gemischt zitiert", `SELECT pg_catalog."pg_sleep"(1)`],
    ["mit Leerraum", `SELECT "pg_sleep" (1)`],
  ])("lehnt %s ab", (_name, query) => {
    const res = validateCustomAuditSql(query);
    expect(res.ok).toBe(false);
    expect(res.sql).toBeUndefined();
  });

  it("nennt den doppelten Anführungsstrich als Grund, nicht die Funktion", () => {
    // Die Behebung ist lexikalisch: `"` ist verboten, weil es der einzige
    // Weg ist, einen Namen vor dem Muster zu verstecken. Wer die Regel
    // stattdessen um `"?` erweitert, verschiebt dieselbe Lücke nur auf die
    // nächste Schreibweise.
    expect(validateCustomAuditSql(`SELECT "pg_sleep"(1)`).reason).toMatch(
      /double-quoted/i,
    );
  });

  it("lässt eine Abfrage ohne Anführungsstriche unverändert durch", () => {
    const res = validateCustomAuditSql(
      "SELECT count(*) FROM risk WHERE status = 'open'",
    );
    expect(res.ok).toBe(true);
  });
});

describe("isValidWpTransition — F-4: Schlüssel aus der Prototypenkette", () => {
  // Gemessen am 2026-09-03 gegen 01d0e4cc: jeder dieser Schlüssel warf
  // `TypeError: WP_STATUS_TRANSITIONS[current]?.includes is not a function`.
  // `?.` schützt gegen `undefined`, nicht gegen eine geerbte Funktion — der
  // `?? false`-Zweig wurde nie erreicht.
  it.each([
    "toString",
    "constructor",
    "valueOf",
    "hasOwnProperty",
    "__proto__",
    "isPrototypeOf",
    "propertyIsEnumerable",
  ])("gibt für %s false zurück, statt zu werfen", (key) => {
    expect(() => isValidWpTransition(key, "in_review")).not.toThrow();
    expect(isValidWpTransition(key, "in_review")).toBe(false);
  });

  it("lässt einen Prototyp-Schlüssel auch als ZIEL nicht durch", () => {
    expect(isValidWpTransition("draft", "toString")).toBe(false);
  });
});

describe("computeQaScore — F-5: Bewertungen ohne Zahl", () => {
  // Gemessen am 2026-09-03 gegen 01d0e4cc:
  //   [{compliant, 0}]                 → score=NaN  (in JSON: null)
  //   [{compliant,-1},{compliant,1}]   → score=NaN
  //   [{compliant,-1},{non_compliant,1}] → score=-Infinity
  //   [{compliant,5},{non_compliant,-1}] → score=125
  // Die Wache prüfte `applicable.length === 0`, also ob es POSITIONEN gibt —
  // nicht, ob es GEWICHT gibt.
  it("gibt 0/red statt NaN, wenn alle Gewichte 0 sind", () => {
    const res = computeQaScore([
      { compliance: "compliant", weight: 0 },
      { compliance: "non_compliant", weight: 0 },
    ]);
    expect(Number.isNaN(res.score)).toBe(false);
    expect(res).toEqual({ score: 0, rating: "red" });
  });

  it("gibt 0/red bei einer einzigen Position mit Gewicht 0", () => {
    expect(computeQaScore([{ compliance: "compliant", weight: 0 }])).toEqual({
      score: 0,
      rating: "red",
    });
  });

  it("liefert nie ±Infinity, wenn sich die Gewichte zu 0 aufheben", () => {
    // `Number.isNaN` fängt diesen Fall NICHT — ein Aufrufer, der nur auf NaN
    // prüft, hätte -Infinity an die Oberfläche gereicht.
    const res = computeQaScore([
      { compliance: "compliant", weight: -1 },
      { compliance: "non_compliant", weight: 1 },
    ]);
    expect(Number.isFinite(res.score)).toBe(true);
    expect(res).toEqual({ score: 0, rating: "red" });
  });

  it("erzeugt aus einem negativen Gewicht kein grünes Ergebnis", () => {
    // Vorher: [{compliant,-2},{compliant,1}] → 100/green, und
    // [{compliant,5},{non_compliant,-1}] → 125/green. Ein negatives Gewicht
    // war ein Hebel, um eine QA-Bewertung zu erfinden.
    expect(
      computeQaScore([
        { compliance: "compliant", weight: -2 },
        { compliance: "compliant", weight: 1 },
      ]),
    ).toEqual({ score: 100, rating: "green" });
    const gedreht = computeQaScore([
      { compliance: "compliant", weight: 5 },
      { compliance: "non_compliant", weight: -1 },
    ]);
    expect(gedreht.score).toBeLessThanOrEqual(100);
    expect(gedreht).toEqual({ score: 100, rating: "green" });
  });

  it("hält die Bewertung in jedem Fall zwischen 0 und 100", () => {
    const faelle: Array<Array<{ compliance: string | null; weight: number }>> =
      [
        [{ compliance: "compliant", weight: Number.POSITIVE_INFINITY }],
        [{ compliance: "non_compliant", weight: Number.NaN }],
        [
          { compliance: "compliant", weight: -1 },
          { compliance: "non_compliant", weight: -1 },
        ],
        [
          { compliance: "partially_compliant", weight: 2 },
          { compliance: "not_applicable", weight: 99 },
        ],
      ];
    for (const items of faelle) {
      const { score } = computeQaScore(items);
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
