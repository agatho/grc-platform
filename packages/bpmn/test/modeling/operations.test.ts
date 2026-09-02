import { describe, expect, it } from "vitest";
import {
  flowElementIds,
  laneRefs,
  openSession,
  operate,
} from "./helpers/harness.js";
import {
  BOUNDARY_PROCESS,
  COLLABORATION,
  DATA_PROCESS,
  SIMPLE_PROCESS,
} from "./helpers/fixtures.js";
import { boundsOf, waypointsOf } from "../../src/modeling/di.js";
import { boOf } from "../../src/modeling/util.js";
import type { BpmnShape } from "../../src/modeling/types.js";

/**
 * Für **jede** Operation aus Punkt 2 des Auftrags mindestens ein Test, der die
 * Invarianten nach der Operation **und nach Undo** prüft.
 *
 * Das erledigt `operate()` aus dem Prüfstand: es führt aus, prüft, macht
 * rückgängig, prüft, wiederholt, prüft. Die einzelnen `expect` darunter prüfen
 * die *Absicht* der Operation — die Konsistenz der drei Bäume ist bereits
 * zugesichert, wenn `operate` zurückkommt.
 */

describe("shape.create", () => {
  it("legt Knoten, DI und flowElements-Zugehörigkeit gemeinsam an", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const process = boOf(session.root());

    const shape = operate(session, "shape.create", () =>
      session.modeling.createShape(
        { type: "bpmn:ServiceTask", name: "Neu" },
        { x: 250, y: 400 },
        session.root() as never,
      ),
    ) as unknown as BpmnShape;

    expect(session.has(shape.id)).toBe(true);
    expect(boOf(shape)?.$type).toBe("bpmn:ServiceTask");
    expect(flowElementIds(process as never)).toContain(shape.id);
    expect(boundsOf(shape.di!)).toEqual({
      x: 200,
      y: 360,
      width: 100,
      height: 80,
    });
    session.destroy();
  });

  it("vergibt IDs, die im gesamten Dokument frei sind", async () => {
    const session = await openSession(COLLABORATION);
    const created = operate(session, "shape.create (id)", () =>
      session.modeling.createShape(
        { type: "bpmn:Task" },
        { x: 600, y: 130 },
        session.shape("Pool_A") as never,
      ),
    ) as unknown as BpmnShape;

    const all = session.elementRegistry.getAll().map((e) => e.id);
    expect(new Set(all).size).toBe(all.length);
    expect(created.id).not.toBe("Task_A1");
    expect(created.id).not.toBe("Task_B1");
    session.destroy();
  });

  it("legt einen Knoten im Subprozess in dessen flowElements ab", async () => {
    const session = await openSession(COLLABORATION);
    const sub = boOf(session.shape("Sub_A"));

    const created = operate(session, "shape.create (SubProcess)", () =>
      session.modeling.createShape(
        { type: "bpmn:Task" },
        { x: 460, y: 290 },
        session.shape("Sub_A") as never,
      ),
    ) as unknown as BpmnShape;

    expect(flowElementIds(sub as never)).toContain(created.id);
    session.destroy();
  });
});

