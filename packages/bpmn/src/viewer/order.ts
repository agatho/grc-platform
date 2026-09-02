import type { Scene } from "../draw/scene";
import {
  isConnection,
  type BpmnConnection,
  type BpmnShape,
} from "../draw/types";

/**
 * Stabile Reihenfolge der Diagrammelemente (Plan §4.2).
 *
 * Nicht die DOM-Reihenfolge — die entspricht der DI-Reihenfolge und ist
 * willkürlich —, sondern eine topologische Ordnung entlang der Sequenzflüsse:
 *
 * 1. Startereignisse in Lesereihenfolge (y, dann x)
 * 2. Ablauf entlang der ausgehenden Kanten; bei Verzweigungen die Zweige nach
 *    y-, dann x-Position des Ziels
 * 3. danach alles Unerreichbare, ebenfalls nach y, dann x
 *
 * Dieselbe Ordnung benutzt die Textalternative — „Schritt 7" meint im Diagramm
 * und in der Tabelle dasselbe Element. Das ist der Grund, warum die Ordnung
 * einmal beim Import berechnet und danach nicht mehr angefasst wird.
 */

export interface GraphNode {
  readonly shape: BpmnShape;
  /** 1-basierte Position in der Ordnung. */
  readonly index: number;
  readonly outgoing: readonly BpmnConnection[];
  readonly incoming: readonly BpmnConnection[];
}

export interface GraphOrder {
  readonly nodes: readonly GraphNode[];
  readonly byId: ReadonlyMap<string, GraphNode>;
}

const FLOW_TYPES = new Set(["bpmn:SequenceFlow", "bpmn:MessageFlow"]);

/** Elemente, die in der Tastaturordnung vorkommen. */
function isNavigable(shape: BpmnShape): boolean {
  return shape.type !== "label" && shape.type !== "bpmn:Group";
}

export function buildGraphOrder(scene: Scene): GraphOrder {
  const shapes = scene.shapes.filter(isNavigable);
  const outgoing = new Map<string, BpmnConnection[]>();
  const incoming = new Map<string, BpmnConnection[]>();

  for (const connection of scene.connections) {
    if (!FLOW_TYPES.has(connection.type)) {
      continue;
    }
    const source = connection.source;
    const target = connection.target;
    if (source) {
      pushInto(outgoing, source.id, connection);
    }
    if (target) {
      pushInto(incoming, target.id, connection);
    }
  }

  const readingOrder = (a: BpmnShape, b: BpmnShape): number =>
    a.y - b.y || a.x - b.x || a.id.localeCompare(b.id);

  const starts = shapes
    .filter((shape) => shape.type === "bpmn:StartEvent")
    .sort(readingOrder);
  const noIncoming = shapes
    .filter(
      (shape) =>
        shape.type !== "bpmn:StartEvent" &&
        (incoming.get(shape.id) ?? []).length === 0 &&
        (outgoing.get(shape.id) ?? []).length > 0,
    )
    .sort(readingOrder);

  const byId = new Map(shapes.map((shape) => [shape.id, shape] as const));
  const visited = new Set<string>();
  const ordered: BpmnShape[] = [];

  const walk = (shape: BpmnShape): void => {
    if (visited.has(shape.id)) {
      return;
    }
    visited.add(shape.id);
    ordered.push(shape);

    const next = (outgoing.get(shape.id) ?? [])
      .map((connection) => connection.target)
      .filter(
        (target): target is BpmnShape =>
          target !== undefined && byId.has(target.id),
      )
      .sort(readingOrder);

    for (const target of next) {
      walk(target);
    }
  };

  for (const start of [...starts, ...noIncoming]) {
    walk(start);
  }
  for (const shape of [...shapes].sort(readingOrder)) {
    walk(shape);
  }

  const nodes: GraphNode[] = ordered.map((shape, position) => ({
    shape,
    index: position + 1,
    outgoing: outgoing.get(shape.id) ?? [],
    incoming: incoming.get(shape.id) ?? [],
  }));

  return {
    nodes,
    byId: new Map(nodes.map((node) => [node.shape.id, node] as const)),
  };
}

function pushInto(
  map: Map<string, BpmnConnection[]>,
  key: string,
  connection: BpmnConnection,
): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(connection);
    return;
  }
  map.set(key, [connection]);
}

/** Die Lane bzw. der Pool, in dem ein Element liegt (geometrisch bestimmt). */
export function findContainerLabel(
  scene: Scene,
  shape: BpmnShape,
): string | undefined {
  let best: BpmnShape | undefined;
  for (const candidate of scene.shapes) {
    if (
      candidate.type !== "bpmn:Lane" &&
      candidate.type !== "bpmn:Participant"
    ) {
      continue;
    }
    if (candidate.id === shape.id) {
      continue;
    }
    if (!contains(candidate, shape)) {
      continue;
    }
    if (!best || area(candidate) < area(best)) {
      best = candidate;
    }
  }
  if (!best) {
    return undefined;
  }
  const name = best.businessObject.name;
  return typeof name === "string" && name !== "" ? name : undefined;
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

export { isConnection };
