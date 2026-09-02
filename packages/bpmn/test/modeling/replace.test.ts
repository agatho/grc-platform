import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openSession, operate } from "./helpers/harness.js";
import {
  BOUNDARY_PROCESS,
  COLLABORATION,
  SIMPLE_PROCESS,
} from "./helpers/fixtures.js";
import { boundsOf } from "../../src/modeling/di.js";
import { asArray, boOf, isModdleElement } from "../../src/modeling/util.js";
import type { BpmnShape, ModdleElement } from "../../src/modeling/types.js";

/**
 * `shape.replace` — Typwechsel (Auftrag: „blockiert das ContextPad").
 *
 * Die Tests prüfen nicht, dass der Typ sich ändert — das wäre die leichte
 * Hälfte. Sie prüfen, was beim Typwechsel **erhalten bleiben muss**:
 * Eigenschaften, `extensionElements` (dort hängt `arctos:grcMetadata`), die
 * ID, die Kanten, die Anhefter und die Lane-Zugehörigkeit. Jeder dieser Posten
 * ist eine Stelle, an der die drei Bäume auseinanderlaufen können, ohne dass
 * es am Bild zu sehen wäre.
 */

const CORPUS = join(import.meta.dirname, "..", "corpus");
const corpus = (name: string): string =>
  readFileSync(join(CORPUS, `${name}.bpmn`), "utf8");

describe("Typwechsel", () => {
  it("tauscht den Typ und behält Name, ID und Geometrie", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const before = { ...boundsOf(session.shape("Task_1").di!)! };

    const replaced = operate(session, "shape.replace", () =>
      session.modeling.replaceShape(session.shape("Task_1"), {
        type: "bpmn:ServiceTask",
      }),
    );

    expect(boOf(replaced)?.$type).toBe("bpmn:ServiceTask");
    expect(replaced.id).toBe("Task_1");
    expect(boOf(replaced)?.["name"]).toBe("Antrag pruefen");
    expect(boundsOf(replaced.di!)).toEqual(before);
    session.destroy();
  });

  it("nimmt die Kanten mit", async () => {
    const session = await openSession(SIMPLE_PROCESS);

    operate(
      session,
      "shape.replace mit Kanten",
      () => {
        session.modeling.replaceShape(session.shape("Task_1"), {
          type: "bpmn:UserTask",
        });
      },
      {
        after: () => {
          const task = session.shape("Task_1");
          expect(task.incoming.map((c) => c.id)).toEqual(["Flow_1"]);
          expect(task.outgoing.map((c) => c.id)).toEqual(["Flow_2"]);
          expect(boOf(session.connection("Flow_1"))?.["targetRef"]).toBe(
            boOf(task),
          );
        },
        afterUndo: () => {
          expect(session.shape("Task_1").incoming.map((c) => c.id)).toEqual([
            "Flow_1",
          ]);
        },
      },
    );
    session.destroy();
  });

  it("hängt Boundary Events auf den neuen Wirt um", async () => {
    const session = await openSession(BOUNDARY_PROCESS);

    operate(
      session,
      "shape.replace mit Anhefter",
      () => {
        session.modeling.replaceShape(session.shape("Task_A"), {
          type: "bpmn:UserTask",
        });
      },
      {
        after: () => {
          const host = session.shape("Task_A");
          const boundary = session.shape("Boundary_1");
          expect(boOf(host)?.$type).toBe("bpmn:UserTask");
          expect(boundary.host).toBe(host);
          expect(boOf(boundary)?.["attachedToRef"]).toBe(boOf(host));
          // Der Fehlerpfad des Anhefters lebt weiter.
          expect(session.has("Flow_B")).toBe(true);
        },
        afterUndo: () => {
          expect(boOf(session.shape("Task_A"))?.$type).toBe("bpmn:ServiceTask");
          expect(session.shape("Boundary_1").host?.id).toBe("Task_A");
        },
      },
    );
    session.destroy();
  });

  it("setzt eine Ereignisdefinition in einem Kommando", async () => {
    const session = await openSession(SIMPLE_PROCESS);

    operate(
      session,
      "shape.replace mit Ereignisdefinition",
      () => {
        session.modeling.replaceShape(session.shape("EndEvent_1"), {
          type: "bpmn:EndEvent",
          eventDefinitionType: "bpmn:ErrorEventDefinition",
        });
      },
      {
        after: () => {
          const definitions = asArray(
            boOf(session.shape("EndEvent_1"))?.["eventDefinitions"],
          );
          expect(definitions).toHaveLength(1);
          expect(definitions[0]?.$type).toBe("bpmn:ErrorEventDefinition");
        },
        afterUndo: () => {
          expect(
            asArray(boOf(session.shape("EndEvent_1"))?.["eventDefinitions"]),
          ).toHaveLength(0);
        },
      },
    );
    session.destroy();
  });

  it("behält die Lane-Zugehörigkeit", async () => {
    const session = await openSession(COLLABORATION);

    operate(session, "shape.replace in einer Lane", () => {
      session.modeling.replaceShape(session.shape("Task_A1"), {
        type: "bpmn:ManualTask",
      });
    });

    const lane = boOf(session.shape("Lane_A1"))!;
    expect(asArray(lane["flowNodeRef"]).map((n) => n["id"])).toContain(
      "Task_A1",
    );
    session.destroy();
  });

  it("nimmt die Kinder eines Subprozesses mit, wenn das Ziel welche trägt", async () => {
    const session = await openSession(COLLABORATION);

    operate(session, "SubProcess → Transaction", () => {
      session.modeling.replaceShape(session.shape("Sub_A"), {
        type: "bpmn:Transaction",
      });
    });

    const sub = session.shape("Sub_A");
    expect(boOf(sub)?.$type).toBe("bpmn:Transaction");
    expect(session.shape("Sub_Start").parent?.id).toBe("Sub_A");
    expect(asArray(boOf(sub)?.["flowElements"]).map((e) => e["id"])).toContain(
      "Sub_Start",
    );
    session.destroy();
  });
});

