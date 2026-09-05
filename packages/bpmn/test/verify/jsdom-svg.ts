/// <reference lib="dom" />

/**
 * The extra jsdom shims that **`bpmn-js`** needs on top of the ones the draw
 * tests already install.
 *
 * `test/draw/helpers/jsdom-svg.ts` implements the SVG geometry model
 * (`SVGMatrix`, `transform.baseVal`, a real `getBBox()` computed from the
 * geometry of the descendants). That file is the authority; this one only adds
 * the two things `diagram-js`' own UI layer touches and the renderer does not:
 *
 *  - `CSS.escape()`, used by the palette when it builds entry class names;
 *  - a 2D canvas context, because `diagram-js/lib/util/Text.js` measures every
 *    label through `canvas.getContext('2d').measureText()`. jsdom has no
 *    canvas, so the context is `null`, every line measures zero wide and
 *    `layoutNext()` **never terminates** for a label box of width zero. The
 *    fake metric below is deliberately linear in the character count: it makes
 *    text layout terminate *and* reproducible, at the price of not being real
 *    font metrics.
 *
 * **Consequence for what may be asserted.** Everything downstream of the fake
 * metric — label widths and heights, the bounds of auto-created external
 * labels, and anything that resizes to fit text — is fiction and is excluded
 * from the shadow comparison (see `src/verify/shadow.ts`, `LABEL_KINDS`).
 *
 * This file exists only to run `bpmn-js` as a reference implementation inside
 * vitest. It is not shipped and `src/` never imports it. When `bpmn-js` leaves
 * the tree, this file goes with it.
 */

import { installSvgPolyfills } from "../draw/helpers/jsdom-svg";

/** Nominal font size the fake text metric assumes, in px. */
const FAKE_FONT_SIZE = 12;
/** Advance width per character as a fraction of the font size. */
const FAKE_ADVANCE_RATIO = 0.55;

let installed = false;

/** Install everything a headless `bpmn-js` needs. Idempotent. */
export function installBpmnJsSupport(): void {
  if (installed) return;
  installed = true;

  installSvgPolyfills();

  const globals = globalThis as unknown as Record<string, unknown>;

  if (!globals["CSS"]) {
    globals["CSS"] = {
      escape: (value: string): string =>
        String(value).replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`),
    };
  }

  const canvasProto = (
    globals["HTMLCanvasElement"] as
      { prototype: Record<string, unknown> } | undefined
  )?.prototype;
  if (canvasProto) {
    canvasProto["getContext"] = function (kind: string): unknown {
      if (kind !== "2d") return null;
      return {
        font: "",
        letterSpacing: "0px",
        measureText(text: string): Record<string, number> {
          return {
            width: text.length * FAKE_FONT_SIZE * FAKE_ADVANCE_RATIO,
            fontBoundingBoxAscent: FAKE_FONT_SIZE * 0.8,
            fontBoundingBoxDescent: FAKE_FONT_SIZE * 0.2,
            actualBoundingBoxAscent: FAKE_FONT_SIZE * 0.8,
            actualBoundingBoxDescent: FAKE_FONT_SIZE * 0.2,
          };
        },
      };
    };
  }
}

/**
 * What this environment cannot decide, stated once so no test pretends
 * otherwise. Mirrored into `STUFE2-A3-VERIFIKATION.md`.
 */
export const BPMNJS_JSDOM_LIMITATIONS: readonly string[] = [
  "Textmetrik ist erfunden (linear in der Zeichenzahl) — Labelgrößen, Autoresize und externe Label-Bounds sind nicht vergleichbar.",
  "Es gibt kein Layout und keinen Viewport — Zoom, Scroll und Viewport-Culling laufen ins Leere.",
  "Es gibt keine Zeigereingabe — Palette, Kontextpad, Drag&Drop werden über die Modeling-API angesteuert, nicht über Events.",
  "Es wird nicht gemalt — Farbe, Kontrast und Schriftbild bleiben ungeprüft (dafür ist der Bildvergleich da).",
];
