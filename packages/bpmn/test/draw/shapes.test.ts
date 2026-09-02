/// <reference lib="dom" />

import { describe, expect, it } from "vitest";

import { SUPPORTED_SHAPE_TYPES } from "../../src/draw/semantic.js";
import {
  ACTIVITY_RADIUS,
  STROKE_THICK,
  STROKE_THIN,
} from "../../src/draw/theme.js";
import {
  createRenderer,
  drawConnection,
  drawShape,
  makeConnection,
  makeShape,
  markerNames,
  outlineOf,
  strokeWidthOf,
  symbolNames,
  textContentOf,
} from "./helpers/render.js";

/**
 * Ein Test je unterstütztem Elementtyp: trägt das erzeugte SVG die
 * charakteristischen Merkmale der BPMN-Notation — Form, Symbol, Marker,
 * Randstärke?
 */

describe("Ereignisse", () => {
  it("Startereignis: einfacher Kreis mit dünnem Rand", () => {
    const { visual } = drawShape(
      makeShape("bpmn:StartEvent", { width: 36, height: 36 }),
    );
    const outline = outlineOf(visual);

    expect(outline.tagName).toBe("circle");
    expect(outline.getAttribute("r")).toBe("18");
    expect(strokeWidthOf(outline)).toBe(STROKE_THIN);
    expect(outline.getAttribute("data-border")).toBe("thin");
    expect(visual.querySelectorAll("circle")).toHaveLength(1);
  });

  it("Endereignis: dicker Rand", () => {
    const { visual } = drawShape(
      makeShape("bpmn:EndEvent", { width: 36, height: 36 }),
    );
    const outline = outlineOf(visual);

    expect(outline.tagName).toBe("circle");
    expect(strokeWidthOf(outline)).toBe(STROKE_THICK);
    expect(outline.getAttribute("data-border")).toBe("thick");
  });

  it("Terminierendes Endereignis: gefüllter Kreis als Symbol", () => {
    const { visual } = drawShape(
      makeShape("bpmn:EndEvent", {
        width: 36,
        height: 36,
        businessObject: {
          $type: "bpmn:EndEvent",
          id: "end",
          eventDefinitions: [{ $type: "bpmn:TerminateEventDefinition" }],
        },
      }),
    );
    expect(symbolNames(visual)).toContain("terminate");
    const symbol = visual.querySelector('[data-symbol="terminate"]');
    expect(symbol?.getAttribute("data-symbol-style")).toBe("filled");
  });

  it("Eintretendes Zwischenereignis: doppelter Rand und ungefülltes Symbol", () => {
    const { visual } = drawShape(
      makeShape("bpmn:IntermediateCatchEvent", {
        width: 36,
        height: 36,
        businessObject: {
          $type: "bpmn:IntermediateCatchEvent",
          id: "catch",
          eventDefinitions: [{ $type: "bpmn:MessageEventDefinition" }],
        },
      }),
    );

    const circles = visual.querySelectorAll("circle");
    expect(circles).toHaveLength(2);
    expect(outlineOf(visual).getAttribute("data-border")).toBe("double");
    expect(
      visual
        .querySelector('[data-symbol="message"]')
        ?.getAttribute("data-symbol-style"),
    ).toBe("hollow");
  });

  it("Ausgelöstes Zwischenereignis: doppelter Rand und gefülltes Symbol", () => {
    const { visual } = drawShape(
      makeShape("bpmn:IntermediateThrowEvent", {
        width: 36,
        height: 36,
        businessObject: {
          $type: "bpmn:IntermediateThrowEvent",
          id: "throw",
          eventDefinitions: [{ $type: "bpmn:SignalEventDefinition" }],
        },
      }),
    );
    expect(visual.querySelectorAll("circle")).toHaveLength(2);
    expect(
      visual
        .querySelector('[data-symbol="signal"]')
        ?.getAttribute("data-symbol-style"),
    ).toBe("filled");
  });

  it("Randereignis, unterbrechend: doppelter durchgezogener Rand", () => {
    const { visual } = drawShape(
      makeShape("bpmn:BoundaryEvent", {
        width: 36,
        height: 36,
        businessObject: {
          $type: "bpmn:BoundaryEvent",
          id: "b1",
          cancelActivity: true,
          eventDefinitions: [{ $type: "bpmn:ErrorEventDefinition" }],
        },
      }),
    );
    const outline = outlineOf(visual);
    expect(outline.getAttribute("stroke-dasharray")).toBeNull();
    expect(visual.querySelectorAll("circle")).toHaveLength(2);
    expect(symbolNames(visual)).toContain("error");
  });

  it("Randereignis, nicht unterbrechend: gestrichelte Ränder", () => {
    const { visual } = drawShape(
      makeShape("bpmn:BoundaryEvent", {
        width: 36,
        height: 36,
        businessObject: {
          $type: "bpmn:BoundaryEvent",
          id: "b2",
          cancelActivity: false,
          eventDefinitions: [{ $type: "bpmn:TimerEventDefinition" }],
        },
      }),
    );
    for (const circle of Array.from(visual.querySelectorAll("circle"))) {
      expect(circle.getAttribute("stroke-dasharray")).toBeTruthy();
    }
    expect(symbolNames(visual)).toContain("timer");
  });

  it.each([
    ["bpmn:MessageEventDefinition", "message"],
    ["bpmn:TimerEventDefinition", "timer"],
    ["bpmn:ErrorEventDefinition", "error"],
    ["bpmn:EscalationEventDefinition", "escalation"],
    ["bpmn:CancelEventDefinition", "cancel"],
    ["bpmn:CompensateEventDefinition", "compensate"],
    ["bpmn:ConditionalEventDefinition", "conditional"],
    ["bpmn:LinkEventDefinition", "link"],
    ["bpmn:SignalEventDefinition", "signal"],
  ])(
    "Ereignisdefinition %s wird als %s gezeichnet",
    (definitionType, symbol) => {
      const { visual } = drawShape(
        makeShape("bpmn:IntermediateCatchEvent", {
          width: 36,
          height: 36,
          businessObject: {
            $type: "bpmn:IntermediateCatchEvent",
            id: "x",
            eventDefinitions: [{ $type: definitionType }],
          },
        }),
      );
      expect(symbolNames(visual)).toContain(symbol);
      expect(
        visual.querySelectorAll(`[data-symbol="${symbol}"] path`).length,
      ).toBeGreaterThan(0);
    },
  );

  it("Mehrere Ereignisdefinitionen ergeben das Mehrfachsymbol", () => {
    const { visual } = drawShape(
      makeShape("bpmn:StartEvent", {
        width: 36,
        height: 36,
        businessObject: {
          $type: "bpmn:StartEvent",
          id: "m",
          eventDefinitions: [
            { $type: "bpmn:MessageEventDefinition" },
            { $type: "bpmn:TimerEventDefinition" },
          ],
        },
      }),
    );
    expect(symbolNames(visual)).toContain("multiple");
  });
});