describe("shape.move", () => {
  it("führt die DI-Bounds nach", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const task = session.shape("Task_1");

    operate(session, "shape.move", () => {
      session.modeling.moveShape(
        task as never,
        { x: 40, y: 25 },
        task.parent as never,
      );
    });

    expect(boundsOf(task.di!)).toEqual({
      x: 290,
      y: 183,
      width: 100,
      height: 80,
    });
    session.destroy();
  });

  it("hängt beim Wechsel der Lane nur flowNodeRef um, nicht flowElements", async () => {
    const session = await openSession(COLLABORATION);
    const task = session.shape("Task_A1");
    const process = boOf(session.shape("Pool_A"))!["processRef"] as Record<
      string,
      unknown
    >;

    expect(laneRefs(session, "Lane_A1")).toContain("Task_A1");

    operate(
      session,
      "shape.move (Lane-Wechsel)",
      () => {
        // 150 px nach unten: aus Lane_A1 (y 60–210) in Lane_A2 (y 210–360)
        session.modeling.moveShape(
          task as never,
          { x: 0, y: 160 },
          task.parent as never,
        );
      },
      {
        after: () => {
          expect(laneRefs(session, "Lane_A2")).toContain("Task_A1");
          expect(laneRefs(session, "Lane_A1")).not.toContain("Task_A1");
          // flowElements bleibt unverändert am Prozess — der Kernpunkt.
          expect(flowElementIds(process)).toContain("Task_A1");
        },
        afterUndo: () => {
          expect(laneRefs(session, "Lane_A1")).toContain("Task_A1");
          expect(laneRefs(session, "Lane_A2")).not.toContain("Task_A1");
        },
      },
    );
    session.destroy();
  });

  it("wechselt beim Zug in einen Subprozess den flowElements-Container", async () => {
    const session = await openSession(COLLABORATION);
    const start = session.shape("Start_A");
    const processA = boOf(session.shape("Pool_A"))!["processRef"] as Record<
      string,
      unknown
    >;
    const sub = boOf(session.shape("Sub_A")) as unknown as Record<
      string,
      unknown
    >;

    operate(
      session,
      "shape.move (SubProcess-Wechsel)",
      () => {
        session.modeling.moveShape(
          start as never,
          { x: 200, y: 160 },
          session.shape("Sub_A") as never,
        );
      },
      {
        after: () => {
          expect(flowElementIds(sub)).toContain("Start_A");
          expect(flowElementIds(processA)).not.toContain("Start_A");
        },
        afterUndo: () => {
          expect(flowElementIds(processA)).toContain("Start_A");
          expect(flowElementIds(sub)).not.toContain("Start_A");
        },
      },
    );
    session.destroy();
  });
});

describe("shape.delete", () => {
  it("nimmt Knoten, DI, Kanten und Lane-Verweise gemeinsam mit", async () => {
    const session = await openSession(COLLABORATION);
    const process = boOf(session.shape("Pool_A"))!["processRef"] as Record<
      string,
      unknown
    >;

    operate(
      session,
      "shape.delete",
      () => {
        session.modeling.removeShape(session.shape("Task_A1") as never);
      },
      {
        after: () => {
          expect(session.has("Task_A1")).toBe(false);
          // Die anhängenden Kanten sind mitgegangen …
          expect(session.has("Flow_A1")).toBe(false);
          expect(session.has("Flow_A2")).toBe(false);
          expect(session.has("Message_1")).toBe(false);
          // … und der Lane-Verweis auch.
          expect(laneRefs(session, "Lane_A1")).not.toContain("Task_A1");
          expect(flowElementIds(process)).not.toContain("Task_A1");
        },
        afterUndo: () => {
          expect(session.has("Task_A1")).toBe(true);
          expect(session.has("Flow_A1")).toBe(true);
          expect(laneRefs(session, "Lane_A1")).toContain("Task_A1");
        },
      },
    );
    session.destroy();
  });

  it("löscht mit dem Wirt auch sein Boundary Event und dessen Fluss", async () => {
    const session = await openSession(BOUNDARY_PROCESS);

    operate(
      session,
      "shape.delete (Wirt mit Boundary)",
      () => {
        session.modeling.removeShape(session.shape("Task_A") as never);
      },
      {
        after: () => {
          expect(session.has("Boundary_1")).toBe(false);
          expect(session.has("Flow_B")).toBe(false);
        },
        afterUndo: () => {
          expect(session.has("Boundary_1")).toBe(true);
          expect(boOf(session.shape("Boundary_1"))?.["attachedToRef"]).toBe(
            boOf(session.shape("Task_A")),
          );
        },
      },
    );
    session.destroy();
  });

  it("räumt den default-Fluss mit, wenn er gelöscht wird", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const gateway = boOf(session.shape("Gateway_1"));
    expect(gateway?.["default"]).toBe(boOf(session.connection("Flow_3")));

    operate(
      session,
      "connection.delete (default)",
      () => {
        session.modeling.removeConnection(
          session.connection("Flow_3") as never,
        );
      },
      {
        after: () => {
          expect(gateway?.["default"]).toBeUndefined();
        },
        afterUndo: () => {
          expect(gateway?.["default"]).toBe(boOf(session.connection("Flow_3")));
        },
      },
    );
    session.destroy();
  });
});

