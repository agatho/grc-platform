/**
 * A comparable picture of a BPMN document.
 *
 * Both the edit round-trip (does the exported file still describe the model we
 * had in memory?) and the shadow comparison (do two engines produce the same
 * document?) need to compare models. They do it here, and they do it over the
 * *exported XML re-read through this package's own model layer* — never over an
 * engine's internal object graph. Two reasons:
 *
 *   - the engines' internal graphs are structurally different by design (one
 *     has `diagram-js` shapes with `businessObject`, the other does not), so a
 *     comparison there would compare implementation details;
 *   - the file is the thing that matters. A model that is right in memory and
 *     wrong on disk is wrong.
 *
 * Generated ids are the one thing that cannot be compared literally: every
 * engine invents its own (`Activity_0e81y14` against `Task_3`). They are
 * therefore rewritten to positional placeholders before comparison — see
 * `normalizeGeneratedIds`.
 */

import type { ModdleElement } from "bpmn-moddle";
import {
  getAllFlowElements,
  getBounds,
  getCollaborations,
  getDiagrams,
  getLaneFlowNodes,
  getLanes,
  getLaneSets,
  getMessageFlows,
  getParticipants,
  getPlane,
  getPlaneElements,
  getProcesses,
  getWaypoints,
  isModdleElement,
} from "../model/access";
import { importXml } from "../model/io";
import type { Bounds, Point } from "../model/types";

export interface SnapshotNode {
  readonly id: string;
  readonly type: string;
  /** Id of the container (process, sub-process, participant), when known. */
  readonly parentId: string | undefined;
  readonly name: string | undefined;
  readonly sourceId?: string;
  readonly targetId?: string;
  readonly attachedToId?: string;
  /** Id of the lane this node is assigned to, when any. */
  readonly laneId?: string;
  readonly bounds?: Bounds;
  readonly waypoints?: readonly Point[];
}

export interface ModelSnapshot {
  readonly xml: string;
  readonly nodes: readonly SnapshotNode[];
  readonly byId: ReadonlyMap<string, SnapshotNode>;
}

function idOf(element: ModdleElement): string | undefined {
  return typeof element.id === "string" && element.id !== ""
    ? element.id
    : undefined;
}

function refId(value: unknown): string | undefined {
  if (isModdleElement(value)) return idOf(value);
  if (typeof value === "string" && value !== "") return value;
  return undefined;
}

