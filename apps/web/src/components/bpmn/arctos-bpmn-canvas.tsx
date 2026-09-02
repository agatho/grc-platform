"use client";

/**
 * ARCTOS-Pfad: dieselbe Prop-Oberfläche, innen `@grc/bpmn`.
 *
 * Das ist der Adapter aus Plan §5.4 („Fassade"): eine Komponente, die sich für
 * die aufrufenden Seiten **nicht** von der bisherigen unterscheidet, intern
 * aber `diagram-js` (MIT) und `bpmn-moddle` (MIT) statt `bpmn-js` benutzt.
 * Keine Aufrufstelle musste dafür geändert werden — der Nachweis dafür ist,
 * dass `processes/[id]/page.tsx` und `my-processes/[id]/page.tsx` unverändert
 * sind.
 *
 * Warum das so schmal ausfällt: die Bestandsaufnahme (§4.1) hat gemessen, dass
 * ARCTOS von `bpmn-js` genau fünf `diagram-js`-Dienste und vier
 * Instanzmethoden benutzt. Vier der fünf Dienste — `canvas`,
 * `elementRegistry`, `eventBus`, `overlays` — sind unverändert `diagram-js`
 * und laufen 1:1 weiter; nur die Klasse darüber ist eine andere. Die 230 Zeilen
 * Overlay-Logik der fünf Badge-Kanäle sind deshalb wörtlich dieselben.
 *
 * **Der Bearbeitungsmodus ist frei.** `BpmnCanvas` registriert im Modus `edit`
 * die Modellierungsschicht (`src/modeling`) und die Bedienschicht
 * (`src/editor`) mit Palette, Kontextmenü, Direktbeschriftung, Stützpunkten,
 * Zwischenablage und vollständiger Tastaturbedienung. Der Adapter reicht
 * `undo`/`redo`/`canUndo`/`canRedo` an den Kommandostapel durch, statt `false`
 * vorzutäuschen, und `saveXml()` schreibt nach einer Bearbeitung aus dem
 * Modell.
 *
 * **Zusicherung Z-D bleibt davon unberührt:** Solange kein Kommando gelaufen
 * ist, gibt `saveXml()` den Eingabetext byteweise unverändert zurück. Die
 * Entscheidung darüber trifft der Kommandostapel in `BpmnCanvas`, nicht diese
 * Datei — eine lesende Fläche speichert damit weiterhin bitgleich.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
// Das Aussehen der eigenen Fläche. Es kommt **nicht** aus
// `bpmn-editor.css` — die importiert `bpmn-js/dist/assets/`, also genau die
// Abhängigkeit, die dieser Pfad ablöst. Siehe den Kopf der Datei.
import "./arctos-bpmn.css";
import { useTranslations } from "next-intl";
import {
  BpmnTextAlternative,
  makeInteractiveOverlay,
  readModelElements,
  type BpmnA11yElement,
} from "./bpmn-a11y";
import type {
  BpmnEditorProps,
  BpmnEditorRef,
  CallActivityOverlayData,
  ControlCoverageOverlayData,
  FindingsOverlayData,
  LodOverlayData,
  RiskOverlayData,
} from "./bpmn-canvas-types";
// Die geteilte moddle-Registry der Anwendung — dieselbe, die
// `bpmn-arctos-parse.ts`/`-write.ts` serverseitig benutzen und dieselbe
// `arctos-moddle-extension.json`, die heute als `moddleExtensions` an den
// bpmn-js-Modeler geht. Damit liest und schreibt der ARCTOS-Pfad
// `arctos:grcMetadata` **exakt** wie der Legacy-Pfad; der Seiteneffektpfad
// über `rehydrateFromBpmnXml()` sieht keinen Unterschied.
import { arctosModdle } from "@/lib/bpmn-arctos-parse";
// Der Unterpfad `"./grc"` steht seit dieser Stufe in
// `packages/bpmn/package.json#exports` — davor war das der Grund, weshalb der
// Aufruf von `decorateGrc` fehlte (STUFE2-B2-EINBINDUNG.md §5.1).
import type { Scene } from "@grc/bpmn/draw";
import type { GrcOverlayData, GrcViewId } from "@grc/bpmn/grc";

/**
 * Die Modi, die der ARCTOS-Pfad heute bedient.
 *
 * Bewusst eine Konstante und keine Vermutung an der Aufrufstelle. `"edit"`
 * steht hier, seit die Bearbeitungsmodule stehen; die Weiche in
 * `bpmn-editor.tsx` liest allein diese Liste.
 */
