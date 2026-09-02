/**
 * The performance budget on the largest corpus diagram — 556 elements,
 * `synth-large-flat-process.bpmn`.
 *
 * Both engines are measured on the same document in the same process, so the
 * comparison between them is fair even where the absolute numbers are not
 * (jsdom, shared CI machine, no real layout). The budget is enforced only on
 * the ARCTOS numbers: `bpmn-js` is measured for reference and is not ours to
 * hold to a budget.
 *
 * Raise `BUDGET_SAMPLES` for a steadier median. Run node with `--expose-gc` for
 * a meaningful heap number; the test says whether that was the case rather than
 * quietly reporting a worse figure.
 */

import { describe, expect, it } from "vitest";
import { installBpmnJsSupport } from "./jsdom-svg.js";
import { loadCorpus } from "../model/corpus.js";
import { exportXml, importXml } from "../../src/model/io.js";
import {
  renderDefinitions,
  toSvgString,
} from "../../src/draw/StaticRenderer.js";
import { createArctosDriver } from "../../src/verify/drivers/arctos.js";
import { BpmnJsDriver } from "../../src/verify/drivers/bpmnjs.js";
import {
  canForceGc,
  checkBudget,
  formatMeasurements,
  measure,
  type BudgetEntry,
  type Measurement,
} from "../../src/verify/budget.js";

installBpmnJsSupport();

const SAMPLES = Number(process.env["BUDGET_SAMPLES"] ?? 5);
const LARGEST = "synth-large-flat-process";

/**
 * The budget.
 *
 * Plan §6.8 gives estimates for 500 elements: import + first image < 2000 ms,
 * export < 500 ms, instance memory < 150 MB. The numbers below keep those as
 * the ceiling where they are the binding constraint and tighten them where the
 * measurement showed there is no reason to be that generous. Each one is
 * roughly three times the measured median — enough headroom for a slow machine,
 * tight enough to catch a regression in kind.
 */
const BUDGET: readonly BudgetEntry[] = [
  {
    label: "arctos: importXml (model layer)",
    maxMs: 400,
    rationale:
      "Parsing 556 elements through bpmn-moddle. Measured well under this; the budget catches an " +
      "accidental O(n²) in the access helpers, which is the realistic failure mode.",
  },
  {
    label: "arctos: render to SVG string",
    maxMs: 900,
    rationale:
      "Building the scene and drawing every element once. Together with the import this is the " +
      '"import + first image" row of §6.8, whose 2000 ms ceiling stays the outer limit.',
  },
  {
    label: "arctos: import + first image",
    maxMs: 2000,
    maxHeapMb: 150,
    rationale:
      "Straight from plan §6.8, 500-element column. Kept at the planned value rather than " +
      "tightened to the measurement: this is the number that was promised, and a budget that " +
      "silently becomes stricter than the plan invites arguments about the wrong thing.",
  },
  {
    label: "arctos: exportXml",
    maxMs: 500,
    rationale: "Plan §6.8, 500-element column, unchanged.",
  },
  {
    label: "arctos: ModelingSession import (editable)",
    maxMs: 3000,
    rationale:
      "The editable path builds the diagram-js graph as well as the two model trees, so it is " +
      "necessarily slower than the read-only import. §6.8 has no row for it; this budget is set " +
      "from the measurement and is the number to revisit once a real browser measurement exists.",
  },
];

describe("performance budget (largest corpus diagram, 556 elements)", () => {
  it("stays inside the budget and records the comparison", async () => {
    const entry = loadCorpus().find((file) => file.name === LARGEST);
    expect(entry, `${LARGEST}.bpmn is missing from the corpus`).toBeDefined();
    const xml = entry?.xml ?? "";

    const measurements: Measurement[] = [];

    measurements.push(
      await measure(
        "arctos: importXml (model layer)",
        async () => importXml(xml, { preserveSource: false }),
        SAMPLES,
      ),
    );

    const { definitions } = await importXml(xml, { preserveSource: false });
    measurements.push(
      await measure(
        "arctos: render to SVG string",
        () => toSvgString(renderDefinitions(definitions, { background: true })),
        SAMPLES,
      ),
    );
    measurements.push(
      await measure(
        "arctos: import + first image",
        async () => {
          const imported = await importXml(xml, { preserveSource: false });
          return toSvgString(
            renderDefinitions(imported.definitions, { background: true }),
          );
        },
        SAMPLES,
      ),
    );
    measurements.push(
      await measure(
        "arctos: exportXml",
        async () => exportXml(definitions, { preferPreservedSource: false }),
        SAMPLES,
      ),
    );

    const arctos = await createArctosDriver();
    if (arctos) {
      measurements.push(
        await measure(
          "arctos: ModelingSession import (editable)",
          async () => {
            await arctos.load(xml);
          },
          Math.min(SAMPLES, 3),
        ),
      );
      measurements.push(
        await measure(
          "arctos: exportXml from session",
          async () => arctos.exportXml(),
          Math.min(SAMPLES, 3),
        ),
      );
      arctos.destroy();
    }

    const reference = await BpmnJsDriver.create();
    if (reference) {
      measurements.push(
        await measure(
          "bpmn-js: importXML (editable)",
          async () => {
            await reference.load(xml);
          },
          Math.min(SAMPLES, 3),
        ),
      );
      measurements.push(
        await measure(
          "bpmn-js: saveXML",
          async () => reference.exportXml(),
          Math.min(SAMPLES, 3),
        ),
      );
      reference.destroy();
    }

    console.info(
      `[budget] ${LARGEST}, 556 elements, ${SAMPLES} samples, ` +
        `forced GC ${canForceGc() ? "on" : "OFF (heap figures are upper bounds)"}\n` +
        formatMeasurements(measurements),
    );

    const violations = checkBudget(measurements, BUDGET);
    if (violations.length > 0) {
      expect.fail(
        "performance budget exceeded:\n" +
          violations
            .map((violation) => {
              const rationale =
                BUDGET.find((b) => b.label === violation.label)?.rationale ??
                "";
              return (
                `  ${violation.label}: ${violation.measured.toFixed(1)} ${violation.unit} ` +
                `> ${violation.budget} ${violation.unit}\n      budget rationale: ${rationale}`
              );
            })
            .join("\n"),
      );
    }
    expect(violations).toHaveLength(0);
  }, 600_000);
});
