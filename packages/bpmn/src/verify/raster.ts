/**
 * Image comparison — the eye the modeling layer does not have, and the one
 * that found the two worst defects of the spike.
 *
 * The spike's own conclusion was blunt: of 118 tests, not one caught the
 * duplicated `xmlns` or the visually identical catch/throw events. Rasterising
 * and *looking* caught both. This module is the automated version of looking:
 * render the diagram, rasterise it, compare it against a stored reference
 * image, and fail when the picture changed.
 *
 * ---------------------------------------------------------------------------
 * The tolerance — the whole design problem
 * ---------------------------------------------------------------------------
 * "Forgiving of antialiasing, unforgiving of a moved edge" cannot be expressed
 * as a percentage of differing pixels, because both effects change roughly the
 * same *number* of pixels. They differ in **shape**:
 *
 *   - antialiasing changes the fringe of a stroke: a band **one pixel wide**;
 *   - a moved, resized or rerouted edge changes a band **at least two pixels
 *     wide**, because both the old and the new stroke differ from the reference
 *     across the stroke's full width.
 *
 * So the test is morphological, not statistical:
 *
 *   1. build the per-pixel difference mask at a per-channel threshold;
 *   2. **erode** it: a differing pixel survives only if it has a differing
 *      neighbour to the left *or* right **and** one above *or* below — that is,
 *      only if the differing region is at least two pixels thick in both axes;
 *   3. any surviving pixel means real geometry moved.
 *
 * A one-pixel fringe is one pixel thick across the stroke, so it is eroded away
 * whatever its orientation, diagonals included. A stroke that moved by two
 * pixels leaves two bands each two pixels thick, and those survive.
 *
 * Getting the structuring element right mattered: a full 3×3 erosion (all eight
 * neighbours) needs a *three*-pixel band and therefore let a two-pixel shift
 * through. The second self-test in `test/verify/raster.test.ts` caught that,
 * which is the argument for a comparator having tests of its own.
 *
 * `maxErodedPixels` is a small allowance for corners where two fringes meet and
 * form a 2×2 blob, not a general budget.
 *
 * **What this does not cover.** Fonts are resolved by the rasteriser, not by
 * this package, so a different fontconfig on another machine changes every
 * glyph and the comparison fails for a reason that has nothing to do with the
 * renderer. That is the known price of pixel tests (plan §6.3 says to keep them
 * few and pinned); the SVG-structure snapshots in `test/draw/` are the
 * font-independent half of the same job.
 *
 * ---------------------------------------------------------------------------
 * Regenerating the reference images — deliberately, never automatically
 * ---------------------------------------------------------------------------
 *     cd packages/bpmn && UPDATE_BASELINES=1 npx vitest run test/verify/raster.test.ts
 *
 * That rewrites every reference PNG under `test/verify/baseline/`. Do it only
 * after **looking at the new images** — the whole point of this tool is that a
 * human saw the picture at least once. A regeneration commit that does not say
 * which visual change it accepts is the same as having no image test at all.
 *
 * Prerequisites (both already installed): `cairosvg` for SVG→PNG and
 * ImageMagick's `convert` for PNG→PPM. Neither is a package dependency: they
 * are called as processes, so nothing in the shipped bundle changes.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface RasterOptions {
  /** Width of the rasterised image in px. Height follows the aspect ratio. */
  readonly width?: number;
}

const DEFAULT_WIDTH = 900;

