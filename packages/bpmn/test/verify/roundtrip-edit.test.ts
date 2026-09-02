/**
 * Round-trip **with editing in between** — the assurance the migration hangs on.
 *
 * `test/model/roundtrip.test.ts` proves import → export for an untouched
 * document. That is the read path, and it is green over all 52 corpus files.
 * It says nothing about the path that actually carries risk:
 *
 *     import → n operations → export → import → compare against the model
 *
 * The difference matters because the failure modes are different in kind. An
 * import defect shows up immediately and loudly. An *edit* defect writes a file
 * that looks fine, opens fine here, and turns out months later to be missing a
 * reference that a foreign tool needed — the exact scenario the spike named as
 * the reason these tools exist.
 *
 * Four properties, in the order of how much they cost to check:
 *
 *   R1  The exported document parses at all.
 *   R2  Re-importing it yields the same model: same elements, same types, same
 *       containment, same references, same geometry. Compared through
 *       `snapshotXml`, i.e. over the document, never over an engine's internal
 *       graph.
 *   R3  Idempotence, as in plan §5.1 Z-B: exporting the re-imported document
 *       gives byte-identical output. Without this a save without a change
 *       produces a diff, `bpmn-diff.ts` reports phantom changes, and the version
 *       history stops meaning anything.
 *   R4  n undos after n operations restore the starting document, compared
 *       canonically (§5.1 Z-A). This is the one that tests the command stack's
 *       inverses, and it is checked with sequences that contain no undo or redo
 *       of their own — otherwise "n undos" is not well defined.
 */

import { describe, expect, it } from "vitest";
import { installBpmnJsSupport } from "./jsdom-svg.js";
import { representativeBases } from "./bases.js";
import { createArctosDriver } from "../../src/verify/drivers/arctos.js";
import { BpmnJsDriver } from "../../src/verify/drivers/bpmnjs.js";
import type { ModelingDriver } from "../../src/verify/driver.js";
import { generateSequence } from "../../src/verify/property.js";
import { Rng } from "../../src/verify/random.js";
import {
  formatOperation,
  type Operation,
} from "../../src/verify/operations.js";
import { snapshotXml } from "../../src/verify/snapshot.js";
import { canonicalize, diffCanonical } from "../../src/util/xml-canonical.js";
import { exportXml, importXml } from "../../src/model/io.js";
import { allKnown, lookupFinding } from "./known-findings.js";

/**
 * Map an undo-symmetry failure to a known finding, or `undefined` when it is
 * new. Same rule as everywhere else in these tools: understood failures are
 * reported and tolerated, unrecognised ones fail the suite.
 */
function classifyUndoProblem(problem: string): string | undefined {
  if (/BPMNShape|BPMNEdge|Bounds|waypoint/.test(problem))
    return "roundtrip/undo-leaves-di";
  if (/@name=/.test(problem)) return "roundtrip/undo-does-not-restore-name";
  return undefined;
}

installBpmnJsSupport();

const SEED = Number(process.env["ROUNDTRIP_SEED"] ?? 7717);
const SEQUENCES = Number(process.env["ROUNDTRIP_SEQUENCES"] ?? 12);
const LENGTH = Number(process.env["ROUNDTRIP_LENGTH"] ?? 6);

async function makeDriver(): Promise<ModelingDriver | undefined> {
  return (await createArctosDriver()) ?? (await BpmnJsDriver.create());
}

/** Operation kinds that make "n undos" ill-defined. */
function withoutUndoRedo(ops: readonly Operation[]): Operation[] {
  return ops.filter((op) => op.kind !== "undo" && op.kind !== "redo");
}

