/**
 * Graph- und Geometriehilfen der GRC-Schicht.
 *
 * Alles, was die Funktionen aus §3.12 über die *Struktur* des Diagramms wissen
 * müssen: was steckt in einem Subprozess, welche Lane trägt ein Element, was ist
 * von einem Schritt aus erreichbar. Die Traversierung läuft im Client auf der
 * Szene — kein Backend nötig (§3.10).
 */

import type { Scene } from "../draw/scene.js";
import type { BpmnConnection, BpmnShape, Point } from "../draw/types.js";

const FLOW_TYPES = new Set(["bpmn:SequenceFlow", "bpmn:MessageFlow"]);

const CONTAINER_TYPES = new Set([
  "bpmn:SubProcess",
  "bpmn:Transaction",
  "bpmn:AdHocSubProcess",
  "bpmn:Lane",
  "bpmn:Participant",
]);

export interface GrcGraph {
  readonly scene: Scene;
  readonly shapes: ReadonlyMap<string, BpmnShape>;
  readonly outgoing: ReadonlyMap<string, readonly BpmnConnection[]>;
  readonly incoming: ReadonlyMap<string, readonly BpmnConnection[]>;
  /** Direkte Kinder eines Containers (Subprozess, Lane, Pool). */
  readonly children: ReadonlyMap<string, readonly BpmnShape[]>;
  /** Der engste Container eines Elements. */
  readonly parentOf: ReadonlyMap<string, BpmnShape>;
}

/** Baut die Nachschlagestrukturen einmal je Szene. */
export function buildGrcGraph(scene: Scene): GrcGraph {
  const shapes = new Map<string, BpmnShape>();
  for (const shape of scene.shapes) {
    if (shape.type !== "label") {
      shapes.set(shape.id, shape);
    }
  }

  const outgoing = new Map<string, BpmnConnection[]>();
  const incoming = new Map<string, BpmnConnection[]>();
  for (const connection of scene.connections) {
    if (!FLOW_TYPES.has(connection.type)) {
      continue;
    }
    if (connection.source) {
      push(outgoing, connection.source.id, connection);
    }
    if (connection.target) {
      push(incoming, connection.target.id, connection);
    }
  }

  // Containment rein geometrisch: BPMN-DI kennt keine Elternbeziehung, und die
  // Szene ist flach. Der engste umschließende Container gewinnt — dieselbe
  // Regel, die `viewer/order.ts` für die Lane-Zuordnung benutzt.
  const parentOf = new Map<string, BpmnShape>();
  const children = new Map<string, BpmnShape[]>();
  for (const shape of shapes.values()) {
    let best: BpmnShape | undefined;
    for (const candidate of shapes.values()) {
      if (candidate.id === shape.id || !CONTAINER_TYPES.has(candidate.type)) {
        continue;
      }
      if (!contains(candidate, shape)) {
        continue;
      }
      if (!best || area(candidate) < area(best)) {
        best = candidate;
      }
    }
    if (best) {
      parentOf.set(shape.id, best);
      push(children, best.id, shape);
    }
  }

  return { scene, shapes, outgoing, incoming, children, parentOf };
}

/** Alle Nachfahren eines Containers (transitiv). */
export function descendants(
  graph: GrcGraph,
  containerId: string,
): readonly BpmnShape[] {
  const out: BpmnShape[] = [];
  const stack = [...(graph.children.get(containerId) ?? [])];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const shape = stack.pop();
    if (!shape || seen.has(shape.id)) {
      continue;
    }
    seen.add(shape.id);
    out.push(shape);
    stack.push(...(graph.children.get(shape.id) ?? []));
  }
  return out;
}

/** Ist `containerId` ein Container (Subprozess, Lane, Pool)? */
export function isContainer(shape: BpmnShape): boolean {
  return CONTAINER_TYPES.has(shape.type);
}

/**
 * Erreichbarkeit entlang der Flüsse.
 *
 * Wird für zwei Dinge gebraucht: die SoD-Prüfung („liegen die beiden
 * Aktivitäten im selben Prozesspfad?", §3.11) und die Ausfallsimulation
 * („welche Schritte hängen hinter dem ausgefallenen?", §3.10).
 */
export function reachableFrom(
  graph: GrcGraph,
  startId: string,
  options: { readonly includeStart?: boolean } = {},
): ReadonlySet<string> {
  const seen = new Set<string>();
  const stack = [startId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || seen.has(current)) {
      continue;
    }
    seen.add(current);
    for (const connection of graph.outgoing.get(current) ?? []) {
      const target = connection.target;
      if (target && !seen.has(target.id)) {
        stack.push(target.id);
      }
    }
  }
  if (!options.includeStart) {
    seen.delete(startId);
  }
  return seen;
}

/** Liegen zwei Elemente auf einem gemeinsamen Pfad (in beliebiger Richtung)? */
export function onCommonPath(graph: GrcGraph, a: string, b: string): boolean {
  return reachableFrom(graph, a).has(b) || reachableFrom(graph, b).has(a);
}

/** Mittelpunkt eines Shapes. */
export function centerOf(shape: BpmnShape): Point {
  return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

/** Mittelpunkt eines Kantenzugs (Punkt auf halber Länge). */
export function midpointOf(connection: BpmnConnection): Point {
  const points = connection.waypoints;
  const first = points[0];
  if (!first) {
    return { x: 0, y: 0 };
  }
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b) {
      total += Math.hypot(b.x - a.x, b.y - a.y);
    }
  }
  let walked = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) {
      continue;
    }
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (walked + length >= total / 2) {
      const t = length === 0 ? 0 : (total / 2 - walked) / length;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    walked += length;
  }
  return first;
}

/** Die Lane bzw. der Pool eines Elements (engster Container dieser Art). */
export function laneOf(
  graph: GrcGraph,
  shapeId: string,
): BpmnShape | undefined {
  let current = graph.parentOf.get(shapeId);
  while (current) {
    if (current.type === "bpmn:Lane" || current.type === "bpmn:Participant") {
      return current;
    }
    current = graph.parentOf.get(current.id);
  }
  return undefined;
}

/** Elemente, die eine GRC-Verknüpfung tragen können (keine Kanten, keine Labels). */
export function isAnnotatable(shape: BpmnShape): boolean {
  return shape.type !== "label";
}

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
    return;
  }
  map.set(key, [value]);
}

function contains(outer: BpmnShape, inner: BpmnShape): boolean {
  const cx = inner.x + inner.width / 2;
  const cy = inner.y + inner.height / 2;
  return (
    cx >= outer.x &&
    cx <= outer.x + outer.width &&
    cy >= outer.y &&
    cy <= outer.y + outer.height
  );
}

function area(shape: BpmnShape): number {
  return shape.width * shape.height;
}
