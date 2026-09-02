import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openSession, operate } from "./helpers/harness";
import {
  BOUNDARY_PROCESS,
  COLLABORATION,
  SIMPLE_PROCESS,
} from "./helpers/fixtures";
import { boundsOf } from "../../src/modeling/di";
import { snapToHostBorder } from "../../src/modeling/behaviors/BoundaryEventBehavior";
import {
  attachOrientation,
  preferredLayouts,
} from "../../src/modeling/BpmnLayouter";
import {
  externalLabelBounds,
  hasExternalLabel,
  labelText,
} from "../../src/modeling/labels";
import { boOf } from "../../src/modeling/util";
import type { BpmnShape } from "../../src/modeling/types";

describe("Beschriftungen bewegen sich mit ihrem Element", () => {
  it("verschiebt das Label mit dem Ereignis", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const start = session.shape("StartEvent_1");
    const label = start.labels[0]!;
    const labelYBefore = label.y;

    // `moveElements`, nicht `moveShape`: `label-support` von `diagram-js`
    // hängt am zusammengesetzten Kommando. Wer `moveShape` einzeln aufruft,
    // bewegt die Form ohne ihre Beschriftung — dieselbe Eigenschaft hat
    // `bpmn-js`, und der Editor-Pfad muss sie kennen.
    operate(session, "elements.move mit Label", () => {
      session.modeling.moveElements(
        [start] as never,
        { x: 0, y: 60 },
        start.parent as never,
      );
    });

    expect(label.y).toBe(labelYBefore + 60);
    session.destroy();
  });

  it("löscht das Label mit dem Element", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const labelId = session.shape("StartEvent_1").labels[0]!.id;

    operate(
      session,
      "shape.delete mit Label",
      () => {
        session.modeling.removeShape(session.shape("StartEvent_1") as never);
      },
      {
        after: () => {
          expect(session.has(labelId)).toBe(false);
        },
        afterUndo: () => {
          expect(session.has(labelId)).toBe(true);
        },
      },
    );
    session.destroy();
  });

  it("legt für eine benannte Kante eine Beschriftung an", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const flow = session.connection("Flow_1");
    expect(flow.labels).toHaveLength(0);

    operate(session, "Kante beschriften", () => {
      session.modeling.updateLabel(flow, "genehmigt");
    });

    expect(flow.labels).toHaveLength(1);
    const di = flow.di!;
    expect(boundsOf(di["label"] as never)).toBeDefined();
    session.destroy();
  });
});

describe("Beschriftungsgeometrie", () => {
  it("respektiert eine vorhandene BPMNLabel-Box aus der Datei", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    // StartEvent_1 bringt eine Box mit: x=140 y=223 w=80 h=14.
    const label = session.shape("StartEvent_1").labels[0]!;
    expect({ x: label.x, y: label.y }).toEqual({ x: 140, y: 223 });
    session.destroy();
  });

  it("berechnet eine Box, wenn die Datei keine mitbringt", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const gateway = session.shape("Gateway_1");
    const label = gateway.labels[0]!;
    // Unter der Form, mittig.
    expect(label.y).toBeGreaterThan(gateway.y + gateway.height);
    expect(
      Math.abs(label.x + label.width / 2 - (gateway.x + gateway.width / 2)),
    ).toBeLessThan(1);
    session.destroy();
  });

  it("weiß, welche Typen außen beschriftet werden", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    expect(hasExternalLabel(boOf(session.shape("StartEvent_1")))).toBe(true);
    expect(hasExternalLabel(boOf(session.shape("Gateway_1")))).toBe(true);
    expect(hasExternalLabel(boOf(session.shape("Task_1")))).toBe(false);
    session.destroy();
  });

  it("ergänzt fehlende Maße einer unvollständigen Box, statt sie zu verwerfen", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const di = session.shape("Gateway_1").di!;
    di["label"] = {
      $type: "bpmndi:BPMNLabel",
      bounds: { $type: "dc:Bounds", x: 10, y: 20 },
    } as never;
    const bounds = externalLabelBounds(session.shape("Gateway_1"), di);
    expect(bounds.x).toBe(10);
    expect(bounds.width).toBeGreaterThan(0);
    session.destroy();
  });
});