describe("round-trip with editing in between", () => {
  it("re-imports an edited document to the same model, idempotently", async () => {
    const driver = await makeDriver();
    if (!driver) return;
    const rng = new Rng(SEED);
    const bases = representativeBases();
    const problems: string[] = [];
    let checked = 0;

    try {
      for (let run = 0; run < SEQUENCES; run += 1) {
        const base = rng.pick(bases);
        const ops = generateSequence(rng, LENGTH);
        await driver.load(base.xml);
        const applied: Operation[] = [];
        let threw: string | undefined;
        for (const op of ops) {
          const result = await driver.apply(op);
          if (result.outcome === "applied") applied.push(op);
          if (result.outcome === "threw") {
            threw = `${formatOperation(op)}: ${result.error ?? ""}`;
            break;
          }
        }
        if (threw !== undefined) {
          // An operation that throws is a defect of the modeling layer, already
          // reported by the property runner with a shrunk reproduction. It is
          // not a round-trip finding, and repeating it here would double-count.
          if (!allKnown(["driver/threw"]))
            problems.push(`${base.name}: ${threw}`);
          continue;
        }
        if (applied.length === 0) continue;
        checked += 1;

        // R1 + R2
        const exported = await driver.exportXml();
        let reimported;
        try {
          reimported = await importXml(exported, { preserveSource: false });
        } catch (error) {
          problems.push(
            `${base.name} run ${run}: the exported document does not parse — ` +
              `${error instanceof Error ? error.message : String(error)}`,
          );
          continue;
        }

        const before = await snapshotXml(exported);
        const rewritten = await exportXml(reimported.definitions, {
          preferPreservedSource: false,
        });
        const after = await snapshotXml(rewritten);

        const beforeIds = before.nodes.map((node) => node.id).join(",");
        const afterIds = after.nodes.map((node) => node.id).join(",");
        if (beforeIds !== afterIds) {
          problems.push(
            `${base.name} run ${run}: the element set changed across export→import→export.\n` +
              `  before: ${beforeIds}\n  after:  ${afterIds}`,
          );
          continue;
        }
        for (const node of before.nodes) {
          const other = after.byId.get(node.id);
          if (!other) continue;
          if (node.type !== other.type) {
            problems.push(
              `${base.name} run ${run}: ${node.id} changed type on re-import`,
            );
          }
          if (node.parentId !== other.parentId) {
            problems.push(
              `${base.name} run ${run}: ${node.id} changed container on re-import`,
            );
          }
          if (
            node.sourceId !== other.sourceId ||
            node.targetId !== other.targetId
          ) {
            problems.push(
              `${base.name} run ${run}: ${node.id} changed its ends on re-import`,
            );
          }
          if (node.attachedToId !== other.attachedToId) {
            problems.push(
              `${base.name} run ${run}: ${node.id} changed its host on re-import`,
            );
          }
          if (JSON.stringify(node.bounds) !== JSON.stringify(other.bounds)) {
            problems.push(
              `${base.name} run ${run}: ${node.id} bounds ${JSON.stringify(node.bounds)} → ` +
                JSON.stringify(other.bounds),
            );
          }
        }

        // R3 — Z-B idempotence, byte for byte from the second pass on.
        const third = await exportXml(
          (await importXml(rewritten, { preserveSource: false })).definitions,
          { preferPreservedSource: false },
        );
        if (third !== rewritten) {
          const differences = diffCanonical(
            canonicalize(rewritten),
            canonicalize(third),
            6,
          );
          problems.push(
            `${base.name} run ${run}: export is not idempotent after editing (Z-B). ` +
              `Every save would produce a diff.\n  ${differences
                .map((d) => `${d.kind}: ${d.text} in ${d.context}`)
                .join("\n  ")}`,
          );
        }
      }
    } finally {
      driver.destroy();
    }

    console.info(
      `[roundtrip-edit] ${checked} edited documents re-imported (engine ${driver.name}, seed ${SEED})`,
    );
    expect(
      checked,
      "no sequence applied a single operation — the test proved nothing",
    ).toBeGreaterThan(0);
    if (problems.length > 0) {
      expect.fail(
        `${problems.length} round-trip problem(s) after editing:\n${problems.slice(0, 8).join("\n")}`,
      );
    }
  }, 600_000);

  it("restores the original document after undoing every operation", async () => {
    const driver = await makeDriver();
    if (!driver) return;
    const rng = new Rng(SEED + 1);
    const bases = representativeBases();
    const problems: string[] = [];
    let checked = 0;

    try {
      for (let run = 0; run < SEQUENCES; run += 1) {
        const base = rng.pick(bases);
        const ops = withoutUndoRedo(generateSequence(rng, LENGTH));
        await driver.load(base.xml);
        const beforeXml = await driver.exportXml();

        let appliedCount = 0;
        let broke = false;
        for (const op of ops) {
          const result = await driver.apply(op);
          if (result.outcome === "applied") appliedCount += 1;
          if (result.outcome === "threw") {
            broke = true;
            break;
          }
        }
        if (broke || appliedCount === 0) continue;

        for (let i = 0; i < appliedCount; i += 1) {
          const result = await driver.apply({ kind: "undo" });
          if (result.outcome !== "applied") break;
        }
        checked += 1;

        const afterXml = await driver.exportXml();
        const differences = diffCanonical(
          canonicalize(beforeXml),
          canonicalize(afterXml),
          8,
        );
        if (differences.length > 0) {
          problems.push(
            `${base.name} run ${run}: ${appliedCount} operations then ${appliedCount} undos did not ` +
              `restore the document (${differences.length} canonical difference(s)):\n  ` +
              differences
                .map(
                  (d) =>
                    `${d.kind === "removed" ? "lost" : "added"}: ${d.text} in ${d.context}`,
                )
                .join("\n  ") +
              `\n  operations: ${ops.map(formatOperation).join(" ; ")}`,
          );
        }
      }
    } finally {
      driver.destroy();
    }

    const known: string[] = [];
    const unknown: string[] = [];
    for (const problem of problems) {
      const id = classifyUndoProblem(problem);
      if (id !== undefined && lookupFinding(id) !== undefined)
        known.push(`${id}: ${problem}`);
      else unknown.push(problem);
    }

    console.info(
      `[roundtrip-edit] undo symmetry checked on ${checked} sequences`,
    );
    if (known.length > 0) {
      console.warn(
        `[roundtrip-edit] ${known.length} of ${checked} sequences did not survive undo, all of them ` +
          `KNOWN findings (test/verify/known-findings.ts):\n${known[0] ?? ""}`,
      );
    }
    expect(checked).toBeGreaterThan(0);
    if (unknown.length > 0) {
      expect.fail(
        `undo did not restore the starting document in ${unknown.length} case(s), with symptoms ` +
          "that are NOT in test/verify/known-findings.ts.\n" +
          "This is the sharpest test of the command stack's inverses; a failure here means a user " +
          "who presses Ctrl+Z back to the start does not get their file back.\n\n" +
          unknown.slice(0, 4).join("\n\n"),
      );
    }
  }, 600_000);
});
