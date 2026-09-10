/// <reference lib="dom" />

/**
 * [ARCTOS-FULL-2026-08-31 · OP-046] Die Renderer-Kleinlücken aus
 * `SPIKE-MESSUNG-DRAW.md` §2.3.
 *
 * **Reproduktion.** Der Spike listet sieben Punkte. Gemessen am Code vor
 * dieser Welle:
 *
 * | Lücke | Befund |
 * |---|---|
 * | `ImplicitThrowEvent` | nicht in `SUPPORTED_SHAPE_TYPES` → gestricheltes Rechteck mit `data-unsupported="true"` |
 * | `participantMultiplicity` | kein Treffer in `src/draw/` |
 * | Nachrichtensymbol am MessageFlow | nur Start- und Endmarker, kein Symbol |
 * | `isMarkerVisible=false` | kein Treffer in `src/draw/`; das X wurde immer gezeichnet |
 * | DI-Farbattribute | kein Treffer für `bioc:` in `src/draw/` |
 * | Label-Kollision | offen — siehe `docs/UMSETZUNG-WELLE-2B.md` |
 * | Clipping am Subprozessrand | offen — siehe `docs/UMSETZUNG-WELLE-2B.md` |
 *
 * Keine der fünf behobenen Lücken kommt im Testkorpus vor (`grep` über
 * `test/corpus/`: `isMarkerVisible` nur als `"true"`, kein `bioc:`, kein
 * `participantMultiplicity`, kein `implicitThrowEvent`) — deshalb bewegt sich
 * kein einziges Referenzbild, und deshalb braucht jede Lücke hier eine eigene
 * Zusicherung: der Korpustest kann sie nicht sehen.
 */

import { describe, expect, it } from "vitest";

import { hexColor, midpointOf } from "../../src/draw/BpmnRenderer";
import {
  getTypeLabel,
  isSupportedShapeType,
  isThrowing,
} from "../../src/draw/semantic";
import type {
  BpmnConnection,
  BpmnShape,
  ModdleElement,
} from "../../src/draw/types";
import { drawConnection, drawShape } from "./helpers/render";

function bo(type: string, extra: Record<string, unknown> = {}): ModdleElement {
  return { $type: type, id: `${type}_1`, ...extra } as ModdleElement;
}

describe("OP-046 · ImplicitThrowEvent", () => {
  it("gilt als unterstützter Typ und wirft", () => {
    expect(isSupportedShapeType("bpmn:ImplicitThrowEvent")).toBe(true);
    expect(isThrowing("bpmn:ImplicitThrowEvent")).toBe(true);
    expect(getTypeLabel("bpmn:ImplicitThrowEvent")).not.toBe(
      "bpmn:ImplicitThrowEvent",
    );
  });

  it("wird als Ereignis gezeichnet, nicht als „nicht unterstützt“", () => {
    const { visual } = drawShape({
      id: "Implicit_1",
      type: "bpmn:ImplicitThrowEvent",
      x: 0,
      y: 0,
      width: 36,
      height: 36,
      businessObject: bo("bpmn:ImplicitThrowEvent"),
    });
    // Die Ersatzdarstellung markiert sich selbst — sie darf hier nicht kommen.
    expect(visual.querySelector('[data-unsupported="true"]')).toBeNull();
    expect(visual.querySelectorAll("circle").length).toBeGreaterThan(1);
  });
});

describe("OP-046 · isMarkerVisible am exklusiven Gateway", () => {
  const gateway = (di?: Record<string, unknown>): BpmnShape =>
    ({
      id: "Gw_1",
      type: "bpmn:ExclusiveGateway",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      businessObject: bo("bpmn:ExclusiveGateway"),
      ...(di ? { di: di as ModdleElement } : {}),
    }) as BpmnShape;

  it("zeichnet das X, solange nichts anderes dasteht", () => {
    const { visual } = drawShape(gateway());
    expect(visual.querySelector('[data-symbol="exclusive"]')).not.toBeNull();
  });

  it("lässt es weg bei isMarkerVisible=false", () => {
    for (const value of [false, "false"]) {
      const { visual } = drawShape(gateway({ isMarkerVisible: value }));
      expect(
        visual.querySelector('[data-symbol="exclusive"]'),
        `isMarkerVisible=${String(value)} lässt das X stehen`,
      ).toBeNull();
      expect(
        visual.querySelector('[data-marker-visible="false"]'),
      ).not.toBeNull();
    }
  });

  it("liest den Wert auch aus $attrs — moddle legt Unbekanntes dort ab", () => {
    const { visual } = drawShape(
      gateway({ $attrs: { isMarkerVisible: "false" } }),
    );
    expect(visual.querySelector('[data-symbol="exclusive"]')).toBeNull();
  });

  it("gilt nur für das exklusive Gateway — sonst ist das Symbol der Typ", () => {
    const { visual } = drawShape({
      id: "Gw_2",
      type: "bpmn:ParallelGateway",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      businessObject: bo("bpmn:ParallelGateway"),
      di: { isMarkerVisible: false } as unknown as ModdleElement,
    } as BpmnShape);
    expect(visual.querySelector('[data-symbol="parallel"]')).not.toBeNull();
  });
});

