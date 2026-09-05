import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openSession } from "./helpers/harness";
import {
  isDirectionHorizontal,
  manhattanOptions,
  preferredLayouts,
} from "../../src/modeling/BpmnLayouter";
import { fixImportDockings, lineIntersect } from "../../src/modeling/docking";
import type {
  BpmnConnection,
  BpmnShape,
  Point,
} from "../../src/modeling/types";

/**
 * Wächter der Kantenführung — Welle 2a, OP-020 / OP-021 / OP-039.
 *
 * Drei Defekte, drei Prüfungsarten:
 *
 *  1. **Die Entscheidungstabelle** (OP-020). Die Vorgabe für Sequenzflüsse war
 *     `["straight", "h:h"]`. `"straight"` ist in `ManhattanLayout` kein
 *     Feinschliff, sondern ein Vorrang: er zieht achsenüberlappende Formen auf
 *     eine gemeinsame Achse und macht aus jeder mehrgliedrigen Route eine
 *     zweipunktige Gerade. Gemessen fiel `waypoints/bpmn:SequenceFlow/count`
 *     im Vergleichslauf allein dadurch von 34 auf 9. Geprüft wird die Tabelle
 *     hier direkt, weil sie sonst leise wieder um einen Eintrag ärmer wird.
 *
 *  2. **Der logische Andockpunkt** (OP-021). Importierte DI kennt kein
 *     `original`; ohne es rechnet jede Kantenreparatur mit dem
 *     abgeschnittenen Punkt weiter, und der Andockpunkt wandert bei jeder
 *     Bearbeitung. Geprüft wird an echten Zahlen: Anker auf der Mittelachse,
 *     Ausgang auf der Kontur.
 *
 *  3. **Die senkrechte Hälfte** (OP-039). Der Korpus hatte keinen senkrechten
 *     Pool; `synth-vertical-pool-lanes.bpmn` ist er. Geprüft wird, dass die
 *     Tabelle die Achsen tatsächlich tauscht und nicht nur so heißt.
 *
 * Gegenprobe zu jedem Block ist im Kommentar genannt: welche Zeile man
 * zurückbauen muss, damit genau dieser Test rot wird.
 */

const CORPUS = join(import.meta.dirname, "..", "corpus");

function corpus(name: string): string {
  return readFileSync(join(CORPUS, `${name}.bpmn`), "utf8");
}

describe("OP-020 — die Entscheidungstabelle der Kantenführung", () => {
  it("führt einen gewöhnlichen Sequenzfluss waagerecht und **nicht** gerade", async () => {
    // Gegenprobe: `default: ["h:h"]` auf `["straight", "h:h"]` zurücksetzen —
    // dieser Test wird rot, und im Vergleichslauf steigt
    // `waypoints/bpmn:SequenceFlow/count` von 1 auf 9 zurück.
    const session = await openSession(corpus("repo-prd-sales-with-gateway"));
    const flow = session.connection("Flow_1") as unknown as BpmnConnection;
    const layouts = preferredLayouts(flow);
    expect(layouts).toEqual(["h:h"]);
    expect(layouts).not.toContain("straight");
    session.destroy();
  });

  it("verlässt ein Gateway senkrecht und läuft waagerecht in eines hinein", async () => {
    // Die typische Rautenverzweigung. Vorher gab es diese beiden Zeilen der
    // Tabelle gar nicht — jede Gateway-Kante lief `h:h` und traf die Raute an
    // der Spitze statt an der Flanke.
    const session = await openSession(corpus("repo-prd-sales-with-gateway"));
    const outgoing = session.connection(
      "Flow_yes",
    ) as unknown as BpmnConnection;
    const incoming = session.connection("Flow_2") as unknown as BpmnConnection;
    expect(outgoing.source?.type).toBe("bpmn:ExclusiveGateway");
    expect(preferredLayouts(outgoing)).toEqual(["v:h"]);
    expect(incoming.target?.type).toBe("bpmn:ExclusiveGateway");
    expect(preferredLayouts(incoming)).toEqual(["h:v"]);
    session.destroy();
  });

  it("hält den Andockpunkt der Gegenseite an einem aufgeklappten Subprozess fest", () => {
    // `preserveDocking` gab es vorher nicht. Ohne es legt das Wachsen eines
    // Containers jede angrenzende Kante neu — genau das, was der Auto-Resize
    // aus Stufe D auslöst. Der Fall steht als Attrappe und nicht als
    // Korpusdokument, weil **kein** Korpusdokument einen Sequenzfluss an einem
    // aufgeklappten Subprozess hat: `synth-boundary-events` und
    // `synth-nested-subprocesses` klappen ihre Subprozesse ein
    // (`isExpanded="false"`), und der einzige aufgeklappte im Korpus
    // (`E_EventSub`) hängt an keiner Kante. Das ist selbst ein Befund und
    // steht so im Protokoll.
    const sub = shapeStub("Sub", 100, 100, 350, 200, "bpmn:SubProcess");
    const task = shapeStub("T", 600, 140, 100, 80);
    const flow = {
      id: "F",
      type: "bpmn:SequenceFlow",
      businessObject: { $type: "bpmn:SequenceFlow", id: "F" },
      waypoints: [
        { x: 450, y: 200 },
        { x: 600, y: 180 },
      ],
      source: sub,
      target: task,
    } as unknown as BpmnConnection;

    const fromSub = manhattanOptions(flow, sub, task, { x: 600, y: 180 });
    expect(fromSub?.preferredLayouts).toEqual(["straight", "h:h"]);
    expect(fromSub?.preserveDocking).toBe("target");

    // Andersherum: zeigt die Kante **in** den Subprozess hinein, gewinnt der
    // Andockpunkt an der Gegenseite, also `source`.
    const intoSub = manhattanOptions(flow, task, sub, { x: 450, y: 200 });
    expect(intoSub?.preserveDocking).toBe("source");
  });

  it("lässt eine Assoziation gerade und behält ihre Zwischenpunkte", async () => {
    const session = await openSession(
      corpus("synth-data-objects-and-artifacts"),
    );
    const association = session
      .get<{ getAll(): unknown[] }>("elementRegistry")
      .getAll()
      .find(
        (element) => (element as BpmnConnection).type === "bpmn:Association",
      ) as BpmnConnection | undefined;
    expect(association).toBeDefined();
    expect(preferredLayouts(association as BpmnConnection)).toEqual([
      "straight",
    ]);
    session.destroy();
  });
});

