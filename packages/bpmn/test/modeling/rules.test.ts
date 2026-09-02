import { describe, expect, it } from "vitest";
import { openSession } from "./helpers/harness.js";
import {
  BOUNDARY_PROCESS,
  COLLABORATION,
  DATA_PROCESS,
  SIMPLE_PROCESS,
} from "./helpers/fixtures.js";
import type { ModelingSession } from "../../src/modeling/session.js";
import type { BpmnElement } from "../../src/modeling/types.js";

/**
 * Die Regeln sind die einzige Stelle der Schicht, deren Fehler der Benutzer
 * sofort sieht. Sie werden hier über den `rules`-Dienst von `diagram-js`
 * abgefragt — also genau so, wie Palette, ContextPad und Ziehen es später tun,
 * und nicht über die exportierten Prädikate. Ein Test gegen die Prädikate
 * bewiese nur, dass die Prädikate sich selbst treu sind.
 */

interface RulesLike {
  allowed(action: string, context?: unknown): unknown;
}

function rules(session: ModelingSession): RulesLike {
  return session.get<RulesLike>("rules");
}

function connectionType(
  session: ModelingSession,
  source: BpmnElement,
  target: BpmnElement,
): string | false {
  const result = rules(session).allowed("connection.create", {
    source,
    target,
  });
  if (result && typeof result === "object" && "type" in result) {
    return String((result as { type: unknown }).type);
  }
  return false;
}

describe("Sequenzflüsse", () => {
  it("erlaubt den gewöhnlichen Fall innerhalb eines Prozesses", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    expect(
      connectionType(
        session,
        session.shape("StartEvent_1"),
        session.shape("Task_1"),
      ),
    ).toBe("bpmn:SequenceFlow");
    session.destroy();
  });

  it("verbietet einen eingehenden Fluss am Start-Ereignis", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    expect(
      connectionType(
        session,
        session.shape("Task_1"),
        session.shape("StartEvent_1"),
      ),
    ).toBe(false);
    session.destroy();
  });

  it("verbietet einen ausgehenden Fluss am End-Ereignis", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    expect(
      connectionType(
        session,
        session.shape("EndEvent_1"),
        session.shape("Task_1"),
      ),
    ).toBe(false);
    session.destroy();
  });

  it("verbietet einen Sequenzfluss über die Poolgrenze", async () => {
    const session = await openSession(COLLABORATION);
    // Zwischen den Pools ist nur ein Nachrichtenfluss zulässig.
    expect(
      connectionType(
        session,
        session.shape("Task_A1"),
        session.shape("Task_B1"),
      ),
    ).toBe("bpmn:MessageFlow");
    session.destroy();
  });

  it("verbietet einen Sequenzfluss über die Subprozessgrenze", async () => {
    const session = await openSession(COLLABORATION);
    expect(
      connectionType(
        session,
        session.shape("Task_A1"),
        session.shape("Sub_Start"),
      ),
    ).toBe(false);
    session.destroy();
  });

  it("erlaubt einen Sequenzfluss innerhalb desselben Subprozesses", async () => {
    const session = await openSession(COLLABORATION);
    expect(
      connectionType(
        session,
        session.shape("Sub_Start"),
        session.shape("Sub_End"),
      ),
    ).toBe("bpmn:SequenceFlow");
    session.destroy();
  });

  it("erlaubt einen Fluss aus einem Boundary Event heraus, aber keinen hinein", async () => {
    const session = await openSession(BOUNDARY_PROCESS);
    expect(
      connectionType(
        session,
        session.shape("Boundary_1"),
        session.shape("End_A"),
      ),
    ).toBe("bpmn:SequenceFlow");
    expect(
      connectionType(
        session,
        session.shape("Task_A"),
        session.shape("Boundary_1"),
      ),
    ).toBe(false);
    session.destroy();
  });

  it("verbietet Sequenzflüsse an einem Ereignis-Subprozess", async () => {
    const session = await openSession(COLLABORATION);
    session.modeling.updateProperties(session.shape("Sub_A"), {
      triggeredByEvent: true,
    });
    expect(
      connectionType(session, session.shape("Task_A1"), session.shape("Sub_A")),
    ).toBe(false);
    expect(
      connectionType(session, session.shape("Sub_A"), session.shape("Task_A1")),
    ).toBe(false);
    session.destroy();
  });

  it("verbietet die Verbindung eines Elements mit sich selbst", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    expect(
      connectionType(session, session.shape("Task_1"), session.shape("Task_1")),
    ).toBe(false);
    session.destroy();
  });
});

