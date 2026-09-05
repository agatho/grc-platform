/**
 * Does the invariant checker actually catch anything?
 *
 * A checker that returns "all good" for every input passes every property test
 * ever written and proves nothing. So each invariant gets a deliberately broken
 * document and has to name the right violation — and, just as important, the
 * intact corpus has to come back clean, so the checker is not simply shouting.
 *
 * The corruptions below are the ones a modeling layer really produces: a
 * dangling reference after a delete, a boundary event whose host is gone, a
 * flow node left in two lanes after a lane move, a DI entry the undo forgot.
 * Each is applied to a real corpus document rather than to a hand-built stub,
 * because a stub proves the checker works on stubs.
 */

import { describe, expect, it } from "vitest";
import type { ModdleElement } from "bpmn-moddle";
import { importXml } from "../../src/model/io";
import {
  checkAllInvariants,
  checkInvariants,
  formatViolations,
  hasModelingInvariants,
  type InvariantReport,
} from "../../src/verify/invariants";
import { loadCorpus } from "../model/corpus";
import { editableBases } from "./bases";

const corpus = new Map(loadCorpus().map((entry) => [entry.name, entry]));

async function load(name: string): Promise<ModdleElement> {
  const entry = corpus.get(name);
  if (!entry) throw new Error(`corpus file ${name} is missing`);
  const { definitions } = await importXml(entry.xml, { preserveSource: false });
  return definitions;
}

function ids(report: InvariantReport): string[] {
  return [...new Set(report.errors.map((violation) => violation.id))];
}

/** Depth-first search for the first element with the given id. */
function find(root: ModdleElement, id: string): ModdleElement {
  const seen = new Set<ModdleElement>();
  const stack: ModdleElement[] = [root];
  while (stack.length > 0) {
    const element = stack.pop() as ModdleElement;
    if (seen.has(element)) continue;
    seen.add(element);
    if (element.id === id) return element;
    for (const value of Object.values(element)) {
      if (Array.isArray(value)) {
        for (const child of value) {
          if (typeof child === "object" && child !== null && "$type" in child) {
            stack.push(child as ModdleElement);
          }
        }
      } else if (
        typeof value === "object" &&
        value !== null &&
        "$type" in value
      ) {
        stack.push(value as ModdleElement);
      }
    }
  }
  throw new Error(`no element with id ${id}`);
}

