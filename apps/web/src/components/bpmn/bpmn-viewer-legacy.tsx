"use client";

/**
 * Legacy-Pfad: der bisherige Viewer auf `bpmn-js` (`NavigatedViewer`).
 *
 * Unverändert bis auf Typherkunft und Exportnamen — siehe den Kopf von
 * `bpmn-editor-legacy.tsx`.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import "./bpmn-editor.css";
// [ARCTOS-FULL-2026-08-31 / WP12 · S14-10] keyboard + screen-reader support.
import {
  BpmnTextAlternative,
  canvasA11yProps,
  makeInteractiveOverlay,
  readModelElements,
  useBpmnKeyboardNavigation,
  type BpmnA11yElement,
  type BpmnCanvasService,
} from "./bpmn-a11y";
import arctosModdleExtension from "./arctos-moddle-extension.json";
import type { BpmnViewerProps } from "./bpmn-canvas-types";

// ---------------------------------------------------------------------------
// bpmn-js viewer instance type
// ---------------------------------------------------------------------------

interface ViewerInstance {
  destroy: () => void;
  importXML: (xml: string) => Promise<{ warnings: string[] }>;
  get: (name: string) => unknown;
}

interface BpmnElement {
  id: string;
  type: string;
  businessObject?: { name?: string };
}

// ---------------------------------------------------------------------------
// Component — read-only NavigatedViewer
// ---------------------------------------------------------------------------

export function BpmnViewerLegacy({
  xml,
  onElementClick,
  riskOverlayData,
  callActivityOverlayData,
  onNavigateToProcess,
  className,
  minHeight = 400,
}: BpmnViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ViewerInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // [WP12 · S14-10] Flat model listing that backs the tabular alternative
  // view — the WCAG 1.1.1 equivalent for a diagram.
  const [modelElements, setModelElements] = useState<BpmnA11yElement[]>([]);
  const t = useTranslations("bpmn");
  const describedById = useId();

  // Store latest callback in ref to avoid re-init
  const onElementClickRef = useRef(onElementClick);
  onElementClickRef.current = onElementClick;
  const onNavigateToProcessRef = useRef(onNavigateToProcess);
  onNavigateToProcessRef.current = onNavigateToProcess;
  // bpmnElementId → calledProcessId for the dblclick drill-down
  const callTargetsRef = useRef<Map<string, string>>(new Map());

  // Dynamic import and init
  useEffect(() => {
    let destroyed = false;

    async function init() {
      if (!containerRef.current || !xml) {
        setLoading(false);
        return;
      }

      try {
        const ViewerModule = await import("bpmn-js/lib/NavigatedViewer");
        const ViewerClass = ViewerModule.default;

        const viewer = new ViewerClass({
          container: containerRef.current,
          // B1.1: keep arctos:* extension attributes intact on import.
          moddleExtensions: { arctos: arctosModdleExtension },
        }) as unknown as ViewerInstance;

        if (destroyed) {
          viewer.destroy();
          return;
        }

        viewerRef.current = viewer;

        await viewer.importXML(xml);

        const canvas = viewer.get("canvas") as {
          zoom: (mode: string) => void;
        };
        canvas.zoom("fit-viewport");

        // [WP12 · S14-10] Snapshot the model for the text alternative.
        const elementRegistry = viewer.get("elementRegistry") as Parameters<
          typeof readModelElements
        >[0];
        if (!destroyed) setModelElements(readModelElements(elementRegistry));

        // Element click
        const eventBus = viewer.get("eventBus") as {
          on: (
            event: string,
            callback: (e: { element: BpmnElement | null }) => void,
          ) => void;
        };
        eventBus.on("element.click", (e) => {
          const element = e.element;
          if (
            element &&
            element.type !== "bpmn:Process" &&
            element.businessObject
          ) {
            onElementClickRef.current?.(
              element.id,
              element.type,
              element.businessObject.name ?? null,
            );
          }
        });

        // Call-Activity Drill-Down: double-click navigates into the
        // linked child process.
        eventBus.on("element.dblclick", (e) => {
          const element = e.element;
          if (!element) return;
          const target = callTargetsRef.current.get(element.id);
          if (target) onNavigateToProcessRef.current?.(target);
        });

        if (!destroyed) setLoading(false);
      } catch (err) {
        if (!destroyed) {
          setError(
            err instanceof Error ? err.message : "Failed to load BPMN viewer",
          );
          setLoading(false);
        }
      }
    }

    void init();

    return () => {
      destroyed = true;
      const viewer = viewerRef.current;
      if (viewer) {
        viewer.destroy();
        viewerRef.current = null;
      }
    };
    // Re-init when xml changes
  }, [xml]);

  // Apply risk overlays
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || loading || !riskOverlayData?.length) return;

    try {
      type OverlayService = {
        remove: (opts: { type: string }) => void;
        add: (
          elementId: string,
          type: string,
          opts: { position: { top: number; right: number }; html: HTMLElement },
        ) => void;
      };
      const overlays = viewer.get("overlays") as OverlayService;

      overlays.remove({ type: "risk-badge" });

      for (const item of riskOverlayData) {
        const color =
          item.highestScore > 15
            ? "bg-red-100 text-red-800 border-red-300"
            : item.highestScore > 8
              ? "bg-yellow-100 text-yellow-800 border-yellow-300"
              : "bg-green-100 text-green-800 border-green-300";

        const html = document.createElement("div");
        html.className = `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold shadow-sm ${color}`;
        html.textContent = `${item.riskCount} · ${item.highestScore}`;
        html.style.transform = "translate(50%, -50%)";
        // [WP12 · S14-10] The badge carried `cursor-pointer` but no handler —
        // it is informational, so it is exposed as such rather than as a
        // button a keyboard user could focus and then not activate.
        makeInteractiveOverlay(html, {
          label: t("a11y.riskBadge", {
            count: item.riskCount,
            score: item.highestScore,
          }),
        });

        overlays.add(item.bpmnElementId, "risk-badge", {
          position: { top: -14, right: -14 },
          html,
        });
      }
    } catch {
      // Overlays may fail if elements don't exist in the diagram
    }
  }, [riskOverlayData, loading]);

  // Call-Activity Drill-Down: badge on elements with a linked child
  // process; clicking the badge navigates to the child's detail page.
  useEffect(() => {
    callTargetsRef.current = new Map(
      (callActivityOverlayData ?? []).map((c) => [
        c.bpmnElementId,
        c.calledProcessId,
      ]),
    );
    const viewer = viewerRef.current;
    if (!viewer || loading) return;
    try {
      type OverlayService = {
        remove: (opts: { type: string }) => void;
        add: (
          elementId: string,
          type: string,
          opts: {
            position: { bottom: number; left: number };
            html: HTMLElement;
          },
        ) => void;
      };
      const overlays = viewer.get("overlays") as OverlayService;
      overlays.remove({ type: "call-activity-badge" });
      for (const item of callActivityOverlayData ?? []) {
        const html = document.createElement("div");
        html.className =
          "inline-flex items-center gap-1 rounded-full border border-indigo-300 bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800 shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";
        html.textContent = `↗${
          item.calledProcessName ? ` ${item.calledProcessName}` : ""
        }`;
        html.style.maxWidth = "160px";
        html.style.overflow = "hidden";
        html.style.whiteSpace = "nowrap";
        html.style.textOverflow = "ellipsis";
        html.style.transform = "translate(-50%, 50%)";
        html.title = item.calledProcessName ?? item.calledProcessId;
        // [WP12 · S14-10] Was a click-only div: focusable, named and
        // Enter/Space-operable now.
        makeInteractiveOverlay(html, {
          label: t("a11y.drillDown", {
            name: item.calledProcessName ?? item.calledProcessId,
          }),
          onActivate: () =>
            onNavigateToProcessRef.current?.(item.calledProcessId),
        });
        overlays.add(item.bpmnElementId, "call-activity-badge", {
          position: { bottom: -14, left: -14 },
          html,
        });
      }
    } catch {
      // Overlays may fail if elements don't exist in the diagram
    }
  }, [callActivityOverlayData, loading]);

  // [WP12 · S14-10] Arrow keys pan, +/- zoom, 0 fits — bound to the canvas so
  // the shortcuts never steal keys from the rest of the page.
  const getCanvas = useCallback((): BpmnCanvasService | null => {
    const viewer = viewerRef.current;
    if (!viewer) return null;
    return viewer.get("canvas") as BpmnCanvasService;
  }, []);
  useBpmnKeyboardNavigation(containerRef, getCanvas);

  if (!xml) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 ${className ?? ""}`}
        style={{ minHeight }}
      >
        <p className="text-sm text-gray-400">No BPMN diagram available</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center text-red-500 text-sm ${className ?? ""}`}
        style={{ minHeight }}
      >
        {error}
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ""}`} style={{ minHeight }}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
          <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}
      {/* [WP12 · S14-10] Was `<div ref={containerRef} className="h-full w-full" />`
          — a bare, unfocusable, unnamed container around an SVG with no text
          alternative (EN 301 549 §9.1.1.1 and §9.2.1.1, both WCAG level A). */}
      <div
        ref={containerRef}
        className="h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        style={{ minHeight }}
        {...canvasA11yProps({
          label: t("a11y.canvasLabel"),
          describedById,
          readOnly: true,
        })}
      />
      <BpmnTextAlternative
        id={describedById}
        elements={modelElements}
        diagramLabel={t("a11y.canvasLabel")}
        labels={{
          heading: t("a11y.tableHeading"),
          show: t("a11y.tableShow"),
          hide: t("a11y.tableHide"),
          empty: t("a11y.tableEmpty"),
          colName: t("a11y.colName"),
          colType: t("a11y.colType"),
          colId: t("a11y.colId"),
          hint: t("a11y.canvasHint"),
        }}
        onSelectElement={(elementId) => {
          const el = modelElements.find((m) => m.id === elementId);
          if (el) onElementClickRef.current?.(el.id, el.type, el.name);
        }}
      />
    </div>
  );
}
