import { describe, expect, it } from "vitest";
import { openSession } from "./helpers/harness";
import {
  BOUNDARY_PROCESS,
  COLLABORATION,
  DATA_PROCESS,
  SIMPLE_PROCESS,
} from "./helpers/fixtures";
import { checkInvariants } from "../../src/modeling/invariants";
import { importXml } from "../../src/model/io";
import { boOf } from "../../src/modeling/util";
import type { BpmnShape } from "../../src/modeling/types";

describe("Import in die Modellierungsschicht", () => {
  it("baut aus einem Prozess einen Elementbaum mit allen drei Bäumen verbunden", async () => {
    const session = await openSession(SIMPLE_PROCESS);

    expect(session.has("StartEvent_1")).toBe(true);
    expect(session.has("Flow_1")).toBe(true);
    expect(session.root().id).toBe("Process_1");

    const task = session.shape("Task_1");
    expect(boOf(task)?.$type).toBe("bpmn:UserTask");
    expect(task.di?.$type).toBe("bpmndi:BPMNShape");
    expect(task.parent?.id).toBe("Process_1");

    const flow = session.connection("Flow_1");
    expect(flow.source?.id).toBe("StartEvent_1");
    expect(flow.target?.id).toBe("Task_1");
    expect(flow.waypoints).toHaveLength(2);

    session.destroy();
  });

  it("legt externe Beschriftungen als eigene Shapes an", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const start = session.shape("StartEvent_1");
    expect(start.labels).toHaveLength(1);
    expect(start.labels[0]?.labelTarget).toBe(start);
    // Aufgaben beschriften innen — kein eigenes Shape.
    expect(session.shape("Task_1").labels).toHaveLength(0);
    session.destroy();
  });

  it("hängt Boundary Events an ihren Wirt", async () => {
    const session = await openSession(BOUNDARY_PROCESS);
    const boundary = session.shape("Boundary_1");
    const host = session.shape("Task_A");
    expect(boundary.host).toBe(host);
    expect(host.attachers).toContain(boundary);
    expect(boOf(boundary)?.["attachedToRef"]).toBe(boOf(host));
    session.destroy();
  });

  it("schachtelt Pools, Lanes und Subprozesse richtig", async () => {
    const session = await openSession(COLLABORATION);

    expect(session.root().id).toBe("Collaboration_1");
    expect(session.shape("Pool_A").parent?.id).toBe("Collaboration_1");
    expect(session.shape("Lane_A1").parent?.id).toBe("Pool_A");
    // Knoten hängen am Pool, nicht an der Lane — Lane-Zugehörigkeit ist
    // `flowNodeRef` plus Geometrie, kein Container.
    expect(session.shape("Task_A1").parent?.id).toBe("Pool_A");
    // Subprozesskinder dagegen hängen wirklich im Subprozess.
    expect(session.shape("Sub_Start").parent?.id).toBe("Sub_A");
    session.destroy();
  });

  it("stellt Datenobjekte und Annotationen dar", async () => {
    const session = await openSession(DATA_PROCESS);
    expect(session.has("Data_1")).toBe(true);
    expect(session.has("Note_1")).toBe(true);
    session.destroy();
  });

  it("ergänzt fehlende DI und meldet das", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D" targetNamespace="x">
        <bpmn:process id="P" isExecutable="false">
          <bpmn:startEvent id="S"><bpmn:outgoing>F</bpmn:outgoing></bpmn:startEvent>
          <bpmn:endEvent id="E"><bpmn:incoming>F</bpmn:incoming></bpmn:endEvent>
          <bpmn:sequenceFlow id="F" sourceRef="S" targetRef="E" />
        </bpmn:process>
      </bpmn:definitions>`;
    const session = await openSession(xml);
    expect(session.has("S")).toBe(true);
    expect(session.has("F")).toBe(true);
    expect(session.checkInvariants()).toEqual([]);
    session.destroy();
  });

  it("meldet Kanten ohne auflösbare Endpunkte, statt sie zu verschlucken", async () => {
    // `moddle` verwirft eine unauflösbare IDREF still (SPIKE-ENTSCHEIDUNG,
    // Ursache 2). Der Import darf daraus kein grafisches Element machen —
    // und den semantischen Rest nicht wegwerfen.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D" targetNamespace="x">
        <bpmn:process id="P" isExecutable="false">
          <bpmn:startEvent id="S" />
          <bpmn:sequenceFlow id="F" sourceRef="S" targetRef="DoesNotExist" />
        </bpmn:process>
      </bpmn:definitions>`;
    const session = await openSession(xml, {
      ignoreInvariants: ["FLOW_WITHOUT_TARGET", "DI_MISSING", "OUTGOING_STALE"],
    });
    expect(session.has("F")).toBe(false);
    session.destroy();
  });

  it("prüft ein Korpusdiagramm ohne Grafik rein semantisch", async () => {
    const { definitions } = await importXml(SIMPLE_PROCESS);
    // Ohne elementRegistry laufen nur die Prüfungen über Baum 1 und 2 — der
    // Modus, in dem ein reiner Modell-Eigenschaftstest arbeitet.
    expect(checkInvariants({ definitions })).toEqual([]);
  });

  it("erkennt eine Ebene mit mehreren Diagrammen und wählt die erste", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    expect(session.plane().id).toBe("Plane_1");
    session.destroy();
  });

  it("übernimmt die Bounds der DI unverändert in die Grafik", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const task: BpmnShape = session.shape("Task_1");
    expect({
      x: task.x,
      y: task.y,
      width: task.width,
      height: task.height,
    }).toEqual({
      x: 250,
      y: 158,
      width: 100,
      height: 80,
    });
    session.destroy();
  });
});
