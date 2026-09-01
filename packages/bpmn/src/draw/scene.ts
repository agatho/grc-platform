import {
  isActivity,
  isDataElement,
  isEvent,
  isGateway,
  isSubProcess,
  isSupportedConnectionType,
} from "./semantic.js";
import type {
  Bounds,
  BpmnConnection,
  BpmnShape,
  ModdleElement,
  Point,
} from "./types.js";

/**
 * Übersetzt einen `bpmn-moddle`-Baum samt BPMN-DI in eine flache, gezeichnete
 * Szene.
 *
 * Das ist die Aufgabe, die `bpmn-moddle` ausdrücklich *nicht* übernimmt
 * (Bestandsaufnahme 4.3, Punkt 1): DI-Formen und semantische Elemente werden
 * über `bpmnElement` verknüpft, Kanten bekommen Quelle und Ziel, externe
 * Beschriftungen werden zu eigenen `label`-Shapes.
 *
 * Bewusste Vereinfachungen für den Spike (im Messprotokoll vermerkt):
 * - nur die erste `BPMNDiagram`-Ebene wird gezeichnet (kein Drill-Down)
 * - Koordinaten werden als absolut behandelt, wie es BPMN-DI vorschreibt
 */

export interface Scene {
  /** Knoten in Zeichenreihenfolge (Rahmen zuerst, Vordergrund zuletzt). */
  readonly shapes: readonly BpmnShape[];
  readonly connections: readonly BpmnConnection[];
  /** Externe Beschriftungen; werden zuletzt gezeichnet. */
  readonly labels: readonly BpmnShape[];
  readonly bounds: Bounds;
  readonly warnings: readonly string[];
  /** Das Wurzelelement der Ebene (`bpmn:Process` oder `bpmn:Collaboration`). */
  readonly root: ModdleElement | undefined;
}

interface MutableScene {
  shapes: BpmnShape[];
  connections: BpmnConnection[];
  labels: BpmnShape[];
  warnings: string[];
}

function asElement(value: unknown): ModdleElement | undefined {
  if (
    value !== null &&
    typeof value === "object" &&
    "$type" in (value as object)
  ) {
    return value as ModdleElement;
  }
  return undefined;
}

function asElements(value: unknown): ModdleElement[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: ModdleElement[] = [];
  for (const entry of value) {
    const element = asElement(entry);
    if (element) {
      out.push(element);
    }
  }
  return out;
}

