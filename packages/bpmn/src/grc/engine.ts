/**
 * Die Auswertungsmaschine: aus Szene + Daten + Sicht wird ein **Überlagerungs-
 * modell** — noch ohne eine einzige DOM-Operation.
 *
 * Diese Trennung ist Absicht. Das Modell ist das, was geprüft, angesagt,
 * tabellarisch ausgegeben und gezeichnet wird; alle vier Ausgabewege benutzen
 * dieselbe Quelle. Eine Ampel, die man sieht, aber nicht hört, kann so gar nicht
 * erst entstehen (Plan §4.2, §4.3).
 */

import type { BpmnConnection, BpmnShape } from "../draw/types";
import type { Scene } from "../draw/scene";
import type { GrcOverlayData, GrcValidationFinding } from "./contract";
import {
  buildLayerContext,
  type GrcFilter,
  type GrcLayer,
  type GrcLayerContext,
  type GrcLegendEntry,
} from "./layers";
import {
  resolveSlots,
  type GrcArcSignal,
  type GrcBannerSignal,
  type GrcEdgeSignal,
  type GrcElementSignal,
  type GrcGhostEdgeSignal,
  type OwnedSignal,
  type SlotResolution,
} from "./slots";
import { defaultRegistry, resolveView, type GrcView } from "./views";

export interface GrcElementDecoration {
  readonly elementId: string;
  readonly shape: BpmnShape;
  readonly resolution: SlotResolution;
  /** Ein Satz je Layer, in Anzeigereihenfolge. */
  readonly descriptions: readonly string[];
  /** Zusammengesetzter Zusatz für den zugänglichen Namen. */
  readonly accessibleSuffix: string;
}

export interface GrcEdgeDecoration {
  readonly edgeId: string;
  readonly connection: BpmnConnection;
  readonly signal: OwnedSignal<GrcEdgeSignal>;
  readonly descriptions: readonly string[];
}

export interface GrcLegendGroup {
  readonly layerId: string;
  readonly title: string;
  readonly entries: readonly GrcLegendEntry[];
}

export interface GrcOverlayModel {
  readonly view: GrcView;
  readonly context: GrcLayerContext;
  readonly layers: readonly GrcLayer[];
  readonly elements: ReadonlyMap<string, GrcElementDecoration>;
  readonly edges: ReadonlyMap<string, GrcEdgeDecoration>;
  readonly arcs: readonly OwnedSignal<GrcArcSignal>[];
  readonly ghostEdges: readonly OwnedSignal<GrcGhostEdgeSignal>[];
  readonly banners: readonly OwnedSignal<GrcBannerSignal>[];
  readonly legend: readonly GrcLegendGroup[];
  /** Stand der Daten, wie ihn die Oberfläche anzeigen muss. */
  readonly computedAt: string;
  readonly warnings: readonly string[];
}

export interface BuildOverlayOptions {
  readonly view: GrcView;
  /** Zusätzlich zugeschaltete Layer (§3.3.3). */
  readonly extraLayers?: readonly string[];
  readonly filter?: GrcFilter;
  readonly selectedConflictId?: string;
  /** [ARCTOS-FULL-2026-08-31 · OP-011] Modellierungsbefunde (Sicht „Modellierung"). */
  readonly validation?: readonly GrcValidationFinding[];
}

/** Pseudo-Layer für den Filter — damit auch das Abblenden eine Beschreibung hat. */
const FILTER_LAYER_ID = "filter";

