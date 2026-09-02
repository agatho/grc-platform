import { describe, expect, it } from "vitest";
import { laneRefs, openSession, operate } from "./helpers/harness.js";
import { COLLABORATION, SIMPLE_PROCESS } from "./helpers/fixtures.js";
import type { Bounds } from "../../src/modeling/types.js";
import {
  childLanes,
  laneFor,
  semanticLanesOf,
} from "../../src/modeling/lanes.js";
import { boOf } from "../../src/modeling/util.js";
import type { BpmnShape } from "../../src/modeling/types.js";

/**
 * Lane-Behandlung (Auftrag Punkt 4).
 *
 * Die interessanten Zusicherungen sind nicht die Geometrie, sondern die
 * **Zugehörigkeit**: dass `flowNodeRef` nach jedem Umbau genau einen Eintrag
 * je Knoten hat, auf der richtigen Ebene, im richtigen Prozess. Die
 * Invarianten `LANE_REF_DUPLICATE` und `LANE_REF_FOREIGN_PROCESS` prüfen das
 * nach jeder Operation; die `expect` hier prüfen, dass die Zuordnung auch
 * *inhaltlich* stimmt.
 */

function poolHeight(session: Awaited<ReturnType<typeof openSession>>): number {
  return session.shape("Pool_A").height;
}

describe("lane.add", () => {
  it("fügt eine Lane ein, vergrößert den Pool und schiebt die Geschwister", async () => {
    const session = await openSession(COLLABORATION);
    const before = poolHeight(session);
    const laneCountBefore = childLanes(session.shape("Pool_A")).length;

    operate(
      session,
      "lane.add (unten)",
      () => {
        session.modeling.addLane(session.shape("Lane_A2"), "bottom");
      },
      {
        after: () => {
          expect(childLanes(session.shape("Pool_A"))).toHaveLength(
            laneCountBefore + 1,
          );
          expect(poolHeight(session)).toBeGreaterThan(before);
        },
        afterUndo: () => {
          expect(childLanes(session.shape("Pool_A"))).toHaveLength(
            laneCountBefore,
          );
          expect(poolHeight(session)).toBe(before);
        },
      },
    );
    session.destroy();
  });

  it("legt die neue Lane semantisch in den LaneSet des Prozesses", async () => {
    const session = await openSession(COLLABORATION);
    const process = boOf(session.shape("Pool_A"))!["processRef"] as never;
    const before = semanticLanesOf(process).length;

    operate(session, "lane.add (LaneSet)", () => {
      session.modeling.addLane(session.shape("Lane_A1"), "top");
    });

    expect(semanticLanesOf(process)).toHaveLength(before + 1);
    session.destroy();
  });

  it("schiebt die Knoten unterhalb der Einfügestelle mit", async () => {
    const session = await openSession(COLLABORATION);
    const subBefore = session.shape("Sub_A").y;

    operate(
      session,
      "lane.add (Knoten mitschieben)",
      () => {
        session.modeling.addLane(session.shape("Lane_A1"), "top");
      },
      {
        after: () => {
          expect(session.shape("Sub_A").y).toBeGreaterThan(subBefore);
          // Der Subprozess bleibt in seiner Lane.
          expect(laneRefs(session, "Lane_A2")).toContain("Sub_A");
        },
      },
    );
    session.destroy();
  });
});

describe("lane.split", () => {
  it("teilt eine Lane in gleich große Streifen und behält die ursprüngliche id", async () => {
    const session = await openSession(COLLABORATION);
    const lane = session.shape("Lane_A2");
    const height = lane.height;

    operate(
      session,
      "lane.split",
      () => {
        session.modeling.splitLane(lane, 3);
      },
      {
        after: () => {
          const lanes = childLanes(session.shape("Pool_A"));
          expect(lanes).toHaveLength(4);
          expect(session.has("Lane_A2")).toBe(true);
          expect(session.shape("Lane_A2").height).toBeLessThan(height);
        },
        afterUndo: () => {
          expect(childLanes(session.shape("Pool_A"))).toHaveLength(2);
          expect(session.shape("Lane_A2").height).toBe(height);
        },
      },
    );
    session.destroy();
  });

  it("legt in einem Pool ohne Lanes die ersten Lanes an", async () => {
    const session = await openSession(COLLABORATION);
    const pool = session.modeling.createShape(
      { type: "bpmn:Participant" },
      { x: 120, y: 700, width: 600, height: 250 } as Bounds as never,
      session.root() as never,
    ) as unknown as BpmnShape;
    session.assertInvariants("Pool angelegt");

    operate(
      session,
      "lane.split (erster Umbau)",
      () => {
        session.modeling.splitLane(pool, 2);
      },
      {
        after: () => {
          expect(childLanes(pool)).toHaveLength(2);
        },
      },
    );
    session.destroy();
  });
});