function readBounds(value: unknown): Bounds | undefined {
  if (value === null || typeof value !== "object") {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const x = Number(raw["x"] ?? 0);
  const y = Number(raw["y"] ?? 0);
  const width = Number(raw["width"]);
  const height = Number(raw["height"]);
  if (![x, y, width, height].every((n) => Number.isFinite(n))) {
    return undefined;
  }
  return { x, y, width, height };
}

function readWaypoints(value: unknown): Point[] {
  const points: Point[] = [];
  for (const entry of asElements(value)) {
    const x = Number(entry["x"]);
    const y = Number(entry["y"]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push({ x, y });
    }
  }
  return points;
}

/** Welche Elementtypen tragen ihre Beschriftung außerhalb der Form? */
function hasExternalLabel(type: string): boolean {
  return isEvent(type) || isGateway(type) || isDataElement(type);
}

/**
 * Baut die Szene aus `definitions`.
 *
 * @param definitions Wurzel aus `importXml(xml).definitions`.
 * @param diagramIndex Welche `BPMNDiagram`-Ebene gezeichnet werden soll.
 */
export function buildScene(
  definitions: ModdleElement,
  diagramIndex = 0,
): Scene {
  const state: MutableScene = {
    shapes: [],
    connections: [],
    labels: [],
    warnings: [],
  };

  const diagrams = asElements(definitions["diagrams"]);
  const diagram = diagrams[diagramIndex];
  if (!diagram) {
    return {
      ...state,
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      root: undefined,
    };
  }
  if (diagrams.length > 1) {
    state.warnings.push(
      `Definitionen enthalten ${String(diagrams.length)} Diagramme; gezeichnet wird Nr. ${String(
        diagramIndex + 1,
      )}.`,
    );
  }

  const plane = asElement(diagram["plane"]);
  if (!plane) {
    state.warnings.push("BPMNDiagram ohne BPMNPlane — nichts zu zeichnen.");
    return {
      ...state,
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      root: undefined,
    };
  }

  const root = asElement(plane["bpmnElement"]);
  const planeElements = asElements(plane["planeElement"]);

  const shapesById = new Map<string, BpmnShape>();
  const pendingLabels: Array<{ bounds: Bounds; targetId: string }> = [];
  const edges: Array<{
    di: ModdleElement;
    bo: ModdleElement;
    waypoints: Point[];
  }> = [];

  for (const di of planeElements) {
    if (di.$type === "bpmndi:BPMNShape") {
      const bo = asElement(di["bpmnElement"]);
      if (!bo) {
        state.warnings.push("BPMNShape ohne bpmnElement — übersprungen.");
        continue;
      }
      const bounds = readBounds(di["bounds"]);
      if (!bounds) {
        state.warnings.push(
          `BPMNShape für ${bo.id ?? "?"} ohne gültige Bounds — übersprungen.`,
        );
        continue;
      }
      if (bounds.width <= 0 || bounds.height <= 0) {
        state.warnings.push(
          `BPMNShape für ${bo.id ?? "?"} hat Nullfläche (${String(bounds.width)}×${String(
            bounds.height,
          )}) — übersprungen.`,
        );
        continue;
      }
      const id = bo.id ?? `shape-${String(shapesById.size)}`;
      const shape: BpmnShape = {
        id,
        type: bo.$type,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        businessObject: bo,
        di,
        isFrame: bo.$type === "bpmn:Participant" || bo.$type === "bpmn:Lane",
      };
      shapesById.set(id, shape);
      state.shapes.push(shape);

      if (
        hasExternalLabel(bo.$type) &&
        typeof bo.name === "string" &&
        bo.name !== ""
      ) {
        // Die DI-Beschriftungsbox ist optional; fehlt sie, wird eine
        // Standardbox unter dem Element aufgespannt. Ohne diesen Fall bliebe die
        // Hälfte des Bestandskorpus unbeschriftet — die Generatoren (Excel-Import,
        // KI) schreiben `BPMNLabel` nicht.
        const labelBounds = readBounds(asElement(di["label"])?.["bounds"]) ?? {
          x: bounds.x + bounds.width / 2 - 45,
          y: bounds.y + bounds.height + 4,
          width: 90,
          height: 28,
        };
        pendingLabels.push({ bounds: labelBounds, targetId: id });
      }
      continue;
    }

    if (di.$type === "bpmndi:BPMNEdge") {
      const bo = asElement(di["bpmnElement"]);
      if (!bo) {
        state.warnings.push("BPMNEdge ohne bpmnElement — übersprungen.");
        continue;
      }
      const waypoints = readWaypoints(di["waypoint"]);
      if (waypoints.length < 2) {
        state.warnings.push(
          `BPMNEdge für ${bo.id ?? "?"} hat < 2 Wegpunkte — übersprungen.`,
        );
        continue;
      }
      edges.push({ di, bo, waypoints });
      continue;
    }
  }

  for (const edge of edges) {
    const bo = edge.bo;
    const id = bo.id ?? `edge-${String(state.connections.length)}`;
    const sourceId = refId(bo["sourceRef"]);
    const targetId = refId(bo["targetRef"]);
    const connection: BpmnConnection = {
      id,
      type: isSupportedConnectionType(bo.$type) ? bo.$type : bo.$type,
      waypoints: edge.waypoints,
      businessObject: bo,
      di: edge.di,
      source: sourceId ? shapesById.get(sourceId) : undefined,
      target: targetId ? shapesById.get(targetId) : undefined,
    };
    state.connections.push(connection);

    const labelBounds = readBounds(asElement(edge.di["label"])?.["bounds"]);
    if (labelBounds && typeof bo.name === "string" && bo.name) {
      state.labels.push({
        id: `${id}_label`,
        type: "label",
        x: labelBounds.x,
        y: labelBounds.y,
        width: Math.max(labelBounds.width, 1),
        height: Math.max(labelBounds.height, 1),
        businessObject: bo,
        labelTarget: connection,
      });
    }
  }

  for (const pending of pendingLabels) {
    const target = shapesById.get(pending.targetId);
    if (!target) {
      continue;
    }
    state.labels.push({
      id: `${pending.targetId}_label`,
      type: "label",
      x: pending.bounds.x,
      y: pending.bounds.y,
      width: Math.max(pending.bounds.width, 1),
      height: Math.max(pending.bounds.height, 1),
      businessObject: target.businessObject,
      labelTarget: target,
    });
  }

  state.shapes.sort(compareShapes);

  return {
    shapes: state.shapes,
    connections: state.connections,
    labels: state.labels,
    warnings: state.warnings,
    bounds: sceneBounds(state),
    root,
  };
}

function refId(value: unknown): string | undefined {
  const element = asElement(value);
  if (element?.id) {
    return element.id;
  }
  return typeof value === "string" ? value : undefined;
}

/**
 * Zeichenreihenfolge: Pools und Lanes bilden den Hintergrund, danach Gruppen,
 * aufgeklappte Subprozesse, zuletzt die eigentlichen Knoten. Innerhalb einer
 * Stufe zuerst die größere Fläche, damit kleinere Elemente sichtbar bleiben.
 */
function compareShapes(a: BpmnShape, b: BpmnShape): number {
  const rankDiff = paintRank(a) - paintRank(b);
  if (rankDiff !== 0) {
    return rankDiff;
  }
  return b.width * b.height - a.width * a.height;
}

function paintRank(shape: BpmnShape): number {
  if (shape.type === "bpmn:Participant") {
    return 0;
  }
  if (shape.type === "bpmn:Lane") {
    return 1;
  }
  if (shape.type === "bpmn:Group") {
    return 2;
  }
  if (isSubProcess(shape.type)) {
    return 3;
  }
  if (isActivity(shape.type)) {
    return 4;
  }
  return 5;
}

function sceneBounds(state: MutableScene): Bounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const include = (x: number, y: number): void => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const shape of [...state.shapes, ...state.labels]) {
    include(shape.x, shape.y);
    include(shape.x + shape.width, shape.y + shape.height);
  }
  for (const connection of state.connections) {
    for (const point of connection.waypoints) {
      include(point.x, point.y);
    }
  }

  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