describe("shape.resize", () => {
  it("führt die DI-Bounds nach", async () => {
    const session = await openSession(COLLABORATION);
    const sub = session.shape("Sub_A");

    operate(session, "shape.resize", () => {
      session.modeling.resizeShape(sub as never, {
        x: 290,
        y: 230,
        width: 400,
        height: 160,
      });
    });

    expect(boundsOf(sub.di!)).toEqual({
      x: 290,
      y: 230,
      width: 400,
      height: 160,
    });
    session.destroy();
  });

  it("hält ein Boundary Event beim Verkleinern auf dem Rand des Wirts", async () => {
    const session = await openSession(BOUNDARY_PROCESS);
    const host = session.shape("Task_A");
    const boundary = session.shape("Boundary_1");

    operate(
      session,
      "shape.resize (Boundary auf dem Rand)",
      () => {
        session.modeling.resizeShape(host as never, {
          x: 200,
          y: 120,
          width: 100,
          height: 50,
        });
      },
      {
        after: () => {
          const centerY = boundary.y + boundary.height / 2;
          const bottom = host.y + host.height;
          expect(Math.abs(centerY - bottom)).toBeLessThanOrEqual(1);
        },
      },
    );
    session.destroy();
  });
});

describe("shape.toggleCollapse", () => {
  it("führt isExpanded in der DI nach", async () => {
    const session = await openSession(COLLABORATION);
    const sub = session.shape("Sub_A");
    expect(sub.di?.["isExpanded"]).toBe(true);

    operate(
      session,
      "shape.toggleCollapse",
      () => {
        session.modeling.toggleCollapse(sub as never);
      },
      {
        after: () => {
          expect(sub.collapsed).toBe(true);
          expect(sub.di?.["isExpanded"]).toBe(false);
        },
        afterUndo: () => {
          expect(sub.di?.["isExpanded"]).toBe(true);
        },
      },
    );
    session.destroy();
  });
});

describe("connection.create", () => {
  it("verdrahtet sourceRef/targetRef, beide Listen, flowElements und DI", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const start = session.shape("StartEvent_1");
    const gateway = session.shape("Gateway_1");
    const process = boOf(session.root()) as unknown as Record<string, unknown>;

    // Erst den bestehenden Weg auftrennen, damit eine neue Kante Sinn ergibt.
    session.modeling.removeConnection(session.connection("Flow_1") as never);
    session.assertInvariants("Vorbereitung");

    const connection = operate(session, "connection.create", () =>
      session.modeling.connect(start, gateway),
    );

    const bo = boOf(connection)!;
    expect(bo.$type).toBe("bpmn:SequenceFlow");
    expect(bo["sourceRef"]).toBe(boOf(start));
    expect(bo["targetRef"]).toBe(boOf(gateway));
    expect(flowElementIds(process)).toContain(connection.id);
    expect(waypointsOf(connection.di!).length).toBeGreaterThanOrEqual(2);
    session.destroy();
  });

  it("erzeugt zwischen Pools einen Nachrichtenfluss statt eines Sequenzflusses", async () => {
    const session = await openSession(COLLABORATION);
    const collaboration = boOf(session.root()) as unknown as Record<
      string,
      unknown
    >;

    const connection = operate(session, "connection.create (MessageFlow)", () =>
      session.modeling.connect(
        session.shape("Start_A"),
        session.shape("Task_B1"),
      ),
    );

    expect(boOf(connection)?.$type).toBe("bpmn:MessageFlow");
    const flows = collaboration["messageFlows"] as Array<{ id?: string }>;
    expect(flows.map((f) => f.id)).toContain(connection.id);
    session.destroy();
  });

  it("erzeugt zwischen Aktivität und Datenobjekt eine Datenassoziation", async () => {
    const session = await openSession(DATA_PROCESS);

    const connection = operate(
      session,
      "connection.create (DataAssociation)",
      () =>
        session.modeling.connect(
          session.shape("Task_D"),
          session.shape("Data_1"),
        ),
    );

    expect(boOf(connection)?.$type).toBe("bpmn:DataOutputAssociation");
    const task = boOf(session.shape("Task_D"))!;
    expect(
      (task["dataOutputAssociations"] as Array<{ id?: string }>).map(
        (a) => a.id,
      ),
    ).toContain(connection.id);
    session.destroy();
  });
});

