import { describe, expect, it } from "vitest";

import { layoutText, measureText } from "../../src/draw/text.js";

/**
 * Das Textlayout ist der Teil des Renderers, der ohne DOM-Messung auskommen
 * muss (jsdom, Worker, SVG-Export). Geprüft wird deshalb die Schätzung selbst.
 */

/** Setzt hart getrennte Zeilen wieder zum ursprünglichen Text zusammen. */
function joinBroken(lines: readonly string[]): string {
  return lines
    .map((line, index) =>
      index < lines.length - 1 ? line.replace(/-$/, "") : line,
    )
    .join("");
}

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
    // Der Trennstrich ist Zusatz, kein Zeichenverlust: ohne ihn steht das
    // ursprüngliche Wort wieder da.
    expect(joinBroken(layout.lines)).toBe("Lieferantenstammdatenpflegeprozess");
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

  /**
   * Der Kern der Umbruchregel, gemessen am Fall aus dem Korpus
   * (`repo-seed-goods-receipt`: Aufgabe „Nach Behandlungsklassen sortieren"
   * in einer 100 px breiten Form, also 90 px Textbreite).
   *
   * Geprüft wird gegen `measureText` — die eigene Messfunktion. jsdom hat
   * keine Textmetrik: `getComputedTextLength` fehlt, `getBBox` liefert
   * Nullflächen. Eine Prüfung gegen den DOM würde nichts messen, sondern nur
   * die Nullwerte von jsdom bestätigen.
   */
  describe("Wortgrenzen", () => {
    const WIDTH = 90;
    const SIZE = 12;

    it("zerteilt kein Wort, das allein in eine Zeile passt", () => {
      const words = ["Nach", "Behandlungsklassen", "sortieren"];
      const layout = layoutText(words.join(" "), {
        width: WIDTH,
        fontSize: SIZE,
      });

      for (const line of layout.lines) {
        for (const raw of line.split(" ")) {
          const fragment = raw.replace(/-$/, "");
          if (fragment === "") continue;
          if (words.includes(fragment)) continue;
          // Kein vollständiges Wort: das ist nur zulässig, wenn das Wort,
          // aus dem das Fragment stammt, allein breiter als die Zeile ist.
          const source = words.find((word) => word.includes(fragment));
          expect(
            source,
            `Fragment „${fragment}" gehört zu keinem Wort`,
          ).toBeDefined();
          expect(measureText(source ?? "", SIZE)).toBeGreaterThan(WIDTH);
        }
      }
    });

    it("hält jede Zeile innerhalb der gemessenen Breite", () => {
      const texts = [
        "Nach Behandlungsklassen sortieren",
        "Eingehende Rechnung sachlich und rechnerisch prüfen",
        "Antrags-Prüfung durch die zweite Verteidigungslinie",
        "wareneingangPruefungDurchfuehren",
        "A2b7f19c4e88d0a1b2c3d4e5f60718293a4b5c6d",
        "Ü",
      ];
      for (const text of texts) {
        const layout = layoutText(text, { width: WIDTH, fontSize: SIZE });
        for (const line of layout.lines) {
          expect(
            measureText(line, SIZE),
            `Zeile „${line}" aus „${text}"`,
          ).toBeLessThanOrEqual(WIDTH);
        }
      }
    });

    it("trennt im Wort nur, wenn das Wort breiter als die Zeile ist", () => {
      const layout = layoutText("Antrag pruefen und danach entscheiden", {
        width: WIDTH,
        fontSize: SIZE,
      });
      for (const word of "Antrag pruefen und danach entscheiden".split(" ")) {
        expect(measureText(word, SIZE)).toBeLessThanOrEqual(WIDTH);
      }
      expect(layout.lines.some((line) => line.endsWith("-"))).toBe(false);
      expect(layout.lines.join(" ")).toBe(
        "Antrag pruefen und danach entscheiden",
      );
    });

    it("markiert einen harten Bruch mit einem Trennstrich", () => {
      expect(measureText("Behandlungsklassen", SIZE)).toBeGreaterThan(WIDTH);
      const layout = layoutText("Behandlungsklassen", {
        width: WIDTH,
        fontSize: SIZE,
      });
      expect(layout.lines.length).toBeGreaterThan(1);
      expect(layout.lines[0]?.endsWith("-")).toBe(true);
      expect(layout.lines.at(-1)?.endsWith("-")).toBe(false);
      expect(joinBroken(layout.lines)).toBe("Behandlungsklassen");
    });

    it("bevorzugt vorhandene Trennstellen vor dem harten Bruch", () => {
      const layout = layoutText("Lieferanten-Stammdaten-Pflege", {
        width: WIDTH,
        fontSize: SIZE,
      });
      expect(layout.lines).toEqual(["Lieferanten-", "Stammdaten-", "Pflege"]);
    });

    it("trennt camelCase am Wortübergang", () => {
      const layout = layoutText("wareneingangPruefungDurchfuehren", {
        width: WIDTH,
        fontSize: SIZE,
      });
      expect(layout.lines).toEqual([
        "wareneingang",
        "Pruefung",
        "Durchfuehren",
      ]);
    });
  });
});
