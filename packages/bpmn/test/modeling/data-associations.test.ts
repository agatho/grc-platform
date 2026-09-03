import { describe, expect, it } from "vitest";
import { openSession, operate } from "./helpers/harness";
import { DATA_PROCESS } from "./helpers/fixtures";
import { asArray, boOf } from "../../src/modeling/util";
import { checkSchema } from "../../src/verify/schema";
import type { ModdleElement } from "../../src/modeling/types";

/**
 * Wächter der Datenassoziationen — Welle 2a, OP-044.
 *
 * `bpmn:DataAssociation` typisiert `sourceRef` und `targetRef` als
 * `bpmn:ItemAwareElement`. Eine `bpmn:Task` ist keines. ARCTOS hat beide
 * Richtungen auf die Aktivität zeigen lassen; das ist wohlgeformtes XML und
 * ungültiges BPMN — genau die Sorte Fehler, die erst beim Austausch auffällt,
 * also beim schlechtesten denkbaren Zeitpunkt.
 *
 * Geprüft wird deshalb nicht nur die Struktur, sondern der **Export**: das
 * Dokument, das ein fremdes Werkzeug zu sehen bekommt.
 */

function properties(bo: ModdleElement | undefined): ModdleElement[] {
  return asArray(bo?.["properties"]);
}

describe("OP-044 — Datenassoziationen zeigen auf ItemAwareElements", () => {
  it("legt für eine eingehende Assoziation den `__targetRef_placeholder` an", async () => {
    // Gegenprobe: in `BpmnUpdater.wireEndpoints` den Zweig
    // `bpmn:DataInputAssociation` wieder auf `targetRef: targetBo` setzen —
    // dann zeigt `targetRef` auf `Task_D`, und der Export trägt
    // `targetRef="Task_D"`, was das Schema nicht zulässt.
    const session = await openSession(DATA_PROCESS);
    const connection = operate(
      session,
      "connection.create (DataInputAssociation)",
      () =>
        session.modeling.connect(
          session.shape("Data_1"),
          session.shape("Task_D"),
        ),
    );
    const bo = boOf(connection);
    expect(bo?.$type).toBe("bpmn:DataInputAssociation");

    const task = boOf(session.shape("Task_D"));
    const placeholder = properties(task).find(
      (property) => property["name"] === "__targetRef_placeholder",
    );
    expect(
      placeholder,
      "die Aktivität braucht die Platzhalter-Property als zulässiges Ziel",
    ).toBeDefined();
    expect(bo?.["targetRef"]).toBe(placeholder);
    // Die Quelle bleibt das Datenobjekt — sie *ist* ein ItemAwareElement.
    expect(asArray(bo?.["sourceRef"])[0]).toBe(boOf(session.shape("Data_1")));
    session.destroy();
  });

  it("legt für mehrere eingehende Assoziationen **eine** Property an", async () => {
    const session = await openSession(DATA_PROCESS);
    session.modeling.connect(session.shape("Data_1"), session.shape("Task_D"));
    // Zweites Datenobjekt daneben, damit wirklich zwei Assoziationen entstehen
    // und nicht dieselbe zweimal.
    const second = session.modeling.createShape(
      session
        .get<{ createShape(attrs: unknown): unknown }>("elementFactory")
        .createShape({ type: "bpmn:DataObjectReference" }) as never,
      { x: 400, y: 320 } as never,
      session.root() as never,
    );
    session.modeling.connect(second as never, session.shape("Task_D"));
    const task = boOf(session.shape("Task_D"));
    expect(
      properties(task).filter(
        (property) => property["name"] === "__targetRef_placeholder",
      ),
    ).toHaveLength(1);
    session.assertInvariants("nach zwei eingehenden Datenassoziationen");
    session.destroy();
  });

  it("lässt `sourceRef` einer ausgehenden Assoziation leer statt die Aktivität einzutragen", async () => {
    // `sourceRef` ist 0..*, und die Aktivität steht ohnehin schon als
    // `$parent` da. Sie zusätzlich in `sourceRef` zu schreiben war der zweite
    // Teil desselben Typfehlers.
    const session = await openSession(DATA_PROCESS);
    const connection = session.modeling.connect(
      session.shape("Task_D"),
      session.shape("Data_1"),
    );
    const bo = boOf(connection);
    expect(bo?.$type).toBe("bpmn:DataOutputAssociation");
    expect(asArray(bo?.["sourceRef"])).toEqual([]);
    expect(bo?.["targetRef"]).toBe(boOf(session.shape("Data_1")));
    session.destroy();
  });

  it("schreibt ein Dokument, das die Schemaprüfung besteht", async () => {
    // Der eigentliche Beleg: nicht die Struktur im Speicher, sondern die
    // Datei. Vor der Reparatur stand hier `targetRef="Task_D"`.
    const session = await openSession(DATA_PROCESS);
    session.modeling.connect(session.shape("Data_1"), session.shape("Task_D"));
    session.modeling.connect(session.shape("Task_D"), session.shape("Data_1"));
    const xml = await session.exportXml();

    expect(xml).toContain("__targetRef_placeholder");
    expect(xml).not.toMatch(/targetRef="Task_D"/);
    expect(checkSchema(xml)).toEqual([]);
    session.destroy();
  });

  it("nimmt die Platzhalter-Property beim Undo wieder zurück", async () => {
    const session = await openSession(DATA_PROCESS);
    const task = boOf(session.shape("Task_D"));
    const before = properties(task).length;
    session.modeling.connect(session.shape("Data_1"), session.shape("Task_D"));
    expect(properties(task).length).toBe(before + 1);
    session.commandStack.undo();
    expect(properties(task).length).toBe(before);
    session.assertInvariants("nach dem Undo");
    session.destroy();
  });
});