describe("Boundary-Attachment", () => {
  it("bewegt das Boundary Event mit seinem Wirt", async () => {
    const session = await openSession(BOUNDARY_PROCESS);
    const host = session.shape("Task_A");
    const boundary = session.shape("Boundary_1");
    const before = { x: boundary.x, y: boundary.y };

    operate(session, "Wirt verschieben", () => {
      session.modeling.moveElements(
        [host] as never,
        { x: 50, y: 30 },
        host.parent as never,
      );
    });

    expect({ x: boundary.x, y: boundary.y }).toEqual({
      x: before.x + 50,
      y: before.y + 30,
    });
    session.destroy();
  });

  it("berechnet die Randposition beim Verkleinern richtig", () => {
    const host = { x: 100, y: 100, width: 100, height: 80 };
    // Anhefter tief im Inneren → auf die nächste Kante.
    expect(
      snapToHostBorder({ x: 140, y: 160, width: 36, height: 36 }, host),
    ).toEqual({ x: 140, y: 162 });
    // Anhefter links außerhalb → auf die linke Kante.
    expect(
      snapToHostBorder({ x: 40, y: 120, width: 36, height: 36 }, host),
    ).toEqual({ x: 82, y: 120 });
  });

  it("erkennt die Seite, an der ein Anhefter sitzt", async () => {
    const session = await openSession(BOUNDARY_PROCESS);
    expect(
      attachOrientation(session.shape("Boundary_1"), session.shape("Task_A")),
    ).toBe("bottom");
    session.destroy();
  });
});

describe("Kantenführung", () => {
  it("bevorzugt waagerechte Führung für Sequenzflüsse", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    expect(preferredLayouts(session.connection("Flow_1"))).toContain("h:h");
    session.destroy();
  });

  it("führt Kanten aus einem Boundary Event senkrecht heraus", async () => {
    const session = await openSession(BOUNDARY_PROCESS);
    expect(preferredLayouts(session.connection("Flow_B"))).toContain("v:h");
    session.destroy();
  });

  it("verträgt den Hint `connectionStart: false` von diagram-js", async () => {
    // `MoveHelper` übergibt `sourceMoved && anchor` — bei einem nicht
    // mitbewegten Endpunkt also den **booleschen** Wert `false`. Wer ihn mit
    // `??` behandelt, schreibt NaN-Wegpunkte in die DI. Regressionstest zu
    // genau diesem Fehler.
    const session = await openSession(SIMPLE_PROCESS);
    const layouter = session.get<{
      layoutConnection: (
        c: unknown,
        h: unknown,
      ) => Array<{ x: number; y: number }>;
    }>("layouter");
    const points = layouter.layoutConnection(session.connection("Flow_1"), {
      connectionStart: false,
      connectionEnd: false,
    });
    expect(
      points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    ).toBe(true);
    session.destroy();
  });

  it("verträgt einen Nachrichtenfluss, dessen Gegenseite stehen bleibt", async () => {
    const session = await openSession(COLLABORATION);
    operate(session, "Pool umbauen mit Nachrichtenfluss nach außen", () => {
      session.modeling.addLane(session.shape("Lane_A1"), "top");
    });
    const message = session.connection("Message_1");
    expect(
      message.waypoints.every(
        (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
      ),
    ).toBe(true);
    session.destroy();
  });

  it("dockt neu gelegte Kanten an den Formgrenzen an, nicht in den Mittelpunkten", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const flow = session.connection("Flow_1");

    operate(session, "Kante neu führen", () => {
      session.modeling.layoutConnection(flow as never);
    });

    const start: BpmnShape = session.shape("StartEvent_1");
    const first = flow.waypoints[0]!;
    // Der erste Punkt liegt auf dem Rand des Start-Ereignisses, nicht in
    // seinem Mittelpunkt — das leistet CroppingConnectionDocking.
    expect(first.x).toBeGreaterThanOrEqual(start.x);
    expect(first.x).toBeLessThanOrEqual(start.x + start.width + 1);
    session.destroy();
  });
});

// ────────────────────────────────────────────────────────────────────
// [ARCTOS-FULL-2026-08-31 · OP-030] `bpmn:Group` — der dritte Beschriftungsfall
//
// Eine Gruppe trägt keinen Namen. Ihr Text steht in einer
// `bpmn:CategoryValue` unter `bpmn:Definitions`, auf die `categoryValueRef`
// zeigt. `UpdateLabelHandler` schrieb ihn nach `name` — ein Attribut, das
// `bpmn:Group` im Schema nicht hat. Der Effekt war nicht „geht beim Austausch
// verloren", sondern schärfer: `moddle` behielt die Eigenschaft im Speicher
// und liess sie beim Schreiben weg, `labelText()` las weiter aus der
// Kategorie — der Editor zeigte den alten Text, und die Eingabe war nach dem
// Speichern spurlos weg.
//
// Die drei Tests unten prüfen genau die drei Wege, auf denen der Text im
// Dokument landen kann; der vierte hält den Round-Trip fest.
// ────────────────────────────────────────────────────────────────────

