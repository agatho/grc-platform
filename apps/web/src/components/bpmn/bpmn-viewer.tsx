"use client";

import { useEffect, useRef, useState } from "react";
import "./bpmn-editor.css";
import arctosModdleExtension from "./arctos-moddle-extension.json";
import type { RiskOverlayData, CallActivityOverlayData } from "./bpmn-editor";

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
// Types
// ---------------------------------------------------------------------------

interface BpmnViewerProps {
  xml: string;
  onElementClick?: (
    elementId: string,
    elementType: string,
    elementName: string | null,
  ) => void;
  riskOverlayData?: RiskOverlayData[];
  // Call-Activity Drill-Down: badge + dblclick navigation into children
  callActivityOverlayData?: CallActivityOverlayData[];
  onNavigateToProcess?: (processId: string) => void;
  className?: string;
  /** Minimum height for the viewer container */
  minHeight?: number;
}

// ---------------------------------------------------------------------------
// Component — read-only NavigatedViewer
// ---------------------------------------------------------------------------

export function BpmnViewer({
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
        html.className = `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold shadow-sm cursor-pointer ${color}`;
        html.textContent = `${item.riskCount} · ${item.highestScore}`;
        html.style.transform = "translate(50%, -50%)";

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
          "inline-flex items-center gap-1 rounded-full border border-indigo-300 bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800 shadow-sm cursor-pointer";
        html.textContent = `↗${
          item.calledProcessName ? ` ${item.calledProcessName}` : ""
        }`;
        html.style.maxWidth = "160px";
        html.style.overflow = "hidden";
        html.style.whiteSpace = "nowrap";
        html.style.textOverflow = "ellipsis";
        html.style.transform = "translate(-50%, 50%)";
        html.title = item.calledProcessName ?? item.calledProcessId;
        html.addEventListener("click", (ev) => {
          ev.stopPropagation();
          onNavigateToProcessRef.current?.(item.calledProcessId);
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
      <div ref={containerRef} className="h-full w-full" style={{ minHeight }} />
    </div>
  );
}