export function buildOverlayModel(
  scene: Scene,
  data: GrcOverlayData,
  options: BuildOverlayOptions,
): GrcOverlayModel {
  const context = buildLayerContext(scene, data, {
    ...(options.filter ? { filter: options.filter } : {}),
    ...(options.selectedConflictId
      ? { selectedConflictId: options.selectedConflictId }
      : {}),
    ...(options.validation ? { validation: options.validation } : {}),
  });
  const resolved = resolveView(
    options.view,
    defaultRegistry(),
    options.extraLayers ?? [],
  );
  const warnings: string[] = resolved.missing.map(
    (id) => `Sicht „${options.view.id}" nennt den unbekannten Layer „${id}".`,
  );

  const shapeCodingLayer = options.view.shapeCodingLayer;

  const elements = new Map<string, GrcElementDecoration>();
  for (const shape of scene.shapes) {
    if (shape.type === "label") {
      continue;
    }
    const owned: OwnedSignal<GrcElementSignal>[] = [];
    for (const layer of resolved.layers) {
      const signals = layer.forShape?.(shape, context) ?? [];
      for (const signal of signals) {
        // Höchstens eine Formkodierung je Sicht: Nur der in der Sicht benannte
        // Layer darf die Fläche einfärben. Die übrigen Formsignale werden nicht
        // verworfen, sondern als verdrängte Signale weitergereicht — sie tauchen
        // im Sammel-Badge und in der Beschreibung auf.
        if (
          signal.kind === "shape" &&
          shapeCodingLayer !== undefined &&
          layer.id !== shapeCodingLayer
        ) {
          owned.push({
            layerId: layer.id,
            layerTitle: layer.title,
            priority: layer.priority - 1000,
            signal,
          });
          continue;
        }
        owned.push({
          layerId: layer.id,
          layerTitle: layer.title,
          priority: layer.priority,
          signal,
        });
      }
    }

    if (options.filter && !options.filter.matches(shape, context)) {
      owned.push({
        layerId: FILTER_LAYER_ID,
        layerTitle: options.filter.label,
        priority: -1,
        signal: {
          kind: "dim",
          describe: `Vom Filter „${options.filter.label}" nicht erfasst.`,
        },
      });
    }

    if (owned.length === 0) {
      continue;
    }

    const resolution = resolveSlots(owned);
    elements.set(shape.id, {
      elementId: shape.id,
      shape,
      resolution,
      descriptions: resolution.descriptions,
      accessibleSuffix: resolution.descriptions.join(" "),
    });
  }

  const edges = new Map<string, GrcEdgeDecoration>();
  for (const connection of scene.connections) {
    const candidates: OwnedSignal<GrcEdgeSignal>[] = [];
    const descriptions: string[] = [];
    for (const layer of resolved.layers) {
      const signal = layer.forEdge?.(connection, context);
      if (!signal) {
        continue;
      }
      candidates.push({
        layerId: layer.id,
        layerTitle: layer.title,
        priority: layer.priority,
        signal,
      });
      descriptions.push(signal.describe);
    }
    candidates.sort(
      (a, b) => b.priority - a.priority || a.layerId.localeCompare(b.layerId),
    );
    const winner = candidates[0];
    if (winner) {
      edges.set(connection.id, {
        edgeId: connection.id,
        connection,
        signal: winner,
        descriptions,
      });
    }
  }

  const arcs: OwnedSignal<GrcArcSignal>[] = [];
  const ghostEdges: OwnedSignal<GrcGhostEdgeSignal>[] = [];
  const banners: OwnedSignal<GrcBannerSignal>[] = [];
  for (const layer of resolved.layers) {
    for (const signal of layer.forDiagram?.(context) ?? []) {
      const owned = {
        layerId: layer.id,
        layerTitle: layer.title,
        priority: layer.priority,
        signal,
      };
      if (signal.kind === "arc") {
        arcs.push(owned as OwnedSignal<GrcArcSignal>);
      } else if (signal.kind === "ghost-edge") {
        ghostEdges.push(owned as OwnedSignal<GrcGhostEdgeSignal>);
      } else {
        banners.push(owned as OwnedSignal<GrcBannerSignal>);
      }
    }
  }
  banners.sort(
    (a, b) => b.priority - a.priority || a.layerId.localeCompare(b.layerId),
  );

  const legend: GrcLegendGroup[] = [];
  for (const layer of resolved.layers) {
    const entries = layer.legend?.(context) ?? [];
    if (entries.length > 0) {
      legend.push({ layerId: layer.id, title: layer.title, entries });
    }
  }

  if (options.filter) {
    const dimmed = [...elements.values()].filter(
      (entry) => entry.resolution.dimmed,
    ).length;
    warnings.push(
      `Filter „${options.filter.label}": ${String(dimmed)} Elemente abgeblendet (nichts ausgeblendet).`,
    );
  }

  return {
    view: options.view,
    context,
    layers: resolved.layers,
    elements,
    edges,
    arcs,
    ghostEdges,
    banners,
    legend,
    computedAt: data.computedAt,
    warnings,
  };
}

/**
 * Die Sätze eines Elements für die Live-Region (§4.2).
 *
 * Reihenfolge: erst was das Element ist (liefert der Viewer), dann die aktiven
 * GRC-Layer in Anzeigereihenfolge. Genau der Satzbau aus dem Plan:
 * „… 2 Risiken, höchster Restwert 16 von 25. Kontrollabdeckung 1 von 3 wirksam.
 * 1 offene Feststellung, überfällig seit 12 Tagen. Kommentare: 2 offen."
 */
export function describeElementForAnnouncement(
  model: GrcOverlayModel,
  elementId: string,
): string {
  return model.elements.get(elementId)?.accessibleSuffix ?? "";
}

/** Alle Beschreibungen einer Kante. */
export function describeEdgeForAnnouncement(
  model: GrcOverlayModel,
  edgeId: string,
): string {
  return model.edges.get(edgeId)?.descriptions.join(" ") ?? "";
}