describe("connection.delete", () => {
  it("löst beide Listen und die DI", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const start = boOf(session.shape("StartEvent_1"))!;
    const task = boOf(session.shape("Task_1"))!;

    operate(
      session,
      "connection.delete",
      () => {
        session.modeling.removeConnection(
          session.connection("Flow_1") as never,
        );
      },
      {
        after: () => {
          expect((start["outgoing"] as unknown[]) ?? []).toHaveLength(0);
          expect((task["incoming"] as unknown[]) ?? []).toHaveLength(0);
        },
        afterUndo: () => {
          expect((start["outgoing"] as unknown[]).length).toBe(1);
          expect((task["incoming"] as unknown[]).length).toBe(1);
        },
      },
    );
    session.destroy();
  });
});

describe("connection.reconnect", () => {
  it("hängt sourceRef und beide Listen um", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const flow = session.connection("Flow_3");
    const gateway = boOf(session.shape("Gateway_1"))!;
    const task = boOf(session.shape("Task_1"))!;

    // Vorbedingung schaffen: Task_1 darf noch einen Ausgang bekommen.
    operate(
      session,
      "connection.reconnect (Quelle)",
      () => {
        session.modeling.reconnectStart(
          flow as never,
          session.shape("Task_1") as never,
          { x: 350, y: 198 },
        );
      },
      {
        after: () => {
          expect(boOf(flow)?.["sourceRef"]).toBe(task);
          expect((gateway["outgoing"] as unknown[]) ?? []).not.toContain(
            boOf(flow),
          );
          expect(task["outgoing"] as unknown[]).toContain(boOf(flow));
          // Der default-Verweis des Gateways geht mit — sonst zeigt er auf
          // einen Fluss, der das Gateway nicht mehr verlässt.
          expect(gateway["default"]).toBeUndefined();
        },
        afterUndo: () => {
          expect(boOf(flow)?.["sourceRef"]).toBe(gateway);
          expect(gateway["outgoing"] as unknown[]).toContain(boOf(flow));
        },
      },
    );
    session.destroy();
  });

  it("hängt targetRef um", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const flow = session.connection("Flow_1");

    operate(session, "connection.reconnect (Ziel)", () => {
      session.modeling.reconnectEnd(
        flow as never,
        session.shape("Gateway_1") as never,
        { x: 405, y: 198 },
      );
    });

    expect(boOf(flow)?.["targetRef"]).toBe(boOf(session.shape("Gateway_1")));
    session.destroy();
  });
});

describe("connection.layout / updateWaypoints", () => {
  it("schreibt neue Wegpunkte in die DI", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const flow = session.connection("Flow_1");

    operate(session, "connection.updateWaypoints", () => {
      session.modeling.updateWaypoints(flow as never, [
        { x: 196, y: 198 },
        { x: 220, y: 250 },
        { x: 250, y: 198 },
      ]);
    });

    expect(waypointsOf(flow.di!)).toEqual([
      { x: 196, y: 198 },
      { x: 220, y: 250 },
      { x: 250, y: 198 },
    ]);
    session.destroy();
  });

  it("führt die DI auch beim Neurouten nach", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const flow = session.connection("Flow_1");

    operate(session, "connection.layout", () => {
      session.modeling.layoutConnection(flow as never);
    });

    // `waypointsOf` liefert reine Punkte; die Grafik trägt an Andockpunkten
    // zusätzlich `original` (das Docking von `diagram-js`). Verglichen werden
    // die Koordinaten.
    expect(waypointsOf(flow.di!)).toEqual(
      flow.waypoints.map((p) => ({ x: p.x, y: p.y })),
    );
    session.destroy();
  });
});