describe("Typwechsel erhält, was ARCTOS braucht", () => {
  it("nimmt extensionElements samt arctos:grcMetadata mit", async () => {
    const session = await openSession(corpus("repo-arctos-full-grcmetadata"));
    const task = session.elementRegistry.getAll().find((element) => {
      const bo = boOf(element as never);
      return (
        bo !== undefined &&
        isModdleElement(bo["extensionElements"]) &&
        bo.$type.startsWith("bpmn:") &&
        bo.$type.endsWith("Task")
      );
    }) as BpmnShape | undefined;
    expect(task, "Korpusdatei ohne Task mit extensionElements").toBeDefined();

    const extensionBefore = boOf(task!)!["extensionElements"];
    const id = task!.id;

    operate(session, "shape.replace mit GRC-Metadaten", () => {
      session.modeling.replaceShape(task!, { type: "bpmn:ServiceTask" });
    });

    const now = boOf(session.shape(id))!;
    expect(now.$type).toBe("bpmn:ServiceTask");
    // **Gleichwertig, nicht identisch.** Der Teilbaum wird kopiert, nicht
    // geteilt — sonst zeigte sein `$parent` nach einem Undo auf ein Objekt,
    // das nicht mehr im Baum steht (der eigene Prüfer hat das gemeldet).
    const extensionAfter = now["extensionElements"] as ModdleElement;
    expect(extensionAfter).not.toBe(extensionBefore);
    expect(extensionAfter.$type).toBe((extensionBefore as ModdleElement).$type);
    // Der Elternverweis zeigt auf das neue Objekt.
    expect((extensionAfter as { $parent?: unknown }).$parent).toBe(now);

    const xml = await session.exportXml();
    expect(xml).toContain("grcMetadata");
    session.destroy();
  });

  it("überträgt keine Eigenschaft, die der neue Typ nicht kennt", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    // `bpmn:ExclusiveGateway` hat `gatewayDirection`, ein `bpmn:Task` nicht.
    session.modeling.updateProperties(session.shape("Gateway_1"), {
      gatewayDirection: "Diverging",
    });

    operate(session, "Gateway → Task", () => {
      session.modeling.replaceShape(session.shape("Gateway_1"), {
        type: "bpmn:Task",
      });
    });

    const bo = boOf(session.shape("Gateway_1"))!;
    expect(bo.$type).toBe("bpmn:Task");
    expect(Object.hasOwn(bo, "gatewayDirection")).toBe(false);
    // Und was der neue Typ kennt, ist da.
    expect(bo["name"]).toBe("Vollstaendig?");
    session.destroy();
  });

  it("vergibt auf Wunsch eine neue ID", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const replaced = operate(session, "shape.replace mit neuer ID", () =>
      session.modeling.replaceShape(
        session.shape("Task_1"),
        { type: "bpmn:UserTask" },
        { newId: true },
      ),
    );
    expect(replaced.id).not.toBe("Task_1");
    expect(session.has("Task_1")).toBe(false);
    session.destroy();
  });

  it("lässt Pools und Lanes nicht ersetzen", async () => {
    const session = await openSession(COLLABORATION);
    const rules = session.get<{ allowed(a: string, c?: unknown): unknown }>(
      "rules",
    );
    expect(
      rules.allowed("shape.replace", {
        oldShape: session.shape("Pool_A"),
        newData: { type: "bpmn:Participant" },
      }),
    ).toBe(false);
    expect(
      rules.allowed("shape.replace", {
        oldShape: session.shape("Lane_A1"),
        newData: { type: "bpmn:Lane" },
      }),
    ).toBe(false);
    expect(
      rules.allowed("shape.replace", {
        oldShape: session.shape("Task_A1"),
        newData: { type: "bpmn:UserTask" },
      }),
    ).toBe(true);
    session.destroy();
  });

  it("verwirft eine Kante, die nach dem Wechsel regelwidrig wäre", async () => {
    const session = await openSession(SIMPLE_PROCESS);

    // Task_1 hat einen eingehenden Fluss. Als Start-Ereignis darf es keinen
    // mehr haben — die Kante muss verschwinden, nicht ungültig weiterleben.
    operate(
      session,
      "Task → StartEvent",
      () => {
        session.modeling.replaceShape(session.shape("Task_1"), {
          type: "bpmn:StartEvent",
          width: 36,
          height: 36,
        });
      },
      {
        after: () => {
          expect(boOf(session.shape("Task_1"))?.$type).toBe("bpmn:StartEvent");
          expect(session.has("Flow_1")).toBe(false);
          expect(session.has("Flow_2")).toBe(true);
        },
        afterUndo: () => {
          expect(session.has("Flow_1")).toBe(true);
          expect(boOf(session.shape("Task_1"))?.$type).toBe("bpmn:UserTask");
        },
      },
    );
    session.destroy();
  });
});