describe("OP-021 — der logische Andockpunkt importierter Kanten", () => {
  it("ergänzt `original` auf beiden Enden, auf der Mittelachse der Form", async () => {
    // Gemessen an `synth-foreign-camunda-extensions`: FF_1 läuft vom
    // Start-Ereignis (152…188 × 102…138, Mitte 170/120) zur Aktivität
    // (240…340 × 80…160, Mitte 290/120). Die DI legt die gezeichneten Punkte
    // auf die Konturen (188,120) und (240,120); die logischen Anker sind die
    // beiden Mittelpunkte.
    const session = await openSession(
      corpus("synth-foreign-camunda-extensions"),
    );
    const flow = session.connection("FF_1") as unknown as BpmnConnection;
    const points = flow.waypoints as (Point & { original?: Point })[];
    expect(points[0]).toMatchObject({ x: 188, y: 120 });
    expect(points[0]?.original).toEqual({ x: 170, y: 120 });
    expect(points[points.length - 1]).toMatchObject({ x: 240, y: 120 });
    expect(points[points.length - 1]?.original).toEqual({ x: 290, y: 120 });
    session.destroy();
  });

  it("verlässt eine Form nach dem Verschieben auf der Mitte ihrer Kante, nicht in der Ecke", async () => {
    // Gegenprobe: den Aufruf `fixImportDockings(connection)` in
    // `importer.ts` entfernen — dann steht hier wieder (188,138), die untere
    // **rechte Ecke** der Bounding-Box eines Kreises, und im Vergleichslauf
    // steigt `waypoints/bpmn:SequenceFlow/position` von 2 auf 25.
    const session = await openSession(
      corpus("synth-foreign-camunda-extensions"),
    );
    // F_Task nach unten links ziehen; F_Start bleibt stehen. Die Kante muss
    // das Start-Ereignis danach nach unten verlassen.
    const task = session.shape("F_Task");
    session.modeling.moveElements([task] as never, { x: -140, y: 420 });
    const flow = session.connection("FF_1") as unknown as BpmnConnection;
    const start = flow.waypoints[0] as Point;
    expect(start).toMatchObject({ x: 170, y: 138 });
    session.destroy();
  });

  it("überschreibt ein vorhandenes `original` nicht", () => {
    const source: BpmnShape = shapeStub("S", 0, 0, 100, 80);
    const target: BpmnShape = shapeStub("T", 300, 0, 100, 80);
    const kept = { x: 100, y: 40, original: { x: 7, y: 7 } };
    const connection = {
      id: "C",
      waypoints: [kept, { x: 300, y: 40 }],
      source,
      target,
    } as unknown as BpmnConnection;
    fixImportDockings(connection);
    expect((connection.waypoints[0] as { original?: Point }).original).toEqual({
      x: 7,
      y: 7,
    });
  });

  it("lässt parallele Geraden ohne Schnittpunkt in Ruhe", () => {
    // Die Rechnung darf für eine Kante, die genau auf der Mittellinie läuft,
    // keinen erfundenen Punkt liefern — `undefined` ist die richtige Antwort,
    // und der Aufrufer fällt dann auf den gezeichneten Punkt zurück.
    expect(
      lineIntersect(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 5 },
        { x: 10, y: 5 },
      ),
    ).toBeUndefined();
  });
});

