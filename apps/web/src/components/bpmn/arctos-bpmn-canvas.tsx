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

/**
 * [ARCTOS-FULL-2026-08-31 · OP-028] Vorgabe der zweiten Achse.
 *
 * Sie hängt nicht am Modus allein, sondern daran, **woher** der Lesemodus
 * kommt — genau so, wie `packages/bpmn/src/editor/modules.ts` es begründet:
 *
 * - `edit` → `full`. Bearbeiten ohne Bedienelemente wäre sinnlos.
 * - `read`/`review` → `full`. Diese Komponente wird aus `bpmn-editor.tsx`
 *   aufgerufen, und dort folgt `readOnly` aus `!canEdit` — aus einem
 *   **fehlenden Recht**. Eine ausgegraute Palette mit Begründung ist dort
 *   ehrlicher als eine Oberfläche, die so tut, als gäbe es die Funktion nicht.
 *
 * Wo `read` aus dem **Kontext** folgt — Mitarbeiterportal, Versionsdialog —,
 * setzt `bpmn-viewer.tsx` ausdrücklich `chrome="minimal"`. Dort will niemand
 * eine dauerhaft graue Werkzeugleiste sehen.
 */
export function defaultChromeFor(
  mode: "read" | "review" | "edit",
): "full" | "minimal" {
  void mode;
  return "full";
}

/**
 * [ARCTOS-FULL-2026-08-31 · OP-029] Der Arbeitsstand, der einen Moduswechsel
 * überlebt.
 *
 * **Der Befund, nachgemessen.** Der Aufbaueffekt hing an `[xml, mode]`: ein
 * Wechsel von `read` nach `edit` zerstörte die Instanz und baute sie neu auf.
 * Danach stand die Ansicht wieder auf `fit-viewport`, die Auswahl war leer und
 * die GRC-Dekoration weg. Wer ein Detail eines grossen Diagramms
 * herangezoomt hatte und auf „Bearbeiten" klickte, suchte es anschliessend
 * wieder — bei `synth-large-flat-process` (60 Knoten) ist das keine
 * Kleinigkeit.
 *
 * **Warum der Neuaufbau bleibt.** Die Modulliste eines `didi`-Containers steht
 * beim Bootstrap fest; `edit` registriert `modeling`, `read` nicht. Einen
 * laufenden Container umzuhängen hiesse, die Modullogik ein zweites Mal zu
 * bauen — und sie wäre die Stelle, an der Lesen und Bearbeiten wieder
 * auseinanderlaufen. Erhalten wird deshalb der **Zustand**, nicht die Instanz.
 */
