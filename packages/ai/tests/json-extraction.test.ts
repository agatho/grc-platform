// [CodeQL js/polynomial-redos] Beide hier geprueften Funktionen extrahieren
// JSON aus dem Rohtext, den ein fremder AI-Provider zurueckgegeben hat, und
// beide waren vorher unverankert-gierige Regexe mit quadratischem Backtracking.
//
// Vor dieser Datei hatte KEINE der beiden einen Unit-Test: `safeJsonParse`
// tauchte im gesamten Repository nur als Mock auf, `parseBatchTranslateResponse`
// ueberhaupt nicht. Die Faelle unten sind daher nicht nur Zeitschranken,
// sondern zuerst einmal die fehlende Verhaltensabdeckung.

import { describe, it, expect } from "vitest";
import { safeJsonParse } from "../src/prompts/bpm";
import { parseBatchTranslateResponse } from "../src/prompts/translate";

describe("safeJsonParse", () => {
  it("liest ein nacktes Objekt", () => {
    expect(safeJsonParse('{"a":1,"b":"x"}')).toEqual({ a: 1, b: "x" });
  });

  it("liest ein Objekt aus einem Markdown-Fence", () => {
    expect(safeJsonParse('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("liest ein Objekt aus umgebendem Fliesstext", () => {
    // Dieser Fall — und nur dieser — erreicht die geaenderte
    // Extraktionszeile: nacktes und gefenctes Objekt parsen bereits im `try`.
    expect(
      safeJsonParse('Gerne! {"hints":["a"]} Ich hoffe, das hilft.'),
    ).toEqual({ hints: ["a"] });
  });

  it("dehnt sich wie der alte gierige Regex bis zur letzten Klammer", () => {
    expect(safeJsonParse('Antwort: {"a":{"b":2}} Ende')).toEqual({
      a: { b: 2 },
    });
  });

  it("liefert null bei kaputtem JSON zwischen den Klammern", () => {
    expect(safeJsonParse('Hier: {"a": } Ende')).toBeNull();
  });

  it("liefert null, wenn gar keine Klammer da ist", () => {
    expect(
      safeJsonParse("Ich kann diese Anfrage nicht beantworten."),
    ).toBeNull();
  });

  it("liefert null bei oeffnender Klammer ohne schliessende", () => {
    expect(safeJsonParse("Beginn { und dann nichts mehr")).toBeNull();
  });

  it("liefert null bei leerer Eingabe", () => {
    expect(safeJsonParse("")).toBeNull();
  });

  // Zeitschranke, kein Verhaltenstest. Gemessene Kurve des alten Regex
  // `/\{[\s\S]*\}/`: 20k -> 183 ms, 40k -> 740 ms, 50k -> 1129 ms. Die lineare
  // Fassung braucht wenige Millisekunden; das Budget liegt dazwischen.
  it("bleibt bei 50.000 oeffnenden Klammern unter dem Zeitbudget", () => {
    const pathological = "{".repeat(50_000);
    const started = performance.now();
    expect(safeJsonParse(pathological)).toBeNull();
    expect(performance.now() - started).toBeLessThan(250);
  });
});

describe("parseBatchTranslateResponse", () => {
  it("liest ein nacktes JSON-Objekt", () => {
    expect(
      parseBatchTranslateResponse('{"title":"Titel","body":"Text"}', [
        "title",
        "body",
      ]),
    ).toEqual({ title: "Titel", body: "Text" });
  });

  it("liest ein Objekt aus einem json-Fence", () => {
    expect(
      parseBatchTranslateResponse('```json\n{"title":"Titel"}\n```', ["title"]),
    ).toEqual({ title: "Titel" });
  });

  it("liest ein Objekt aus einem Fence ohne Sprachangabe", () => {
    expect(
      parseBatchTranslateResponse('```\n{"title":"Titel"}\n```', ["title"]),
    ).toEqual({ title: "Titel" });
  });

  it("liest einen Fence, der in Fliesstext eingebettet ist", () => {
    expect(
      parseBatchTranslateResponse(
        'Hier die Uebersetzung:\n```json\n{"title":"Titel"}\n```\nViel Erfolg!',
        ["title"],
      ),
    ).toEqual({ title: "Titel" });
  });

  it("nimmt nur die erwarteten Felder auf", () => {
    expect(
      parseBatchTranslateResponse('{"title":"Titel","extra":"weg"}', ["title"]),
    ).toEqual({ title: "Titel" });
  });

  it("wirft bei einer Antwort ohne Fence und ohne JSON", () => {
    expect(() =>
      parseBatchTranslateResponse("Das kann ich nicht uebersetzen.", ["title"]),
    ).toThrow("Failed to parse AI translation response as JSON");
  });

  it("wirft bei einem Fence mit kaputtem JSON", () => {
    expect(() =>
      parseBatchTranslateResponse('```json\n{"title":\n```', ["title"]),
    ).toThrow("Failed to parse AI translation response as JSON");
  });

  it("gibt ohne Fence den Rohtext zurueck, wenn der Aufrufer das zulaesst", () => {
    expect(
      parseBatchTranslateResponse("  Nur ein Satz.  ", ["title"], {
        allowRawFallback: true,
      }),
    ).toEqual({ title: "Nur ein Satz." });
  });

  // Zeitschranke. Das alte Muster hatte `\s*` direkt vor `([\s\S]*?)` — beide
  // matchen Whitespace, das ist das polynomiale Paar. Gemessen auf
  // "```" + n Leerzeichen ohne schliessenden Fence: 50k -> 192 ms,
  // 120k -> 1138 ms. Ohne `\s*` liegt dieselbe Eingabe unter 1 ms.
  it("bleibt bei einem unabgeschlossenen Fence mit 120.000 Leerzeichen unter dem Zeitbudget", () => {
    const pathological = "```" + " ".repeat(120_000);
    const started = performance.now();
    expect(() => parseBatchTranslateResponse(pathological, ["title"])).toThrow(
      "Failed to parse AI translation response as JSON",
    );
    expect(performance.now() - started).toBeLessThan(250);
  });
});