describe("OP-039 — senkrechte Pools", () => {
  it("erkennt die Leserichtung am Pool und nicht am Element", async () => {
    const session = await openSession(corpus("synth-vertical-pool-lanes"));
    expect(isDirectionHorizontal(session.shape("Task_Pruefen"))).toBe(false);
    expect(isDirectionHorizontal(session.shape("Task_Einreichen"))).toBe(false);
    session.destroy();
  });

  it("hält einen reinen Prozess ohne Pool waagerecht", async () => {
    const session = await openSession(corpus("repo-prd-sales-with-gateway"));
    expect(isDirectionHorizontal(session.shape("Task_qualify"))).toBe(true);
    session.destroy();
  });

  it("tauscht die Achsen der Tabelle in einem senkrechten Pool", async () => {
    // Gegenprobe: in `manhattanOptions` `VERTICAL_LAYOUTS` durch
    // `HORIZONTAL_LAYOUTS` ersetzen — alle drei Erwartungen kippen auf ihre
    // waagerechten Gegenstücke, und das Diagramm bekäme Kanten quer zu seiner
    // eigenen Leserichtung.
    const session = await openSession(corpus("synth-vertical-pool-lanes"));
    const plain = session.connection("Flow_V1") as unknown as BpmnConnection;
    const toGateway = session.connection(
      "Flow_V2",
    ) as unknown as BpmnConnection;
    const fromGateway = session.connection(
      "Flow_V3",
    ) as unknown as BpmnConnection;
    expect(preferredLayouts(plain)).toEqual(["v:v"]);
    expect(preferredLayouts(toGateway)).toEqual(["v:h"]);
    expect(preferredLayouts(fromGateway)).toEqual(["h:v"]);
    session.destroy();
  });

  it("führt einen Nachrichtenfluss zwischen senkrechten Pools waagerecht", async () => {
    // Der Nachrichtenfluss soll die Poolgrenze im rechten Winkel schneiden.
    // Bei senkrechten Pools ist die Grenze senkrecht, die Kante also
    // waagerecht — das Gegenteil des waagerechten Falls.
    const session = await openSession(corpus("synth-vertical-pool-lanes"));
    const message = session.connection(
      "MessageFlow_V1",
    ) as unknown as BpmnConnection;
    expect(preferredLayouts(message)).toEqual(["straight", "h:h"]);
    session.destroy();
  });

  it("führt eine Kante aus einem seitlich angehefteten Boundary Event waagerecht heraus", async () => {
    // `Boundary_Frist` sitzt mittig auf der **rechten** Kante von
    // `Task_Pruefen` (257…293 × 282…318 an 175…275 × 260…340). Die Kante muss
    // nach rechts heraus, sonst liefe sie durch ihren eigenen Wirt.
    const session = await openSession(corpus("synth-vertical-pool-lanes"));
    const escape = session.connection("Flow_V5") as unknown as BpmnConnection;
    expect(preferredLayouts(escape)[0]?.startsWith("r:")).toBe(true);
    session.destroy();
  });

  it("überlebt eine Bearbeitung im senkrechten Pool mit allen Invarianten", async () => {
    // Der eigentliche Zweck des neuen Korpusdokuments: bis hierher lief keine
    // einzige Operation dieser Schicht jemals gegen einen senkrechten Pool.
    const session = await openSession(corpus("synth-vertical-pool-lanes"));
    session.modeling.moveElements([session.shape("Task_Bescheiden")] as never, {
      x: 0,
      y: 40,
    });
    session.assertInvariants("nach dem Verschieben im senkrechten Pool");
    session.modeling.moveElements([session.shape("Task_Pruefen")] as never, {
      x: 20,
      y: -20,
    });
    session.assertInvariants("nach dem Verschieben mit Anhefter");
    session.commandStack.undo();
    session.assertInvariants("nach dem Undo");
    session.commandStack.undo();
    session.assertInvariants("nach dem zweiten Undo");
    session.destroy();
  });
});

function shapeStub(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  type = "bpmn:Task",
): BpmnShape {
  return {
    id,
    type,
    businessObject: { $type: type, id } as never,
    x,
    y,
    width,
    height,
    children: [],
    attachers: [],
    incoming: [],
    outgoing: [],
    labels: [],
  } as unknown as BpmnShape;
}
