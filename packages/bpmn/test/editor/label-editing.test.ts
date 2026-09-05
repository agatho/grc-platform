/// <reference lib="dom" />

/**
 * Direktes Beschriften (Auftrag Punkt 3).
 *
 * Doppelklick und `F2`, Textfeld über dem Element, mehrzeilig, `Escape`
 * verwirft, `Enter` übernimmt, `Tab` geht weiter — und nach jeder Übernahme
 * halten die Invarianten, auch nach dem Undo.
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { LabelEditing } from "../../src/editor/LabelEditing";
import { SIMPLE_PROCESS } from "../modeling/helpers/fixtures";
import { act, openEditor, type EditorHarness } from "./helpers/editor";

let harness: EditorHarness;

beforeEach(() => {
  document.body.replaceChildren();
});

function nameOf(harness: EditorHarness, id: string): string {
  const bo = harness.session.element(id).businessObject as { name?: unknown };
  return typeof bo.name === "string" ? bo.name : "";
}

describe("Öffnen", () => {
  it("öffnet ein mehrzeiliges Feld mit zugänglichem Namen", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const editing = harness.service<LabelEditing>("labelEditing");
    expect(editing.activate(harness.session.shape("Task_1"))).toBe(true);

    const input = editing.input();
    expect(input).not.toBeNull();
    expect(input?.tagName.toLowerCase()).toBe("textarea");
    expect(input?.value).toBe("Antrag pruefen");
    expect(input?.getAttribute("aria-label")).toContain("Beschriftung von");
    expect(document.activeElement).toBe(input);
    expect(harness.said()).toContain("wird bearbeitet");
    editing.cancel();
    harness.destroy();
  });

  it("öffnet bei Doppelklick auf das Element", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const editing = harness.service<LabelEditing>("labelEditing");
    harness.session.eventBus.fire("element.dblclick", {
      element: harness.session.shape("Gateway_1"),
    } as never);
    expect(editing.isActive()).toBe(true);
    editing.cancel();
    harness.destroy();
  });

  it("öffnet mit F2 das fokussierte Element", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    harness.session
      .get<{ select(element: unknown): void }>("selection")
      .select(harness.session.shape("Task_1"));
    harness.key({ key: "F2" });
    expect(harness.service<LabelEditing>("labelEditing").isActive()).toBe(true);
    harness.service<LabelEditing>("labelEditing").cancel();
    harness.destroy();
  });

  it("bearbeitet bei einer Beschriftung das beschriftete Element", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const editing = harness.service<LabelEditing>("labelEditing");
    const label = harness.session.elementRegistry
      .getAll()
      .find(
        (element) =>
          (element as { labelTarget?: unknown }).labelTarget !== undefined,
      );
    expect(label).toBeDefined();
    editing.activate(label as never);
    expect(editing.input()?.getAttribute("aria-label")).toContain(
      "Startereignis",
    );
    editing.cancel();
    harness.destroy();
  });
});

describe("Übernehmen und Verwerfen", () => {
  it("übernimmt mit Enter und hält die Invarianten, auch nach Undo", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const editing = harness.service<LabelEditing>("labelEditing");

    act(
      harness,
      "Beschriftung übernehmen",
      () => {
        editing.activate(harness.session.shape("Task_1"));
        const input = editing.input();
        if (input) input.value = "Antrag sorgfältig prüfen";
        input?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
      },
      {
        undoSteps: 1,
        after: () => {
          expect(nameOf(harness, "Task_1")).toBe("Antrag sorgfältig prüfen");
          expect(harness.said()).toContain("beschriftet mit");
        },
        afterUndo: () => {
          expect(nameOf(harness, "Task_1")).toBe("Antrag pruefen");
        },
      },
    );
    harness.destroy();
  });

  it("verwirft mit Escape ohne Kommando", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const editing = harness.service<LabelEditing>("labelEditing");
    const canUndoBefore = harness.session.commandStack.canUndo();

    editing.activate(harness.session.shape("Task_1"));
    const input = editing.input();
    if (input) input.value = "wird verworfen";
    input?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(nameOf(harness, "Task_1")).toBe("Antrag pruefen");
    expect(harness.session.commandStack.canUndo()).toBe(canUndoBefore);
    expect(harness.said()).toBe("Beschriftung verworfen.");
    harness.session.assertInvariants("nach dem Verwerfen");
    harness.destroy();
  });

  it("lässt Umschalt+Enter die Zeile umbrechen, statt zu übernehmen", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const editing = harness.service<LabelEditing>("labelEditing");
    editing.activate(harness.session.shape("Task_1"));
    editing.input()?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(editing.isActive()).toBe(true);
    editing.cancel();
    harness.destroy();
  });

  it("übernimmt eine mehrzeilige Beschriftung wörtlich", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const editing = harness.service<LabelEditing>("labelEditing");
    act(harness, "mehrzeilig beschriften", () => {
      editing.activate(harness.session.shape("Task_1"));
      const input = editing.input();
      if (input) input.value = "Antrag\nsorgfältig\nprüfen";
      editing.complete();
    });
    expect(nameOf(harness, "Task_1")).toBe("Antrag\nsorgfältig\nprüfen");
    harness.destroy();
  });

  it("entfernt eine geleerte Beschriftung", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const editing = harness.service<LabelEditing>("labelEditing");
    act(
      harness,
      "Beschriftung leeren",
      () => {
        editing.activate(harness.session.shape("StartEvent_1"));
        const input = editing.input();
        if (input) input.value = "";
        editing.complete();
      },
      {
        undoSteps: 1,
        after: () => {
          expect(nameOf(harness, "StartEvent_1")).toBe("");
          expect(harness.said()).toContain("entfernt");
        },
        afterUndo: () => {
          expect(nameOf(harness, "StartEvent_1")).toBe("Antrag geht ein");
        },
      },
    );
    harness.destroy();
  });
});

describe("Tabulator", () => {
  it("übernimmt und öffnet das nächste Element", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const editing = harness.service<LabelEditing>("labelEditing");
    editing.activate(harness.session.shape("StartEvent_1"));
    const input = editing.input();
    if (input) input.value = "Antrag eingegangen";
    input?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );

    expect(nameOf(harness, "StartEvent_1")).toBe("Antrag eingegangen");
    expect(editing.isActive()).toBe(true);
    expect(editing.isActive(harness.session.shape("StartEvent_1"))).toBe(false);
    editing.cancel();
    harness.session.assertInvariants("nach dem Tabulatorwechsel");
    harness.destroy();
  });
});
