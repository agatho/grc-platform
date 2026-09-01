import { describe, expect, it } from "vitest";

import { layoutText, measureText } from "../../src/draw/text.js";

/**
 * Das Textlayout ist der Teil des Renderers, der ohne DOM-Messung auskommen
 * muss (jsdom, Worker, SVG-Export). Geprüft wird deshalb die Schätzung selbst.
 */
describe("Textlayout", () => {
  it("schätzt Breiten monoton und schriftgrößenproportional", () => {
    expect(measureText("", 12)).toBe(0);
    expect(measureText("iiii", 12)).toBeLessThan(measureText("WWWW", 12));
    expect(measureText("Rechnung", 24)).toBeCloseTo(
      measureText("Rechnung", 12) * 2,
      5,
    );
  });

  it("bricht an Leerzeichen um", () => {
    const layout = layoutText("Eingehende Rechnung sachlich prüfen", {
      width: 90,
      fontSize: 12,
    });
    expect(layout.lines.length).toBeGreaterThan(1);
    for (const line of layout.lines) {
      expect(measureText(line, 12)).toBeLessThanOrEqual(90);
    }
  });

  it("bricht auch Wörter, die allein nicht passen", () => {
    const layout = layoutText("Lieferantenstammdatenpflegeprozess", {
      width: 60,
      fontSize: 12,
    });
    expect(layout.lines.length).toBeGreaterThan(1);
    expect(layout.lines.join("")).toBe("Lieferantenstammdatenpflegeprozess");
  });

  it("behält vorhandene Zeilenumbrüche", () => {
    const layout = layoutText("Zeile eins\nZeile zwei", {
      width: 200,
      fontSize: 12,
    });
    expect(layout.lines).toEqual(["Zeile eins", "Zeile zwei"]);
  });

  it("kürzt mit Auslassungszeichen, wenn die Höhe nicht reicht", () => {
    const layout = layoutText(
      "Ein sehr langer Text, der in eine flache Form nicht hineinpasst und deshalb gekürzt werden muss",
      { width: 80, fontSize: 12, maxHeight: 30 },
    );
    expect(layout.lines).toHaveLength(2);
    expect(layout.lines.at(-1)).toMatch(/…$/);
  });

  it("liefert Höhe und Breite passend zu den Zeilen", () => {
    const layout = layoutText("Kurz", { width: 200, fontSize: 12 });
    expect(layout.lines).toEqual(["Kurz"]);
    expect(layout.height).toBeCloseTo(12 * 1.2, 5);
    expect(layout.width).toBeCloseTo(measureText("Kurz", 12), 5);
  });

  it("Umlaute und Sonderzeichen zählen mit", () => {
    expect(measureText("Prüfung", 12)).toBeGreaterThan(
      measureText("Prfung", 12),
    );
  });
});
