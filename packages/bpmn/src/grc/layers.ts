/**
 * Layer-Modell der GRC-Schicht (Plan §3.3).
 *
 * Ein *Layer* ist eine Zuständigkeit: er beantwortet für ein Element genau eine
 * fachliche Frage und meldet dafür null, ein oder mehrere Signale an feste
 * Slots. Er zeichnet nicht selbst — das tut `decorate.ts` —, und er kennt weder
 * DOM noch Koordinaten. Dadurch ist jede fachliche Regel für sich prüfbar.
 *
 * **Die eine nicht verhandelbare Regel** (§3.3.5, Regel 3): Jeder Layer
 * implementiert `describe()`. Ohne diese Methode wird er nicht registriert —
 * erzwungen über das Interface *und* zur Laufzeit in
 * {@link createLayerRegistry}, weil TypeScript-Typen an einer JS-Aufrufstelle
 * niemanden aufhalten.
 */

import type { BpmnConnection, BpmnShape } from "../draw/types.js";
import {
  asOfDate,
  conformanceGate,
  summarizeFramework,
  type ConformanceGate,
  type FrameworkSummary,
} from "./analysis.js";
import type { GrcOverlayData } from "./contract.js";
import { buildGrcGraph, type GrcGraph } from "./graph.js";
import { computeSod, type SodResult } from "./sod.js";
import { simulateOutage, type OutageResult } from "./outage.js";
import type { Scene } from "../draw/scene.js";
import type {
  GrcDiagramSignal,
  GrcEdgeSignal,
  GrcElementSignal,
} from "./slots.js";
import { computeTrustBoundaries, type TrustResult } from "./trust.js";
import type { GrcTone } from "./tokens.js";

/**
 * Ein Filter blendet **nicht aus** (§3.3.5 Regel 1) — er blendet ab. Ein
 * BPMN-Diagramm mit Löchern ist irreführend.
 */
export interface GrcFilter {
  readonly id: string;
  readonly label: string;
  matches(shape: BpmnShape, context: GrcLayerContext): boolean;
}

/** Alles, was ein Layer über das Diagramm wissen muss — einmal berechnet. */
export interface GrcLayerContext {
  readonly scene: Scene;
  readonly graph: GrcGraph;
  readonly data: GrcOverlayData;
  /** Bezugszeitpunkt aller Fristen. */
  readonly asOf: Date;
  readonly sod: SodResult;
  readonly trust: TrustResult;
  readonly outage: OutageResult | undefined;
  readonly conformance: ConformanceGate;
  readonly framework: FrameworkSummary | undefined;
  readonly filter: GrcFilter | undefined;
  /** Ausgewählter SoD-Konflikt (nur dieser Bogen wird gezeichnet). */
  readonly selectedConflictId: string | undefined;
}

export interface GrcLegendEntry {
  readonly tone: GrcTone;
  readonly glyph: string;
  readonly text: string;
}

export interface GrcLayer {
  readonly id: string;
  readonly title: string;
  /** Höhere Priorität gewinnt den Slot (§3.3.2). */
  readonly priority: number;
  /** Zu welcher Funktion aus §3.12 der Layer gehört (`F1`…`F18`, `A1`…`B5`). */
  readonly feature: string;
  /** Signale für ein Shape. Leere Rückgabe = der Layer belegt keinen Slot. */
  forShape?(
    shape: BpmnShape,
    context: GrcLayerContext,
  ): readonly GrcElementSignal[];
  /** Kantendekoration. */
  forEdge?(
    connection: BpmnConnection,
    context: GrcLayerContext,
  ): GrcEdgeSignal | undefined;
  /** Diagrammweite Signale: Bögen, Geisterkanten, Kopfzeile. */
  forDiagram?(context: GrcLayerContext): readonly GrcDiagramSignal[];
  /**
   * Textform für ein Element — **Pflicht**.
   *
   * Liefert `undefined`, wenn der Layer zu diesem Element nichts zu sagen hat.
   */
  describe(
    element: BpmnShape | BpmnConnection,
    context: GrcLayerContext,
  ): string | undefined;
  legend?(context: GrcLayerContext): readonly GrcLegendEntry[];
}

export interface GrcLayerRegistry {
  readonly byId: ReadonlyMap<string, GrcLayer>;
  readonly all: readonly GrcLayer[];
  get(id: string): GrcLayer | undefined;
}

/**
 * Registriert Layer und weist die zurück, die den Vertrag nicht erfüllen.
 *
 * Das ist die Stelle, an der die Barrierefreiheit strukturell erzwungen wird:
 * Ein Layer ohne `describe` kommt nicht ins Register und kann folglich nichts
 * zeichnen — statt später eine Farbe ohne Textentsprechung zu hinterlassen.
 */
export function createLayerRegistry(
  layers: readonly GrcLayer[],
): GrcLayerRegistry {
  const byId = new Map<string, GrcLayer>();
  for (const layer of layers) {
    if (typeof layer.describe !== "function") {
      throw new Error(
        `Layer „${layer.id}" hat keine describe()-Methode und wird nicht registriert (Plan §3.3.5, Regel 3).`,
      );
    }
    if (byId.has(layer.id)) {
      throw new Error(`Layer-ID doppelt vergeben: ${layer.id}`);
    }
    byId.set(layer.id, layer);
  }
  const all = [...byId.values()].sort(
    (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
  );
  return { byId, all, get: (id) => byId.get(id) };
}

export interface BuildContextOptions {
  readonly filter?: GrcFilter;
  readonly selectedConflictId?: string;
}

/** Baut den Kontext einmal je Zeichenvorgang (§3.3.6: eine Rechnung, nicht N). */
export function buildLayerContext(
  scene: Scene,
  data: GrcOverlayData,
  options: BuildContextOptions = {},
): GrcLayerContext {
  const graph = buildGrcGraph(scene);
  return {
    scene,
    graph,
    data,
    asOf: asOfDate(data),
    sod: computeSod(graph, data),
    trust: computeTrustBoundaries(graph, data),
    outage: simulateOutage(graph, data),
    conformance: conformanceGate(data),
    framework: summarizeFramework(data, data.diagram?.framework),
    filter: options.filter,
    selectedConflictId: options.selectedConflictId,
  };
}
