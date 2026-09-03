/// <reference lib="dom" />

/**
 * [ARCTOS-FULL-2026-08-31 · OP-031, OP-032] Werkzeuge und Bereichsauswahl.
 *
 * **Reproduktion vor der Reparatur, beides gemessen.**
 *
 * - OP-031: `grep -rn "lasso\|space-tool\|hand-tool" packages/bpmn/src/` ergab
 *   vor dieser Welle **einen** Treffer, und der stand in einem Kommentar
 *   (`src/verify/shadow.ts:339`). Die Module waren also nicht „vorhanden, aber
 *   ohne Palette-Eintrag" (so der Registereintrag), sondern gar nicht
 *   registriert. `injector.get("lassoTool", false)` lieferte `null`.
 * - OP-032: die Palette hatte 17 Knöpfe, die Tastenbehandlung kannte `Strg+A`
 *   (alles) und `Strg+Leertaste` (eines dazu). Um die sechs Elemente **einer**
 *   Lane von `synth-collaboration-pools-lanes` zu wählen, brauchte es sechs
 *   Fokusfahrten und sechs Tastendrücke.
 *
 * Jeder Test hier führt seine Handlung **ausschließlich über Tastenereignisse**
 * aus — das ist der Nachweis, den die Arbeitsweise für eine neue Bedienfunktion
 * verlangt — und prüft die Ansage mit.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { TOOL_IDS, TOOL_LABELS, directionOf } from "../../src/editor/Tools";
import type { EditorTools } from "../../src/editor/Tools";
import {
  compareByPosition,
  containerLabel,
} from "../../src/editor/RangeSelection";
import type { RangeSelection } from "../../src/editor/RangeSelection";
import type { PaletteChrome } from "../../src/editor/PaletteChrome";
import { KEY_BINDINGS } from "../../src/editor/KeyboardHelp";
import type { BpmnElement, BpmnShape } from "../../src/modeling/types";
import { openEditor, act, type EditorHarness } from "./helpers/editor";

const CORPUS = join(import.meta.dirname, "..", "corpus");
const corpus = (name: string): string =>
  readFileSync(join(CORPUS, `${name}.bpmn`), "utf8");

let harness: EditorHarness;

beforeEach(() => {
  document.body.replaceChildren();
});

interface SelectionLike {
  get(): BpmnElement[];
  select(element: unknown): void;
}

/**
 * Fokus im DOM setzen — die Tastenbehandlung liest ihn von dort
 * (`EditorKeyboard.focusedFromDom`).
 *
 * `tabindex` gehört dazu: jsdom vergibt `document.activeElement` nur an
 * fokussierbare Knoten, und die a11y-Schicht, die das sonst besorgt
 * (`viewer/a11y.ts`), läuft im Prüfstand der Bedienschicht nicht mit. Ohne die
 * Zeile bliebe `focused()` leer und der Test prüfte nichts.
 */
function focus(h: EditorHarness, id: string): void {
  const graphics = h.session
    .get<{ getGraphics(id: string): SVGElement | undefined }>("elementRegistry")
    .getGraphics(id);
  const node = graphics as unknown as HTMLElement | undefined;
  node?.setAttribute("data-element-id", id);
  node?.setAttribute("tabindex", "-1");
  node?.focus();
  expect(
    h.canvasContainer.ownerDocument.activeElement?.getAttribute(
      "data-element-id",
    ),
    `Fokus auf ${id} liess sich nicht setzen`,
  ).toBe(id);
}

describe("OP-031 — die drei Werkzeuge sind registriert", () => {
  it("stellt handTool, lassoTool und spaceTool im Bearbeitungsmodus bereit", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    for (const name of ["handTool", "lassoTool", "spaceTool", "toolManager"]) {
      expect(
        harness.session.get<unknown>(name),
        `«${name}» fehlt im Container`,
      ).toBeDefined();
    }
    harness.destroy();
  });

  it("zeigt sie als eigene Palettengruppe mit aria-pressed", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    const node = harness
      .service<PaletteChrome>("paletteChrome")
      .element() as HTMLElement;

    const toolButtons = Array.from(
      node.querySelectorAll<HTMLElement>(
        '[data-group="werkzeuge"] button.entry',
      ),
    );
    expect(toolButtons).toHaveLength(TOOL_IDS.length);
    for (const button of toolButtons) {
      // `aria-pressed` und nicht eine Klasse: „welches Werkzeug ist an" ist
      // eine Zustandsaussage, die auch hörbar sein muss.
      expect(button.getAttribute("aria-pressed")).toBe("false");
      expect(button.getAttribute("aria-label")?.length ?? 0).toBeGreaterThan(
        10,
      );
    }
    // Die Gruppe hat einen Namen — sonst hört ein Screenreader drei Knöpfe
    // ohne Zusammenhang.
    const group = node.querySelector('[data-group="werkzeuge"]');
    expect(group?.getAttribute("aria-label")).toBe("Werkzeuge");
    harness.destroy();
  });
});

