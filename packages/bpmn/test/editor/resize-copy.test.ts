/// <reference lib="dom" />

/**
 * Größe ändern (Punkt 5) sowie Kopieren, Einfügen, Duplizieren (Punkt 6).
 *
 * Der wichtigste Test dieser Datei ist der letzte: **`arctos:grcMetadata` muss
 * die Kopie überleben, und die Kennung muss neu sein.** Beides zusammen ist die
 * eigentliche Anforderung — eine Kopie ohne GRC-Daten verliert stumm die
 * Verknüpfung zu Risiken und Kontrollen, eine Kopie mit derselben Kennung
 * erzeugt eine Datei, die kein Werkzeug mehr lesen kann.
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { BpmnCopyPaste } from "../../src/editor/CopyPaste.js";
import type { ResizeBehavior } from "../../src/editor/ResizeBehavior.js";
import { resizeBounds } from "../../src/editor/ResizeBehavior.js";
import { minDimensionsFor } from "../../src/modeling/BpmnRules.js";
import { snapshotOf } from "../../src/editor/copy/serialize.js";
import { COLLABORATION, SIMPLE_PROCESS } from "../modeling/helpers/fixtures.js";
import { act, openEditor, type EditorHarness } from "./helpers/editor.js";

let harness: EditorHarness;

beforeEach(() => {
  document.body.replaceChildren();
});

/** Eine Aufgabe mit ARCTOS-Erweiterung — der Fall, um den es geht. */
const GRC_PROCESS = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:arctos="https://arctos.grc/schema/bpmn/1.0"
                  id="Definitions_G" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_G" isExecutable="false">
    <bpmn:userTask id="Task_G" name="Zahlung freigeben">
      <bpmn:extensionElements>
        <arctos:grcMetadata>
          <arctos:riskRefs>
            <arctos:riskRef id="risk-4711" title="Zahlungsbetrug" />
          </arctos:riskRefs>
        </arctos:grcMetadata>
      </bpmn:extensionElements>
    </bpmn:userTask>
    <bpmn:subProcess id="Sub_G" name="Prüfen">
      <bpmn:task id="Inner_G" name="Beleg lesen" />
    </bpmn:subProcess>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_G">
    <bpmndi:BPMNPlane id="Plane_G" bpmnElement="Process_G">
      <bpmndi:BPMNShape id="Task_G_di" bpmnElement="Task_G">
        <dc:Bounds x="160" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_G_di" bpmnElement="Sub_G" isExpanded="true">
        <dc:Bounds x="320" y="60" width="350" height="200" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Inner_G_di" bpmnElement="Inner_G">
        <dc:Bounds x="360" y="100" width="100" height="80" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

describe("Mindestmaße", () => {
  it("rechnet die Ecke gegen die Untergrenze", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 80 };
    const min = { width: 50, height: 50 };
    expect(resizeBounds(bounds, "se", { x: -80, y: -60 }, min)).toEqual({
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });
    // Die Nordwest-Ecke verschiebt den Ursprung mit.
    expect(resizeBounds(bounds, "nw", { x: 20, y: 10 }, min)).toEqual({
      x: 20,
      y: 10,
      width: 80,
      height: 70,
    });
  });

  it("gibt einem Pool ein Maß, das ihn noch als Pool lesbar lässt", async () => {
    harness = await openEditor(COLLABORATION);
    const pool = harness.session.elementRegistry
      .getAll()
      .find(
        (element) =>
          (element.businessObject as { $type?: string } | undefined)?.$type ===
          "bpmn:Participant",
      );
    expect(pool).toBeDefined();
    const min = minDimensionsFor(pool as never);
    expect(min.width).toBeGreaterThanOrEqual(300);
    harness.destroy();
  });
});