/** Rasterise an SVG string to PNG bytes with `cairosvg`. */
export function rasterize(svg: string, options: RasterOptions = {}): Buffer {
  const dir = mkdtempSync(join(tmpdir(), "arctos-raster-"));
  try {
    const svgPath = join(dir, "in.svg");
    const pngPath = join(dir, "out.png");
    writeFileSync(svgPath, svg, "utf8");
    execFileSync(
      "python3",
      [
        "-c",
        "import sys, cairosvg; cairosvg.svg2png(url=sys.argv[1], write_to=sys.argv[2], output_width=int(sys.argv[3]), background_color='white')",
        svgPath,
        pngPath,
        String(options.width ?? DEFAULT_WIDTH),
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    return readFileSync(pngPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export interface Bitmap {
  readonly width: number;
  readonly height: number;
  /** RGB, three bytes per pixel, row-major. */
  readonly data: Buffer;
}

/**
 * Decode PNG bytes to raw RGB via ImageMagick.
 *
 * Binary PPM (`P6`) is used rather than a PNG decoder dependency: the header is
 * three ASCII numbers and the body is exactly the pixels, so the parser below
 * is ten lines and cannot drift out of date.
 */
export function decodePng(png: Buffer): Bitmap {
  const raw = execFileSync("convert", ["png:-", "-depth", "8", "ppm:-"], {
    input: png,
    maxBuffer: 256 * 1024 * 1024,
  });
  return parsePpm(raw);
}

function parsePpm(buffer: Buffer): Bitmap {
  let offset = 0;
  const token = (): string => {
    while (offset < buffer.length) {
      const char = buffer[offset];
      if (char === 0x23) {
        while (offset < buffer.length && buffer[offset] !== 0x0a) offset += 1;
        continue;
      }
      if (char === 0x20 || char === 0x09 || char === 0x0a || char === 0x0d) {
        offset += 1;
        continue;
      }
      break;
    }
    const start = offset;
    while (offset < buffer.length) {
      const char = buffer[offset];
      if (char === 0x20 || char === 0x09 || char === 0x0a || char === 0x0d)
        break;
      offset += 1;
    }
    return buffer.subarray(start, offset).toString("ascii");
  };

  const magic = token();
  if (magic !== "P6") throw new Error(`expected a binary PPM, got "${magic}"`);
  const width = Number(token());
  const height = Number(token());
  const max = Number(token());
  if (max !== 255) throw new Error(`unsupported PPM maximum value ${max}`);
  offset += 1; // exactly one whitespace byte after the header
  const data = buffer.subarray(offset, offset + width * height * 3);
  if (data.length !== width * height * 3) {
    throw new Error("PPM body is shorter than its header promises");
  }
  return { width, height, data };
}

export interface CompareOptions {
  /**
   * Per-channel difference that still counts as "the same pixel". 24 of 255
   * covers font hinting and cairo's own rounding; it is well below the contrast
   * of any stroke against its background.
   */
  readonly channelThreshold?: number;
  /**
   * Differing pixels allowed to survive erosion. Small on purpose: a handful
   * covers the corners where two antialiasing fringes meet, and nothing else.
   */
  readonly maxErodedPixels?: number;
}

export interface CompareResult {
  readonly ok: boolean;
  readonly reason?: string;
  /** Pixels differing beyond the channel threshold. */
  readonly differingPixels: number;
  /** Differing pixels that survived erosion — the ones that count. */
  readonly erodedPixels: number;
  readonly totalPixels: number;
  /** Bounding box of the surviving pixels, to say *where* it changed. */
  readonly region?: { x: number; y: number; width: number; height: number };
}

export const DEFAULT_CHANNEL_THRESHOLD = 24;
export const DEFAULT_MAX_ERODED_PIXELS = 8;

/**
 * Compare two bitmaps. Antialiasing-tolerant, geometry-intolerant — see the
 * file header for why erosion is the right discriminator.
 */
export function compareBitmaps(
  actual: Bitmap,
  expected: Bitmap,
  options: CompareOptions = {},
): CompareResult {
  const threshold = options.channelThreshold ?? DEFAULT_CHANNEL_THRESHOLD;
  const allowance = options.maxErodedPixels ?? DEFAULT_MAX_ERODED_PIXELS;

  if (actual.width !== expected.width || actual.height !== expected.height) {
    return {
      ok: false,
      reason: `size changed: ${actual.width}x${actual.height} vs ${expected.width}x${expected.height}`,
      differingPixels: -1,
      erodedPixels: -1,
      totalPixels: expected.width * expected.height,
    };
  }

  const { width, height } = actual;
  const mask = new Uint8Array(width * height);
  let differing = 0;
  for (let i = 0; i < width * height; i += 1) {
    const base = i * 3;
    const dr = Math.abs((actual.data[base] ?? 0) - (expected.data[base] ?? 0));
    const dg = Math.abs(
      (actual.data[base + 1] ?? 0) - (expected.data[base + 1] ?? 0),
    );
    const db = Math.abs(
      (actual.data[base + 2] ?? 0) - (expected.data[base + 2] ?? 0),
    );
    if (dr > threshold || dg > threshold || db > threshold) {
      mask[i] = 1;
      differing += 1;
    }
  }

  // Erosion: a differing pixel survives only when the differing region around
  // it is at least two pixels thick in *both* axes. Border pixels are eroded
  // away, which is the conservative direction (the diagram has padding, so
  // nothing of interest touches an edge).
  let eroded = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (mask[index] !== 1) continue;
      const horizontal = mask[index - 1] === 1 || mask[index + 1] === 1;
      const vertical = mask[index - width] === 1 || mask[index + width] === 1;
      if (!horizontal || !vertical) continue;
      eroded += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  const ok = eroded <= allowance;
  return {
    ok,
    ...(ok
      ? {}
      : {
          reason:
            `${eroded} pixel(s) differ in a region at least two pixels thick in both axes ` +
            `(allowance ${allowance}). A one-pixel antialiasing fringe cannot survive the erosion, ` +
            "so this is real geometry: something moved, resized, or is drawn differently.",
        }),
    differingPixels: differing,
    erodedPixels: eroded,
    totalPixels: width * height,
    ...(maxX >= 0
      ? {
          region: {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
          },
        }
      : {}),
  };
}

/** True when the external tools this module shells out to are present. */
export function rasterToolsAvailable(): { ok: boolean; reason?: string } {
  try {
    execFileSync("python3", ["-c", "import cairosvg"], { stdio: "ignore" });
  } catch {
    return {
      ok: false,
      reason:
        "cairosvg is not importable — `pip install --break-system-packages cairosvg`",
    };
  }
  try {
    execFileSync("convert", ["-version"], { stdio: "ignore" });
  } catch {
    return { ok: false, reason: "ImageMagick's `convert` is not on PATH" };
  }
  return { ok: true };
}
