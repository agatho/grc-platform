/// <reference lib="dom" />

/**
 * [ARCTOS-FULL-2026-08-31 · OP-033] Ein unsichtbares Element ist kein
 * bedienbares Element.
 *
 * Der Befund und die Entscheidung stehen im Kopf von
 * `src/editor/visibility.ts`; hier wird beides geprüft.
 *
 * Zwei Teile, und der zweite ist der wichtigere:
 *
 *   **Teil A** misst das Verhalten an den Bedienpfaden, die OP-033 nennt —
 *   `Strg+A` und die Ansage.
 *
 *   **Teil B** schliesst die Klasse über den QUELLTEXT. OP-033 war kein
 *   vergessener Filter an einer Stelle, sondern sieben Aufzählungen über die
 *   `elementRegistry`, von denen jede für sich plausibel aussah. Ein Test,
 *   der nur `Strg+A` prüft, lässt die anderen sechs offen und den achten
 *   Aufruf erst recht. Deshalb prüft Teil B, dass in `src/editor/` überhaupt
 *   niemand mehr `getAll()` aufruft ausser `visibility.ts` selbst.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ElementRegistryLike,
  SelectionLike,
} from "../../src/editor/types";
import { openEditor } from "./helpers/editor";
import { COLLABORATION } from "../modeling/helpers/fixtures";
import {
  isHiddenInDiagram,
  isVisibleInDiagram,
  visibleElements,
} from "../../src/editor/visibility";
import type { BpmnElement } from "../../src/modeling/types";

const EDITOR_SRC = join(__dirname, "../../src/editor");

interface ToggleCollapse {
  modeling: { toggleCollapse(shape: unknown): void };
}

describe("OP-033 · Teil A — eingeklappte Subprozesse sind nicht bedienbar", () => {
  it("Strg+A überspringt die Kinder und die Ansage zählt sie nicht mit", async () => {
    const harness = await openEditor(COLLABORATION);
    const registry = harness.service<ElementRegistryLike>("elementRegistry");
    const selection = harness.service<SelectionLike>("selection");

    harness.key({ key: "a", ctrlKey: true });
    expect(harness.said()).toBe("15 Elemente ausgewählt.");

    (harness.session as unknown as ToggleCollapse).modeling.toggleCollapse(
      registry.get("Sub_A"),
    );

    // Der Ausgangsbefund, ausdrücklich festgehalten: die Registry ändert
    // sich NICHT. Genau das ist der Punkt, an dem die Entscheidung (B)
    // hängt — würde hier je auf (A) umgestellt, muss dieser Test brechen
    // und die Entscheidung neu begründet werden.
    expect(registry.get("Sub_Start")).toBeDefined();
    expect(
      (registry.get("Sub_Start") as unknown as { hidden?: boolean }).hidden,
    ).toBe(true);

    harness.key({ key: "a", ctrlKey: true });
    const ids = selection.get().map((e) => e.id);
    expect(ids).not.toContain("Sub_Start");
    expect(ids).not.toContain("Sub_End");
    expect(ids).not.toContain("Sub_Flow");
    expect(ids).toContain("Sub_A");
    expect(harness.said()).toBe("12 Elemente ausgewählt.");

    harness.destroy();
  });

  it("nach dem Aufklappen sind sie wieder da", async () => {
    // Die Gegenrichtung gehört dazu: ein Filter, der zu viel wegnimmt, wäre
    // derselbe Fehler mit umgekehrtem Vorzeichen.
    const harness = await openEditor(COLLABORATION);
    const registry = harness.service<ElementRegistryLike>("elementRegistry");
    const sub = registry.get("Sub_A");

    (harness.session as unknown as ToggleCollapse).modeling.toggleCollapse(sub);
    expect(visibleElements(registry)).toHaveLength(14);
    (harness.session as unknown as ToggleCollapse).modeling.toggleCollapse(sub);

    harness.key({ key: "a", ctrlKey: true });
    expect(harness.said()).toBe("15 Elemente ausgewählt.");
    harness.destroy();
  });

  it("die Suche findet nichts in einem eingeklappten Subprozess", async () => {
    const harness = await openEditor(COLLABORATION);
    const registry = harness.service<ElementRegistryLike>("elementRegistry");
    expect(visibleElements(registry).map((e) => e.id)).toContain("Sub_Start");
    (harness.session as unknown as ToggleCollapse).modeling.toggleCollapse(
      registry.get("Sub_A"),
    );
    expect(visibleElements(registry).map((e) => e.id)).not.toContain(
      "Sub_Start",
    );
    harness.destroy();
  });

  it("die Kennzeichnung wird über die Elternkette geerbt", () => {
    // Ein Enkel trägt `hidden` nicht selbst: `diagram-js` setzt es nur an
    // den direkten Kindern der eingeklappten Ebene. Ohne den Aufstieg über
    // `parent` bliebe die zweite Ebene bedienbar.
    const grandparent = { id: "Sub", hidden: true } as unknown as BpmnElement;
    const parent = { id: "Inner", parent: grandparent } as BpmnElement;
    const child = { id: "Task", parent } as BpmnElement;
    expect(isHiddenInDiagram(child)).toBe(true);
    expect(isVisibleInDiagram(child)).toBe(false);

    // Und eine Beschriftung erbt von ihrem Ziel, auch wenn sie im Baum
    // woanders hängt.
    const label = {
      id: "Task_label",
      labelTarget: child,
    } as unknown as BpmnElement;
    expect(isHiddenInDiagram(label)).toBe(true);

    // Ein Zyklus in `parent` darf den Wächter nicht aufhängen.
    const a = { id: "A" } as BpmnElement;
    const b = { id: "B", parent: a } as BpmnElement;
    (a as { parent?: BpmnElement }).parent = b;
    expect(isHiddenInDiagram(a)).toBe(false);
  });
});

describe("OP-033 · Teil B — niemand in src/editor läuft an der Sichtbarkeit vorbei", () => {
  /**
   * Es gibt genau eine erlaubte Ausnahme, und sie ist die Umsetzung selbst.
   * Wer eine zweite braucht, trägt sie hier ein — und muss dabei
   * hinschreiben, warum ein unsichtbares Element in seinem Fall bedienbar
   * sein soll.
   */
  const ERLAUBT = new Set(["visibility.ts"]);

  it("kein `elementRegistry.getAll()` ausserhalb von visibility.ts", () => {
    const treffer: string[] = [];
    for (const name of readdirSync(EDITOR_SRC)) {
      if (!name.endsWith(".ts") || ERLAUBT.has(name)) continue;
      const text = readFileSync(join(EDITOR_SRC, name), "utf8");
      text.split("\n").forEach((line, index) => {
        // Kommentare zählen nicht — der Aufruf steht in mehreren
        // Begründungen namentlich drin.
        const code = line.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
        // Nur AUFRUFE (`x.getAll()`), nicht die Deklaration der
        // Schnittstelle in `types.ts`.
        if (/\.\s*getAll\s*\(\s*\)/.test(code)) {
          treffer.push(`${name}:${String(index + 1)}  ${line.trim()}`);
        }
      });
    }
    expect(
      treffer,
      "Aufzählungen über die elementRegistry laufen in dieser Schicht über " +
        "`visibleElements(registry)` — sonst sind die Kinder eines " +
        "eingeklappten Subprozesses wieder bedienbar (OP-033).",
    ).toEqual([]);
  });

  it("`types.ts` deklariert `getAll()` weiterhin — der Test prüft Aufrufe, keine Signaturen", () => {
    // Ohne diese Zusicherung wäre der Test oben auch dann grün, wenn die
    // Schnittstelle umbenannt würde und die Suche ins Leere liefe.
    const text = readFileSync(join(EDITOR_SRC, "types.ts"), "utf8");
    expect(text).toContain("getAll(): BpmnElement[];");
  });
});
