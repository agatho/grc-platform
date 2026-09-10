import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { laneRefs, openSession } from "./helpers/harness";
import { COLLABORATION, NESTED_LANES } from "./helpers/fixtures";
import { childLanes } from "../../src/modeling/lanes";
import type { BpmnConnection, BpmnShape } from "../../src/modeling/types";

/**
 * Wächter der Geometrie — Welle 2a, OP-040 / OP-041 / OP-042.
 *
 * Drei Punkte aus `STUFE2-A1-MODELING.md` §7 („Nur teilweise tragfähig"), die
 * eines gemeinsam haben: **das Ergebnis ist sichtbar falsch und trotzdem
 * gültig**, weshalb keine Invariante sie fängt. Ein Etikett an der alten
 * Stelle, eine Kind-Lane, die aus ihrer Eltern-Lane ragt, und ein Wegpunkt
 * außerhalb seines Containers sind alle drei wohlgeformtes BPMN.
 */

const CORPUS = join(import.meta.dirname, "..", "corpus");

function corpus(name: string): string {
  return readFileSync(join(CORPUS, `${name}.bpmn`), "utf8");
}

describe("OP-040 — `moveShape` nimmt Beschriftung und Anhefter mit", () => {
  it("bewegt die externe Beschriftung eines Ereignisses mit", async () => {
    // Gegenprobe: in `BpmnModeling.moveShape` den Zweig entfernen, der auf
    // `moveElements` umleitet — dann bleibt `label.x` auf 250 stehen, während
    // das Ereignis auf 400 wandert.
    const session = await openSession(corpus("synth-all-event-types"));
    const event = session.shape("E_Start_Message");
    const label = event.label as BpmnShape | undefined;
    expect(
      label,
      "Fixture braucht ein Element mit externer Beschriftung",
    ).toBeDefined();
    const before = { x: (label as BpmnShape).x, y: (label as BpmnShape).y };

    session.modeling.moveShape(event as never, { x: 120, y: 40 } as never);

    expect((label as BpmnShape).x).toBe(before.x + 120);
    expect((label as BpmnShape).y).toBe(before.y + 40);
    session.assertInvariants("nach moveShape mit Beschriftung");
    session.destroy();
  });

  it("bewegt die Anhefter eines Wirts mit", async () => {
    const session = await openSession(corpus("synth-boundary-events"));
    const host = session.shape("Task_Freigabe");
    const boundary = session.shape("Boundary_Timer");
    expect(boundary.host?.id).toBe("Task_Freigabe");
    const before = { x: boundary.x, y: boundary.y };

    session.modeling.moveShape(host as never, { x: 60, y: -30 } as never);

    expect(boundary.x).toBe(before.x + 60);
    expect(boundary.y).toBe(before.y - 30);
    session.assertInvariants("nach moveShape mit Anhefter");
    session.destroy();
  });

  it("lässt eine Form ohne Anhang unverändert über den einfachen Weg laufen", async () => {
    // Die Umleitung darf nicht zum Selbstzweck werden: eine Form ohne
    // Beschriftung und ohne Anhefter soll weiterhin genau ein Kommando
    // erzeugen, damit ein Undo weiterhin genau einen Schritt zurückgeht.
    const session = await openSession(corpus("repo-prd-sales-with-gateway"));
    const shape = session.shape("Task_qualify");
    expect(shape.labels.length).toBe(0);
    expect(shape.attachers.length).toBe(0);
    const before = shape.x;
    session.modeling.moveShape(shape as never, { x: 10, y: 10 } as never);
    expect(shape.x).toBe(before + 10);
    // **Ein** Undo genügt: die Umleitung darf nicht für jede Form ein
    // zusammengesetztes Kommando erzeugen.
    session.commandStack.undo();
    expect(shape.x).toBe(before);
    session.assertInvariants("nach Undo einer einfachen Bewegung");
    session.destroy();
  });
});

