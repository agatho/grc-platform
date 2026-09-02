import { describe, expect, it } from "vitest";
import { laneRefs, openSession, operate } from "./helpers/harness.js";
import {
  COLLABORATION,
  NESTED_LANES,
  SIMPLE_PROCESS,
} from "./helpers/fixtures.js";
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
  it("ist erlaubt — der Wurzelwechsel geschieht dabei", async () => {
    // Früher war das hier eine Verbotsregel: Der Übergang Process →
    // Collaboration war nicht gebaut, und ein Pool, der im Editor erscheint
    // und in der Datei fehlt, wäre schlimmer als ein „geht nicht". Der
    // Übergang ist inzwischen gebaut (`behaviors/ParticipantBehavior.ts`,
    // `test/modeling/participant.test.ts`), also fällt das Verbot.
    const session = await openSession(SIMPLE_PROCESS);
    const rules = session.get<{ allowed(a: string, c?: unknown): unknown }>(
      "rules",
    );
    const pool = session
      .get<{ createShape: (attrs: unknown) => BpmnShape }>("elementFactory")
      .createShape({ type: "bpmn:Participant" });
    expect(
      rules.allowed("shape.create", { shape: pool, target: session.root() }),
    ).toBe(true);
    session.destroy();
  });

  it("bleibt in einem Container verboten", async () => {
    const session = await openSession(COLLABORATION);
    const rules = session.get<{ allowed(a: string, c?: unknown): unknown }>(
      "rules",
    );
    const pool = session
      .get<{ createShape: (attrs: unknown) => BpmnShape }>("elementFactory")
      .createShape({ type: "bpmn:Participant" });
    expect(
      rules.allowed("shape.create", {
        shape: pool,
        target: session.shape("Sub_A"),
      }),
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

describe("Geschachtelte Lanes", () => {
  it("hängt flowNodeRef an die innerste Lane", async () => {
    const session = await openSession(NESTED_LANES);
    expect(laneRefs(session, "Lane_Innen1")).toEqual(["Task_N1"]);
    expect(laneRefs(session, "Lane_Innen2")).toEqual(["Task_N2"]);
    // Die äußere Lane beansprucht die Knoten ihrer Kinder **nicht**.
    expect(laneRefs(session, "Lane_Aussen")).toEqual([]);
    expect(laneFor(session.shape("Task_N1"))?.id).toBe("Lane_Innen1");
    session.destroy();
  });

  it("lässt beim Entfernen einer inneren Lane die Geschwisterlane wachsen — nicht den Pool", async () => {
    const session = await openSession(NESTED_LANES);
    const poolHeightBefore = session.shape("Pool_N").height;
    const outerHeightBefore = session.shape("Lane_Aussen").height;

    operate(
      session,
      "innere Lane entfernen",
      () => {
        session.modeling.removeLane(session.shape("Lane_Innen1"));
      },
      {
        after: () => {
          expect(session.has("Lane_Innen1")).toBe(false);
          // Die Geschwisterlane füllt die Lücke.
          expect(session.shape("Lane_Innen2").height).toBe(200);
          // Weder der Pool noch die äußere Lane ändern ihre Größe.
          expect(session.shape("Pool_N").height).toBe(poolHeightBefore);
          expect(session.shape("Lane_Aussen").height).toBe(outerHeightBefore);
          // Der Knoten der entfernten Lane gehört jetzt zur Geschwisterlane.
          expect(laneRefs(session, "Lane_Innen2").sort()).toEqual([
            "Task_N1",
            "Task_N2",
          ]);
        },
        afterUndo: () => {
          expect(session.has("Lane_Innen1")).toBe(true);
          expect(laneRefs(session, "Lane_Innen1")).toEqual(["Task_N1"]);
          expect(laneRefs(session, "Lane_Innen2")).toEqual(["Task_N2"]);
        },
      },
    );
    session.destroy();
  });

  it("verkleinert beim Entfernen der letzten Lane einer Ebene nichts", async () => {
    const session = await openSession(NESTED_LANES);
    session.modeling.removeLane(session.shape("Lane_Innen1"));
    session.assertInvariants("erste innere Lane weg");
    const outerBefore = session.shape("Lane_Aussen").height;
    const poolBefore = session.shape("Pool_N").height;

    operate(
      session,
      "letzte innere Lane entfernen",
      () => {
        session.modeling.removeLane(session.shape("Lane_Innen2"));
      },
      {
        after: () => {
          // Die äußere Lane verliert ihre Unterteilung, nicht ihre Größe.
          expect(session.shape("Lane_Aussen").height).toBe(outerBefore);
          expect(session.shape("Pool_N").height).toBe(poolBefore);
          expect(childLanes(session.shape("Lane_Aussen"))).toHaveLength(0);
          // Die Knoten hängen nun an der äußeren Lane.
          expect(laneRefs(session, "Lane_Aussen").sort()).toEqual([
            "Task_N1",
            "Task_N2",
          ]);
        },
      },
    );
    session.destroy();
  });

  it("lässt den Pool beim Entfernen seiner letzten Lane unverändert groß", async () => {
    const session = await openSession(NESTED_LANES);
    const poolBefore = { ...boundsOfShape(session.shape("Pool_N")) };

    session.modeling.removeLane(session.shape("Lane_Aussen"));
    session.assertInvariants("äußere Lane weg");
    session.modeling.removeLane(session.shape("Lane_Unten"));
    session.assertInvariants("letzte Lane weg");

    expect(boundsOfShape(session.shape("Pool_N"))).toEqual(poolBefore);
    expect(childLanes(session.shape("Pool_N"))).toHaveLength(0);
    // Der Knoten, der in der letzten Lane lag, ist noch da.
    expect(session.has("Task_N3")).toBe(true);
    session.destroy();
  });

  it("nimmt beim Entfernen einer äußeren Lane ihre Kind-Lanes mit", async () => {
    const session = await openSession(NESTED_LANES);

    operate(
      session,
      "äußere Lane mit Kindern entfernen",
      () => {
        session.modeling.removeLane(session.shape("Lane_Aussen"));
      },
      {
        after: () => {
          expect(session.has("Lane_Innen1")).toBe(false);
          expect(session.has("Lane_Innen2")).toBe(false);
          // Die Knoten bleiben — sie gehören dem Prozess.
          expect(session.has("Task_N1")).toBe(true);
          expect(session.has("Task_N2")).toBe(true);
        },
        afterUndo: () => {
          expect(session.has("Lane_Innen1")).toBe(true);
          expect(laneRefs(session, "Lane_Innen1")).toEqual(["Task_N1"]);
        },
      },
    );
    session.destroy();
  });
});

function boundsOfShape(shape: BpmnShape): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
}