describe("Pool in einem Prozessdiagramm", () => {
  it("wird verweigert, solange keine Collaboration da ist", async () => {
    // Der Übergang Process → Collaboration wechselt das Wurzelelement der
    // Ebene und ist in dieser Stufe nicht gebaut (siehe BpmnRules.canDrop).
    // Der Test hält fest, dass die Schicht das *sagt*, statt einen Pool
    // anzulegen, der in der Datei fehlt.
    const session = await openSession(SIMPLE_PROCESS);
    const rules = session.get<{ allowed(a: string, c?: unknown): unknown }>(
      "rules",
    );
    const pool = session
      .get<{ createShape: (attrs: unknown) => BpmnShape }>("elementFactory")
      .createShape({ type: "bpmn:Participant" });
    expect(
      rules.allowed("shape.create", { shape: pool, target: session.root() }),
    ).toBe(false);
    session.destroy();
  });
});

describe("lane.remove", () => {
  it("entfernt die Lane und lässt die Nachbarlane in die Lücke wachsen", async () => {
    const session = await openSession(COLLABORATION);
    const lane1Height = session.shape("Lane_A1").height;

    operate(
      session,
      "lane.remove",
      () => {
        session.modeling.removeLane(session.shape("Lane_A2"));
      },
      {
        after: () => {
          expect(session.has("Lane_A2")).toBe(false);
          expect(session.shape("Lane_A1").height).toBeGreaterThan(lane1Height);
          // Der Subprozess lag in Lane_A2 und gehört nun zu Lane_A1.
          expect(laneRefs(session, "Lane_A1")).toContain("Sub_A");
        },
        afterUndo: () => {
          expect(session.has("Lane_A2")).toBe(true);
          expect(laneRefs(session, "Lane_A2")).toContain("Sub_A");
          expect(laneRefs(session, "Lane_A1")).not.toContain("Sub_A");
        },
      },
    );
    session.destroy();
  });

  it("lässt die Knoten stehen — sie gehören dem Prozess, nicht der Lane", async () => {
    const session = await openSession(COLLABORATION);

    operate(
      session,
      "lane.remove (Knoten bleiben)",
      () => {
        session.modeling.removeLane(session.shape("Lane_A1"));
      },
      {
        after: () => {
          expect(session.has("Start_A")).toBe(true);
          expect(session.has("Task_A1")).toBe(true);
        },
      },
    );
    session.destroy();
  });
});

describe("Lane-Zugehörigkeit", () => {
  it("findet die innerste Lane, die einen Knoten enthält", async () => {
    const session = await openSession(COLLABORATION);
    const lane = laneFor(session.shape("Task_A1"));
    expect(lane?.id).toBe("Lane_A1");
    session.destroy();
  });

  it("trägt einen neu erzeugten Knoten sofort in die Lane ein, in der er landet", async () => {
    const session = await openSession(COLLABORATION);

    const created = operate(session, "shape.create in Lane", () =>
      session.modeling.createShape(
        { type: "bpmn:Task" },
        { x: 600, y: 290 },
        session.shape("Pool_A") as never,
      ),
    ) as unknown as BpmnShape;

    expect(laneRefs(session, "Lane_A2")).toContain(created.id);
    expect(laneRefs(session, "Lane_A1")).not.toContain(created.id);
    session.destroy();
  });

  it("hält einen Knoten in genau einer Lane, auch nach mehrfachem Hin und Her", async () => {
    const session = await openSession(COLLABORATION);
    const task = session.shape("Task_A1");

    for (let round = 0; round < 3; round += 1) {
      operate(session, `Lane-Pendeln ${String(round)} hinunter`, () => {
        session.modeling.moveShape(
          task as never,
          { x: 0, y: 160 },
          task.parent as never,
        );
      });
      operate(session, `Lane-Pendeln ${String(round)} hinauf`, () => {
        session.modeling.moveShape(
          task as never,
          { x: 0, y: -160 },
          task.parent as never,
        );
      });
    }

    expect(laneRefs(session, "Lane_A1")).toContain("Task_A1");
    expect(laneRefs(session, "Lane_A2")).not.toContain("Task_A1");
    session.destroy();
  });

  it("nimmt einen Knoten aus allen Lanes, wenn er den Pool verlässt", async () => {
    const session = await openSession(COLLABORATION);
    const start = session.shape("Start_A");

    operate(
      session,
      "shape.move (Pool verlassen)",
      () => {
        session.modeling.moveShape(
          start as never,
          { x: 200, y: 160 },
          session.shape("Sub_A") as never,
        );
      },
      {
        after: () => {
          expect(laneRefs(session, "Lane_A1")).not.toContain("Start_A");
        },
        afterUndo: () => {
          expect(laneRefs(session, "Lane_A1")).toContain("Start_A");
        },
      },
    );
    session.destroy();
  });
});