const SUPPORTED_MODES: ReadonlySet<string> = new Set([
  "read",
  "review",
  "edit",
]);

export function supportsMode(mode: "read" | "review" | "edit"): boolean {
  return SUPPORTED_MODES.has(mode);
}

/** Minimalvertrag der `diagram-js`-Dienste, die dieser Adapter anfasst. */
interface OverlayService {
  add: (
    elementId: string,
    type: string,
    opts: {
      position: Record<string, number>;
      html: HTMLElement;
    },
  ) => string;
  remove: (opts: { type: string }) => void;
}

interface RegistryService {
  getAll: () => Array<{
    id: string;
    type: string;
    businessObject?: { name?: string };
  }>;
}

/** Ausschnitt von `BpmnCanvas`, den dieser Adapter benutzt. */
interface CanvasHandle {
  importXml: (xml: string) => Promise<{ warnings: readonly string[] }>;
  exportXml: () => Promise<string>;
  exportSvg: (title?: string) => string;
  getScene: () => Scene | null;
  get: <T>(name: string) => T;
  on: (
    event: string,
    listener: (e: { element?: { id?: string } }) => void,
  ) => void;
  destroy: () => void;
  zoom: (scale?: number | "fit-viewport") => number;
  scroll: (delta: { dx: number; dy: number }) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export interface ArctosBpmnCanvasProps extends Omit<
  BpmnEditorProps,
  "initialXml" | "engine"
> {
  xml: string;
  mode?: "read" | "review" | "edit";
  minHeight?: number;
  /**
   * Der fertig berechnete GRC-Datensatz (`STUFE2-A2-GRC.md` §4.1). Liegt er
   * vor, zeichnet `decorateGrc` die GRC-Schicht **ins SVG** — mitskalierend
   * und im Export enthalten — und die fünf HTML-Badge-Kanäle bleiben aus,
   * damit dieselbe Aussage nicht zweimal am Bild steht.
   *
   * `bpmn-grc-bridge.ts` baut den Datensatz aus den heutigen Routen zusammen;
   * die Aufrufstellen reichen ihn noch nicht durch, weil dafür der Endpunkt
   * aus Plan §3.3.6 fehlt. Ohne ihn läuft alles wie bisher.
   */
  grcOverlayData?: GrcOverlayData;
  /** Sicht auf die GRC-Schicht (Vorgabe: `risk-control`). */
  grcView?: GrcViewId;
  /** Imperative Fläche — dieselbe wie beim Legacy-Editor. */
  handleRef?: React.RefObject<BpmnEditorRef | null>;
}

export function ArctosBpmnCanvas({
  xml,
  mode = "read",
  readOnly: _readOnly,
  onElementClick,
  onNavigateToProcess,
  riskOverlayData,
  controlCoverageOverlayData,
  lodOverlayData,
  findingsOverlayData,
  callActivityOverlayData,
  grcOverlayData,
  grcView,
  className,
  minHeight = 400,
  handleRef,
}: ArctosBpmnCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<CanvasHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelElements, setModelElements] = useState<BpmnA11yElement[]>([]);
  const t = useTranslations("bpmn");
  const describedById = useId();

  const onElementClickRef = useRef(onElementClick);
  onElementClickRef.current = onElementClick;
  const onNavigateToProcessRef = useRef(onNavigateToProcess);
  onNavigateToProcessRef.current = onNavigateToProcess;
  const callTargetsRef = useRef<Map<string, string>>(new Map());

