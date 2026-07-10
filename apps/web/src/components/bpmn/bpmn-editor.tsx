"use client";

import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import "./bpmn-editor.css";
import arctosModdleExtension from "./arctos-moddle-extension.json";

// ---------------------------------------------------------------------------
// bpmn-js instance type — using an interface to satisfy TS while
// allowing dynamic import (bpmn-js classes use complex generic signatures).
// ---------------------------------------------------------------------------

interface BpmnInstance {
  destroy: () => void;
  importXML: (xml: string) => Promise<{ warnings: string[] }>;
  saveXML: (opts: { format: boolean }) => Promise<{ xml: string }>;
  saveSVG: () => Promise<{ svg: string }>;
  get: (name: string) => unknown;
  __keyHandler?: (e: KeyboardEvent) => void;
}

interface BpmnElement {
  id: string;
  type: string;
  businessObject?: { name?: string };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RiskOverlayData {
  bpmnElementId: string;
  riskCount: number;
  highestScore: number;
}

// BPM Overhaul Phase 2 A3–A5: additional overlay channels.
export interface ControlCoverageOverlayData {
  bpmnElementId: string;
  controlCount: number;
  effectiveCount: number;
}

export interface LodOverlayData {
  bpmnElementId: string;
  lineOfDefense: "first" | "second" | "third" | "oversight" | null;
}

export interface FindingsOverlayData {
  bpmnElementId: string;
  openCount: number;
  criticalCount: number;
}

export interface BpmnEditorRef {
  saveXml: () => Promise<string>;
  saveSvg: () => Promise<string>;
  getModeler: () => unknown | null;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

interface BpmnEditorProps {
  initialXml: string;
  readOnly?: boolean;
  onSave?: (xml: string) => Promise<void>;
  onElementClick?: (
    elementId: string,
    elementType: string,
    elementName: string | null,
  ) => void;
  onChanged?: () => void;
  riskOverlayData?: RiskOverlayData[];
  controlCoverageOverlayData?: ControlCoverageOverlayData[];
  lodOverlayData?: LodOverlayData[];
  findingsOverlayData?: FindingsOverlayData[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const BpmnEditor = forwardRef<BpmnEditorRef, BpmnEditorProps>(
  function BpmnEditor(
    {
      initialXml,
      readOnly = false,
      onSave,
      onElementClick,
      onChanged,
      riskOverlayData,
      controlCoverageOverlayData,
      lodOverlayData,
      findingsOverlayData,
      className,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const modelerRef = useRef<BpmnInstance | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Store latest callbacks in refs to avoid re-init
    const onSaveRef = useRef(onSave);
    onSaveRef.current = onSave;
    const onChangedRef = useRef(onChanged);
    onChangedRef.current = onChanged;
    const onElementClickRef = useRef(onElementClick);
    onElementClickRef.current = onElementClick;

    // Dynamic import and init — runs once on mount
    useEffect(() => {
      let destroyed = false;

      async function init() {
        if (!containerRef.current) return;

        try {
          // Dynamic import of bpmn-js to avoid SSR
          const BpmnModule = readOnly
            ? await import("bpmn-js/lib/NavigatedViewer")
            : await import("bpmn-js/lib/Modeler");

          const BpmnClass = BpmnModule.default;

          const instance = new BpmnClass({
            container: containerRef.current,
            keyboard: { bindTo: document },
            // B1.1: register the arctos moddle extension so arctos:*
            // extension elements survive import/export round-trips and are
            // readable/writable through the moddle model.
            moddleExtensions: { arctos: arctosModdleExtension },
          }) as unknown as BpmnInstance & {
            __keyHandler?: (e: KeyboardEvent) => void;
          };

          if (destroyed) {
            instance.destroy();
            return;
          }

          modelerRef.current = instance;

          // Import BPMN XML
          await instance.importXML(initialXml);

          // Fit viewport
          const canvas = instance.get("canvas") as {
            zoom: (mode: string) => void;
          };
          canvas.zoom("fit-viewport");

          // Edit-mode event listeners
          if (!readOnly) {
            const eventBus = instance.get("eventBus") as {
              on: (event: string, callback: () => void) => void;
            };
            eventBus.on("commandStack.changed", () => {
              onChangedRef.current?.();
            });

            // Ctrl+S / Cmd+S save shortcut
            const handleKeyDown = (e: KeyboardEvent) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                const mod = modelerRef.current;
                if (!mod) return;
                void mod.saveXML({ format: true }).then(({ xml }) => {
                  if (xml) void onSaveRef.current?.(xml);
                });
              }
            };
            document.addEventListener("keydown", handleKeyDown);
            instance.__keyHandler = handleKeyDown;
          }

          // Element click (both edit and view modes)
          const eventBus2 = instance.get("eventBus") as {
            on: (
              event: string,
              callback: (e: { element: BpmnElement | null }) => void,
            ) => void;
          };
          eventBus2.on("element.click", (e) => {
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

          if (!destroyed) setLoading(false);
        } catch (err) {
          if (!destroyed) {
            setError(
              err instanceof Error ? err.message : "Failed to load BPMN editor",
            );
            setLoading(false);
          }
        }
      }

      void init();

      return () => {
        destroyed = true;
        const instance = modelerRef.current;
        if (instance) {
          if (instance.__keyHandler) {
            document.removeEventListener("keydown", instance.__keyHandler);
          }
          instance.destroy();
          modelerRef.current = null;
        }
      };
      // Only mount once — readOnly and initialXml are treated as initial values
    }, []);

    // Apply risk overlays when data changes
    useEffect(() => {
      const instance = modelerRef.current;
      if (!instance || loading || !riskOverlayData?.length) return;

      try {
        type OverlayService = {
          remove: (opts: { type: string }) => void;
          add: (
            elementId: string,
            type: string,
            opts: {
              position: { top: number; right: number };
              html: HTMLElement;
            },
          ) => void;
        };
        const overlays = instance.get("overlays") as OverlayService;

        // Clear existing risk overlays
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

    // BPM Overhaul A5: control-coverage overlay
    useEffect(() => {
      const instance = modelerRef.current;
      if (!instance || loading || !controlCoverageOverlayData?.length) return;
      try {
        type OverlayService = {
          remove: (opts: { type: string }) => void;
          add: (
            elementId: string,
            type: string,
            opts: {
              position: { top: number; left: number };
              html: HTMLElement;
            },
          ) => void;
        };
        const overlays = instance.get("overlays") as OverlayService;
        overlays.remove({ type: "control-badge" });
        for (const item of controlCoverageOverlayData) {
          const color =
            item.controlCount === 0
              ? "bg-gray-200 text-gray-600 border-gray-300"
              : item.effectiveCount === item.controlCount
                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                : item.effectiveCount > 0
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-red-100 text-red-800 border-red-300";
          const html = document.createElement("div");
          html.className = `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold shadow-sm cursor-pointer ${color}`;
          html.textContent = `\u{1F6E1} ${item.effectiveCount}/${item.controlCount}`;
          html.style.transform = "translate(-50%, 0)";
          overlays.add(item.bpmnElementId, "control-badge", {
            position: { top: -14, left: -14 },
            html,
          });
        }
      } catch {
        /* element may be missing */
      }
    }, [controlCoverageOverlayData, loading]);

    // BPM Overhaul A4: LoD overlay (left edge accent)
    useEffect(() => {
      const instance = modelerRef.current;
      if (!instance || loading || !lodOverlayData?.length) return;
      try {
        type OverlayService = {
          remove: (opts: { type: string }) => void;
          add: (
            elementId: string,
            type: string,
            opts: {
              position: { top: number; left: number };
              html: HTMLElement;
            },
          ) => void;
        };
        const overlays = instance.get("overlays") as OverlayService;
        overlays.remove({ type: "lod-stripe" });
        const colorMap: Record<string, string> = {
          first: "bg-blue-500",
          second: "bg-purple-500",
          third: "bg-amber-500",
          oversight: "bg-slate-500",
        };
        for (const item of lodOverlayData) {
          if (!item.lineOfDefense) continue;
          const html = document.createElement("div");
          html.className = `${colorMap[item.lineOfDefense] ?? "bg-gray-400"} rounded-l`;
          html.style.width = "4px";
          html.style.height = "60px";
          html.title = `LoD: ${item.lineOfDefense}`;
          overlays.add(item.bpmnElementId, "lod-stripe", {
            position: { top: 0, left: -6 },
            html,
          });
        }
      } catch {
        /* */
      }
    }, [lodOverlayData, loading]);

    // BPM Overhaul Phase 6: findings overlay (bottom badge)
    useEffect(() => {
      const instance = modelerRef.current;
      if (!instance || loading || !findingsOverlayData?.length) return;
      try {
        type OverlayService = {
          remove: (opts: { type: string }) => void;
          add: (
            elementId: string,
            type: string,
            opts: {
              position: { bottom: number; right: number };
              html: HTMLElement;
            },
          ) => void;
        };
        const overlays = instance.get("overlays") as OverlayService;
        overlays.remove({ type: "finding-badge" });
        for (const item of findingsOverlayData) {
          if (item.openCount === 0) continue;
          const color =
            item.criticalCount > 0
              ? "bg-red-600 text-white border-red-700"
              : "bg-amber-200 text-amber-900 border-amber-300";
          const html = document.createElement("div");
          html.className = `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold shadow-sm cursor-pointer ${color}`;
          html.textContent = `⚠ ${item.openCount}`;
          html.style.transform = "translate(50%, 50%)";
          overlays.add(item.bpmnElementId, "finding-badge", {
            position: { bottom: -14, right: -14 },
            html,
          });
        }
      } catch {
        /* */
      }
    }, [findingsOverlayData, loading]);

    // Imperative handle for parent components
    useImperativeHandle(ref, () => {
      type CommandStack = {
        undo: () => void;
        redo: () => void;
        canUndo: () => boolean;
        canRedo: () => boolean;
      };

      return {
        saveXml: async () => {
          const instance = modelerRef.current;
          if (!instance) return "";
          const { xml } = await instance.saveXML({ format: true });
          return xml ?? "";
        },
        saveSvg: async () => {
          const instance = modelerRef.current;
          if (!instance) return "";
          const { svg } = await instance.saveSVG();
          return svg ?? "";
        },
        getModeler: () => modelerRef.current,
        undo: () => {
          const instance = modelerRef.current;
          if (!instance) return;
          try {
            const cs = instance.get("commandStack") as CommandStack;
            cs.undo();
          } catch {
            // Command stack may be empty
          }
        },
        redo: () => {
          const instance = modelerRef.current;
          if (!instance) return;
          try {
            const cs = instance.get("commandStack") as CommandStack;
            cs.redo();
          } catch {
            // Command stack may be empty
          }
        },
        canUndo: () => {
          const instance = modelerRef.current;
          if (!instance) return false;
          try {
            const cs = instance.get("commandStack") as CommandStack;
            return cs.canUndo();
          } catch {
            return false;
          }
        },
        canRedo: () => {
          const instance = modelerRef.current;
          if (!instance) return false;
          try {
            const cs = instance.get("commandStack") as CommandStack;
            return cs.canRedo();
          } catch {
            return false;
          }
        },
      };
    }, [loading]);

    if (error) {
      return (
        <div className="flex items-center justify-center h-96 text-red-500 text-sm">
          {error}
        </div>
      );
    }

    return (
      <div className={`relative ${className ?? ""}`}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}
        <div ref={containerRef} className="h-full w-full min-h-[500px]" />
      </div>
    );
  },
);