describe("OP-031 — Werkzeuge lassen sich ohne Maus schalten", () => {
  it("schaltet mit h, l und s ein und wieder aus, jeweils mit Ansage", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    const tools = harness.service<EditorTools>("editorTools");

    for (const tool of TOOL_IDS) {
      const key = TOOL_LABELS[tool].key.toLowerCase();
      harness.key({ key });
      expect(tools.active(), `«${key}» schaltet ${tool} nicht ein`).toBe(tool);
      expect(harness.said()).toContain(TOOL_LABELS[tool].title);
      expect(harness.said()).toContain("Escape");

      harness.key({ key });
      expect(tools.active(), `«${key}» schaltet ${tool} nicht aus`).toBeNull();
      expect(harness.said()).toContain("ausgeschaltet");
    }
    harness.destroy();
  });

  it("hält genau ein Werkzeug aktiv und beendet es mit Escape", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    const tools = harness.service<EditorTools>("editorTools");

    harness.key({ key: "h" });
    harness.key({ key: "l" });
    expect(tools.active()).toBe("lasso");
    expect(tools.isActive("hand")).toBe(false);

    harness.key({ key: "Escape" });
    expect(tools.active()).toBeNull();
    harness.destroy();
  });

  it("spiegelt den Zustand in aria-pressed der Palette", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    harness.key({ key: "l" });
    const pressed = harness
      .service<PaletteChrome>("paletteChrome")
      .element()
      ?.querySelector(
        '[data-action="tool.lasso"] button.entry, button.entry[aria-label*="Lasso"]',
      );
    expect(pressed?.getAttribute("aria-pressed")).toBe("true");
    harness.destroy();
  });

  it("nennt jede Werkzeugtaste in der Tastaturhilfe", async () => {
    // Derselbe Wächter gegen Drift wie für die übrigen Tasten: die Hilfe ist
    // die einzige Quelle der Belegung.
    for (const tool of TOOL_IDS) {
      const key = TOOL_LABELS[tool].key.toLowerCase();
      expect(
        KEY_BINDINGS.some((binding) => binding.keys === key),
        `«${key}» fehlt in KEY_BINDINGS`,
      ).toBe(true);
    }
  });
});

describe("OP-031 — der Tastatur-Zwilling des Platz-Werkzeugs", () => {
  it("schiebt mit Pfeiltasten Platz hinter das fokussierte Element", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    const registry = harness.session.get<{
      get(id: string): BpmnShape | undefined;
      getAll(): BpmnElement[];
    }>("elementRegistry");

    const anchor = harness.session.shape("Task_Kunde_Antrag");
    const cut = anchor.x + anchor.width;
    const positions = (): Map<string, number> =>
      new Map(
        registry
          .getAll()
          .filter(
            (element): element is BpmnShape =>
              typeof (element as BpmnShape).width === "number" &&
              (element as BpmnShape).labelTarget === undefined,
          )
          .map((shape) => [shape.id, shape.x]),
      );
    const before = positions();

    focus(harness, "Task_Kunde_Antrag");
    act(
      harness,
      "Platz schaffen per Tastatur",
      () => {
        harness.key({ key: "s" });
        harness.key({ key: "ArrowRight" });
      },
      {
        after: () => {
          const after = positions();
          const moved = [...before].filter(
            ([id, x]) => (after.get(id) ?? x) > x,
          );
          // Mindestens ein Element ist gerückt — sonst hätte die Taste nichts
          // getan.
          expect(moved.length, "nichts ist gerückt").toBeGreaterThan(0);
          // Und **nichts** vor dem Schnitt: „Platz hinter diesem Schritt"
          // heißt, dass davor alles stehen bleibt. Das ist die Aussage, die
          // ein falsch gesetztes `start` als Erstes bricht.
          for (const [id, x] of before) {
            if (x + (registry.get(id)?.width ?? 0) <= cut) {
              expect(after.get(id), `${id} steht nicht mehr, wo es war`).toBe(
                x,
              );
            }
          }
        },
        afterUndo: () => {
          const restored = positions();
          for (const [id, x] of before) {
            expect(restored.get(id), `${id} ist nach Undo verschoben`).toBe(x);
          }
        },
      },
    );
    expect(harness.said()).toContain("Platz");
    harness.destroy();
  });

  it("sagt es an, statt stumm zu bleiben, wenn dahinter nichts liegt", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    const tools = harness.service<EditorTools>("editorTools");
    const shapes = harness.session
      .get<{ getAll(): BpmnElement[] }>("elementRegistry")
      .getAll()
      .filter(
        (element): element is BpmnShape =>
          typeof (element as BpmnShape).width === "number" &&
          (element as BpmnShape).labelTarget === undefined,
      )
      .sort((a, b) => b.x + b.width - (a.x + a.width));
    const rightmost = shapes[0]!;
    expect(tools.makeSpace(rightmost, { x: 20, y: 0 })).toBe(false);
    expect(harness.said()).toContain("nichts");
    harness.destroy();
  });

  it("übersetzt Achse und Vorzeichen in die Himmelsrichtung", () => {
    expect(directionOf("x", 20)).toBe("e");
    expect(directionOf("x", -20)).toBe("w");
    expect(directionOf("y", 20)).toBe("s");
    expect(directionOf("y", -20)).toBe("n");
  });
});