function nameOf(element: ModdleElement): string | undefined {
  const name = element["name"];
  return typeof name === "string" && name !== "" ? name : undefined;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function roundBounds(bounds: Bounds): Bounds {
  return {
    x: round(bounds.x),
    y: round(bounds.y),
    width: round(bounds.width),
    height: round(bounds.height),
  };
}

/** Build the snapshot from an already-parsed definitions tree. */
export function snapshotDefinitions(
  definitions: ModdleElement,
  xml: string,
): ModelSnapshot {
  const nodes: SnapshotNode[] = [];
  const laneOf = new Map<string, string>();
  const boundsOf = new Map<string, Bounds>();
  const waypointsOf = new Map<string, readonly Point[]>();

  for (const diagram of getDiagrams(definitions)) {
    const plane = getPlane(diagram);
    if (!plane) continue;
    for (const di of getPlaneElements(plane)) {
      const target = refId(di.bpmnElement);
      if (target === undefined) continue;
      const bounds = getBounds(di);
      if (bounds) boundsOf.set(target, roundBounds(bounds));
      const waypoints = getWaypoints(di);
      if (waypoints.length > 0) {
        waypointsOf.set(
          target,
          waypoints.map((p) => ({ x: round(p.x), y: round(p.y) })),
        );
      }
    }
  }

  const containers: {
    container: ModdleElement;
    parentId: string | undefined;
  }[] = [];

  for (const process of getProcesses(definitions)) {
    for (const laneSet of getLaneSets(process)) {
      for (const lane of getLanes(laneSet)) {
        const laneId = idOf(lane);
        if (laneId === undefined) continue;
        for (const node of getLaneFlowNodes(lane)) {
          const nodeId = idOf(node);
          if (nodeId !== undefined) laneOf.set(nodeId, laneId);
        }
      }
    }
    containers.push({ container: process, parentId: undefined });
  }

  const emit = (element: ModdleElement, parentId: string | undefined): void => {
    const id = idOf(element);
    if (id === undefined) return;
    const bounds = boundsOf.get(id);
    const waypoints = waypointsOf.get(id);
    nodes.push({
      id,
      type: element.$type,
      parentId,
      name: nameOf(element),
      ...(refId(element["sourceRef"]) !== undefined
        ? { sourceId: refId(element["sourceRef"]) as string }
        : {}),
      ...(refId(element["targetRef"]) !== undefined
        ? { targetId: refId(element["targetRef"]) as string }
        : {}),
      ...(refId(element["attachedToRef"]) !== undefined
        ? { attachedToId: refId(element["attachedToRef"]) as string }
        : {}),
      ...(laneOf.has(id) ? { laneId: laneOf.get(id) as string } : {}),
      ...(bounds ? { bounds } : {}),
      ...(waypoints ? { waypoints } : {}),
    });
  };

  for (const { container } of containers) {
    const containerId = idOf(container);
    emit(container, undefined);
    const visit = (
      parent: ModdleElement,
      parentId: string | undefined,
    ): void => {
      for (const child of getAllFlowElements(parent)) {
        const owner = isModdleElement(child.$parent)
          ? idOf(child.$parent)
          : parentId;
        emit(child, owner ?? parentId);
      }
    };
    visit(container, containerId);
  }

  for (const collaboration of getCollaborations(definitions)) {
    const collaborationId = idOf(collaboration);
    emit(collaboration, undefined);
    for (const participant of getParticipants(collaboration)) {
      emit(participant, collaborationId);
    }
    for (const flow of getMessageFlows(collaboration)) {
      emit(flow, collaborationId);
    }
  }

  const unique = new Map<string, SnapshotNode>();
  for (const node of nodes) if (!unique.has(node.id)) unique.set(node.id, node);
  const sorted = [...unique.values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  return { xml, nodes: sorted, byId: unique };
}

/** Parse XML through this package's model layer and snapshot it. */
export async function snapshotXml(xml: string): Promise<ModelSnapshot> {
  const { definitions } = await importXml(xml, { preserveSource: false });
  return snapshotDefinitions(definitions, xml);
}

// ---------------------------------------------------------------------------
// Id normalisation
// ---------------------------------------------------------------------------

const ID_ATTRIBUTES = [
  "id",
  "sourceRef",
  "targetRef",
  "attachedToRef",
  "bpmnElement",
  "processRef",
  "dataStoreRef",
  "messageRef",
  "errorRef",
  "signalRef",
  "default",
  "calledElement",
] as const;

/** Every id that occurs in the document, in document order. */
export function collectIds(xml: string): string[] {
  const out: string[] = [];
  const pattern = /\sid="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    const value = match[1];
    if (value !== undefined && value !== "") out.push(value);
  }
  return out;
}

/**
 * Rewrite every id that is *not* in `known` to `gen-0`, `gen-1`, … in document
 * order, together with every reference to it.
 *
 * This is what makes two engines comparable at all: both invent ids for the
 * elements a sequence creates, and neither invention is wrong. What *would* be
 * wrong is creating a different number of elements, in a different order, or
 * pointing a reference somewhere else — and all three survive this rewrite.
 *
 * The rewrite is textual on purpose. Doing it on the moddle tree would require
 * re-serialising, which is exactly the step under test.
 */
export function normalizeGeneratedIds(
  xml: string,
  known: ReadonlySet<string>,
): string {
  const mapping = new Map<string, string>();
  let next = 0;
  for (const id of collectIds(xml)) {
    if (known.has(id) || mapping.has(id)) continue;
    mapping.set(id, `gen-${next}`);
    next += 1;
  }
  if (mapping.size === 0) return xml;

  let out = xml;
  for (const attribute of ID_ATTRIBUTES) {
    out = out.replace(
      new RegExp(`(\\s${attribute}=")([^"]*)(")`, "g"),
      (whole, prefix: string, value: string, suffix: string) => {
        const replacement = mapping.get(value);
        return replacement === undefined
          ? whole
          : `${prefix}${replacement}${suffix}`;
      },
    );
  }
  // `<bpmn:incoming>Flow_1</bpmn:incoming>` and friends carry ids as text.
  out = out.replace(
    /(<(?:\w+:)?(?:incoming|outgoing|flowNodeRef)>)([^<]*)(<\/)/g,
    (whole, open: string, value: string, close: string) => {
      const replacement = mapping.get(value.trim());
      return replacement === undefined
        ? whole
        : `${open}${replacement}${close}`;
    },
  );
  return out;
}

/** Apply the same rewrite to a snapshot, so node-level diffs line up too. */
export function normalizeSnapshotIds(
  snapshot: ModelSnapshot,
  known: ReadonlySet<string>,
): ModelSnapshot {
  const mapping = new Map<string, string>();
  let next = 0;
  for (const node of snapshot.nodes) {
    if (known.has(node.id) || mapping.has(node.id)) continue;
    mapping.set(node.id, `gen-${next}`);
    next += 1;
  }
  const map = (id: string | undefined): string | undefined =>
    id === undefined ? undefined : (mapping.get(id) ?? id);

  const nodes = snapshot.nodes.map((node) => ({
    ...node,
    id: map(node.id) as string,
    parentId: map(node.parentId),
    ...(node.sourceId !== undefined
      ? { sourceId: map(node.sourceId) as string }
      : {}),
    ...(node.targetId !== undefined
      ? { targetId: map(node.targetId) as string }
      : {}),
    ...(node.attachedToId !== undefined
      ? { attachedToId: map(node.attachedToId) as string }
      : {}),
    ...(node.laneId !== undefined
      ? { laneId: map(node.laneId) as string }
      : {}),
  }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return { xml: normalizeGeneratedIds(snapshot.xml, known), nodes, byId };
}
