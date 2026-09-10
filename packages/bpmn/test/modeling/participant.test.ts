import { describe, expect, it } from "vitest";
import { openSession, operate } from "./helpers/harness";
import { COLLABORATION, SIMPLE_PROCESS } from "./helpers/fixtures";
import { planesOf } from "../../src/modeling/di";
import { participantsOf } from "../../src/modeling/behaviors/ParticipantBehavior";
import { asArray, boOf } from "../../src/modeling/util";
import type { Bounds, BpmnShape } from "../../src/modeling/types";

/**
 * Wurzelwechsel Prozess ↔ Kollaboration (Plan §2.3.1).
 *
 * Der interessante Teil ist nicht der Typ der Wurzel, sondern was beim Wechsel
 * **mitkommt**: der bisherige Prozess muss der Prozess des neuen Pools werden,
 * sein Inhalt muss hinein, und beim Rückweg muss er wieder heraus, **bevor**
 * die Löschkaskade des Pools ihn erwischt. Jeder dieser Schritte ist eine
 * Stelle, an der der Editor etwas zeigt, das in der Datei nicht steht.
 */

const POOL_BOUNDS: Bounds = { x: 100, y: 100, width: 700, height: 300 };

describe("Erster Pool in einem Prozessdiagramm", () => {
  it("macht aus der Prozesswurzel eine Collaboration", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    expect(boOf(session.root())?.$type).toBe("bpmn:Process");

    operate(
      session,
      "erster Pool",
      () => {
        session.modeling.createShape(
          { type: "bpmn:Participant", name: "Fachbereich" },
          POOL_BOUNDS as never,
          session.root() as never,
        );
      },
      {
        after: () => {
          expect(boOf(session.root())?.$type).toBe("bpmn:Collaboration");
          expect(participantsOf(session.root())).toHaveLength(1);
        },
        afterUndo: () => {
          expect(boOf(session.root())?.$type).toBe("bpmn:Process");
          expect(participantsOf(session.root())).toHaveLength(0);
        },
      },
    );
    session.destroy();
  });

  it("gibt dem Pool den vorhandenen Prozess, nicht einen neuen", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const process = boOf(session.root())!;

    const pool = operate(session, "Pool mit vorhandenem Prozess", () =>
      session.modeling.createShape(
        { type: "bpmn:Participant" },
        POOL_BOUNDS as never,
        session.root() as never,
      ),
    ) as unknown as BpmnShape;

    expect(boOf(pool)?.["processRef"]).toBe(process);
    // Kein zweiter, leerer Prozess im Dokument.
    const processes = asArray(session.definitions()["rootElements"]).filter(
      (element) => element.$type === "bpmn:Process",
    );
    expect(processes).toHaveLength(1);
    session.destroy();
  });

  it("zieht den bisherigen Inhalt in den Pool", async () => {
    const session = await openSession(SIMPLE_PROCESS);

    const pool = operate(
      session,
      "Inhalt in den Pool",
      () =>
        session.modeling.createShape(
          { type: "bpmn:Participant" },
          POOL_BOUNDS as never,
          session.root() as never,
        ),
      {
        after: () => {
          expect(session.shape("Task_1").parent?.id).not.toBe(
            session.root().id,
          );
        },
        afterUndo: () => {
          expect(session.shape("Task_1").parent?.id).toBe(session.root().id);
        },
      },
    ) as unknown as BpmnShape;

    expect(session.shape("Task_1").parent).toBe(pool);
    expect(session.shape("StartEvent_1").parent).toBe(pool);
    session.destroy();
  });

  it("schreibt danach ein gültiges Kollaborationsdokument", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    session.modeling.createShape(
      { type: "bpmn:Participant", name: "Fachbereich" },
      POOL_BOUNDS as never,
      session.root() as never,
    );
    session.assertInvariants("nach dem Wurzelwechsel");

    const xml = await session.exportXml();
    expect(xml).toContain("bpmn:collaboration");
    expect(xml).toContain('name="Fachbereich"');

    // Wieder einlesen: dieselbe Struktur, keine Verluste.
    const reopened = await openSession(xml);
    expect(boOf(reopened.root())?.$type).toBe("bpmn:Collaboration");
    expect(reopened.has("Task_1")).toBe(true);
    expect(reopened.checkInvariants()).toEqual([]);
    session.destroy();
    reopened.destroy();
  });

  it("erlaubt danach einen zweiten Pool und einen Nachrichtenfluss", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const first = session.modeling.createShape(
      { type: "bpmn:Participant", name: "Innen" },
      POOL_BOUNDS as never,
      session.root() as never,
    ) as unknown as BpmnShape;
    session.assertInvariants("erster Pool");

    const second = operate(session, "zweiter Pool", () =>
      session.modeling.createShape(
        { type: "bpmn:Participant", name: "Aussen" },
        { x: 100, y: 480, width: 700, height: 200 } as never,
        session.root() as never,
      ),
    ) as unknown as BpmnShape;

    const partner = session.modeling.createShape(
      { type: "bpmn:Task", name: "Antwort" },
      { x: 300, y: 580 },
      second as never,
    ) as unknown as BpmnShape;
    session.assertInvariants("Aufgabe im zweiten Pool");

    const message = session.modeling.connect(session.shape("Task_1"), partner);
    expect(boOf(message)?.$type).toBe("bpmn:MessageFlow");
    session.assertInvariants("Nachrichtenfluss");
    expect(first.id).not.toBe(second.id);
    session.destroy();
  });
});