describe("OP-041 — Kind-Lanes wachsen mit ihrer Eltern-Lane", () => {
  it("verteilt die neue Höhe einer Lane lückenlos auf ihre Kind-Lanes", async () => {
    // Gegenprobe: `LaneResizeBehavior` aus `modeling/index.ts` austragen —
    // `Lane_Innen1`/`Lane_Innen2` bleiben dann auf 100 px stehen, während
    // `Lane_Aussen` auf 300 wächst, und 100 px der Eltern-Lane gehören keiner
    // Kind-Lane mehr. Ein Knoten dort verliert seine `flowNodeRef`.
    const session = await openSession(NESTED_LANES);
    const outer = session.shape("Lane_Aussen");
    expect(outer.height).toBe(200);

    session.modeling.resizeShape(
      outer as never,
      {
        x: outer.x,
        y: outer.y,
        width: outer.width,
        height: 300,
      } as never,
    );

    const inner = childLanes(outer).sort((a, b) => a.y - b.y);
    expect(inner.map((lane) => lane.id)).toEqual([
      "Lane_Innen1",
      "Lane_Innen2",
    ]);
    // Lückenlos und deckungsgleich mit der Eltern-Lane: das ist die
    // Eigenschaft, an der es hängt.
    expect(inner[0]?.y).toBe(outer.y);
    expect((inner[0]?.y ?? 0) + (inner[0]?.height ?? 0)).toBe(inner[1]?.y);
    expect((inner[1]?.y ?? 0) + (inner[1]?.height ?? 0)).toBe(
      outer.y + outer.height,
    );
    // Im bisherigen Verhältnis (100:100) — beide gleich hoch.
    expect(inner[0]?.height).toBe(150);
    expect(inner[1]?.height).toBe(150);
    session.assertInvariants("nach dem Vergrößern einer Lane mit Kindern");
    session.destroy();
  });

  it("zieht die Kind-Lanes beim Undo wieder zurück", async () => {
    const session = await openSession(NESTED_LANES);
    const outer = session.shape("Lane_Aussen");
    session.modeling.resizeShape(
      outer as never,
      {
        x: outer.x,
        y: outer.y,
        width: outer.width,
        height: 300,
      } as never,
    );
    session.commandStack.undo();
    const inner = childLanes(outer).sort((a, b) => a.y - b.y);
    expect(inner[0]?.height).toBe(100);
    expect(inner[1]?.height).toBe(100);
    session.assertInvariants("nach dem Undo");
    session.destroy();
  });

  it("lässt eine Lane ohne Kinder in Ruhe", async () => {
    const session = await openSession(NESTED_LANES);
    const leaf = session.shape("Lane_Unten");
    expect(childLanes(leaf).length).toBe(0);
    session.modeling.resizeShape(
      leaf as never,
      {
        x: leaf.x,
        y: leaf.y,
        width: leaf.width,
        height: 160,
      } as never,
    );
    expect(leaf.height).toBe(160);
    session.assertInvariants("nach dem Vergrößern einer Blatt-Lane");
    session.destroy();
  });
});

describe("OP-024 — Lane-Inhalte wandern mit ihrer Lane", () => {
  it("behält die Lane-Zuordnung, wenn der Pool wächst", async () => {
    // [ARCTOS-FULL-2026-08-31 · OP-024] Der Registereintrag nennt „5 px"; die
    // Messung zeigt etwas anderes. `Participant_Bank` von 260 auf 390 px:
    // vorher gehörte `Task_Bank_Entscheiden` zu `Lane_Genehmigung`, danach zur
    // `Lane_Sachbearbeitung` — weil die Lane-Kante unter dem Knoten
    // weggewandert ist und `syncLaneMembership` die Zugehörigkeit aus der
    // Geometrie neu rechnet. In diesem Produkt sagt die Lane, **wer** den
    // Schritt tut. Eine Größenänderung an anderer Stelle darf das nicht
    // ändern.
    //
    // Gegenprobe: den `else`-Zweig mit `moveLaneContents` in
    // `redistributeLanes` entfernen — `Task_Bank_Entscheiden` steht dann
    // wieder in `Lane_Sachbearbeitung`, und `End_Bank` (y=252) liegt oberhalb
    // der Oberkante seiner eigenen Lane (y=275).
    const session = await openSession(
      corpus("synth-collaboration-pools-lanes"),
    );
    const pool = session.shape("Participant_Bank");
    const before = laneRefs(session, "Lane_Genehmigung").sort();
    expect(before).toEqual(["End_Bank", "Task_Bank_Entscheiden"]);

    session.modeling.resizeShape(
      pool as never,
      {
        x: pool.x,
        y: pool.y,
        width: pool.width,
        height: pool.height + 130,
      } as never,
    );

    expect(laneRefs(session, "Lane_Genehmigung").sort()).toEqual(before);
    expect(laneRefs(session, "Lane_Sachbearbeitung").sort()).toEqual([
      "Start_Bank",
      "Task_Bank_Pruefen",
    ]);
    // Und der Knoten liegt danach auch geometrisch in seiner Lane.
    const lane = session.shape("Lane_Genehmigung");
    const end = session.shape("End_Bank");
    expect(end.y).toBeGreaterThanOrEqual(lane.y);
    expect(end.y + end.height).toBeLessThanOrEqual(lane.y + lane.height);
    session.assertInvariants("nach dem Poolwachstum");
    session.destroy();
  });

  it("nimmt die Inhaltsverschiebung beim Undo zurück", async () => {
    const session = await openSession(
      corpus("synth-collaboration-pools-lanes"),
    );
    const pool = session.shape("Participant_Bank");
    const before = session.shape("End_Bank").y;
    session.modeling.resizeShape(
      pool as never,
      {
        x: pool.x,
        y: pool.y,
        width: pool.width,
        height: pool.height + 130,
      } as never,
    );
    expect(session.shape("End_Bank").y).not.toBe(before);
    session.commandStack.undo();
    expect(session.shape("End_Bank").y).toBe(before);
    session.assertInvariants("nach dem Undo");
    session.destroy();
  });
});