describe("Nachrichtenflüsse", () => {
  it("erlaubt sie nur zwischen verschiedenen Pools", async () => {
    const session = await openSession(COLLABORATION);
    expect(
      connectionType(session, session.shape("Pool_A"), session.shape("Pool_B")),
    ).toBe("bpmn:MessageFlow");
    // Innerhalb eines Pools entsteht ein Sequenzfluss, kein Nachrichtenfluss.
    expect(
      connectionType(
        session,
        session.shape("Start_A"),
        session.shape("Task_A1"),
      ),
    ).toBe("bpmn:SequenceFlow");
    session.destroy();
  });

  it("verbietet sie ohne Pool", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    expect(
      connectionType(
        session,
        session.shape("Task_1"),
        session.shape("EndEvent_1"),
      ),
    ).toBe("bpmn:SequenceFlow");
    session.destroy();
  });
});

describe("Datenassoziationen und Assoziationen", () => {
  it("verbindet Aktivität und Datenobjekt in beide Richtungen typrichtig", async () => {
    const session = await openSession(DATA_PROCESS);
    expect(
      connectionType(session, session.shape("Task_D"), session.shape("Data_1")),
    ).toBe("bpmn:DataOutputAssociation");
    expect(
      connectionType(session, session.shape("Data_1"), session.shape("Task_D")),
    ).toBe("bpmn:DataInputAssociation");
    session.destroy();
  });

  it("verbindet Textannotationen über eine Assoziation", async () => {
    const session = await openSession(DATA_PROCESS);
    expect(
      connectionType(session, session.shape("Note_1"), session.shape("Task_D")),
    ).toBe("bpmn:Association");
    session.destroy();
  });
});

describe("Anheften und Ablegen", () => {
  it("heftet Boundary Events nur an Aktivitäten", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const boundary = session
      .get<{
        createShape: (attrs: unknown) => BpmnElement;
      }>("elementFactory")
      .createShape({ type: "bpmn:BoundaryEvent" });

    expect(
      rules(session).allowed("shape.attach", {
        shape: boundary,
        target: session.shape("Task_1"),
      }),
    ).toBe("attach");
    expect(
      rules(session).allowed("shape.attach", {
        shape: boundary,
        target: session.shape("Gateway_1"),
      }),
    ).toBe(false);
    session.destroy();
  });

  it("legt Pools nur auf der Wurzel ab", async () => {
    const session = await openSession(COLLABORATION);
    const pool = session
      .get<{
        createShape: (attrs: unknown) => BpmnElement;
      }>("elementFactory")
      .createShape({ type: "bpmn:Participant" });

    expect(
      rules(session).allowed("shape.create", {
        shape: pool,
        target: session.root(),
      }),
    ).toBe(true);
    expect(
      rules(session).allowed("shape.create", {
        shape: pool,
        target: session.shape("Pool_A"),
      }),
    ).toBe(false);
    session.destroy();
  });

  it("lässt Lanes ihren Pool nicht verlassen", async () => {
    const session = await openSession(COLLABORATION);
    expect(
      rules(session).allowed("elements.move", {
        shapes: [session.shape("Lane_A1")],
        target: session.shape("Pool_B"),
      }),
    ).toBe(false);
    expect(
      rules(session).allowed("elements.move", {
        shapes: [session.shape("Lane_A1")],
        target: session.shape("Pool_A"),
      }),
    ).toBe(true);
    session.destroy();
  });

  it("erlaubt die Größenänderung nur bei Containern, nicht bei Ereignissen", async () => {
    const session = await openSession(COLLABORATION);
    expect(
      rules(session).allowed("shape.resize", { shape: session.shape("Sub_A") }),
    ).toBe(true);
    expect(
      rules(session).allowed("shape.resize", {
        shape: session.shape("Pool_A"),
      }),
    ).toBe(true);
    expect(
      rules(session).allowed("shape.resize", {
        shape: session.shape("Start_A"),
      }),
    ).toBe(false);
    session.destroy();
  });
});

describe("Umhängen", () => {
  it("erlaubt es nur, wenn dabei derselbe Kantentyp herauskäme", async () => {
    const session = await openSession(COLLABORATION);
    const flow = session.connection("Flow_A1");
    // Sequenzfluss auf ein Element im anderen Pool umhängen: verboten.
    expect(
      rules(session).allowed("connection.reconnect", {
        connection: flow,
        source: session.shape("Start_A"),
        target: session.shape("Task_B1"),
      }),
    ).toBe(false);
    // Innerhalb des Pools: erlaubt.
    expect(
      rules(session).allowed("connection.reconnect", {
        connection: flow,
        source: session.shape("Start_A"),
        target: session.shape("Sub_A"),
      }),
    ).toBe(true);
    session.destroy();
  });
});

describe("Modeling.connect", () => {
  it("verweigert eine regelwidrige Verbindung, statt still einen Sequenzfluss anzulegen", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    expect(() =>
      session.modeling.connect(
        session.shape("EndEvent_1"),
        session.shape("StartEvent_1"),
      ),
    ).toThrow(/keine Verbindung zulässig/);
    session.assertInvariants("nach dem verweigerten Verbinden");
    session.destroy();
  });
});