describe("Aktivitäten", () => {
  it("Aufgabe: abgerundetes Rechteck mit dünnem Rand und zentrierter Beschriftung", () => {
    const { visual } = drawShape(
      makeShape("bpmn:Task", {
        businessObject: {
          $type: "bpmn:Task",
          id: "t1",
          name: "Rechnung prüfen",
        },
      }),
    );
    const outline = outlineOf(visual);

    expect(outline.tagName).toBe("rect");
    expect(Number(outline.getAttribute("rx"))).toBe(ACTIVITY_RADIUS);
    expect(strokeWidthOf(outline)).toBe(STROKE_THIN);
    expect(textContentOf(visual)).toContain("Rechnung prüfen");
  });

  it.each([
    ["bpmn:UserTask", "UserTask"],
    ["bpmn:ServiceTask", "ServiceTask"],
    ["bpmn:SendTask", "SendTask"],
    ["bpmn:ReceiveTask", "ReceiveTask"],
    ["bpmn:ManualTask", "ManualTask"],
    ["bpmn:BusinessRuleTask", "BusinessRuleTask"],
    ["bpmn:ScriptTask", "ScriptTask"],
  ])("%s trägt sein Typsymbol oben links", (type, symbol) => {
    const { visual } = drawShape(makeShape(type));
    expect(symbolNames(visual)).toContain(symbol);

    const group = visual.querySelector(`[data-symbol="${symbol}"]`);
    const transform = group?.getAttribute("transform") ?? "";
    // Symbol sitzt in der oberen linken Ecke der Aktivität.
    expect(transform).toMatch(/translate\(6 6\)/);
  });

  it("Aufgabe ohne Typ trägt kein Typsymbol", () => {
    const { visual } = drawShape(makeShape("bpmn:Task"));
    expect(symbolNames(visual)).toHaveLength(0);
  });

  it("CallActivity: dicker Rand", () => {
    const { visual } = drawShape(makeShape("bpmn:CallActivity"));
    const outline = outlineOf(visual);
    expect(strokeWidthOf(outline)).toBe(STROKE_THICK);
    expect(outline.getAttribute("data-border")).toBe("thick");
    expect(markerNames(visual)).toContain("collapsed");
  });

  it("Zugeklappter Subprozess: Pluskasten als Marker", () => {
    const { visual } = drawShape(makeShape("bpmn:SubProcess"));
    expect(markerNames(visual)).toContain("collapsed");
    expect(strokeWidthOf(outlineOf(visual))).toBe(STROKE_THIN);
  });

  it("Aufgeklappter Subprozess: kein Pluskasten, Beschriftung oben", () => {
    const { visual } = drawShape(
      makeShape("bpmn:SubProcess", {
        width: 350,
        height: 200,
        di: { $type: "bpmndi:BPMNShape", isExpanded: true },
        businessObject: {
          $type: "bpmn:SubProcess",
          id: "sp",
          name: "Freigabe",
        },
      }),
    );
    expect(markerNames(visual)).not.toContain("collapsed");
    expect(textContentOf(visual)).toContain("Freigabe");
  });

  it("Ereignis-Subprozess: gestrichelter Rand", () => {
    const { visual } = drawShape(
      makeShape("bpmn:SubProcess", {
        businessObject: {
          $type: "bpmn:SubProcess",
          id: "esp",
          triggeredByEvent: true,
        },
      }),
    );
    expect(outlineOf(visual).getAttribute("stroke-dasharray")).toBeTruthy();
  });

  it("Transaktion: doppelter Rand", () => {
    const { visual } = drawShape(
      makeShape("bpmn:Transaction", {
        di: { $type: "bpmndi:BPMNShape", isExpanded: true },
      }),
    );
    expect(visual.querySelectorAll("rect")).toHaveLength(2);
    expect(outlineOf(visual).getAttribute("data-border")).toBe("double");
  });

  it("Ad-hoc-Subprozess: Tilde-Marker", () => {
    const { visual } = drawShape(
      makeShape("bpmn:AdHocSubProcess", {
        di: { $type: "bpmndi:BPMNShape", isExpanded: true },
        width: 300,
        height: 200,
      }),
    );
    expect(markerNames(visual)).toContain("adHoc");
  });

  it.each([
    [
      "Schleife",
      { loopCharacteristics: { $type: "bpmn:StandardLoopCharacteristics" } },
      "loop",
    ],
    [
      "parallele Mehrfachinstanz",
      {
        loopCharacteristics: { $type: "bpmn:MultiInstanceLoopCharacteristics" },
      },
      "parallelMultiInstance",
    ],
    [
      "sequenzielle Mehrfachinstanz",
      {
        loopCharacteristics: {
          $type: "bpmn:MultiInstanceLoopCharacteristics",
          isSequential: true,
        },
      },
      "sequentialMultiInstance",
    ],
    ["Kompensation", { isForCompensation: true }, "compensation"],
  ])("Aktivitätsmarker %s", (_name, boExtras, marker) => {
    const { visual } = drawShape(
      makeShape("bpmn:Task", {
        businessObject: { $type: "bpmn:Task", id: "t", ...boExtras },
      }),
    );
    expect(markerNames(visual)).toContain(marker);
  });

  it("mehrere Marker stehen nebeneinander, nicht übereinander", () => {
    const { visual } = drawShape(
      makeShape("bpmn:SubProcess", {
        businessObject: {
          $type: "bpmn:SubProcess",
          id: "s",
          loopCharacteristics: {
            $type: "bpmn:MultiInstanceLoopCharacteristics",
          },
        },
      }),
    );
    const transforms = Array.from(visual.querySelectorAll("[data-marker]")).map(
      (node) => node.getAttribute("transform"),
    );
    expect(transforms).toHaveLength(2);
    expect(new Set(transforms).size).toBe(2);
  });
});