interface CanvasSnapshot {
  /** Das XML, zu dem dieser Stand gehört. Passt es nicht, wird nichts gesetzt. */
  readonly xml: string;
  readonly viewbox: { x: number; y: number; width: number; height: number };
  readonly zoom: number;
  readonly selection: readonly string[];
  readonly planeIndex: number;
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
  // [ARCTOS-FULL-2026-08-31 · OP-018/OP-029]
  select: (elementId: string | null) => void;
  getPlaneIndex: () => number;
  showPlane: (index: number) => boolean;
  getPlanes: () => ReadonlyArray<{ index: number }>;
  getPlanePath: () => ReadonlyArray<{
    index: number;
    rootId?: string | undefined;
    rootName?: string | undefined;
    rootType?: string | undefined;
  }>;
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
  /**
   * [ARCTOS-FULL-2026-08-31 · OP-028] Die zweite Achse aus Plan §2.4.
   *
   * `full` zeigt die Bedienelemente auch dann, wenn nicht bearbeitet werden
   * darf — deaktiviert und mit Begründung. `minimal` lässt sie weg.
   *
   * Vorgabe ist **nicht** „minimal, ausser im Editor": sie hängt daran, woher
   * das `read` kommt. Siehe {@link defaultChromeFor}.
   */
  chrome?: "full" | "minimal";
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
  chrome,
  className,
  minHeight = 400,
  handleRef,
}: ArctosBpmnCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<CanvasHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelElements, setModelElements] = useState<BpmnA11yElement[]>([]);
  /**
   * [ARCTOS-FULL-2026-08-31 · OP-018] Die Brotkrume der Ebenen. Leer bei einem
   * Dokument mit nur einer `BPMNPlane` — dann wird auch nichts gezeigt, statt
   * eine Zeile „Prozess" ohne Bedeutung über jedes Diagramm zu setzen.
   */
  const [planePath, setPlanePath] = useState<
    ReadonlyArray<{ index: number; label: string }>
  >([]);
  /**
   * Wie viele Ebenen das Dokument überhaupt hat. Die Brotkrume hängt an
   * **dieser** Zahl und nicht an der Länge des Pfades: auf der obersten Ebene
   * ist der Pfad einstufig, und genau dort muss der Hinweis stehen, dass es
   * eine Ebene tiefer geht — sonst findet ihn nur, wer schon drin war.
   */
  const [planeCount, setPlaneCount] = useState(0);
  const t = useTranslations("bpmn");
  const describedById = useId();

  const onElementClickRef = useRef(onElementClick);
  onElementClickRef.current = onElementClick;
  const onNavigateToProcessRef = useRef(onNavigateToProcess);
  onNavigateToProcessRef.current = onNavigateToProcess;
  const callTargetsRef = useRef<Map<string, string>>(new Map());
  /**
   * [ARCTOS-FULL-2026-08-31 · OP-029] Der Arbeitsstand über den Moduswechsel
   * hinweg. Eine Ref und kein State: ihn zu setzen darf kein Rendern auslösen,
   * sonst baut sich die Fläche beim Aufräumen selbst noch einmal auf.
   */
  const restoreRef = useRef<CanvasSnapshot | null>(null);

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
          // [ARCTOS-FULL-2026-08-31 · OP-028] Hier stand `mode === "edit" ?
          // "full" : "minimal"` fest verdrahtet. Damit war `chrome: "full"` im
          // Lesemodus zwar in `packages/bpmn` gebaut (`editorChromeModule`,
          // `editorModulesFor`), aber von keiner Einbindung erreichbar: jede
          // lesende Fläche bekam `minimal`, auch die, deren `read` aus einem
          // **fehlenden Recht** folgt. Wer auf `processes/[id]` nicht
          // bearbeiten darf, sah eine Fläche ohne Werkzeuge und erfuhr nicht,
          // dass es sie gibt. Jetzt entscheidet die Aufrufstelle — mit einer
          // Vorgabe, die die Herkunft des `read` berücksichtigt.
          chrome: chrome ?? defaultChromeFor(mode),
          editor: {
            chrome: chrome ?? defaultChromeFor(mode),
            disabledReason: t("chrome.disabledReason"),
          },
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

        // [ARCTOS-FULL-2026-08-31 · OP-018] Die Brotkrume mitführen. Sie kommt
        // aus der Engine und wird nicht in React nachgerechnet — die Ebene ist
        // Zustand der Fläche, und zwei Wahrheiten darüber wären genau der
        // Fehler, den `BpmnCanvas.planeIndex` vermeidet.
        const readPath = (): void => {
          setPlaneCount(canvas.getPlanes().length);
          setPlanePath(
            canvas.getPlanePath().map((plane) => ({
              index: plane.index,
              label:
                plane.rootName ??
                plane.rootId ??
                plane.rootType ??
                t("plane.label"),
            })),
          );
        };
        canvas.on("plane.changed", () => {
          readPath();
        });
        readPath();

        // [ARCTOS-FULL-2026-08-31 · OP-029] Den Arbeitsstand des vorigen
        // Modus wiederherstellen: Ebene zuerst (sie entscheidet, welche
        // Elemente es überhaupt gibt), dann Ansicht, dann Auswahl.
        restoreSnapshot(canvas, restoreRef.current, xml);
        restoreRef.current = null;

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
        // [ARCTOS-FULL-2026-08-31 · OP-029] **Vor** dem Zerstören merken.
        // Danach ist der Container weg und mit ihm Viewbox, Auswahl und
        // Ebene.
        restoreRef.current = takeSnapshot(canvas, xml);
        canvas.destroy();
        canvasRef.current = null;
      }
    };
    // Wie im Legacy-Viewer: Neuaufbau, wenn sich das XML ändert — und beim
    // Moduswechsel, weil die Modulliste eine andere ist. Was dabei erhalten
    // bleibt, regelt `restoreRef` (OP-029).
  }, [xml, mode, chrome]);

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
      {/*
        [ARCTOS-FULL-2026-08-31 · OP-018] Die Ebenen-Brotkrume.
        Sie erscheint nur, wenn das Dokument mehr als eine `BPMNPlane` hat —
        im Korpus trifft das auf eine von 26 Dateien zu. Ein Balken über jedem
        Diagramm, der immer dasselbe Wort zeigt, wäre Ballast.
      */}
      {planeCount > 1 && planePath.length > 0 && (
        <nav
          aria-label={t("plane.breadcrumb")}
          className="mb-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
        >
          {planePath.map((plane, position) => {
            const last = position === planePath.length - 1;
            return (
              <span key={plane.index} className="flex items-center gap-1">
                {position > 0 && <span aria-hidden="true">/</span>}
                {last ? (
                  <span aria-current="step" className="font-semibold">
                    {plane.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="rounded underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    onClick={() => {
                      canvasRef.current?.showPlane(plane.index);
                    }}
                  >
                    {plane.label}
                  </button>
                )}
              </span>
            );
          })}
          <span className="ml-1">{t("plane.openHint")}</span>
        </nav>
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

/**
 * [ARCTOS-FULL-2026-08-31 · OP-029] Den Arbeitsstand einer Fläche festhalten.
 *
 * Jeder Zugriff einzeln abgesichert: Beim Aufräumen kann der Container schon
 * aus dem Dokument sein, und dann wirft `viewbox()`. Ein gescheiterter
 * Schnappschuss darf den Moduswechsel nicht mitreissen — im schlimmsten Fall
 * steht die Ansicht danach wie bisher auf `fit-viewport`.
 */
function takeSnapshot(
  canvas: CanvasHandle,
  xml: string,
): CanvasSnapshot | null {
  try {
    const view = canvas.get<{
      viewbox(): { x: number; y: number; width: number; height: number };
    }>("canvas");
    const selection = canvas.get<{ get(): Array<{ id?: string }> }>(
      "selection",
    );
    return {
      xml,
      viewbox: view.viewbox(),
      zoom: canvas.zoom(),
      selection: selection
        .get()
        .map((element) => element.id)
        .filter((id): id is string => typeof id === "string"),
      planeIndex: canvas.getPlaneIndex(),
    };
  } catch {
    return null;
  }
}

/**
 * Den gemerkten Stand auf eine frisch aufgebaute Fläche legen.
 *
 * `snapshot.xml !== xml` heisst: das Diagramm ist ein anderes. Dann wird
 * nichts gesetzt — eine Viewbox aus einem fremden Dokument zeigte auf leere
 * Fläche, und eine Auswahl aus einem fremden Dokument gäbe es gar nicht.
 */
function restoreSnapshot(
  canvas: CanvasHandle,
  snapshot: CanvasSnapshot | null,
  xml: string,
): void {
  if (!snapshot || snapshot.xml !== xml) return;
  try {
    if (snapshot.planeIndex !== canvas.getPlaneIndex()) {
      canvas.showPlane(snapshot.planeIndex);
    }
    const view = canvas.get<{
      viewbox(box?: {
        x: number;
        y: number;
        width: number;
        height: number;
      }): unknown;
    }>("canvas");
    view.viewbox(snapshot.viewbox);
    const selection = canvas.get<{
      select(elements: unknown, add?: boolean): void;
    }>("selection");
    const registry = canvas.get<{ get(id: string): unknown }>(
      "elementRegistry",
    );
    const restored = snapshot.selection
      .map((id) => registry.get(id))
      .filter((element) => element !== undefined && element !== null);
    if (restored.length > 0) selection.select(restored);
  } catch {
    // Siehe `takeSnapshot`: ein misslungenes Wiederherstellen ist ein
    // Komfortverlust, kein Fehler.
  }
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
