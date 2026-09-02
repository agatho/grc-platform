/**
 * The shadow comparison against `bpmn-js` — temporary by design.
 *
 * Two levels:
 *   1. **Import agreement over the corpus.** Load every corpus document into
 *      both engines with no editing at all and compare the models. This is the
 *      cheapest and strictest signal there is: DI is read, not computed, so a
 *      bounds difference here can only be an import defect.
 *   2. **Edit agreement.** Replay generated operation sequences through both
 *      engines and compare the resulting documents.
 *
 * Every difference is classified (`src/verify/shadow.ts`). An unclassified one
 * fails the test — there is no "close enough" here.
 *
 * The whole file disappears with `bpmn-js`; see the header of
 * `src/verify/drivers/bpmnjs.ts` for the four conditions that say when.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { installBpmnJsSupport } from "./jsdom-svg";
import { editableBases, representativeBases } from "./bases";
import {
  BpmnJsDriver,
  isBpmnJsAvailable,
} from "../../src/verify/drivers/bpmnjs";
import { createArctosDriver } from "../../src/verify/drivers/arctos";
import {
  formatDivergences,
  shadowCompare,
  summarize,
  type Divergence,
} from "../../src/verify/shadow";
import { generateSequence } from "../../src/verify/property";
import { Rng } from "../../src/verify/random";
import type { ModelingDriver } from "../../src/verify/driver";

installBpmnJsSupport();

const SEED = Number(process.env["SHADOW_SEED"] ?? 424242);
const SEQUENCES = Number(process.env["SHADOW_SEQUENCES"] ?? 8);
const LENGTH = Number(process.env["SHADOW_LENGTH"] ?? 6);

let available = false;

async function drivers(): Promise<
  { ours: ModelingDriver; reference: ModelingDriver } | undefined
> {
  const ours = await createArctosDriver();
  const reference = await BpmnJsDriver.create();
  if (!ours || !reference) return undefined;
  return { ours, reference };
}

describe("shadow comparison against bpmn-js (temporary)", () => {
  beforeAll(async () => {
    available =
      (await isBpmnJsAvailable()) && (await createArctosDriver()) !== undefined;
  });

  it("has both engines available, or says why not", async () => {
    // Not a skip: when this stops being true it is either the end of the
    // watermark (good, delete the file) or a broken modeling layer (bad, and
    // silence would be the worst possible answer).
    const bpmnJs = await isBpmnJsAvailable();
    const arctos = (await createArctosDriver()) !== undefined;
    if (!bpmnJs) {
      console.warn(
        "[shadow] bpmn-js is gone. If that was deliberate (plan §5.6), delete " +
          "src/verify/shadow.ts, src/verify/drivers/bpmnjs.ts, test/verify/jsdom-svg.ts " +
          "and this file in one commit.",
      );
    }
    if (!arctos) {
      console.warn(
        "[shadow] src/modeling/ could not be loaded; nothing to compare against.",
      );
    }
    expect(bpmnJs || arctos).toBe(true);
  });

  it("imports every corpus document into the same model", async () => {
    if (!available) return;
    const all: Divergence[] = [];
    const unclassified: { file: string; divergences: readonly Divergence[] }[] =
      [];

    for (const entry of editableBases()) {
      const pair = await drivers();
      if (!pair) return;
      try {
        const result = await shadowCompare({
          baseXml: entry.xml,
          ops: [],
          ours: pair.ours,
          reference: pair.reference,
        });
        all.push(...result.divergences);
        if (!result.ok) {
          unclassified.push({
            file: entry.name,
            divergences: result.unclassified,
          });
        }
      } finally {
        pair.ours.destroy();
        pair.reference.destroy();
      }
    }

    console.info(
      `[shadow] import over corpus: ${JSON.stringify(summarize(all))}`,
    );
    if (unclassified.length > 0) {
      expect.fail(
        `unclassified divergences on import in ${unclassified.length} file(s):\n` +
          unclassified
            .slice(0, 4)
            .map(
              (entry) =>
                `${entry.file}:\n${formatDivergences(entry.divergences, 8)}`,
            )
            .join("\n\n"),
      );
    }
  }, 300_000);

  it("produces the same document after the same edits", async () => {
    if (!available) return;
    const rng = new Rng(SEED);
    const bases = representativeBases();
    const all: Divergence[] = [];
    const failures: string[] = [];

    for (let run = 0; run < SEQUENCES; run += 1) {
      const base = rng.pick(bases);
      const ops = generateSequence(rng, LENGTH);
      const pair = await drivers();
      if (!pair) return;
      try {
        const result = await shadowCompare({
          baseXml: base.xml,
          ops,
          ours: pair.ours,
          reference: pair.reference,
        });
        all.push(...result.divergences);
        if (!result.ok) {
          failures.push(
            `${base.name}, sequence ${run}:\n${formatDivergences(result.unclassified, 6)}`,
          );
        }
      } finally {
        pair.ours.destroy();
        pair.reference.destroy();
      }
    }

    // The histogram, not just the totals: a report needs to say *which* classes
    // are open, and a single noisy class must not read as many problems.
    const histogram: Record<string, number> = {};
    for (const divergence of all) {
      const key = `${divergence.verdict ?? "UNCLASSIFIED"} ${divergence.signature}`;
      histogram[key] = (histogram[key] ?? 0) + 1;
    }
    console.info(
      `[shadow] ${SEQUENCES} edited sequences: ${JSON.stringify(summarize(all))}\n` +
        Object.entries(histogram)
          .sort((a, b) => b[1] - a[1])
          .map(([key, count]) => `    ${String(count).padStart(4)}  ${key}`)
          .join("\n"),
    );
    if (failures.length > 0) {
      expect.fail(
        `unclassified divergences after editing (${failures.length} of ${SEQUENCES} sequences).\n` +
          "Every difference needs a verdict in DIVERGENCE_RULES (src/verify/shadow.ts) — a " +
          "difference is not evidence that bpmn-js is right.\n\n" +
          failures.slice(0, 3).join("\n\n"),
      );
    }
  }, 600_000);
});