  // -------------------------------------------------------------------------
  // Aufbau. Wie im Legacy-Pfad dynamisch geladen: die Engine ist DOM-gebunden
  // und darf nicht in den Serverbaum geraten (`ssr:false` an den Aufrufstellen
  // gilt unverändert).
  // -------------------------------------------------------------------------
  useEffect(() => {
    let destroyed = false;

    async function init() {
      const container = containerRef.current;
      if (!container || !xml) {
        setReady(true);
        return;
      }
      try {
        const engineModule = await import("@grc/bpmn/viewer");
        if (destroyed) return;

        const canvas = new engineModule.BpmnCanvas({
          container,
          mode,
          // Im Bearbeitungsmodus zeigt die Fläche ihre Bedienelemente; im
          // Lesemodus folgt `read` hier aus dem Kontext, nicht aus einem
          // fehlenden Recht — dort wäre eine dauerhaft graue Werkzeugleiste
          // falsch (Plan §2.4, zweite Achse).
          chrome: mode === "edit" ? "full" : "minimal",
          // Die Modellschicht ausdrücklich mitgeben: `BpmnCanvas` würde sie
          // sonst über einen dynamischen Modulpfad nachladen, der sich mit
          // keinem Bündler auflösen lässt. Und sie kommt hier ohnehin aus der
          // Anwendung, damit es genau **eine** moddle-Registry gibt.
          importXml: async (source: string) => {
            const { rootElement, warnings } =
              await arctosModdle.fromXML(source);
            return {
              definitions: rootElement as never,
              warnings: warnings as readonly unknown[],
            };
          },
          // Symmetrisch zum Import: **eine** moddle-Registry für Lesen und
          // Schreiben. Sonst entstünde beim Speichern eine zweite Meinung
          // darüber, wie `arctos:grcMetadata` serialisiert wird.
          exportXml: async (definitions: unknown) => {
            const { xml: written } = await arctosModdle.toXML(
              definitions as never,
              { format: true },
            );
            return written;
          },
        }) as unknown as CanvasHandle;

        if (destroyed) {
          canvas.destroy();
          return;
        }
        canvasRef.current = canvas;

        await canvas.importXml(xml);
        if (destroyed) return;

        // Der zugängliche Name kommt weiterhin aus den Übersetzungen, damit
        // der Wechsel der Engine an der Vorlesereihenfolge nichts ändert.
        // `role`, `aria-roledescription` und `tabindex` setzt die
        // a11y-Schicht der Engine selbst (S14-10).
        container.setAttribute("aria-label", t("a11y.canvasLabel"));
        container.setAttribute("aria-describedby", describedById);

        // `readModelElements` erwartet die bpmn-js-Zusicherung, dass jedes
        // Element einen `type` trägt. `diagram-js` selbst kennt zusätzlich das
        // implizite Wurzelelement ohne Typ — das muss hier weg, sonst
        // stolpert die Textalternative über `undefined.replace(...)`.
        const registry = canvas.get<RegistryService>("elementRegistry");
        setModelElements(
          readModelElements({
            getAll: () =>
              registry
                .getAll()
                .filter(
                  (element) =>
                    typeof element.type === "string" && element.type !== "",
                ),
          }),
        );

        canvas.on("element.click", (event) => {
          const element = event.element as
            | { id?: string; type?: string; businessObject?: { name?: string } }
            | undefined;
          if (!element?.id || !element.type) return;
          if (
            element.type === "bpmn:Process" ||
            element.type === "bpmn:Collaboration"
          ) {
            onElementClickRef.current?.(element.id, element.type, null);
            return;
          }
          onElementClickRef.current?.(
            element.id,
            element.type,
            element.businessObject?.name ?? null,
          );
        });

        canvas.on("element.dblclick", (event) => {
          const id = event.element?.id;
          if (!id) return;
          const target = callTargetsRef.current.get(id);
          if (target) onNavigateToProcessRef.current?.(target);
        });

        // `element.activate` ist das Tastatur-Gegenstück (Enter auf einem
        // Element); der Legacy-Pfad hat dafür keine Entsprechung.
        canvas.on("element.activate", (event) => {
          const element = event.element as
            | { id?: string; type?: string; businessObject?: { name?: string } }
            | undefined;
          if (!element?.id || !element.type) return;
          onElementClickRef.current?.(
            element.id,
            element.type,
            element.businessObject?.name ?? null,
          );
        });

        setReady(true);
      } catch (err) {
        if (destroyed) return;
        setError(
          err instanceof Error ? err.message : "BPMN-Diagramm nicht ladbar",
        );
        setReady(true);
      }
    }

    void init();

    return () => {
      destroyed = true;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.destroy();
        canvasRef.current = null;
      }
    };
    // Wie im Legacy-Viewer: Neuaufbau, wenn sich das XML ändert.
  }, [xml, mode]);

  // -------------------------------------------------------------------------
  // Die GRC-Schicht (`src/grc`, 23 Layer) — ins SVG gezeichnet, nicht als
  // HTML darübergelegt. Das ist der Unterschied, den `decorate.ts` in seinem
  // Kopf begründet: die Dekoration skaliert mit, und `saveSvg()` enthält sie.
  //
  // Sie schließt die fünf HTML-Badge-Kanäle aus: dieselbe Aussage zweimal am
  // selben Element wäre kein Mehrwert, sondern ein Widerspruch in spe.
  // -------------------------------------------------------------------------
  const decorated = grcOverlayData !== undefined;
  useGrcDecoration(canvasRef, ready, grcOverlayData, grcView, (elementId) => {
    onElementClickRef.current?.(elementId, "", null);
  });

  // -------------------------------------------------------------------------
  // Die fünf Badge-Kanäle. Wörtlich dieselbe `overlays`-API wie heute — das
  // ist der Teil, von dem die Bestandsaufnahme sagt, er laufe unverändert
  // weiter (§4.2). Übernommen sind auch die Pixelversätze; sie hängen an der
  // Formgeometrie, und die ist in beiden Engines die BPMN-Standardgröße.
  // -------------------------------------------------------------------------
  useOverlayChannel(
    canvasRef,
    ready,
    "risk-badge",
    decorated ? undefined : riskOverlayData,
    (item) => {
      const color =
        item.highestScore > 15
          ? "bg-red-100 text-red-800 border-red-300"
          : item.highestScore > 8
            ? "bg-yellow-100 text-yellow-800 border-yellow-300"
            : "bg-green-100 text-green-800 border-green-300";
      const html = badge(color);
      html.textContent = `${item.riskCount} · ${item.highestScore}`;
      html.style.transform = "translate(50%, -50%)";
      makeInteractiveOverlay(html, {
        label: t("a11y.riskBadge", {
          count: item.riskCount,
          score: item.highestScore,
        }),
      });
      return { html, position: { top: -14, right: -14 } };
    },
  );

  useOverlayChannel(
    canvasRef,
    ready,
    "control-badge",
    decorated ? undefined : controlCoverageOverlayData,
    (item: ControlCoverageOverlayData) => {
      const color =
        item.controlCount === 0
          ? "bg-gray-200 text-gray-600 border-gray-300"
          : item.effectiveCount === item.controlCount
            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
            : item.effectiveCount > 0
              ? "bg-amber-100 text-amber-800 border-amber-300"
              : "bg-red-100 text-red-800 border-red-300";
      const html = badge(color);
      html.textContent = `\u{1F6E1} ${item.effectiveCount}/${item.controlCount}`;
      html.style.transform = "translate(-50%, 0)";
      makeInteractiveOverlay(html, {
        label: t("a11y.controlBadge", {
          effective: item.effectiveCount,
          total: item.controlCount,
        }),
      });
      return { html, position: { top: -14, left: -14 } };
    },
  );

  useOverlayChannel(
    canvasRef,
    ready,
    "lod-stripe",
    decorated ? undefined : lodOverlayData,
    (item: LodOverlayData) => {
      if (!item.lineOfDefense) return null;
      const colorMap: Record<string, string> = {
        first: "bg-blue-500",
        second: "bg-purple-500",
        third: "bg-amber-500",
        oversight: "bg-slate-500",
      };
      const html = document.createElement("div");
      html.className = `${colorMap[item.lineOfDefense] ?? "bg-gray-400"} rounded-l`;
      html.style.width = "4px";
      html.style.height = "60px";
      html.title = `LoD: ${item.lineOfDefense}`;
      makeInteractiveOverlay(html, {
        label: t("a11y.lodStripe", { lod: item.lineOfDefense }),
      });
      return { html, position: { top: 0, left: -6 } };
    },
  );

  useOverlayChannel(
    canvasRef,
    ready,
    "finding-badge",
    decorated ? undefined : findingsOverlayData,
    (item: FindingsOverlayData) => {
      if (item.openCount === 0) return null;
      const color =
        item.criticalCount > 0
          ? "bg-red-600 text-white border-red-700"
          : "bg-amber-200 text-amber-900 border-amber-300";
      const html = badge(color);
      html.textContent = `⚠ ${item.openCount}`;
      html.style.transform = "translate(50%, 50%)";
      makeInteractiveOverlay(html, {
        label: t("a11y.findingBadge", {
          open: item.openCount,
          critical: item.criticalCount,
        }),
      });
      return { html, position: { bottom: -14, right: -14 } };
    },
  );

  // Drill-Down: die Zuordnung bpmnElementId → Zielprozess wird immer gepflegt,
  // auch bevor die Fläche steht — der Doppelklick-Handler liest sie aus der Ref.
  useEffect(() => {
    callTargetsRef.current = new Map(
      (callActivityOverlayData ?? []).map((c) => [
        c.bpmnElementId,
        c.calledProcessId,
      ]),
    );
  }, [callActivityOverlayData]);

  useOverlayChannel(
    canvasRef,
    ready,
    "call-activity-badge",
    decorated ? undefined : callActivityOverlayData,
    (item: CallActivityOverlayData) => {
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
      makeInteractiveOverlay(html, {
        label: t("a11y.drillDown", {
          name: item.calledProcessName ?? item.calledProcessId,
        }),
        onActivate: () =>
          onNavigateToProcessRef.current?.(item.calledProcessId),
      });
      return { html, position: { bottom: -14, left: -14 } };
    },
  );

  // -------------------------------------------------------------------------
  // Imperative Fläche — identisch zum Legacy-Editor.
  // -------------------------------------------------------------------------
  const saveXml = useCallback(async (): Promise<string> => {
    // Zusicherung Z-D (Plan §5.1, „read-preserve-write") gilt weiter — aber
    // sie gilt, **solange nichts bearbeitet wurde**, und nicht mehr, weil der
    // Adapter nichts anderes könnte. `BpmnCanvas.exportXml()` entscheidet das
    // am Kommandostapel: unbearbeitet → der Eingabetext, byteweise identisch;
    // bearbeitet → serialisiert aus dem Modell, sonst ginge die Bearbeitung
    // beim Speichern verloren.
    const canvas = canvasRef.current;
    if (!canvas) return xml;
    try {
      return await canvas.exportXml();
    } catch {
      // Ein gescheiterter Export darf nicht als leere Datei durchgehen: die
      // Aufrufstelle speichert das Ergebnis. Der Eingabetext ist der einzige
      // Wert, von dem sicher ist, dass er ein gültiges Diagramm beschreibt.
      return xml;
    }
  }, [xml]);

  const saveSvg = useCallback(async (): Promise<string> => {
    const canvas = canvasRef.current;
    if (!canvas) return "";
    try {
      return canvas.exportSvg();
    } catch {
      return "";
    }
  }, []);

  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      saveXml,
      saveSvg,
      getModeler: () => canvasRef.current,
      // Der Kommandostapel gibt es nur im Modus `edit`; im Lesemodus liefern
      // diese vier weiterhin `false`/nichts, weil `BpmnCanvas` ihn dort gar
      // nicht registriert. Die Werkzeugleiste zeigt die Schaltflächen dann
      // deaktiviert — was der Wahrheit entspricht.
      undo: () => canvasRef.current?.undo(),
      redo: () => canvasRef.current?.redo(),
      canUndo: () => canvasRef.current?.canUndo() ?? false,
      canRedo: () => canvasRef.current?.canRedo() ?? false,
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef, saveXml, saveSvg]);

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
        role="alert"
        className={`flex items-center justify-center text-red-600 text-sm ${className ?? ""}`}
        style={{ minHeight }}
      >
        {error}
      </div>
    );
  }

  return (
    <div
      className={`relative ${className ?? ""}`}
      style={{ minHeight }}
      data-bpmn-engine="arctos"
    >
      {!ready && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-white/80"
          role="status"
          aria-live="polite"
          aria-label={t("a11y.loading")}
        >
          <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}
      <div
        ref={containerRef}
        className="h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        style={{ minHeight }}
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

/** Gemeinsame Hülle der Textbadges — wörtlich die Klassenliste von heute. */
function badge(color: string): HTMLElement {
  const html = document.createElement("div");
  html.className = `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold shadow-sm ${color}`;
  return html;
}

/**
 * Die GRC-Dekoration.
 *
 * Der eine Aufruf, den `STUFE2-B2-EINBINDUNG.md` §5.1 als offenen Punkt nennt:
 * `decorateGrc({ root, model: buildOverlayModel(scene, data, { view }) })`.
 * Er stand dort nicht, weil `packages/bpmn/package.json#exports` keinen
 * Eintrag `"./grc"` hatte und der Wurzelimport aus `apps/web` nicht
 * typprüfbar war. Beides ist erledigt; hier steht der Aufruf.
 *
 * Geladen wird das Modul dynamisch — wie die Engine selbst: eine Fläche ohne
 * GRC-Daten soll die 23 Layer nicht mitziehen.
 */
function useGrcDecoration(
  canvasRef: React.RefObject<CanvasHandle | null>,
  ready: boolean,
  data: GrcOverlayData | undefined,
  viewId: GrcViewId | undefined,
  onSelectElement: (elementId: string) => void,
): void {
  const onSelectRef = useRef(onSelectElement);
  onSelectRef.current = onSelectElement;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready || !data) return;

    let destroyed = false;
    let decoration: { destroy: () => void } | null = null;

    void (async () => {
      try {
        const grc = await import("@grc/bpmn/grc");
        if (destroyed) return;
        const scene = canvas.getScene();
        if (!scene) return;
        const container = canvas.get<{ getContainer: () => HTMLElement }>(
          "canvas",
        );
        // Vorgabesicht: „Risiko & Kontrolle" — die Sicht, die den heutigen fünf
        // Badge-Kanälen inhaltlich am nächsten kommt.
        const view = grc.viewById(viewId ?? "risk-control");
        const model = grc.buildOverlayModel(scene, data, { view });
        decoration = grc.decorateGrc({
          root: container.getContainer(),
          model,
          // Nicht jede Interaktion nennt ein Element (Kanten nennen eine
          // Kante). Nur die, die es tun, werden weitergereicht.
          onInteract: (interaction) => {
            if ("elementId" in interaction) {
              onSelectRef.current(interaction.elementId);
            }
          },
        });
      } catch {
        // Eine fehlgeschlagene Dekoration darf das Diagramm nicht mitnehmen:
        // ohne sie bleibt ein lesbares Bild stehen, mit einem Abbruch nicht.
      }
    })();

    return () => {
      destroyed = true;
      decoration?.destroy();
    };
  }, [canvasRef, ready, data, viewId]);
}