describe("OP-032 — alles in dieser Lane, per Tastatur", () => {
  it("wählt mit Strg+Umschalt+A alles im Container des fokussierten Elements", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    const selection = harness.session.get<SelectionLike>("selection");
    const task = harness.session.shape("Task_Kunde_Antrag");
    const lane = task.parent as BpmnElement;

    focus(harness, "Task_Kunde_Antrag");
    harness.key({ key: "a", ctrlKey: true, shiftKey: true });

    const selected = selection.get();
    expect(selected.length).toBeGreaterThan(1);
    // Genau der Container — nichts aus einer anderen Lane.
    for (const element of selected) {
      expect(element.parent).toBe(lane);
    }
    // Und die Ansage nennt Zahl **und** Container, sonst weiß ein
    // Screenreader-Nutzer nicht, was gerade markiert ist.
    expect(harness.said()).toContain(String(selected.length));
    expect(harness.said()).toContain(containerLabel(lane as never));
    harness.destroy();
  });

  it("trifft weniger als Strg+A — sonst wäre die Taste ohne Wert", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    const selection = harness.session.get<SelectionLike>("selection");

    harness.key({ key: "a", ctrlKey: true });
    const all = selection.get().length;

    focus(harness, "Task_Kunde_Antrag");
    harness.key({ key: "a", ctrlKey: true, shiftKey: true });
    const inLane = selection.get().length;

    expect(inLane).toBeGreaterThan(0);
    expect(inLane).toBeLessThan(all);
    harness.destroy();
  });

  it("sagt an, wenn kein Element im Fokus ist", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    harness.session.get<SelectionLike>("selection").select(null);
    harness
      .service<RangeSelection>("rangeSelection")
      .selectContainer(undefined);
    expect(harness.said()).toContain("kein Element");
    harness.destroy();
  });
});

describe("OP-032 — Strecke vom Anker bis hierher", () => {
  it("setzt beim ersten Druck den Anker und spannt beim zweiten auf", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    const selection = harness.session.get<SelectionLike>("selection");
    const range = harness.service<RangeSelection>("rangeSelection");

    selection.select(null);
    const first = harness.session.shape("Task_Kunde_Antrag");
    range.extendRange(first);
    expect(selection.get()).toEqual([first]);
    expect(harness.said()).toContain("Anfang");

    const second = harness.session.shape("Task_Kunde_Empfang");
    const spanned = range.extendRange(second);
    expect(spanned.length).toBeGreaterThan(1);
    expect(spanned).toContain(first);
    expect(spanned).toContain(second);
    expect(harness.said()).toContain(String(spanned.length));
    harness.destroy();
  });

  it("erreicht dieselbe Strecke allein über Tastenereignisse", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    const selection = harness.session.get<SelectionLike>("selection");
    selection.select(null);

    focus(harness, "Task_Kunde_Antrag");
    harness.key({ key: " ", shiftKey: true });
    expect(selection.get()).toHaveLength(1);

    focus(harness, "Task_Kunde_Empfang");
    harness.key({ key: " ", shiftKey: true });
    expect(selection.get().length).toBeGreaterThan(1);
    harness.destroy();
  });

  it("ordnet nach Zeichenposition, nicht nach Kennung", () => {
    const at = (id: string, x: number, y: number): BpmnElement =>
      ({ id, x, y, width: 10, height: 10 }) as unknown as BpmnElement;
    const sorted = [at("c", 0, 100), at("a", 200, 0), at("b", 0, 0)]
      .sort(compareByPosition)
      .map((element) => element.id);
    expect(sorted).toEqual(["b", "a", "c"]);
  });
});