describe("Gateways", () => {
  it.each([
    ["bpmn:ExclusiveGateway", "exclusive"],
    ["bpmn:ParallelGateway", "parallel"],
    ["bpmn:InclusiveGateway", "inclusive"],
    ["bpmn:EventBasedGateway", "eventBased"],
    ["bpmn:ComplexGateway", "complex"],
  ])("%s: Raute mit %s-Symbol", (type, symbol) => {
    const { visual } = drawShape(makeShape(type, { width: 50, height: 50 }));
    const outline = outlineOf(visual);

    expect(outline.tagName).toBe("path");
    // Raute: vier Ecken, geschlossen.
    expect(outline.getAttribute("d")).toBe("M 25 0 L 50 25 L 25 50 L 0 25 z");
    expect(strokeWidthOf(outline)).toBe(STROKE_THIN);
    expect(symbolNames(visual)).toContain(symbol);
  });
});

describe("Daten", () => {
  it("Datenobjekt: Blatt mit umgeknickter Ecke", () => {
    const { visual } = drawShape(
      makeShape("bpmn:DataObjectReference", {
        width: 36,
        height: 50,
        businessObject: {
          $type: "bpmn:DataObjectReference",
          id: "d1",
          name: "Rechnung",
        },
      }),
    );
    expect(outlineOf(visual).tagName).toBe("path");
    expect(markerNames(visual)).toContain("fold");
    // Die Beschriftung von Datenobjekten steht außerhalb der Form und wird als
    // eigenes `label`-Shape gezeichnet (siehe scene.test.ts) — nicht hier.
    expect(textContentOf(visual)).toBe("");
  });

  it("Datenobjekt als Sammlung: drei Balken", () => {
    const { visual } = drawShape(
      makeShape("bpmn:DataObjectReference", {
        width: 36,
        height: 50,
        businessObject: {
          $type: "bpmn:DataObjectReference",
          id: "d2",
          dataObjectRef: { $type: "bpmn:DataObject", isCollection: true },
        },
      }),
    );
    expect(
      markerNames(visual).filter((name) => name === "collection"),
    ).toHaveLength(3);
  });

  it("Datenspeicher: Zylinder mit Schichtlinien", () => {
    const { visual } = drawShape(
      makeShape("bpmn:DataStoreReference", { width: 50, height: 50 }),
    );
    expect(outlineOf(visual).tagName).toBe("path");
    expect(
      markerNames(visual).filter((name) => name === "store-layer"),
    ).toHaveLength(2);
  });

  it("Dateneingabe und Datenausgabe unterscheiden sich im Pfeil", () => {
    const input = drawShape(
      makeShape("bpmn:DataInput", { width: 36, height: 50 }),
    );
    const output = drawShape(
      makeShape("bpmn:DataOutput", { width: 36, height: 50 }),
    );

    expect(symbolNames(input.visual)).toContain("dataInput");
    expect(symbolNames(output.visual)).toContain("dataOutput");
    const inputArrow = input.visual.querySelector('[data-symbol="dataInput"]');
    const outputArrow = output.visual.querySelector(
      '[data-symbol="dataOutput"]',
    );
    expect(inputArrow?.getAttribute("fill")).not.toBe(
      outputArrow?.getAttribute("fill"),
    );
  });
});