describe("OP-042 — `connection.move` über Containergrenzen", () => {
  it("führt `flowElements` nach und hält die Wegpunkte absolut", async () => {
    // [ARCTOS-FULL-2026-08-31 · OP-042] Der Registereintrag lautet: „führt
    // `flowElements` nach, aber die Wegpunkte werden nicht neu relativiert".
    //
    // Nachgemessen ist das **kein Defekt, sondern die Vorschrift.** BPMN-DI
    // kennt keine container-relativen Koordinaten: `dc:Point` einer
    // `bpmndi:BPMNEdge` steht im Koordinatensystem der `BPMNPlane`, und eine
    // `BPMNPlane` gibt es je Diagrammebene, nicht je Subprozess-Rechteck. Eine
    // Kante beim Containerwechsel zu „relativieren" hieße, ihre Wegpunkte um
    // den Ursprung des neuen Containers zu verschieben — sie läge danach an
    // einer anderen Stelle im Bild als vorher, ohne dass jemand sie bewegt
    // hätte. Der Bericht `STUFE2-A1-MODELING.md` §7.10 sagt das selbst
    // („BPMN-DI ist absolut, insofern korrekt") und hält fest, dass der Fall
    // im Korpus nie beobachtet wurde.
    //
    // Was fehlte, ist nicht die Umrechnung, sondern der **Wächter**: dass ein
    // Containerwechsel die Kante semantisch mitnimmt und die Geometrie dabei
    // konsistent bleibt. Genau das steht hier.
    const session = await openSession(COLLABORATION);
    const flow = session.connection("Sub_Flow") as unknown as BpmnConnection;
    const start = session.shape("Sub_Start");
    const end = session.shape("Sub_End");
    const lane = session.shape("Lane_A1");

    expect(semanticParentId(flow)).toBe("Sub_A");
    const before = flow.waypoints.map((point) => ({ x: point.x, y: point.y }));
    const delta = { x: 20, y: -140 };

    session.modeling.moveElements(
      [start, end, flow] as never,
      delta as never,
      lane as never,
    );

    // (1) Der semantische Container ist nachgeführt.
    expect(semanticParentId(flow)).toBe("Process_A");
    // (2) Die Wegpunkte sind um dasselbe Delta gewandert wie die Formen —
    //     absolut, nicht relativ. Eine Relativierung ergäbe hier einen Sprung
    //     um den Ursprung von `Sub_A` (290/230).
    expect(flow.waypoints.map((p) => ({ x: p.x, y: p.y }))).toEqual(
      before.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y })),
    );
    // (3) Und sie docken weiterhin an ihren Endpunkten an.
    expect(touches(flow.waypoints[0] as { x: number; y: number }, start)).toBe(
      true,
    );
    expect(
      touches(
        flow.waypoints[flow.waypoints.length - 1] as { x: number; y: number },
        end,
      ),
    ).toBe(true);
    session.assertInvariants("nach dem Containerwechsel einer Kante");
    session.destroy();
  });
});

/** Der `bpmn:Process`/`bpmn:SubProcess`, in dessen `flowElements` das Element steht. */
function semanticParentId(element: BpmnConnection): string | undefined {
  const parent = (element.businessObject as { $parent?: { id?: unknown } })
    .$parent;
  return typeof parent?.id === "string" ? parent.id : undefined;
}

/** Liegt der Punkt auf oder in der Form (Toleranz 1 px)? */
function touches(point: { x: number; y: number }, shape: BpmnShape): boolean {
  return (
    point.x >= shape.x - 1 &&
    point.x <= shape.x + shape.width + 1 &&
    point.y >= shape.y - 1 &&
    point.y <= shape.y + shape.height + 1
  );
}