describe("Größe ändern", () => {
  it("vergrößert einen Subprozess und hält die Invarianten", async () => {
    harness = await openEditor(GRC_PROCESS);
    const resize = harness.service<ResizeBehavior>("resizeBehavior");
    const sub = harness.session.shape("Sub_G");
    const before = { width: sub.width, height: sub.height };

    act(
      harness,
      "Subprozess vergrößern",
      () => resize.resizeBy(sub, "se", { x: 60, y: 40 }),
      {
        undoSteps: 1,
        after: () => {
          expect(sub.width).toBe(before.width + 60);
          expect(sub.height).toBe(before.height + 40);
          expect(harness.said()).toContain("groß");
        },
        afterUndo: () => {
          expect(sub.width).toBe(before.width);
        },
      },
    );
    harness.destroy();
  });

  it("verweigert das Verkleinern unter das Mindestmaß", async () => {
    harness = await openEditor(GRC_PROCESS);
    const resize = harness.service<ResizeBehavior>("resizeBehavior");
    const sub = harness.session.shape("Sub_G");
    const min = minDimensionsFor(sub);
    expect(resize.resizeBy(sub, "se", { x: -1000, y: -1000 })).toBe(true);
    expect(sub.width).toBe(min.width);
    expect(sub.height).toBe(min.height);
    // Ein weiterer Versuch ändert nichts mehr und sagt es.
    expect(resize.resizeBy(sub, "se", { x: -100, y: -100 })).toBe(false);
    expect(harness.said()).toContain("Mindestmaß");
    harness.session.assertInvariants("nach dem Verkleinern");
    harness.destroy();
  });

  it("verweigert die Größenänderung an einem Ereignis", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const resize = harness.service<ResizeBehavior>("resizeBehavior");
    expect(
      resize.resizeBy(harness.session.shape("StartEvent_1"), "se", {
        x: 20,
        y: 20,
      }),
    ).toBe(false);
    expect(harness.said()).toContain("Größe nicht ändern");
    harness.destroy();
  });

  it("setzt die Mindestmaße auch für das Ziehen an den Griffen", async () => {
    harness = await openEditor(GRC_PROCESS);
    const context: {
      shape: unknown;
      direction: string;
      minDimensions?: { width: number };
    } = { shape: harness.session.shape("Sub_G"), direction: "se" };
    harness.session.eventBus.fire("resize.start", { context } as never);
    expect(context.minDimensions?.width).toBe(140);
    harness.destroy();
  });
});

