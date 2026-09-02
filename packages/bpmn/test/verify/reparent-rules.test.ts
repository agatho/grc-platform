/**
 * The one finding in `known-findings.ts` that belonged to these tools rather
 * than to the engine.
 *
 * Both drivers used to ask the rules
 * `allowed("elements.move", { shapes: [target], target })` in their `reparent`
 * case — where `target` was the element being *moved*, not the destination the
 * operation names. The rule was therefore handed "may X move into X?", which a
 * sub-process happily answers with yes, and rejects for most ordinary flow
 * nodes. Two consequences, both bad in opposite directions: a reparent onto a
 * `bpmn:Collaboration` ran past a rule that would have refused it, and the
 * `reparent` operation was barely exercised at all.
 *
 * This test pins the question the driver asks. It does not need the campaign:
 * one document, one rule call, and the two answers that must differ.
 */

import { describe, expect, it } from "vitest";

import { installBpmnJsSupport } from "./jsdom-svg.js";
import { editableBases } from "./bases.js";
import { createArctosDriver } from "../../src/verify/drivers/arctos.js";
import { canMove } from "../../src/modeling/BpmnRules.js";
import { createModelingSession } from "../../src/modeling/session.js";

installBpmnJsSupport();

function base(name: string): string {
  const entry = editableBases().find((candidate) => candidate.name === name);
  if (!entry) throw new Error(`base document ${name} is not editable`);
  return entry.xml;
}

describe("reparent asks the rules about the destination", () => {
  it("the two questions have different answers — which is why the mix-up hid", async () => {
    const session = await createModelingSession(
      base("synth-collaboration-pools-lanes"),
    );
    const sub = session.modeling.createShape(
      { type: "bpmn:SubProcess", collapsed: false },
      { x: 400, y: 400 },
      session.shape("Participant_Kunde") as never,
    ) as never;
    const collaboration = session.canvas.getRootElement() as never;

    // The question the driver used to ask: may it move into itself?
    expect(canMove([sub], sub)).toBe(true);
    // The question the operation actually poses.
    expect(canMove([sub], collaboration)).toBe(false);
    session.destroy();
  });

  it("the driver rejects a reparent the rules forbid", async () => {
    const driver = await createArctosDriver();
    expect(driver, "the arctos driver must be available here").not.toBeNull();
    await driver!.load(base("synth-collaboration-pools-lanes"));

    // A sub-process inside a pool, then dragged onto the collaboration root.
    await driver!.apply({
      kind: "createShape",
      elementType: "bpmn:SubProcess",
      parent: { kind: "container", index: 2 },
      x: 100,
      y: 100,
    } as never);
    const containers = driver!.candidates("container");
    expect(containers[0]).toBe("Collaboration_1");

    const result = await driver!.apply({
      kind: "reparent",
      target: { kind: "container", index: containers.indexOf("SubProcess_1") },
      parent: { kind: "container", index: 0 },
      x: 550,
      y: 250,
    } as never);

    expect(result.outcome).toBe("rejected");
  });
});