/**
 * Ein Badge-Kanal.
 *
 * Im Legacy-Pfad steht diese Schleife fünfmal fast wörtlich gleich (je ~40
 * Zeilen). Hier einmal — sonst ändert sich nichts am Verhalten: `remove` nach
 * Typ, dann `add` je Element, Fehler beim Anhängen an ein fehlendes Element
 * werden geschluckt wie bisher.
 */
function useOverlayChannel<T extends { bpmnElementId: string }>(
  canvasRef: React.RefObject<CanvasHandle | null>,
  ready: boolean,
  type: string,
  data: readonly T[] | undefined,
  build: (
    item: T,
  ) => { html: HTMLElement; position: Record<string, number> } | null,
): void {
  const buildRef = useRef(build);
  buildRef.current = build;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    let overlays: OverlayService;
    try {
      overlays = canvas.get<OverlayService>("overlays");
    } catch {
      return;
    }
    try {
      overlays.remove({ type });
    } catch {
      /* noch keine Overlays dieses Typs */
    }
    for (const item of data ?? []) {
      try {
        const built = buildRef.current(item);
        if (!built) continue;
        overlays.add(item.bpmnElementId, type, {
          position: built.position,
          html: built.html,
        });
      } catch {
        // Element existiert im Diagramm nicht — wie bisher stillschweigend
        // übergangen: Overlay-Daten und Diagramm können auseinanderlaufen.
      }
    }
  }, [canvasRef, ready, type, data]);
}

export type { RiskOverlayData };
