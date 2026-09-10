/// <reference lib="dom" />

/**
 * Die drei Bedienlücken, die `STUFE2-D` geschlossen hat — plus das Auto-Resize.
 *
 * Alle vier standen in `STUFE2-C-ABSCHLUSS.md` §5 als offene Punkte:
 *
 *   6. kein Auto-Resize — ein Element am Rand vergrößert den Container nicht;
 *   7. Containerwechsel nur mit der Maus;
 *   8. keine Suche, keine Tastaturhilfe.
 *
 * Geprüft wird jeweils über **echte Tastaturereignisse** und über die
 * Invarianten nach der Handlung und nach dem Undo — der Maßstab dieser Suite:
 * eine Bedienhandlung, ein Strg-Z, und danach ein Dokument, das ein
 * Fremdwerkzeug noch lesen kann.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ContainerMode } from "../../src/editor/ContainerMode";
import type { DiagramFind } from "../../src/editor/Find";
import type { KeyboardHelp } from "../../src/editor/KeyboardHelp";
import { placeInside } from "../../src/editor/ContainerMode";
import { matchesFor, searchKey } from "../../src/editor/Find";
import { KEY_BINDINGS, buildHelp } from "../../src/editor/KeyboardHelp";
import { canAutoResize } from "../../src/modeling/behaviors/AutoResizeBehavior";
import { openEditor, act, type EditorHarness } from "./helpers/editor";
import type { BpmnShape } from "../../src/modeling/types";

const CORPUS = join(import.meta.dirname, "..", "corpus");
const corpus = (name: string): string =>
  readFileSync(join(CORPUS, `${name}.bpmn`), "utf8");

let harness: EditorHarness;

beforeEach(() => {
  document.body.replaceChildren();
});

// ---------------------------------------------------------------------------
// Containerwechsel per Tastatur
// ---------------------------------------------------------------------------

describe("Containerwechsel per Tastatur (`m`)", () => {
  it("bietet nur Container an, die die Regeln zulassen — und nicht den bisherigen", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    const task = harness.session.shape("Task_Kunde_Antrag");
    harness.session.get<{ select(e: unknown): void }>("selection").select(task);

    harness.key({ key: "m" });
    const mode = harness.service<ContainerMode>("containerMode");
    expect(mode.isActive()).toBe(true);

    const ids = mode.candidates().map((element) => element.id);
    // Der bisherige Container steht nicht zur Wahl …
    expect(ids).not.toContain(task.parent?.id);
    // … die fremde Lane und der fremde Pool schon.
    expect(ids).toContain("Lane_Sachbearbeitung");
    expect(ids).toContain("Participant_Bank");
    harness.destroy();
  });

  it("legt die Aktivität wirklich in die gewählte Lane — ein Strg-Z nimmt es zurück", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    const task = harness.session.shape("Task_Kunde_Antrag");
    const before = task.parent?.id;
    harness.session.get<{ select(e: unknown): void }>("selection").select(task);
    const mode = harness.service<ContainerMode>("containerMode");

    act(
      harness,
      "Containerwechsel",
      () => {
        harness.key({ key: "m" });
        // Bis zur gesuchten Lane blättern — genau so, wie ein Nutzer es tut.
        let guard = 0;
        while (mode.current()?.id !== "Lane_Genehmigung" && guard < 50) {
          harness.key({ key: "ArrowRight" });
          guard += 1;
        }
        expect(mode.current()?.id).toBe("Lane_Genehmigung");
        harness.key({ key: "Enter" });
      },
      {
        after: () => {
          const moved = harness.session.shape("Task_Kunde_Antrag");
          expect(moved.parent?.id).toBe("Lane_Genehmigung");
          expect(harness.said()).toContain("liegt jetzt in");
        },
        afterUndo: () => {
          expect(harness.session.shape("Task_Kunde_Antrag").parent?.id).toBe(
            before,
          );
        },
        undoSteps: 1,
      },
    );
    harness.destroy();
  });

  it("bricht mit Escape ab, ohne etwas zu ändern", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    const task = harness.session.shape("Task_Kunde_Antrag");
    const before = task.parent?.id;
    harness.session.get<{ select(e: unknown): void }>("selection").select(task);

    harness.key({ key: "m" });
    harness.key({ key: "ArrowRight" });
    harness.key({ key: "Escape" });

    expect(harness.service<ContainerMode>("containerMode").isActive()).toBe(
      false,
    );
    expect(harness.session.shape("Task_Kunde_Antrag").parent?.id).toBe(before);
    harness.destroy();
  });

  it("setzt das Element in den Container hinein, nicht auf seine Kante", () => {
    const box = { x: 100, y: 100, width: 400, height: 200 } as BpmnShape;
    const shape = { x: 0, y: 0, width: 100, height: 80 } as BpmnShape;
    const at = placeInside(box, shape);
    expect(at.x).toBeGreaterThanOrEqual(box.x);
    expect(at.y).toBeGreaterThanOrEqual(box.y);
    expect(at.x + shape.width).toBeLessThanOrEqual(box.x + box.width);
    expect(at.y + shape.height).toBeLessThanOrEqual(box.y + box.height);
  });

  it("lässt ein Ziel ohne Geometrie das Element, wo es ist", () => {
    // Die Wurzel hat keine Bounds; sie soll das Element nicht auf (NaN|NaN)
    // schieben, sondern es stehen lassen.
    const root = { id: "Process_1" } as unknown as BpmnShape;
    const shape = { x: 42, y: 43, width: 100, height: 80 } as BpmnShape;
    expect(placeInside(root, shape)).toEqual({ x: 42, y: 43 });
  });
});

// ---------------------------------------------------------------------------
// Suche
// ---------------------------------------------------------------------------

describe("Suche (`/`)", () => {
  it("normalisiert Umlaute und Groß-/Kleinschreibung", () => {
    expect(searchKey("Prüfung  DURCHFÜHREN")).toBe("prufung durchfuhren");
  });

  it("findet den Schritt über seinen Namen, ohne die Beschriftungselemente", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    const all = harness.session.elementRegistry.getAll();
    const hits = matchesFor(all as never, "antrag");
    expect(hits.length).toBeGreaterThan(0);
    // Kein Treffer ist eine Beschriftung, keiner ist die Wurzel.
    for (const hit of hits) {
      expect((hit as BpmnShape).labelTarget).toBeUndefined();
      expect(hit.parent).toBeDefined();
    }
    harness.destroy();
  });

  it("liefert für eine leere Anfrage nichts — nicht alles", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    const all = harness.session.elementRegistry.getAll();
    expect(matchesFor(all as never, "   ")).toEqual([]);
    harness.destroy();
  });

  it("öffnet mit `/`, wählt den Treffer aus und schließt mit Escape", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    harness.key({ key: "/" });
    const find = harness.service<DiagramFind>("diagramFind");
    expect(find.isOpen()).toBe(true);

    const input = find.element()?.querySelector("input");
    expect(input).toBeTruthy();
    if (!(input instanceof HTMLInputElement)) throw new Error("kein Feld");
    input.value = "Antrag";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(find.matches().length).toBeGreaterThan(0);
    expect(harness.said()).toContain("Treffer 1 von");

    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(find.isOpen()).toBe(false);
    harness.destroy();
  });

  it("verschluckt Tastendrücke im Eingabefeld — `Entf` löscht dort kein Element", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    const task = harness.session.shape("Task_Kunde_Antrag");
    harness.session.get<{ select(e: unknown): void }>("selection").select(task);
    harness.key({ key: "/" });
    const find = harness.service<DiagramFind>("diagramFind");
    const input = find.element()?.querySelector("input");
    if (!(input instanceof HTMLInputElement)) throw new Error("kein Feld");

    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Delete",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(harness.session.has("Task_Kunde_Antrag")).toBe(true);
    harness.destroy();
  });
});

// ---------------------------------------------------------------------------
// Tastaturhilfe
// ---------------------------------------------------------------------------

describe("Tastaturhilfe (`?`)", () => {
  it("öffnet und schließt mit derselben Taste", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    const help = harness.service<KeyboardHelp>("keyboardHelp");
    harness.key({ key: "?", shiftKey: true });
    expect(help.isOpen()).toBe(true);
    expect(help.element()?.getAttribute("role")).toBe("dialog");
    harness.key({ key: "?", shiftKey: true }, help.element() ?? undefined);
    expect(help.isOpen()).toBe(false);
    harness.destroy();
  });

  it("nennt jede Taste, die die Tastenbehandlung wirklich kennt", async () => {
    // Der Wächter gegen Drift: die Hilfe ist die einzige Quelle der Belegung,
    // also muss jede Taste, die sie nennt, auch verarbeitet werden. Geprüft
    // werden die Einzeltasten — die Modifikatorenkürzel hängen an
    // Browserkonventionen und stehen in keyboard.test.ts.
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    const keyboard = harness.service<{ handle(e: KeyboardEvent): boolean }>(
      "editorKeyboard",
    );
    const task = harness.session.shape("Task_Kunde_Antrag");
    harness.session.get<{ select(e: unknown): void }>("selection").select(task);

    for (const key of ["c", "m", "r", "b", "g", "/", "?"]) {
      expect(
        KEY_BINDINGS.some((binding) => binding.keys.split(" ")[0] === key),
        `«${key}» fehlt in KEY_BINDINGS`,
      ).toBe(true);
      const handled = keyboard.handle(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      );
      expect(handled, `«${key}» wird nicht verarbeitet`).toBe(true);
      // Betriebsart wieder verlassen, damit die nächste Taste frei ist.
      keyboard.handle(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
      harness.service<DiagramFind>("diagramFind").close(false);
      harness.service<KeyboardHelp>("keyboardHelp").close(false);
      harness.session
        .get<{ select(e: unknown): void }>("selection")
        .select(task);
    }
    harness.destroy();
  });

  it("baut Knoten statt Markup — Text bleibt Text", () => {
    // Der Wächter zur Auflage S12-15 („kein HTML-Einfüllpunkt im Baum"): der
    // Inhalt landet als `textContent`, also kann er niemals als Markup
    // ausgewertet werden. Ein Test gegen escapetes Markup prüfte nur, dass die
    // Escape-Funktion funktioniert; dieser prüft, dass es keine gibt.
    const nodes = buildHelp(document, [
      { group: "<b>G</b>", keys: "a & b", what: "x < y" },
    ]);
    const host = document.createElement("div");
    for (const node of nodes) host.appendChild(node);
    expect(host.querySelector("b")).toBeNull();
    expect(host.querySelector("h3")?.textContent).toBe("<b>G</b>");
    expect(host.querySelector("kbd")?.textContent).toBe("a & b");
    expect(host.querySelector("dd")?.textContent).toBe("x < y");
  });
});

// ---------------------------------------------------------------------------
// Auto-Resize
// ---------------------------------------------------------------------------

describe("Auto-Resize der Container", () => {
  it("vergrößert einen aufgeklappten Subprozess, wenn ein Element an seinen Rand kommt", async () => {
    harness = await openEditor(corpus("synth-all-event-types"));
    const sub = harness.session.shape("E_EventSub");
    const before = { width: sub.width, height: sub.height };
    const factory = harness.service<{
      createShape(attrs: Record<string, unknown>): never;
    }>("elementFactory");

    act(
      harness,
      "Element an den Rand legen",
      () =>
        harness.session.modeling.createShape(
          factory.createShape({ type: "bpmn:Task" }),
          { x: sub.x + sub.width - 5, y: sub.y + sub.height / 2 },
          sub as never,
        ),
      {
        after: () => {
          expect(harness.session.shape("E_EventSub").width).toBeGreaterThan(
            before.width,
          );
        },
        afterUndo: () => {
          const after = harness.session.shape("E_EventSub");
          expect(after.width).toBe(before.width);
          expect(after.height).toBe(before.height);
        },
      },
    );
    harness.destroy();
  });

  it("zieht die Lanes mit, wenn der Pool wächst — lückenlos", async () => {
    harness = await openEditor(corpus("synth-collaboration-pools-lanes"));
    const pool = harness.session.shape("Participant_Bank");
    const node = harness.session.shape("Task_Bank_Pruefen");
    // Der Shape ist ein *lebendes* Objekt: nach der Handlung trägt er bereits
    // die neue Höhe. Der Vergleichswert muss deshalb vorher kopiert werden.
    const poolBefore = { y: pool.y, height: pool.height };

    act(
      harness,
      "Knoten an den unteren Poolrand",
      () =>
        harness.session.modeling.moveElements([node] as never, {
          x: 0,
          y: pool.y + pool.height - node.y - 10,
        }),
      {
        after: () => {
          const grown = harness.session.shape("Participant_Bank");
          expect(grown.height).toBeGreaterThan(poolBefore.height);
          // Die Lanes teilen die neue Fläche restlos auf. Bliebe ein Streifen
          // übrig, verlöre ein Knoten dort seine `flowNodeRef` — und die
          // Invariante LANE_REF_* fände es erst beim nächsten Speichern.
          const lanes = ["Lane_Sachbearbeitung", "Lane_Genehmigung"]
            .map((id) => harness.session.shape(id))
            .sort((a, b) => a.y - b.y);
          expect(lanes[0]?.y).toBe(grown.y);
          expect((lanes[0]?.y ?? 0) + (lanes[0]?.height ?? 0)).toBe(
            lanes[1]?.y,
          );
          expect((lanes[1]?.y ?? 0) + (lanes[1]?.height ?? 0)).toBe(
            grown.y + grown.height,
          );
        },
      },
    );
    harness.destroy();
  });

  it("lässt einen eingeklappten Subprozess und eine Lane in Ruhe", () => {
    const collapsed = {
      id: "Sub_1",
      businessObject: { $type: "bpmn:SubProcess" },
      collapsed: true,
    } as unknown as BpmnShape;
    const lane = {
      id: "Lane_1",
      businessObject: { $type: "bpmn:Lane" },
    } as unknown as BpmnShape;
    const task = {
      id: "Task_1",
      businessObject: { $type: "bpmn:Task" },
    } as unknown as BpmnShape;
    expect(canAutoResize([task], collapsed)).toBe(false);
    expect(canAutoResize([task], lane)).toBe(false);
    // Eine bewegte Lane löst nirgends Wachstum aus.
    const pool = {
      id: "Pool_1",
      businessObject: { $type: "bpmn:Participant" },
    } as unknown as BpmnShape;
    expect(canAutoResize([lane], pool)).toBe(false);
    expect(canAutoResize([task], pool)).toBe(true);
  });
});