describe("element.updateProperties", () => {
  it("schreibt semantische Eigenschaften und macht sie exakt rückgängig", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const task = session.shape("Task_1");
    const bo = boOf(task)!;

    operate(
      session,
      "element.updateProperties",
      () => {
        session.modeling.updateProperties(task, {
          name: "Antrag gründlich prüfen",
          isForCompensation: true,
        });
      },
      {
        after: () => {
          expect(bo["name"]).toBe("Antrag gründlich prüfen");
          expect(bo["isForCompensation"]).toBe(true);
        },
        afterUndo: () => {
          expect(bo["name"]).toBe("Antrag pruefen");
          // Nie gesetzte Eigenschaften dürfen nach dem Undo nicht als
          // `undefined` zurückbleiben — sonst entsteht beim Schreiben ein
          // leeres Attribut.
          expect(Object.hasOwn(bo, "isForCompensation")).toBe(false);
        },
      },
    );
    session.destroy();
  });

  it("ändert die id in allen drei Bäumen", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const task = session.shape("Task_1");

    operate(
      session,
      "element.updateProperties (id)",
      () => {
        session.modeling.updateProperties(task, { id: "Task_geprueft" });
      },
      {
        after: () => {
          expect(session.has("Task_geprueft")).toBe(true);
          expect(session.has("Task_1")).toBe(false);
          expect(boOf(task)?.id).toBe("Task_geprueft");
        },
        afterUndo: () => {
          expect(session.has("Task_1")).toBe(true);
        },
      },
    );
    session.destroy();
  });
});

describe("element.updateLabel", () => {
  it("legt bei einem benannten Ereignis ein externes Label an und entfernt es wieder", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const gateway = session.shape("Gateway_1");
    expect(gateway.labels).toHaveLength(1);

    operate(
      session,
      "element.updateLabel (leeren)",
      () => {
        session.modeling.updateLabel(gateway, "");
      },
      {
        after: () => {
          expect(gateway.labels).toHaveLength(0);
          expect(boOf(gateway)?.["name"]).toBe("");
        },
        afterUndo: () => {
          expect(gateway.labels).toHaveLength(1);
        },
      },
    );
    session.destroy();
  });

  it("beschriftet eine Textannotation über `text`, nicht über `name`", async () => {
    const session = await openSession(DATA_PROCESS);
    const note = session.shape("Note_1");

    operate(session, "element.updateLabel (TextAnnotation)", () => {
      session.modeling.updateLabel(note, "Sechs-Augen-Prinzip");
    });

    expect(boOf(note)?.["text"]).toBe("Sechs-Augen-Prinzip");
    expect(boOf(note)?.["name"]).toBeUndefined();
    session.destroy();
  });

  it("schreibt die Beschriftungsbox in die DI, wenn das Label bewegt wird", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const label = session.shape("StartEvent_1").labels[0]!;

    operate(session, "shape.move (Label)", () => {
      session.modeling.moveShape(
        label as never,
        { x: 0, y: 20 },
        label.parent as never,
      );
    });

    const di = session.shape("StartEvent_1").di!;
    const labelDi = di["label"] as Record<string, unknown>;
    expect(boundsOf(labelDi as never)?.y).toBe(label.y);
    session.destroy();
  });
});

describe("element.updateAttachment", () => {
  it("führt attachedToRef beim Umhängen nach", async () => {
    const session = await openSession(BOUNDARY_PROCESS);
    const boundary = session.shape("Boundary_1");

    // Zweite Aktivität als neuer Wirt.
    const host2 = session.modeling.createShape(
      { type: "bpmn:Task", id: "Task_B" },
      { x: 600, y: 160 },
      session.root() as never,
    ) as unknown as BpmnShape;
    session.assertInvariants("Vorbereitung");

    operate(
      session,
      "element.updateAttachment",
      () => {
        session.modeling.updateAttachment(boundary as never, host2 as never);
      },
      {
        after: () => {
          expect(boOf(boundary)?.["attachedToRef"]).toBe(boOf(host2));
          expect(host2.attachers).toContain(boundary);
        },
        afterUndo: () => {
          expect(boOf(boundary)?.["attachedToRef"]).toBe(
            boOf(session.shape("Task_A")),
          );
        },
      },
    );
    session.destroy();
  });
});
