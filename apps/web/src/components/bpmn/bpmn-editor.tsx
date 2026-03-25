"use client";

import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import "./bpmn-editor.css";

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
          }) as unknown as BpmnInstance & { __keyHandler?: (e: KeyboardEvent) => void };

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
            on: (event: string, callback: (e: { element: BpmnElement | null }) => void) => void;
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
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
            opts: { position: { top: number; right: number }; html: HTMLElement },
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
          html.innerHTML = `<span>${item.riskCount}</span><span>&middot;</span><span>${item.highestScore}</span>`;
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

    // Imperative handle for parent components
    useImperativeHandle(
      ref,
      () => {
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
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [loading],
    );

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