describe("OP-030 — eine Gruppe wird über bpmn:CategoryValue beschriftet", () => {
  const GROUP_XML = readFileSync(
    join(__dirname, "../corpus/synth-data-objects-and-artifacts.bpmn"),
    "utf8",
  );

  it("ändert den Wert der vorhandenen CategoryValue statt bo.name zu setzen", async () => {
    const session = await openSession(GROUP_XML);
    const group = session.shape("Group_1");
    const bo = boOf(group)!;
    expect(labelText(bo)).toBe("Kernprozess");

    operate(session, "Gruppe umbenennen", () => {
      session.modeling.updateLabel(group, "Kreditvergabe");
    });

    expect(labelText(bo)).toBe("Kreditvergabe");
    // Der eigentliche Befund: `name` darf gar nicht erst entstehen. Ein
    // `bo.name`, das nur im Speicher existiert, ist genau die Form von
    // Datenverlust, die niemandem auffällt.
    expect(Object.hasOwn(bo, "name")).toBe(false);
    session.destroy();
  });

  it("legt für eine neue Gruppe Category und CategoryValue an", async () => {
    const session = await openSession(GROUP_XML);
    const group = operate(session, "Gruppe anlegen", () =>
      session.modeling.createShape(
        { type: "bpmn:Group" },
        { x: 700, y: 500 },
        session.root() as never,
      ),
    ) as unknown as BpmnShape;

    expect(labelText(boOf(group))).toBe("");

    operate(session, "neue Gruppe beschriften", () => {
      session.modeling.updateLabel(group, "Nebenprozess");
    });

    const bo = boOf(group)!;
    const value = bo["categoryValueRef"] as Record<string, unknown>;
    expect(value?.["value"]).toBe("Nebenprozess");
    // Die Kategorie muss ein rootElement sein, sonst schreibt `moddle` sie
    // nicht mit und der Verweis zeigt beim nächsten Öffnen ins Leere.
    const category = value["$parent"] as Record<string, unknown>;
    expect(category["$type"]).toBe("bpmn:Category");
    expect(
      (session.definitions()["rootElements"] as unknown[]).includes(category),
    ).toBe(true);
    session.destroy();
  });

  it("legt für einen leeren Text KEINE Kategorie an", async () => {
    const session = await openSession(GROUP_XML);
    const rootsBefore = (session.definitions()["rootElements"] as unknown[])
      .length;
    const group = operate(session, "Gruppe anlegen", () =>
      session.modeling.createShape(
        { type: "bpmn:Group" },
        { x: 700, y: 500 },
        session.root() as never,
      ),
    ) as unknown as BpmnShape;

    operate(session, "leer bestätigen", () => {
      session.modeling.updateLabel(group, "   ");
    });

    expect(boOf(group)!["categoryValueRef"]).toBeUndefined();
    expect((session.definitions()["rootElements"] as unknown[]).length).toBe(
      rootsBefore,
    );
    session.destroy();
  });

  it("behält die Beschriftung über Schreiben und Wiedereinlesen", async () => {
    const session = await openSession(GROUP_XML);
    operate(session, "vorhandene Gruppe umbenennen", () => {
      session.modeling.updateLabel(session.shape("Group_1"), "Kreditvergabe");
    });
    const neu = operate(session, "zweite Gruppe anlegen", () =>
      session.modeling.createShape(
        { type: "bpmn:Group" },
        { x: 700, y: 500 },
        session.root() as never,
      ),
    ) as unknown as BpmnShape;
    operate(session, "zweite Gruppe beschriften", () => {
      session.modeling.updateLabel(neu, "Nebenprozess");
    });

    const xml = await session.exportXml();
    // Der Beweis am Dokument, nicht am Speicherbild: beide Texte müssen als
    // `bpmn:categoryValue` im XML stehen.
    expect(xml).toContain('value="Kreditvergabe"');
    expect(xml).toContain('value="Nebenprozess"');
    expect(xml).not.toContain('bpmn:group id="Group_1" name=');

    const wieder = await openSession(xml);
    expect(labelText(boOf(wieder.shape("Group_1")))).toBe("Kreditvergabe");
    expect(labelText(boOf(wieder.shape(neu.id)))).toBe("Nebenprozess");
    wieder.destroy();
    session.destroy();
  });
});