describe("Pools, Lanes und Artefakte", () => {
  it("Pool: Rechteck mit Kopfleiste und gedrehter Beschriftung", () => {
    const { visual } = drawShape(
      makeShape("bpmn:Participant", {
        width: 600,
        height: 250,
        businessObject: {
          $type: "bpmn:Participant",
          id: "p1",
          name: "Buchhaltung",
          processRef: { $type: "bpmn:Process", id: "proc" },
        },
      }),
    );
    expect(outlineOf(visual).tagName).toBe("rect");
    expect(markerNames(visual)).toContain("lane-header");
    expect(visual.querySelector("text")?.getAttribute("transform")).toMatch(
      /rotate\(-90/,
    );
    expect(textContentOf(visual)).toContain("Buchhaltung");
  });

  it("Black-Box-Pool: keine Kopfleiste, Beschriftung mittig", () => {
    const { visual } = drawShape(
      makeShape("bpmn:Participant", {
        width: 400,
        height: 100,
        businessObject: { $type: "bpmn:Participant", id: "p2", name: "Kunde" },
      }),
    );
    expect(outlineOf(visual).getAttribute("data-blackbox")).toBe("true");
    expect(markerNames(visual)).not.toContain("lane-header");
    expect(visual.querySelector("text")?.getAttribute("transform")).toBeNull();
  });

  it("Lane: Rechteck mit Kopfleiste", () => {
    const { visual } = drawShape(
      makeShape("bpmn:Lane", {
        width: 570,
        height: 120,
        businessObject: { $type: "bpmn:Lane", id: "l1", name: "Einkauf" },
      }),
    );
    expect(outlineOf(visual).classList.contains("bpmn-lane")).toBe(true);
    expect(markerNames(visual)).toContain("lane-header");
  });

  it("Senkrechter Pool: waagerechte Kopfleiste", () => {
    const { visual } = drawShape(
      makeShape("bpmn:Participant", {
        width: 250,
        height: 600,
        di: { $type: "bpmndi:BPMNShape", isHorizontal: false },
        businessObject: {
          $type: "bpmn:Participant",
          id: "p3",
          name: "Vertrieb",
          processRef: { $type: "bpmn:Process", id: "proc3" },
        },
      }),
    );
    expect(outlineOf(visual).getAttribute("data-orientation")).toBe("vertical");
    expect(visual.querySelector("text")?.getAttribute("transform")).toBeNull();
  });

  it("Textanmerkung: offene Klammer links, kein geschlossenes Rechteck", () => {
    const { visual } = drawShape(
      makeShape("bpmn:TextAnnotation", {
        width: 120,
        height: 40,
        businessObject: {
          $type: "bpmn:TextAnnotation",
          id: "a1",
          text: "Nur mit Vier-Augen-Prinzip",
        },
      }),
    );
    const outline = outlineOf(visual);
    expect(outline.getAttribute("d")).not.toContain("z");
    expect(outline.getAttribute("fill")).toBe("none");
    expect(textContentOf(visual)).toContain("Vier-Augen");
  });

  it("Gruppe: gestricheltes abgerundetes Rechteck ohne Füllung", () => {
    const { visual } = drawShape(
      makeShape("bpmn:Group", {
        width: 300,
        height: 200,
        businessObject: {
          $type: "bpmn:Group",
          id: "g1",
          categoryValueRef: {
            $type: "bpmn:CategoryValue",
            value: "Kernprozess",
          },
        },
      }),
    );
    const outline = outlineOf(visual);
    expect(outline.getAttribute("fill")).toBe("none");
    expect(outline.getAttribute("stroke-dasharray")).toBeTruthy();
    expect(outline.getAttribute("pointer-events")).toBe("none");
    expect(textContentOf(visual)).toContain("Kernprozess");
  });
});

describe("Kanten", () => {
  it("Sequenzfluss: durchgezogen mit gefüllter Pfeilspitze", () => {
    const { svg, visual } = drawConnection(makeConnection("bpmn:SequenceFlow"));
    const line = visual.querySelector("path");

    expect(line?.getAttribute("stroke-dasharray")).toBeNull();
    expect(line?.getAttribute("marker-end")).toMatch(
      /^url\(#arctos-sequenceflow-end/,
    );
    expect(svg.querySelector("defs marker")).not.toBeNull();
  });

  it("Bedingter Sequenzfluss: Raute am Anfang", () => {
    const source = makeShape("bpmn:Task", { id: "t1" });
    const { visual } = drawConnection(
      makeConnection("bpmn:SequenceFlow", {
        source,
        businessObject: {
          $type: "bpmn:SequenceFlow",
          id: "f1",
          conditionExpression: {
            $type: "bpmn:FormalExpression",
            body: "x > 1",
          },
        },
      }),
    );
    const line = visual.querySelector("path");
    expect(line?.getAttribute("data-flow")).toBe("conditional");
    expect(line?.getAttribute("marker-start")).toMatch(
      /conditional-flow-start/,
    );
  });

  it("Standardfluss: Schrägstrich am Anfang", () => {
    const source = makeShape("bpmn:ExclusiveGateway", {
      id: "g1",
      businessObject: {
        $type: "bpmn:ExclusiveGateway",
        id: "g1",
        default: { $type: "bpmn:SequenceFlow", id: "f2" },
      },
    });
    const { visual } = drawConnection(
      makeConnection("bpmn:SequenceFlow", { id: "f2", source }),
    );
    const line = visual.querySelector("path");
    expect(line?.getAttribute("data-flow")).toBe("default");
    expect(line?.getAttribute("marker-start")).toMatch(/default-flow-start/);
  });

  it("Nachrichtenfluss: gestrichelt, Kreis am Anfang, offene Spitze am Ende", () => {
    const { visual } = drawConnection(makeConnection("bpmn:MessageFlow"));
    const line = visual.querySelector("path");

    expect(line?.getAttribute("stroke-dasharray")).toBeTruthy();
    expect(line?.getAttribute("marker-start")).toMatch(/messageflow-start/);
    expect(line?.getAttribute("marker-end")).toMatch(/messageflow-end/);
  });

  /**
   * Der Kreis am Ursprung war bis hierher zwar vorhanden, aber unsichtbar:
   * 3,5 px Durchmesser, zur Hälfte unter der Kontur der Quellform, und in
   * Rasterern, die `stroke-dasharray` fälschlich in den Marker vererben,
   * zusätzlich als aufgebrochener Bogen. Geprüft wird deshalb die Geometrie,
   * nicht nur die Anwesenheit des Verweises.
   */
  it("Nachrichtenfluss: der Kreis am Ursprung ist sichtbar und liegt außerhalb der Quelle", () => {
    const { svg, visual } = drawConnection(makeConnection("bpmn:MessageFlow"));
    const line = visual.querySelector("path");
    const id = /url\(#(.*)\)/.exec(
      line?.getAttribute("marker-start") ?? "",
    )?.[1];
    expect(id).toBeDefined();

    const marker = svg.querySelector(`#${id ?? ""}`);
    const circle = marker?.querySelector("circle");
    expect(circle).not.toBeNull();

    // viewBox-Einheiten je Benutzerpixel: viewBox-Breite / markerWidth.
    const viewBox = (marker?.getAttribute("viewBox") ?? "").split(/\s+/);
    const perPixel =
      Number(viewBox[2]) / Number(marker?.getAttribute("markerWidth"));
    const radius = Number(circle?.getAttribute("r")) / perPixel;
    // Mindestens 6 px Durchmesser — darunter verschwindet der Kreis neben
    // einer 2 px starken Kante.
    expect(radius * 2).toBeGreaterThanOrEqual(6);

    // Referenzpunkt hinter dem Kreis: der Kreis sitzt vor dem Anfangspunkt
    // der Kante, nicht auf ihm, und wird von der Quellkontur nicht verdeckt.
    const refX = Number(marker?.getAttribute("refX"));
    const cx = Number(circle?.getAttribute("cx"));
    const r = Number(circle?.getAttribute("r"));
    expect(refX).toBeLessThanOrEqual(cx - r);

    // Unausgefüllt (Flächenfarbe, nicht Linienfarbe) und durchgezogen.
    expect(circle?.getAttribute("fill")).not.toBe(
      circle?.getAttribute("stroke"),
    );
    expect(circle?.getAttribute("stroke-dasharray")).toBe("10000 1");
  });

  it("Nachrichtenfluss: die Spitze am Ziel ist offen, nicht gefüllt", () => {
    const { svg, visual } = drawConnection(makeConnection("bpmn:MessageFlow"));
    const line = visual.querySelector("path");
    const id = /url\(#(.*)\)/.exec(line?.getAttribute("marker-end") ?? "")?.[1];
    const head = svg.querySelector(`#${id ?? ""}`)?.querySelector("path");

    expect(head?.getAttribute("fill")).toBe("none");
    // Kein `z` im Pfad: die Spitze ist nicht geschlossen.
    expect(head?.getAttribute("d")).not.toMatch(/z/i);
  });

  it("Assoziation ohne Richtung: gepunktet, ohne Pfeilspitze", () => {
    const { visual } = drawConnection(makeConnection("bpmn:Association"));
    const line = visual.querySelector("path");

    expect(line?.getAttribute("stroke-dasharray")).toBeTruthy();
    expect(line?.getAttribute("marker-end")).toBeNull();
  });

  it("Gerichtete Assoziation: offene Pfeilspitze", () => {
    const { visual } = drawConnection(
      makeConnection("bpmn:Association", {
        businessObject: {
          $type: "bpmn:Association",
          id: "a1",
          associationDirection: "One",
        },
      }),
    );
    expect(visual.querySelector("path")?.getAttribute("marker-end")).toMatch(
      /association-end/,
    );
  });

  it.each(["bpmn:DataInputAssociation", "bpmn:DataOutputAssociation"])(
    "%s: gepunktet mit offener Spitze",
    (type) => {
      const { visual } = drawConnection(makeConnection(type));
      const line = visual.querySelector("path");
      expect(line?.getAttribute("stroke-dasharray")).toBeTruthy();
      expect(line?.getAttribute("marker-end")).toMatch(/association-end/);
    },
  );

  it("Kante mit weniger als zwei Wegpunkten schlägt fehl statt still zu verschwinden", () => {
    expect(() =>
      drawConnection(
        makeConnection("bpmn:SequenceFlow", { waypoints: [{ x: 0, y: 0 }] }),
      ),
    ).toThrow(/Wegpunkte/);
  });
});

describe("Beschriftungen und Robustheit", () => {
  it("Externe Beschriftung wird als eigenes label-Shape gezeichnet", () => {
    const target = makeShape("bpmn:StartEvent", {
      id: "s1",
      businessObject: {
        $type: "bpmn:StartEvent",
        id: "s1",
        name: "Antrag geht ein",
      },
    });
    const { visual } = drawShape(
      makeShape("label", {
        id: "s1_label",
        width: 90,
        height: 20,
        labelTarget: target,
      }),
    );
    expect(textContentOf(visual)).toContain("Antrag geht ein");
  });

  it("Lange Beschriftungen werden umgebrochen", () => {
    const { visual } = drawShape(
      makeShape("bpmn:Task", {
        businessObject: {
          $type: "bpmn:Task",
          id: "t",
          name: "Eingehende Lieferantenrechnung sachlich und rechnerisch prüfen",
        },
      }),
    );
    expect(visual.querySelectorAll("tspan").length).toBeGreaterThan(2);
  });

  it("Nullfläche wird als Fehler gemeldet, nicht stumm gezeichnet", () => {
    expect(() => drawShape(makeShape("bpmn:Task", { width: 0 }))).toThrow(
      /Nullfläche/,
    );
  });

  it("NaN-Koordinaten werden als Fehler gemeldet", () => {
    expect(() => drawShape(makeShape("bpmn:Task", { x: Number.NaN }))).toThrow(
      /nicht endlich/,
    );
  });

  it("Unbekannter Typ wird sichtbar als nicht unterstützt gezeichnet", () => {
    const { visual } = drawShape(
      makeShape("bpmn:Choreography", { width: 100, height: 80 }),
    );
    expect(outlineOf(visual).getAttribute("data-unsupported")).toBe("true");
  });

  it("canRender deckt alle deklarierten Typen ab", () => {
    const renderer = createRenderer();
    for (const type of SUPPORTED_SHAPE_TYPES) {
      expect(renderer.canRender({ id: "x", type })).toBe(true);
    }
    expect(renderer.canRender({ id: "x", type: "label" })).toBe(true);
    expect(renderer.canRender({ id: "x", type: "bpmn:Choreography" })).toBe(
      false,
    );
  });

  it("jeder unterstützte Knotentyp erzeugt eine Kontur", () => {
    for (const type of SUPPORTED_SHAPE_TYPES) {
      const shape = makeShape(type, {
        width: type === "bpmn:Participant" ? 400 : 100,
        height: type === "bpmn:Participant" ? 200 : 80,
        businessObject:
          type === "bpmn:Participant"
            ? {
                $type: type,
                id: "p",
                processRef: { $type: "bpmn:Process", id: "pp" },
              }
            : { $type: type, id: "n" },
      });
      const { visual } = drawShape(shape);
      expect(
        visual.querySelector(".bpmn-outline"),
        `keine Kontur für ${type}`,
      ).not.toBeNull();
      expect(visual.getAttribute("data-bpmn-type")).toBe(type);
    }
  });

  it("Kontrastvariante zeichnet dieselben Formen mit reiner Kontur", () => {
    const normal = drawShape(makeShape("bpmn:Task"));
    const contrast = drawShape(makeShape("bpmn:Task"), { contrast: "more" });

    expect(outlineOf(contrast.visual).tagName).toBe(
      outlineOf(normal.visual).tagName,
    );
    expect(outlineOf(contrast.visual).getAttribute("stroke")).toBe("#000000");
  });
});