describe("Kopieren und Einfügen", () => {
  it("nimmt arctos:grcMetadata mit und vergibt eine neue Kennung", async () => {
    // Ohne Ausnahme: `DUPLICATE_ID` prüft seit der Behebung von Befund 3
    // (`STUFE2-B1-EDITOR.md` §6) nur noch BPMN- und DI-Kennungen. Der
    // Fremdschlüssel `arctos:riskRef/@id` zählt nicht mehr mit — der nächste
    // Test hält genau das fest.
    harness = await openEditor(GRC_PROCESS);
    const clipboard = harness.service<BpmnCopyPaste>("bpmnCopyPaste");
    const original = harness.session.shape("Task_G");

    clipboard.copy([original]);
    expect(harness.said()).toContain("GRC-Angaben");

    const pasted = act(
      harness,
      "Einfügen",
      () => clipboard.paste({ x: 200, y: 400 }),
      { undoSteps: 1 },
    ).value;

    expect(pasted).toHaveLength(1);
    const copy = pasted[0]!;
    expect(copy.id).not.toBe(original.id);

    const bo = copy.businessObject as {
      $type: string;
      name?: unknown;
      extensionElements?: { values?: unknown[] };
    };
    expect(bo.$type).toBe("bpmn:UserTask");
    expect(bo.name).toBe("Zahlung freigeben");

    const snapshot = snapshotOf(copy.businessObject);
    const grc = JSON.stringify(snapshot);
    expect(grc).toContain("arctos:GrcMetadata");
    expect(grc).toContain("risk-4711");

    // Die Kopie teilt **kein** Objekt mit dem Original.
    const originalExtensions = (
      original.businessObject as { extensionElements?: unknown }
    ).extensionElements;
    expect(bo.extensionElements).not.toBe(originalExtensions);
    harness.destroy();
  });

  it("zählt den Fremdschlüssel arctos:riskRef/@id nicht als doppelte Kennung", async () => {
    // Die Gegenprobe zum behobenen Befund 3: Zwei Aufgaben, die dasselbe
    // Risiko tragen, sind der Normalfall — im Editor beim Kopieren genauso wie
    // in jeder von Hand gepflegten Datei. `risk-4711` steht nach dem Einfügen
    // zweimal im Dokument und ist trotzdem kein Fehler.
    harness = await openEditor(GRC_PROCESS);
    const clipboard = harness.service<BpmnCopyPaste>("bpmnCopyPaste");
    clipboard.copy([harness.session.shape("Task_G")]);
    clipboard.paste({ x: 200, y: 400 });

    const xml = await harness.session.exportXml();
    expect(xml.split("risk-4711").length - 1).toBe(2);
    expect(harness.session.checkInvariants()).toEqual([]);
    harness.destroy();
  });

  it("meldet eine doppelte BPMN-Kennung weiterhin", async () => {
    // Die Einschränkung darf die Prüfung nicht entschärfen: eine von Hand
    // gleichgesetzte `bpmn:`-Kennung schlägt unverändert an.
    harness = await openEditor(GRC_PROCESS);
    const task = harness.session.shape("Task_G");
    const sub = harness.session.shape("Sub_G");
    (sub.businessObject as unknown as Record<string, unknown>)["id"] = (
      task.businessObject as unknown as Record<string, unknown>
    )["id"];

    expect(harness.session.checkInvariants().map((v) => v.code)).toContain(
      "DUPLICATE_ID",
    );
    harness.destroy();
  });

  it("dupliziert eine Auswahl samt Kante und hält die Invarianten", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const clipboard = harness.service<BpmnCopyPaste>("bpmnCopyPaste");
    const elements = [
      harness.session.shape("Task_1"),
      harness.session.shape("Gateway_1"),
      harness.session.connection("Flow_2"),
    ];
    const before = harness.session.elementRegistry.getAll().length;

    act(harness, "Duplizieren", () => clipboard.duplicate(elements), {
      undoSteps: 1,
      after: () => {
        expect(harness.session.elementRegistry.getAll().length).toBeGreaterThan(
          before,
        );
        expect(harness.said()).toContain("dupliziert");
      },
      afterUndo: () => {
        expect(harness.session.elementRegistry.getAll().length).toBe(before);
      },
    });
    harness.destroy();
  });

  it("schneidet aus und fügt wieder ein", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const clipboard = harness.service<BpmnCopyPaste>("bpmnCopyPaste");
    const before = harness.session.elementRegistry.getAll().length;

    act(
      harness,
      "Ausschneiden",
      () => clipboard.cut([harness.session.shape("Task_1")]),
      {
        undoSteps: 1,
        after: () => {
          expect(harness.session.has("Task_1")).toBe(false);
        },
        afterUndo: () => {
          expect(harness.session.elementRegistry.getAll().length).toBe(before);
        },
      },
    );
    harness.destroy();
  });

  it("sagt an, wenn die Zwischenablage leer ist", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const clipboard = harness.service<BpmnCopyPaste>("bpmnCopyPaste");
    expect(clipboard.paste()).toHaveLength(0);
    expect(harness.said()).toContain("leer");
    harness.destroy();
  });

  it("kopiert keine Verweise mit — die stellt der Updater neu her", () => {
    const snapshot = snapshotOf({
      $type: "bpmn:SequenceFlow",
      id: "Flow_X",
      name: "ja",
      sourceRef: { $type: "bpmn:Task", id: "A" },
      targetRef: { $type: "bpmn:Task", id: "B" },
    } as never);
    expect(snapshot.attrs["name"]).toBe("ja");
    expect(Object.keys(snapshot.attrs)).not.toContain("id");
    expect(Object.keys(snapshot.children)).not.toContain("sourceRef");
    expect(Object.keys(snapshot.children)).not.toContain("targetRef");
  });
});
