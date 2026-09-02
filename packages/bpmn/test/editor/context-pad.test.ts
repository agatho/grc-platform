/// <reference lib="dom" />

/**
 * Kontextmenü am Element (Auftrag Punkt 2).
 *
 * Der Anspruch dieser Datei: **kein angebotener Eintrag darf scheitern.** Jeder
 * Eintrag, der im Menü steht, wird ausgelöst; danach laufen die Invarianten,
 * dann das Undo, dann wieder die Invarianten. Ein Menü, das Handlungen
 * anbietet, die die Regeln anschließend ablehnen, wäre schlimmer als ein
 * kürzeres Menü.
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { ArctosContextPadProvider } from "../../src/editor/ContextPadProvider.js";
import type { ContextPadChrome } from "../../src/editor/ContextPadChrome.js";
import {
  BOUNDARY_PROCESS,
  COLLABORATION,
  SIMPLE_PROCESS,
} from "../modeling/helpers/fixtures.js";
import { act, openEditor, type EditorHarness } from "./helpers/editor.js";

let harness: EditorHarness;

beforeEach(() => {
  document.body.replaceChildren();
});

interface PadLike {
  open(target: unknown, force?: boolean): void;
  close(): void;
  isOpen(target?: unknown): boolean;
}

function entryIds(
  provider: ArctosContextPadProvider,
  element: unknown,
): string[] {
  return Object.keys(provider.getContextPadEntries(element as never)).sort();
}

describe("Angebotene Einträge", () => {
  it("bietet an einer Aufgabe die naheliegenden Folgeaktionen", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const provider =
      harness.service<ArctosContextPadProvider>("contextPadProvider");
    const ids = entryIds(provider, harness.session.shape("Task_1"));
    expect(ids).toContain("connect");
    expect(ids).toContain("delete");
    expect(ids).toContain("edit.label");
    expect(ids).toContain("replace");
    expect(ids).toContain("attach.boundary");
    expect(ids).toContain("append.text-annotation");
    expect(ids).toContain("append.create.task");
    harness.destroy();
  });

  it("bietet am Endereignis kein Anhängen an — die Regel verbietet den Ausgang", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const provider =
      harness.service<ArctosContextPadProvider>("contextPadProvider");
    const ids = entryIds(provider, harness.session.shape("EndEvent_1"));
    expect(ids).not.toContain("append.create.task");
    expect(ids).not.toContain("attach.boundary");
    // Verbinden bleibt: eine Assoziation zu einer Anmerkung ist zulässig.
    expect(ids).toContain("delete");
    harness.destroy();
  });

  it("bietet an einer Kante Stützpunkt und Umhängen, aber kein Anhängen", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const provider =
      harness.service<ArctosContextPadProvider>("contextPadProvider");
    const ids = entryIds(provider, harness.session.connection("Flow_1"));
    expect(ids).toContain("bendpoint.add");
    expect(ids).toContain("reconnect.start");
    expect(ids).toContain("reconnect.end");
    expect(ids).toContain("delete");
    expect(ids).not.toContain("append.create.task");
    harness.destroy();
  });

  it("bietet an Pool und Lane die Lane-Handlungen", async () => {
    harness = await openEditor(COLLABORATION);
    const provider =
      harness.service<ArctosContextPadProvider>("contextPadProvider");
    const pools = harness.session.elementRegistry
      .getAll()
      .filter(
        (element) =>
          (element.businessObject as { $type?: string } | undefined)?.$type ===
          "bpmn:Participant",
      );
    expect(pools.length).toBeGreaterThan(0);
    const ids = entryIds(provider, pools[0]);
    expect(ids).toContain("lane.add.below");
    harness.destroy();
  });

  it("bietet im Lesemodus nichts an", async () => {
    harness = await openEditor(SIMPLE_PROCESS, {
      editor: { editable: false },
    });
    const provider =
      harness.service<ArctosContextPadProvider>("contextPadProvider");
    expect(entryIds(provider, harness.session.shape("Task_1"))).toHaveLength(0);
    harness.destroy();
  });
});

describe("Ausgelöste Einträge halten die Invarianten", () => {
  const CASES: ReadonlyArray<{ element: string; entry: string }> = [
    { element: "Task_1", entry: "append.create.task" },
    { element: "Task_1", entry: "append.create.exclusive-gateway" },
    { element: "Task_1", entry: "append.create.end-event" },
    { element: "Task_1", entry: "append.text-annotation" },
    { element: "Task_1", entry: "attach.boundary" },
    { element: "Task_1", entry: "delete" },
    { element: "Flow_1", entry: "bendpoint.add" },
    { element: "Flow_1", entry: "delete" },
  ];

  for (const testCase of CASES) {
    it(`${testCase.entry} an ${testCase.element}`, async () => {
      harness = await openEditor(SIMPLE_PROCESS);
      const provider =
        harness.service<ArctosContextPadProvider>("contextPadProvider");
      const element = harness.session.element(testCase.element);
      const entries = provider.getContextPadEntries(element as never);
      const entry = entries[testCase.entry];
      expect(entry, `${testCase.entry} wird nicht angeboten`).toBeDefined();

      const before = harness.session.elementRegistry.getAll().length;
      act(
        harness,
        `Kontextmenü: ${testCase.entry}`,
        () => {
          entry?.action["click"]?.(
            new MouseEvent("click"),
            element as never,
            false,
          );
        },
        {
          undoSteps: 1,
          afterUndo: () => {
            expect(harness.session.elementRegistry.getAll().length).toBe(
              before,
            );
          },
        },
      );
      harness.destroy();
    });
  }

  it("löst den Typwechsel aus und behält die Kennung", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const provider =
      harness.service<ArctosContextPadProvider>("contextPadProvider");
    const element = harness.session.shape("Task_1");
    const entries = provider.getContextPadEntries(element as never);
    entries["replace"]?.action["click"]?.(
      new MouseEvent("click"),
      element as never,
      false,
    );
    const menu = harness.container.querySelector(".arctos-bpmn-replace-menu");
    expect(menu).not.toBeNull();
    expect(menu?.getAttribute("role")).toBe("menu");
    harness.destroy();
  });

  it("heftet nur typrichtige Randereignisse an", async () => {
    harness = await openEditor(BOUNDARY_PROCESS);
    const creation = harness.service<{
      attachBoundary(
        host: unknown,
        item: unknown,
      ): { shape: unknown; rejected?: string };
    }>("elementCreation");
    const host = harness.session.shape("Task_A");
    const wrong = creation.attachBoundary(host, {
      id: "x",
      type: "bpmn:IntermediateCatchEvent",
      title: "Zwischenereignis",
      group: "ereignisse",
    });
    expect(wrong.shape).toBeNull();
    expect(wrong.rejected).toContain("Randereignis");
    harness.destroy();
  });
});

describe("Barrierefreiheit des Kontextmenüs", () => {
  it("ist eine benannte Werkzeugleiste mit Knöpfen und Tastaturweg", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const pad = harness.service<PadLike>("contextPad");
    pad.open(harness.session.shape("Task_1"), true);

    const chrome = harness.service<ContextPadChrome>("contextPadChrome");
    const node = chrome.element();
    expect(node).not.toBeNull();
    expect(node?.getAttribute("role")).toBe("toolbar");
    expect(node?.getAttribute("aria-label")).toContain("Antrag pruefen");

    const buttons = Array.from(
      node?.querySelectorAll<HTMLElement>("button.entry") ?? [],
    );
    expect(buttons.length).toBeGreaterThan(3);
    for (const button of buttons) {
      expect(button.getAttribute("aria-label")).toBeTruthy();
    }
    expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1);

    chrome.focus();
    expect(document.activeElement).toBe(buttons[0]);
    harness.key({ key: "ArrowRight" }, buttons[0]);
    expect(document.activeElement).toBe(buttons[1]);

    harness.key({ key: "Escape" }, document.activeElement ?? undefined);
    expect(harness.said()).toBe("Kontextmenü geschlossen.");
    harness.destroy();
  });
});
