"use client";

/**
 * Legacy-Pfad: der bisherige Editor auf `bpmn-js`.
 *
 * Inhaltlich unverändert gegenüber dem Stand vor der Umstellung — bis auf drei
 * Punkte, die der Parallelbetrieb erzwingt:
 *
 * 1. Die Typen stehen jetzt in `bpmn-canvas-types.ts`, damit sie ohne eine der
 *    beiden Engines ladbar sind.
 * 2. Der Export heißt `BpmnEditorLegacy`; `bpmn-editor.tsx` ist die Weiche.
 * 3. Das unbenutzte `engine`-Prop wird geschluckt, damit die Weiche dieselben
 *    Props an beide Implementierungen reichen kann.
 *
 * Diese Datei bleibt so lange stehen, bis die Abschaltkriterien aus Plan §5.6
 * erfüllt sind. Sie ist der Rückfallweg (§5.7) — nicht Altlast, sondern das
 * Sicherheitsnetz, ohne das die Umstellung nicht verantwortbar wäre.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
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
import type { BpmnEditorProps, BpmnEditorRef } from "./bpmn-canvas-types";

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
// Component
// ---------------------------------------------------------------------------

export const BpmnEditorLegacy = forwardRef<BpmnEditorRef, BpmnEditorProps>(
  function BpmnEditorLegacy(
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
      callActivityOverlayData,
      onNavigateToProcess,
      className,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const modelerRef = useRef<BpmnInstance | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // [WP12 · S14-10] Backing data for the tabular alternative view.
    const [modelElements, setModelElements] = useState<BpmnA11yElement[]>([]);
    const t = useTranslations("bpmn");
    const describedById = useId();

    // Store latest callbacks in refs to avoid re-init
    const onSaveRef = useRef(onSave);
    onSaveRef.current = onSave;
    const onChangedRef = useRef(onChanged);
    onChangedRef.current = onChanged;
    const onElementClickRef = useRef(onElementClick);
    onElementClickRef.current = onElementClick;
    const onNavigateToProcessRef = useRef(onNavigateToProcess);
    onNavigateToProcessRef.current = onNavigateToProcess;
    // bpmnElementId → calledProcessId for the dblclick drill-down
    const callTargetsRef = useRef<Map<string, string>>(new Map());

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

          // [WP12 · S14-10] Snapshot the model for the text alternative.
          const elementRegistry = instance.get("elementRegistry") as Parameters<
            typeof readModelElements
          >[0];
          if (!destroyed) setModelElements(readModelElements(elementRegistry));

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

          // Call-Activity Drill-Down: in view mode a double-click on an
          // element with a linked child process navigates into it. In edit
          // mode dblclick keeps its bpmn-js default (label editing) — the
          // overlay badge is the navigation affordance there.
          if (readOnly) {
            eventBus2.on("element.dblclick", (e) => {
              const element = e.element;
              if (!element) return;
              const target = callTargetsRef.current.get(element.id);
              if (target) onNavigateToProcessRef.current?.(target);
            });
          }

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
          html.className = `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold shadow-sm ${color}`;
          html.textContent = `${item.riskCount} · ${item.highestScore}`;
          html.style.transform = "translate(50%, -50%)";
          // [WP12 · S14-10] Informational badge: named, not falsely operable.
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
          html.className = `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold shadow-sm ${color}`;
          html.textContent = `\u{1F6E1} ${item.effectiveCount}/${item.controlCount}`;
          html.style.transform = "translate(-50%, 0)";
          // [WP12 · S14-10] The shield glyph alone announces as "shield"; the
          // label carries what the badge actually means.
          makeInteractiveOverlay(html, {
            label: t("a11y.controlBadge", {
              effective: item.effectiveCount,
              total: item.controlCount,
            }),
          });
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
          // [WP12 · S14-10] A 4px colour stripe conveys the line of defence by
          // colour alone; `title` is not reliably announced. Named explicitly.
          html.title = `LoD: ${item.lineOfDefense}`;
          makeInteractiveOverlay(html, {
            label: t("a11y.lodStripe", { lod: item.lineOfDefense }),
          });
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
          html.className = `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold shadow-sm ${color}`;
          html.textContent = `⚠ ${item.openCount}`;
          html.style.transform = "translate(50%, 50%)";
          // [WP12 · S14-10] Informational badge.
          makeInteractiveOverlay(html, {
            label: t("a11y.findingBadge", {
              open: item.openCount,
              critical: item.criticalCount,
            }),
          });
          overlays.add(item.bpmnElementId, "finding-badge", {
            position: { bottom: -14, right: -14 },
            html,
          });
        }
      } catch {
        /* */
      }
    }, [findingsOverlayData, loading]);

    // Call-Activity Drill-Down: badge on elements with a linked child
    // process; clicking the badge navigates to the child's detail page.
    useEffect(() => {
      callTargetsRef.current = new Map(
        (callActivityOverlayData ?? []).map((c) => [
          c.bpmnElementId,
          c.calledProcessId,
        ]),
      );
      const instance = modelerRef.current;
      if (!instance || loading) return;
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
        const overlays = instance.get("overlays") as OverlayService;
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
          // [WP12 · S14-10] Was click-only: focusable, named and
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
        /* element may be missing */
      }
    }, [callActivityOverlayData, loading]);

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

    // [WP12 · S14-10] Arrow keys pan, +/- zoom, 0 fits. bpmn-js already binds
    // its own editor shortcuts via `keyboard: { bindTo: document }`; these are
    // bound to the canvas element so they only fire while it has focus.
    const getCanvas = useCallback((): BpmnCanvasService | null => {
      const instance = modelerRef.current;
      if (!instance) return null;
      return instance.get("canvas") as BpmnCanvasService;
    }, []);
    useBpmnKeyboardNavigation(containerRef, getCanvas);

    if (error) {
      return (
        <div
          role="alert"
          className="flex items-center justify-center h-96 text-red-600 text-sm"
        >
          {error}
        </div>
      );
    }

    return (
      <div className={`relative ${className ?? ""}`}>
        {loading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-white/80"
            role="status"
            aria-live="polite"
            aria-label={t("a11y.loading")}
          >
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}
        {/* [WP12 · S14-10] Was a bare `<div ref={containerRef}>`: unfocusable,
            unnamed, and wrapping an SVG with no text alternative. */}
        <div
          ref={containerRef}
          className="h-full w-full min-h-[500px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          {...canvasA11yProps({
            label: readOnly ? t("a11y.canvasLabel") : t("a11y.editorLabel"),
            describedById,
            readOnly,
          })}
        />
        <BpmnTextAlternative
          id={describedById}
          elements={modelElements}
          diagramLabel={
            readOnly ? t("a11y.canvasLabel") : t("a11y.editorLabel")
          }
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
  },
);