describe("Letzter Pool wird gelöscht", () => {
  it("bindet die Wurzel zurück auf den Prozess", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const pool = session.modeling.createShape(
      { type: "bpmn:Participant" },
      POOL_BOUNDS as never,
      session.root() as never,
    ) as unknown as BpmnShape;
    session.assertInvariants("Pool angelegt");

    operate(
      session,
      "letzten Pool löschen",
      () => {
        session.modeling.removeShape(session.shape(pool.id) as never);
      },
      {
        after: () => {
          expect(boOf(session.root())?.$type).toBe("bpmn:Process");
          // Der Inhalt ist gerettet, nicht mitgelöscht.
          expect(session.has("Task_1")).toBe(true);
          expect(session.shape("Task_1").parent?.id).toBe(session.root().id);
        },
        afterUndo: () => {
          expect(boOf(session.root())?.$type).toBe("bpmn:Collaboration");
          expect(session.has("Task_1")).toBe(true);
        },
      },
    );
    session.destroy();
  });

  it("lässt die Collaboration stehen, solange noch ein Pool da ist", async () => {
    const session = await openSession(COLLABORATION);

    operate(
      session,
      "einen von zwei Pools löschen",
      () => {
        session.modeling.removeShape(session.shape("Pool_B") as never);
      },
      {
        after: () => {
          expect(boOf(session.root())?.$type).toBe("bpmn:Collaboration");
          expect(participantsOf(session.root())).toHaveLength(1);
        },
      },
    );
    session.destroy();
  });

  it("hält Ebene und DI über den ganzen Hin- und Rückweg zusammen", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const planesBefore = planesOf(session.definitions()).length;

    const pool = session.modeling.createShape(
      { type: "bpmn:Participant" },
      POOL_BOUNDS as never,
      session.root() as never,
    ) as unknown as BpmnShape;
    session.assertInvariants("hin");
    session.modeling.removeShape(session.shape(pool.id) as never);
    session.assertInvariants("zurück");

    expect(planesOf(session.definitions())).toHaveLength(planesBefore);
    expect(boOf(session.root())?.$type).toBe("bpmn:Process");
    const xml = await session.exportXml();
    expect(xml).not.toContain("bpmn:collaboration");
    session.destroy();
  });
});