describe("invariant checker: does it catch anything", () => {
  it("is clean on every corpus document that is meant to be clean", async () => {
    const dirty: string[] = [];
    for (const entry of editableBases()) {
      const { definitions } = await importXml(entry.xml, {
        preserveSource: false,
      });
      const report = checkInvariants(definitions);
      if (!report.ok)
        dirty.push(`${entry.name}:\n${formatViolations(report.errors)}`);
    }
    if (dirty.length > 0) {
      expect.fail(
        "the checker reports errors on intact corpus documents; either the corpus is broken or " +
          `the checker is:\n\n${dirty.slice(0, 3).join("\n\n")}`,
      );
    }
  });

  it("reports the deliberately broken corpus fixture", async () => {
    // Positive control. `synth-dangling-references` exists precisely because it
    // has references that go nowhere; a checker that calls it clean is broken.
    const definitions = await load("synth-dangling-references");
    const report = checkInvariants(definitions);
    expect(report.ok).toBe(false);
    expect(ids(report)).toContain("di/orphan");
  });

  it("catches a sequence flow whose target was deleted", async () => {
    const definitions = await load("repo-seed-customer-service");
    const flow = find(definitions, "Flow_1404_1");
    flow["targetRef"] = "Element_That_Never_Existed";
    const report = checkInvariants(definitions);
    expect(ids(report)).toContain("ref/sequence-flow-target");
  });

  it("catches a boundary event whose host is gone", async () => {
    const definitions = await load("synth-boundary-events");
    const boundary = find(definitions, "Boundary_Timer");
    delete boundary["attachedToRef"];
    const report = checkInvariants(definitions);
    expect(ids(report)).toContain("ref/boundary-attached-to");
  });

  it("catches a boundary event attached to something that is not an activity", async () => {
    const definitions = await load("synth-boundary-events");
    const boundary = find(definitions, "Boundary_Timer");
    boundary["attachedToRef"] = find(definitions, "Start_1");
    const report = checkInvariants(definitions);
    expect(ids(report)).toContain("structure/boundary-host-not-activity");
  });

  it("catches an incoming list that no flow points back to", async () => {
    const definitions = await load("repo-seed-customer-service");
    const task = find(definitions, "Task_KS_Bearbeitung");
    task["incoming"] = [find(definitions, "Flow_1404_3")];
    const report = checkInvariants(definitions);
    expect(ids(report)).toContain("consistency/incoming-stale");
  });

  it("catches a message flow written into outgoing", async () => {
    const definitions = await load("synth-collaboration-pools-lanes");
    const task = find(definitions, "Task_Kunde_Antrag");
    const messageFlow = find(definitions, "MessageFlow_1");
    task["outgoing"] = [...(task["outgoing"] as ModdleElement[]), messageFlow];
    const report = checkInvariants(definitions);
    expect(ids(report)).toContain("consistency/incoming-outgoing-wrong-type");
  });

  it("catches a flow node claimed by two lanes", async () => {
    const definitions = await load("synth-collaboration-pools-lanes");
    const first = find(definitions, "Lane_Sachbearbeitung");
    const second = find(definitions, "Lane_Genehmigung");
    const node = (first["flowNodeRef"] as ModdleElement[])[0];
    expect(node).toBeDefined();
    second["flowNodeRef"] = [
      ...(second["flowNodeRef"] as ModdleElement[]),
      node as ModdleElement,
    ];
    const report = checkInvariants(definitions);
    expect(ids(report)).toContain("structure/flow-node-in-several-lanes");
  });

  it("catches a duplicated id", async () => {
    const definitions = await load("repo-seed-customer-service");
    find(definitions, "Task_KS_Bearbeitung")["id"] = "Task_KS_Klassifizierung";
    const report = checkInvariants(definitions);
    expect(ids(report)).toContain("id/duplicate");
  });

  it("catches DI that outlived its element", async () => {
    const definitions = await load("repo-seed-customer-service");
    const shape = find(definitions, "Start_1404_di");
    shape["bpmnElement"] = "Gone";
    const report = checkInvariants(definitions);
    expect(ids(report)).toContain("di/orphan");
  });

  it("catches an edge with a single waypoint", async () => {
    const definitions = await load("repo-seed-customer-service");
    const edge = find(definitions, "Flow_1404_1_di");
    edge["waypoint"] = [
      (edge["waypoint"] as ModdleElement[])[0] as ModdleElement,
    ];
    const report = checkInvariants(definitions);
    expect(ids(report)).toContain("di/edge-waypoints");
  });

  it("catches a shape with no area", async () => {
    const definitions = await load("repo-seed-customer-service");
    const bounds = find(definitions, "Start_1404_di")[
      "bounds"
    ] as ModdleElement;
    bounds["width"] = 0;
    const report = checkInvariants(definitions);
    expect(ids(report)).toContain("di/bounds-empty");
  });

  it("catches a NaN coordinate", async () => {
    const definitions = await load("repo-seed-customer-service");
    const bounds = find(definitions, "Start_1404_di")[
      "bounds"
    ] as ModdleElement;
    bounds["x"] = Number.NaN;
    const report = checkInvariants(definitions);
    expect(ids(report)).toContain("di/bounds-not-finite");
  });

  it("never throws, even on a tree that is nonsense", () => {
    // The checker has to be able to walk a broken tree in order to say what is
    // broken about it; a checker that throws on bad input is useless exactly
    // when it is needed.
    const nonsense = {
      $type: "bpmn:Definitions",
      rootElements: "not an array",
    } as ModdleElement;
    expect(() => checkInvariants(nonsense)).not.toThrow();
    const cyclic = { $type: "bpmn:Definitions" } as ModdleElement;
    cyclic["rootElements"] = [cyclic];
    expect(() => checkInvariants(cyclic)).not.toThrow();
  });

  it("tolerates only what it was told to tolerate", async () => {
    const definitions = await load("repo-seed-customer-service");
    find(definitions, "Flow_1404_1")["targetRef"] = "Gone";
    const strict = checkInvariants(definitions);
    expect(strict.ok).toBe(false);
    // Both ids, because breaking a targetRef also makes the old target's
    // `incoming` list stale — a reminder that invariants are not independent.
    const lenient = checkInvariants(definitions, {
      tolerate: {
        "ref/sequence-flow-target": "test",
        "consistency/incoming-stale": "test",
      },
    });
    expect(lenient.ok).toBe(true);
    expect(
      lenient.warnings.some((v) => v.message.includes("[tolerated: test]")),
    ).toBe(true);
  });
});

describe("delegation to the modeling layer's own checker", () => {
  it("picks it up when it is there, and says so either way", async () => {
    const present = await hasModelingInvariants();
    console.info(
      `[invariants] src/modeling/invariants.ts is ${present ? "loaded and merged in" : "not available; only this package's invariants run"}`,
    );
    expect(typeof present).toBe("boolean");
  });

  it("merges its findings under a modeling/ prefix without letting it crash the run", async () => {
    if (!(await hasModelingInvariants())) return;
    const definitions = await load("synth-boundary-events");
    delete find(definitions, "Boundary_Timer")["attachedToRef"];
    const report = await checkAllInvariants(definitions);
    expect(report.ok).toBe(false);
    // Both checkers see the same defect; that agreement is the point of merging
    // rather than replacing.
    expect(ids(report)).toContain("ref/boundary-attached-to");
    expect(ids(report).some((id) => id.startsWith("modeling/"))).toBe(true);
    expect(ids(report)).not.toContain("modeling/checker-crashed");
  });
});