describe("OP-046 · Mehrfachbeteiligter am Pool", () => {
  const pool = (multiplicity?: Record<string, unknown>): BpmnShape =>
    ({
      id: "Pool_1",
      type: "bpmn:Participant",
      x: 0,
      y: 0,
      width: 600,
      height: 200,
      isFrame: true,
      businessObject: bo("bpmn:Participant", {
        name: "Lieferant",
        processRef: bo("bpmn:Process"),
        ...(multiplicity ? { participantMultiplicity: multiplicity } : {}),
      }),
    }) as BpmnShape;

  it("zeichnet drei Striche, wenn maximum grösser als 1 ist", () => {
    const { visual } = drawShape(pool({ maximum: 5 }));
    expect(
      visual.querySelectorAll('[data-marker="participant-multiplicity"]'),
    ).toHaveLength(3);
  });

  it("zeichnet nichts ohne Angabe oder bei maximum 1", () => {
    for (const value of [undefined, { maximum: 1 }, {}]) {
      const { visual } = drawShape(pool(value));
      expect(
        visual.querySelectorAll('[data-marker="participant-multiplicity"]'),
        `maximum=${JSON.stringify(value)} zeichnet einen Marker`,
      ).toHaveLength(0);
    }
  });
});

describe("OP-046 · Nachrichtensymbol am Nachrichtenfluss", () => {
  const flow = (
    businessObject: ModdleElement,
    source?: BpmnShape,
  ): BpmnConnection =>
    ({
      id: "MF_1",
      type: "bpmn:MessageFlow",
      waypoints: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      businessObject,
      ...(source ? { source } : {}),
    }) as BpmnConnection;

  it("zeichnet es nur, wenn eine Nachricht daran hängt", () => {
    const ohne = drawConnection(flow(bo("bpmn:MessageFlow")));
    expect(
      ohne.visual.querySelector('[data-marker="messageflow-message"]'),
    ).toBeNull();

    const mit = drawConnection(
      flow(bo("bpmn:MessageFlow", { messageRef: bo("bpmn:Message") })),
    );
    expect(
      mit.visual.querySelector('[data-marker="messageflow-message"]'),
    ).not.toBeNull();
  });

  it("füllt das Symbol beim Sender und lässt es beim Empfänger offen", () => {
    const sender = {
      id: "Send_1",
      type: "bpmn:SendTask",
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      businessObject: bo("bpmn:SendTask"),
    } as BpmnShape;
    const gesendet = drawConnection(
      flow(bo("bpmn:MessageFlow", { messageRef: bo("bpmn:Message") }), sender),
    );
    expect(
      gesendet.visual
        .querySelector('[data-marker="messageflow-message"]')
        ?.getAttribute("data-initiating"),
    ).toBe("true");

    const empfangen = drawConnection(
      flow(bo("bpmn:MessageFlow", { messageRef: bo("bpmn:Message") })),
    );
    expect(
      empfangen.visual
        .querySelector('[data-marker="messageflow-message"]')
        ?.getAttribute("data-initiating"),
    ).toBe("false");
  });

  it("setzt es auf halbe Länge des Polygonzugs, nicht in die Mitte der Box", () => {
    // Bei einer L-förmigen Kante sind das zwei verschiedene Punkte, und nur
    // der erste liegt auf der Linie.
    expect(
      midpointOf([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ]),
    ).toEqual({ x: 100, y: 0 });
    expect(midpointOf([{ x: 0, y: 0 }])).toBeUndefined();
    expect(
      midpointOf([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ]),
    ).toEqual({ x: 0, y: 0 });
  });
});

describe("OP-046 · DI-Farbattribute", () => {
  const task = (di: Record<string, unknown>): BpmnShape =>
    ({
      id: "Task_1",
      type: "bpmn:Task",
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      businessObject: bo("bpmn:Task", { name: "Prüfen" }),
      di: di as unknown as ModdleElement,
    }) as BpmnShape;

  it("übernimmt die bpmn.io-Schreibweise", () => {
    const { visual } = drawShape(
      task({ "bioc:stroke": "#ff0000", "bioc:fill": "#00ff00" }),
    );
    const outline = visual.querySelector("[data-di-stroke]");
    expect(outline?.getAttribute("stroke")).toBe("#ff0000");
    expect(outline?.getAttribute("fill")).toBe("#00ff00");
  });

  it("übernimmt auch die OMG-Schreibweise aus $attrs", () => {
    const { visual } = drawShape(
      task({
        $attrs: {
          "color:border-color": "#123456",
          "color:background-color": "#abcdef",
        },
      }),
    );
    expect(
      visual.querySelector("[data-di-stroke]")?.getAttribute("stroke"),
    ).toBe("#123456");
  });

  it("verwirft alles, was keine Hexfarbe ist", () => {
    // Der Wert kommt aus einer hochgeladenen Datei und landet in einem
    // SVG-Attribut. Genau das ist die Stelle, an der eine ungeprüfte
    // Zeichenkette nichts zu suchen hat.
    for (const böse of [
      "url(#x)",
      "expression(alert(1))",
      "red; stroke: black",
      "javascript:1",
      "#12",
      42,
      null,
    ]) {
      expect(
        hexColor(böse),
        `„${String(böse)}“ wurde durchgelassen`,
      ).toBeUndefined();
      const { visual } = drawShape(task({ "bioc:stroke": böse }));
      expect(visual.querySelector("[data-di-stroke]")).toBeNull();
    }
    expect(hexColor(undefined)).toBeUndefined();
  });

  it("färbt eine Kante nicht zu", () => {
    // Eine Kante hat `fill="none"`; ein Hintergrund an ihr liesse sie als
    // Fläche zulaufen.
    const { visual } = drawConnection({
      id: "Flow_1",
      type: "bpmn:SequenceFlow",
      waypoints: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
      ],
      businessObject: bo("bpmn:SequenceFlow"),
      di: {
        "bioc:stroke": "#ff0000",
        "bioc:fill": "#00ff00",
      } as unknown as ModdleElement,
    } as BpmnConnection);
    const line = visual.querySelector("[data-di-stroke]");
    expect(line?.getAttribute("stroke")).toBe("#ff0000");
    expect(line?.getAttribute("fill")).toBe("none");
  });
});
