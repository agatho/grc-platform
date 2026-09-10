"use client";

/**
 * [ARCTOS-FULL-2026-08-31 / WP12 · S14-10] Keyboard and screen-reader support
 * for the BPMN module — EN 301 549 §9.2.1.1 (keyboard, WCAG 2.1.1 level A) and
 * §9.1.1.1 (non-text content, WCAG 1.1.1 level A).
 *
 * Baseline from the audit:
 *
 *     $ grep -c "aria-\|tabIndex\|onKeyDown\|role=" src/components/bpmn/*.tsx
 *     arctos-properties-panel.tsx:0   bpmn-editor.tsx:0   bpmn-toolbar.tsx:0
 *     bpmn-viewer.tsx:0               risk-link-search.tsx:0
 *     shape-side-panel.tsx:0
 *
 * Zero in all six files of what `CLAUDE.md:62` and `docs/feature-catalog.md:15`
 * call a core module. The canvas was a bare `<div>`; bpmn-js mounts an SVG in
 * it with no `role`, no name and no text alternative, and the risk /
 * call-activity overlays were `cursor-pointer` divs with a click listener and
 * nothing else.
 *
 * Three things are needed, and a WCAG level-A keyboard failure cannot be
 * compensated by "there is also a mouse":
 *
 *  1. `canvasA11yProps()` — the canvas becomes a named, focusable
 *     `role="application"` region. `application` (not `img`) is correct
 *     because the widget handles its own arrow keys; it tells assistive
 *     technology to pass keystrokes through rather than intercept them.
 *  2. `useBpmnKeyboardNavigation()` — pan, zoom and fit from the keyboard.
 *     Without it the canvas is reachable but the viewport cannot be moved
 *     without a mouse. Element-by-element traversal *inside* the SVG is NOT
 *     provided here; the tabular alternative in (3) is what makes every
 *     element reachable, and it is the more robust of the two.
 *  3. `<BpmnTextAlternative>` — the tabular alternative view of the model that
 *     the audit noted does not exist. It is the actual §9.1.1.1 remedy: a
 *     diagram cannot be conveyed by a label, only by an equivalent structure.
 *     It is rendered as a real, visible, collapsible table so it is testable
 *     and useful to sighted keyboard users too, rather than hidden text that
 *     nobody ever checks.
 *  4. `makeInteractiveOverlay()` — the imperatively created overlay badges get
 *     `role="button"`, `tabindex="0"`, an `aria-label` and Enter/Space
 *     handling, so the risk and drill-down affordances are operable.
 */

import * as React from "react";

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

/** Minimal surface of the bpmn-js canvas/zoom services this module needs. */
export interface BpmnCanvasService {
  zoom: (mode: string | number, center?: unknown) => number;
  scroll: (delta: { dx: number; dy: number }) => void;
}

export interface BpmnA11yElement {
  id: string;
  type: string;
  name: string | null;
}

/**
 * Props for the element that bpmn-js mounts into.
 *
 * `role="application"` + `tabIndex={0}` is the combination that makes a custom
 * canvas widget both reachable and able to receive raw keystrokes. The label
 * and the description reference the text alternative so a screen-reader user
 * is told, on focus, that an equivalent table exists.
 */
export function canvasA11yProps(opts: {
  label: string;
  describedById?: string;
  readOnly?: boolean;
}): React.HTMLAttributes<HTMLDivElement> & { tabIndex: number } {
  return {
    role: "application",
    tabIndex: 0,
    "aria-label": opts.label,
    "aria-describedby": opts.describedById,
    "aria-readonly": opts.readOnly ? true : undefined,
  };
}

/**
 * Arrow keys pan, `+`/`-` zoom, `0` fits the viewport, `Home` re-centres.
 * Bound to the canvas element itself so it only fires while the diagram has
 * focus — a document-level listener would steal keys from every form on the
 * page.
 */
export function useBpmnKeyboardNavigation(
  containerRef: React.RefObject<HTMLElement | null>,
  getCanvas: () => BpmnCanvasService | null,
) {
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const PAN = 60;
    const onKeyDown = (ev: KeyboardEvent) => {
      const canvas = getCanvas();
      if (!canvas) return;
      // Never swallow the browser's own shortcuts.
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;

      let handled = true;
      switch (ev.key) {
        case "ArrowLeft":
          canvas.scroll({ dx: PAN, dy: 0 });
          break;
        case "ArrowRight":
          canvas.scroll({ dx: -PAN, dy: 0 });
          break;
        case "ArrowUp":
          canvas.scroll({ dx: 0, dy: PAN });
          break;
        case "ArrowDown":
          canvas.scroll({ dx: 0, dy: -PAN });
          break;
        case "+":
        case "=":
          canvas.zoom(canvas.zoom("") * 1.2);
          break;
        case "-":
        case "_":
          canvas.zoom(canvas.zoom("") / 1.2);
          break;
        case "0":
        case "Home":
          canvas.zoom("fit-viewport");
          break;
        default:
          handled = false;
      }
      if (handled) {
        // Only now — an unhandled key must still reach the page (Tab out).
        ev.preventDefault();
        ev.stopPropagation();
      }
    };

    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [containerRef, getCanvas]);
}

