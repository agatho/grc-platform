/**
 * Image comparison over a selection of the corpus.
 *
 * Why this test exists at all is in the header of `src/verify/raster.ts`: the
 * two worst defects of the spike were found by rasterising and looking, not by
 * any of the 118 tests that were running at the time.
 *
 * **Regenerating the reference images:**
 *
 *     cd packages/bpmn && UPDATE_BASELINES=1 npx vitest run test/verify/raster.test.ts
 *
 * Only after looking at the result. `test/verify/baseline/README.md` says the
 * same thing where someone will find it.
 *
 * Two tests guard the comparison itself — one proves it tolerates antialiasing,
 * one proves it catches a two-pixel shift. Without those, a comparison that
 * silently always passed would look exactly like a comparison that works.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { installSvgPolyfills } from "../draw/helpers/jsdom-svg.js";
import {
  renderDefinitions,
  toSvgString,
} from "../../src/draw/StaticRenderer.js";
import { importXml } from "../../src/model/io.js";
import { loadCorpus } from "../model/corpus.js";
import {
  compareBitmaps,
  decodePng,
  rasterize,
  rasterToolsAvailable,
  type Bitmap,
} from "../../src/verify/raster.js";

installSvgPolyfills();

const BASELINE_DIR = join(dirname(fileURLToPath(import.meta.url)), "baseline");
const UPDATE = process.env["UPDATE_BASELINES"] === "1";

/**
 * The selection: broad enough that a change to any major shape family shows up,
 * small enough that the suite stays quick (each image costs one cairosvg call).
 * A repository diagram and a hard case for every construct group the renderer
 * has an opinion about.
 */
const SELECTION: readonly string[] = [
  "repo-seed-customer-service",
  "repo-prd-sales-with-gateway",
  "repo-parser-mixed-types-subprocess",
  "synth-all-event-types",
  "synth-all-gateway-types",
  "synth-all-task-types",
  "synth-boundary-events",
  "synth-collaboration-pools-lanes",
  "synth-data-objects-and-artifacts",
  "synth-nested-subprocesses",
  "synth-cdata-umlauts-entities",
];

const tools = rasterToolsAvailable();

async function renderToPng(xml: string): Promise<Buffer> {
  const { definitions } = await importXml(xml, { preserveSource: false });
  const result = renderDefinitions(definitions, {
    background: true,
    title: "corpus",
    // Pin everything the picture depends on, so the reference image is a
    // function of the model and the renderer alone.
    fontFamily: "sans-serif",
    fontSize: 12,
    padding: 20,
  });
  return rasterize(toSvgString(result), { width: 900 });
}

/** A tiny synthetic bitmap, so the comparator can be tested without files. */
function bitmap(
  width: number,
  height: number,
  paint: (x: number, y: number) => number,
): Bitmap {
  const data = Buffer.alloc(width * height * 3, 255);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = paint(x, y);
      const base = (y * width + x) * 3;
      data[base] = value;
      data[base + 1] = value;
      data[base + 2] = value;
    }
  }
  return { width, height, data };
}

describe("image comparison", () => {
  it("has its tools, or says exactly which one is missing", () => {
    expect(tools.ok, tools.reason ?? "").toBe(true);
  });

  it("forgives a one-pixel antialiasing fringe", () => {
    // A vertical stroke at x=20..23, and the same stroke whose fringe pixels
    // (x=19 and x=24) are shaded differently. That is what a font-hinting or
    // renderer-version change looks like.
    const clean = bitmap(60, 40, (x) => (x >= 20 && x <= 23 ? 0 : 255));
    const fringed = bitmap(60, 40, (x) =>
      x >= 20 && x <= 23 ? 0 : x === 19 || x === 24 ? 90 : 255,
    );
    const result = compareBitmaps(fringed, clean);
    expect(result.differingPixels).toBeGreaterThan(0);
    expect(result.erodedPixels).toBe(0);
    expect(result.ok, result.reason ?? "").toBe(true);
  });

  it("does not forgive an edge that moved two pixels", () => {
    const before = bitmap(60, 40, (x) => (x >= 20 && x <= 23 ? 0 : 255));
    const after = bitmap(60, 40, (x) => (x >= 22 && x <= 25 ? 0 : 255));
    const result = compareBitmaps(after, before);
    expect(result.erodedPixels).toBeGreaterThan(0);
    expect(result.ok).toBe(false);
    expect(result.region?.width ?? 0).toBeGreaterThan(0);
  });

  it("notices a diagram that changed size", () => {
    const result = compareBitmaps(
      bitmap(10, 10, () => 255),
      bitmap(12, 10, () => 255),
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("size changed");
  });

  const corpus = new Map(loadCorpus().map((entry) => [entry.name, entry]));

  for (const name of SELECTION) {
    it(`renders ${name} the same as its reference image`, async () => {
      if (!tools.ok) return;
      const entry = corpus.get(name);
      expect(entry, `corpus file ${name} is missing`).toBeDefined();
      const png = await renderToPng(entry?.xml ?? "");
      const baselinePath = join(BASELINE_DIR, `${name}.png`);

      if (UPDATE || !existsSync(baselinePath)) {
        mkdirSync(BASELINE_DIR, { recursive: true });
        writeFileSync(baselinePath, png);
        // A freshly written baseline is not evidence of anything; say so.
        console.warn(
          `[raster] wrote reference image ${name}.png — look at it before committing`,
        );
        return;
      }

      const result = compareBitmaps(
        decodePng(png),
        decodePng(readFileSync(baselinePath)),
      );
      if (!result.ok) {
        const failedPath = join(BASELINE_DIR, `${name}.failed.png`);
        writeFileSync(failedPath, png);
        expect.fail(
          `${name}: ${result.reason ?? "images differ"}\n` +
            `  differing pixels: ${result.differingPixels} of ${result.totalPixels}\n` +
            `  after erosion:    ${result.erodedPixels}\n` +
            (result.region
              ? `  region:           x=${result.region.x} y=${result.region.y} ` +
                `${result.region.width}x${result.region.height}\n`
              : "") +
            `  actual image written to ${failedPath}\n` +
            "  If the change is intended, look at both images, then regenerate with\n" +
            "  UPDATE_BASELINES=1 npx vitest run test/verify/raster.test.ts",
        );
      }
      expect(result.ok).toBe(true);
    }, 120_000);
  }
});
