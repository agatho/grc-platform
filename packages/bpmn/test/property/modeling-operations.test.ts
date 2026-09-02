/**
 * The property test over modeling operations — the sharpest test in this
 * package and, per plan §6.1, "der wichtigste Test des Vorhabens".
 *
 * It generates random but structurally valid operation sequences, runs them,
 * and checks the model invariants after **every** step. A failure is shrunk to
 * the shortest still-failing subsequence before it is reported.
 *
 * **Which engine it drives.** `drivers/arctos.ts` when `src/modeling/` exists,
 * otherwise the `bpmn-js` reference driver. Running against the reference is
 * not a placeholder: it exercises the generator, the shrinker and the invariant
 * checker against a mature implementation, so that on the day the ARCTOS driver
 * appears the harness itself is not the suspect. The suite says out loud which
 * engine it drove.
 *
 * Volume: `PROPERTY_RUNS` sequences of `PROPERTY_LENGTH` operations each,
 * default 200 × 12. Both can be raised from the environment for a long run
 * (`PROPERTY_RUNS=5000 PROPERTY_SEED=…`), which is how the 10.000-case figure
 * in plan §5.6 is meant to be produced in CI rather than on a laptop.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { installBpmnJsSupport } from "../verify/jsdom-svg.js";
import { editableBases } from "../verify/bases.js";
import { BpmnJsDriver } from "../../src/verify/drivers/bpmnjs.js";
import {
  arctosDriverStatus,
  createArctosDriver,
} from "../../src/verify/drivers/arctos.js";
import type { ModelingDriver } from "../../src/verify/driver.js";
import {
  failureIds,
  formatFailure,
  runCampaign,
  type CampaignFailure,
  type CampaignResult,
} from "../../src/verify/property.js";
import { allKnown, lookupFinding } from "../verify/known-findings.js";
import { hasModelingInvariants } from "../../src/verify/invariants.js";

installBpmnJsSupport();

const RUNS = Number(process.env["PROPERTY_RUNS"] ?? 200);
const LENGTH = Number(process.env["PROPERTY_LENGTH"] ?? 12);
const SEED = Number(process.env["PROPERTY_SEED"] ?? 20260901);

/**
 * Invariants that the *base documents* already violate and that no operation
 * can repair. Tolerating them is the alternative to excluding whole corpus
 * files; each one names why.
 */
const TOLERATED: Readonly<Record<string, string>> = {
  // `synth-*` hard cases carry flow elements without DI on purpose (partial DI
  // is one of the round-trip fixtures). An operation cannot fix an element it
  // did not create, so this stays a warning for the base and is caught for
  // created elements by `di/missing` being a warning anyway.
};

async function makeDriver(): Promise<ModelingDriver> {
  const arctos = await createArctosDriver();
  if (arctos) return arctos;
  const reference = await BpmnJsDriver.create();
  if (!reference) {
    throw new Error(
      "neither src/modeling/ nor bpmn-js is available — there is no engine to drive",
    );
  }
  return reference;
}

describe("property: random modeling operation sequences", () => {
  let engine = "unknown";
  let result: CampaignResult;

  beforeAll(async () => {
    const status = await arctosDriverStatus();
    engine = status.available ? "arctos" : "bpmn-js (reference)";
    if (!status.available) {
      // Deliberately loud: a green suite must never be mistaken for "the
      // ARCTOS modeling layer was tested".
      console.warn(`[property] driving ${engine}. Reason: ${status.reason}`);
    }
    const bases = editableBases().map((entry) => ({
      name: entry.name,
      xml: entry.xml,
    }));
    result = await runCampaign({
      seed: SEED,
      runs: RUNS,
      length: LENGTH,
      bases,
      makeDriver,
      checkOptions: { tolerate: TOLERATED },
      shrink: true,
    });
  }, 900_000);

  it("executes the whole vocabulary, not just the cheap half", () => {
    // A campaign in which `connect` or `attachBoundary` never applied would be
    // green for the wrong reason. This is the guard against that.
    const applied = result.kindsApplied;
    for (const kind of [
      "createShape",
      "connect",
      "move",
      "remove",
      "rename",
      "attachBoundary",
      "reparent",
      "undo",
      "redo",
    ]) {
      expect(
        applied[kind] ?? 0,
        `operation "${kind}" never applied in ${RUNS} sequences — the generator or the driver is not exercising it`,
      ).toBeGreaterThan(0);
    }
  });

  it(`holds the invariants after every operation across ${RUNS} sequences`, () => {
    const strict = process.env["PROPERTY_STRICT"] === "1";
    const known: CampaignFailure[] = [];
    const unknown: CampaignFailure[] = [];
    for (const failure of result.failures) {
      (!strict && allKnown(failureIds(failure)) ? known : unknown).push(
        failure,
      );
    }

    if (known.length > 0) {
      // Loud, every run: a finding that is tolerated must still be visible.
      const summary = [
        ...new Set(known.flatMap((failure) => failureIds(failure))),
      ]
        .map((id) => {
          const entry = lookupFinding(id);
          return `    ${id} — ${entry?.owner ?? "?"} / ${entry?.verdict ?? "?"}`;
        })
        .join("\n");
      console.warn(
        `[property] ${known.length} of ${RUNS} sequences hit KNOWN findings (see ` +
          `test/verify/known-findings.ts; PROPERTY_STRICT=1 makes them fail):\n${summary}\n\n` +
          formatFailure(known[0] as CampaignFailure),
      );
    }

    if (unknown.length > 0) {
      const report = unknown
        .slice(0, 5)
        .map((failure) => formatFailure(failure))
        .join("\n\n----------------------------------------\n\n");
      expect.fail(
        `${unknown.length} of ${RUNS} sequences violated the invariants with findings that are ` +
          `NOT in test/verify/known-findings.ts (engine: ${engine}).\n\n${report}`,
      );
    }
    expect(unknown).toHaveLength(0);
  });

  it("records what was actually exercised", async () => {
    expect(result.runs).toBe(RUNS);
    // A failing sequence stops at its first bad step, so this only bounds the
    // *lower* end: it catches a campaign that silently did almost nothing.
    expect(result.operationsExecuted).toBeGreaterThan(RUNS);
    console.info(
      `[property] engine=${engine} seed=${SEED} runs=${RUNS} length=${LENGTH} ` +
        `operations=${result.operationsExecuted} ` +
        `applied=${result.outcomes.applied} rejected=${result.outcomes.rejected} ` +
        `unresolved=${result.outcomes.unresolved} threw=${result.outcomes.threw} ` +
        `modelingInvariants=${String(await hasModelingInvariants())}`,
    );
  });
});