// ---------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------

/**
 * Turns an imperatively built overlay badge into an operable control.
 *
 * `bpmn-viewer.tsx:186,227` created these with `document.createElement` and a
 * `cursor-pointer` class, then attached a `click` listener — visually a button,
 * but unreachable by keyboard and invisible to assistive technology.
 */
export function makeInteractiveOverlay(
  el: HTMLElement,
  opts: { label: string; onActivate?: () => void },
): void {
  if (!opts.onActivate) {
    // Purely informational badge (e.g. the risk score): expose the text, do
    // not pretend it is operable.
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", opts.label);
    return;
  }
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");
  el.setAttribute("aria-label", opts.label);
  el.addEventListener("click", (ev) => {
    ev.stopPropagation();
    opts.onActivate?.();
  });
  el.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;
    ev.preventDefault();
    ev.stopPropagation();
    opts.onActivate?.();
  });
}

// ---------------------------------------------------------------------------
// Text alternative
// ---------------------------------------------------------------------------

/** Human-readable label for a `bpmn:*` type, without needing the catalogue. */
export function humaniseBpmnType(type: string): string {
  return type
    .replace(/^bpmn:/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
}

export interface BpmnTextAlternativeProps {
  /** Elements of the imported model, in document order. */
  elements: BpmnA11yElement[];
  /** Same id referenced by `canvasA11yProps({ describedById })`. */
  id: string;
  /** Accessible name of the diagram this describes. */
  diagramLabel: string;
  /** Localised strings; the component must not reach for a namespace itself. */
  labels: {
    heading: string;
    show: string;
    hide: string;
    empty: string;
    colName: string;
    colType: string;
    colId: string;
    hint: string;
  };
  /** Selecting a row focuses the corresponding shape in the diagram. */
  onSelectElement?: (elementId: string) => void;
}

/**
 * The tabular equivalent of the diagram (WCAG 1.1.1). Collapsed by default so
 * it does not crowd the canvas, but the summary is always in the accessibility
 * tree, and the hint text is what `aria-describedby` on the canvas points at —
 * so a screen-reader user learns the alternative exists the moment the canvas
 * takes focus, whether or not the table is expanded.
 */
export function BpmnTextAlternative({
  elements,
  id,
  diagramLabel,
  labels,
  onSelectElement,
}: BpmnTextAlternativeProps) {
  const [open, setOpen] = React.useState(false);
  const tableId = `${id}-table`;

  return (
    <section aria-label={labels.heading} className="mt-2">
      <p id={id} className="sr-only">
        {labels.hint}
      </p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={tableId}
        className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-800 dark:text-gray-500 dark:hover:bg-gray-900"
      >
        {open ? labels.hide : labels.show} ({elements.length})
      </button>

      <div id={tableId} hidden={!open} className="mt-2 overflow-x-auto">
        {elements.length === 0 ? (
          <p className="text-sm text-gray-500">{labels.empty}</p>
        ) : (
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <caption className="sr-only">
              {labels.heading} — {diagramLabel}
            </caption>
            <thead>
              <tr className="border-b border-gray-200 text-left dark:border-gray-800">
                <th scope="col" className="px-2 py-1.5 font-medium">
                  {labels.colName}
                </th>
                <th scope="col" className="px-2 py-1.5 font-medium">
                  {labels.colType}
                </th>
                <th scope="col" className="px-2 py-1.5 font-medium">
                  {labels.colId}
                </th>
              </tr>
            </thead>
            <tbody>
              {elements.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-900"
                >
                  <th scope="row" className="px-2 py-1.5 text-left font-normal">
                    {onSelectElement ? (
                      <button
                        type="button"
                        onClick={() => onSelectElement(e.id)}
                        className="text-blue-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        {e.name ?? humaniseBpmnType(e.type)}
                      </button>
                    ) : (
                      (e.name ?? humaniseBpmnType(e.type))
                    )}
                  </th>
                  <td className="px-2 py-1.5 text-gray-600 dark:text-gray-600">
                    {humaniseBpmnType(e.type)}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-xs text-gray-500">
                    {e.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

/**
 * Reads the imported model out of a bpmn-js instance as a flat, ordered list.
 * Kept here rather than in the viewer so the editor can reuse it verbatim.
 */
export function readModelElements(elementRegistry: {
  getAll: () => Array<{
    id: string;
    type: string;
    businessObject?: { name?: string };
  }>;
}): BpmnA11yElement[] {
  return elementRegistry
    .getAll()
    .filter(
      (e) =>
        // Skip the diagram root and the plain-label pseudo elements: they carry
        // no information a reader could act on.
        e.type !== "bpmn:Process" &&
        e.type !== "bpmn:Collaboration" &&
        e.type !== "label",
    )
    .map((e) => ({
      id: e.id,
      type: e.type,
      name: e.businessObject?.name?.trim() || null,
    }));
}
