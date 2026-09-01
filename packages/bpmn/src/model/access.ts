/**
 * Typed access helpers over a `bpmn-moddle` definitions tree.
 *
 * `bpmn-moddle` returns an untyped object graph: every property is `unknown`,
 * containers may be absent rather than empty, and the same information lives in
 * three parallel trees (semantic, DI, and the `arctos:` extension). These
 * helpers are the narrow, total functions the rest of the engine is meant to
 * use instead of reaching into that graph by hand.
 *
 * Two conventions throughout:
 *   - a missing container is an empty array, never `undefined`;
 *   - nothing here throws. Malformed input yields empty results, because the
 *     round-trip harness must be able to walk a broken file to report *why*
 *     it is broken.
 */

import type { ModdleElement } from "bpmn-moddle";
import { ARCTOS_METADATA_LOCAL_TYPE } from "./moddle.js";
import type {
  Bounds,
  GrcBcmKpi,
  GrcControlRef,
  GrcDocumentRef,
  GrcMetadata,
  GrcRaci,
  GrcRiskRef,
  GrcRopa,
  Point,
} from "./types.js";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export function isModdleElement(value: unknown): value is ModdleElement {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { $type?: unknown }).$type === "string"
  );
}

/** Lower-cased local part of a moddle `$type`, e.g. `bpmn:UserTask` → `usertask`. */
export function localType(element: ModdleElement): string {
  const idx = element.$type.indexOf(":");
  return (
    idx === -1 ? element.$type : element.$type.slice(idx + 1)
  ).toLowerCase();
}

/**
 * `$instanceOf` if moddle attached it (it does for every element it created),
 * falling back to an exact `$type` match for hand-built stubs.
 */
export function isType(element: ModdleElement, type: string): boolean {
  const fn = (element as { $instanceOf?: unknown }).$instanceOf;
  if (typeof fn === "function") {
    return (fn as (t: string) => boolean).call(element, type);
  }
  return element.$type === type;
}

function children(value: unknown): ModdleElement[] {
  return Array.isArray(value) ? value.filter(isModdleElement) : [];
}

function str(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function num(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function bool(value: unknown): boolean {
  return value === true || value === "true";
}

// ---------------------------------------------------------------------------
// Definitions / root elements
// ---------------------------------------------------------------------------

export function getRootElements(definitions: ModdleElement): ModdleElement[] {
  return children(definitions.rootElements);
}

export function getProcesses(definitions: ModdleElement): ModdleElement[] {
  return getRootElements(definitions).filter((e) => e.$type === "bpmn:Process");
}

export function getCollaborations(definitions: ModdleElement): ModdleElement[] {
  return getRootElements(definitions).filter(
    (e) => e.$type === "bpmn:Collaboration",
  );
}

export function getParticipants(collaboration: ModdleElement): ModdleElement[] {
  return children(collaboration.participants);
}

export function getMessageFlows(collaboration: ModdleElement): ModdleElement[] {
  return children(collaboration.messageFlows);
}

/**
 * The process a participant points at, resolved through the definitions tree.
 * `processRef` is a reference, so moddle usually hands back the object already;
 * the id fallback covers files whose reference could not be resolved.
 */
export function getParticipantProcess(
  definitions: ModdleElement,
  participant: ModdleElement,
): ModdleElement | undefined {
  const ref = participant.processRef;
  if (isModdleElement(ref)) return ref;
  const id = str(ref);
  if (!id) return undefined;
  return getProcesses(definitions).find((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// Flow elements
// ---------------------------------------------------------------------------

/** Anything that can hold `flowElements`: process, subProcess, transaction, … */
export function getFlowElements(container: ModdleElement): ModdleElement[] {
  return children(container.flowElements);
}

/**
 * Every flow element in the container, descending into sub-processes.
 * Order is depth-first, container before its children, which is the order the
 * importer will want when it builds shapes.
 */
export function getAllFlowElements(container: ModdleElement): ModdleElement[] {
  const out: ModdleElement[] = [];
  const visit = (node: ModdleElement): void => {
    for (const child of getFlowElements(node)) {
      out.push(child);
      if (Array.isArray(child.flowElements)) visit(child);
    }
  };
  visit(container);
  return out;
}

/** Flow *nodes* only — tasks, events, gateways, sub-processes; no edges. */
export function getFlowNodes(
  container: ModdleElement,
  recursive = true,
): ModdleElement[] {
  const source = recursive
    ? getAllFlowElements(container)
    : getFlowElements(container);
  return source.filter((e) => isType(e, "bpmn:FlowNode"));
}

export function getSequenceFlows(
  container: ModdleElement,
  recursive = true,
): ModdleElement[] {
  const source = recursive
    ? getAllFlowElements(container)
    : getFlowElements(container);
  return source.filter((e) => e.$type === "bpmn:SequenceFlow");
}

export function getSourceRef(flow: ModdleElement): ModdleElement | undefined {
  return isModdleElement(flow.sourceRef) ? flow.sourceRef : undefined;
}

export function getTargetRef(flow: ModdleElement): ModdleElement | undefined {
  return isModdleElement(flow.targetRef) ? flow.targetRef : undefined;
}

/** Boundary events anywhere below `container`. */
export function getBoundaryEvents(container: ModdleElement): ModdleElement[] {
  return getAllFlowElements(container).filter(
    (e) => e.$type === "bpmn:BoundaryEvent",
  );
}

/** The activity a boundary event is attached to, or `undefined`. */
export function getAttachedToRef(
  boundaryEvent: ModdleElement,
): ModdleElement | undefined {
  return isModdleElement(boundaryEvent.attachedToRef)
    ? boundaryEvent.attachedToRef
    : undefined;
}

/** All boundary events attached to `activity`, searched from `container`. */
export function getAttachedBoundaryEvents(
  container: ModdleElement,
  activity: ModdleElement,
): ModdleElement[] {
  return getBoundaryEvents(container).filter(
    (e) => getAttachedToRef(e)?.id === activity.id,
  );
}

/** `true` for a boundary event that interrupts its activity (the default). */
export function isInterrupting(boundaryEvent: ModdleElement): boolean {
  return (
    boundaryEvent.cancelActivity !== false &&
    boundaryEvent.cancelActivity !== "false"
  );
}

/** The event definitions of an event (`bpmn:TimerEventDefinition`, …). */
export function getEventDefinitions(event: ModdleElement): ModdleElement[] {
  return children(event.eventDefinitions);
}

// ---------------------------------------------------------------------------
// Lanes
// ---------------------------------------------------------------------------

export function getLaneSets(container: ModdleElement): ModdleElement[] {
  return children(container.laneSets);
}

/** Every lane of a process, including lanes nested via `childLaneSet`. */
export function getLanes(container: ModdleElement): ModdleElement[] {
  const out: ModdleElement[] = [];
  const visitLaneSet = (laneSet: ModdleElement): void => {
    for (const lane of children(laneSet.lanes)) {
      out.push(lane);
      const child = lane.childLaneSet;
      if (isModdleElement(child)) visitLaneSet(child);
    }
  };
  for (const laneSet of getLaneSets(container)) visitLaneSet(laneSet);
  return out;
}

/** The flow nodes a lane claims via `flowNodeRef`. */
export function getLaneFlowNodes(lane: ModdleElement): ModdleElement[] {
  return children(lane.flowNodeRef);
}

/**
 * The innermost lane that claims `node`, or `undefined`. Membership in BPMN is
 * expressed on the lane, not on the node, so this has to search — which is also
 * the reason a modelling layer has to *maintain* `flowNodeRef` on every move
 * (plan §2.3.1).
 */
export function getLaneOf(
  container: ModdleElement,
  node: ModdleElement,
): ModdleElement | undefined {
  let found: ModdleElement | undefined;
  for (const lane of getLanes(container)) {
    if (getLaneFlowNodes(lane).some((n) => n.id === node.id)) found = lane;
  }
  return found;
}

// ---------------------------------------------------------------------------
// extensionElements / arctos:grcMetadata
// ---------------------------------------------------------------------------

/** Direct children of `<bpmn:extensionElements>`, foreign ones included. */
export function getExtensionElements(element: ModdleElement): ModdleElement[] {
  const container = element.extensionElements;
  if (!isModdleElement(container)) return [];
  const values = children(container.values);
  return values.length > 0 ? values : children(container.$children);
}

/**
 * The `<arctos:grcMetadata>` element of a flow node, if any.
 *
 * Matched on the lower-cased local type, exactly as `bpmn-arctos-parse.ts`
 * does today — the descriptor's `xml.tagAlias: "lowerCase"` means the type is
 * `GrcMetadata` but the tag is `grcMetadata`, and a file written by a naive
 * foreign exporter may well spell it `GrcMetadata`. Both must be read.
 */
export function getGrcMetadataElement(
  element: ModdleElement,
): ModdleElement | undefined {
  return getExtensionElements(element).find(
    (e) => localType(e) === ARCTOS_METADATA_LOCAL_TYPE,
  );
}

function refContainerItems(container: unknown): ModdleElement[] {
  if (Array.isArray(container)) return container.filter(isModdleElement);
  if (!isModdleElement(container)) return [];
  const values = children(container.values);
  return values.length > 0 ? values : children(container.$children);
}

function findChildByLocalType(
  element: ModdleElement,
  local: string,
): ModdleElement | undefined {
  const direct = element[local];
  if (isModdleElement(direct)) return direct;
  return children(element.$children).find(
    (c) => localType(c) === local.toLowerCase(),
  );
}

/** Read the GRC metadata of a flow node into a plain object. */
export function readGrcMetadata(
  element: ModdleElement,
): GrcMetadata | undefined {
  const meta = getGrcMetadataElement(element);
  if (!meta) return undefined;

  const riskRefs: GrcRiskRef[] = refContainerItems(
    findChildByLocalType(meta, "riskRefs"),
  ).map((e) => ({
    id: str(e.id) ?? "",
    title: str(e.title),
    inherentScore: num(e.inherentScore),
    residualScore: num(e.residualScore),
    status: str(e.status),
  }));

  const controlRefs: GrcControlRef[] = refContainerItems(
    findChildByLocalType(meta, "controlRefs"),
  ).map((e) => ({
    id: str(e.id) ?? "",
    title: str(e.title),
    effectiveness: str(e.effectiveness),
    controlType: str(e.controlType),
  }));

  const documentRefs: GrcDocumentRef[] = refContainerItems(
    findChildByLocalType(meta, "documentRefs"),
  ).map((e) => ({
    id: str(e.id) ?? "",
    title: str(e.title),
    documentType: str(e.documentType),
  }));

  const raciEl = findChildByLocalType(meta, "raci");
  const raci: GrcRaci | undefined = raciEl
    ? {
        responsibleRoleId: str(raciEl.responsibleRoleId),
        accountableRoleId: str(raciEl.accountableRoleId),
        consultedRoleIds: str(raciEl.consultedRoleIds),
        informedRoleIds: str(raciEl.informedRoleIds),
      }
    : undefined;

  const bcmEl = findChildByLocalType(meta, "bcmKpi");
  const bcmKpi: GrcBcmKpi | undefined = bcmEl
    ? {
        mtpdMinutes: num(bcmEl.mtpdMinutes),
        rtoMinutes: num(bcmEl.rtoMinutes),
        rpoMinutes: num(bcmEl.rpoMinutes),
        criticality: str(bcmEl.criticality),
      }
    : undefined;

  const ropaEl = findChildByLocalType(meta, "ropa");
  const ropa: GrcRopa | undefined = ropaEl
    ? {
        isProcessingActivity: bool(ropaEl.isProcessingActivity),
        purpose: str(ropaEl.purpose),
        legalBasis: str(ropaEl.legalBasis),
        requiresDpia: bool(ropaEl.requiresDpia),
      }
    : undefined;

  return {
    lineOfDefense: str(meta.lineOfDefense),
    complianceProfile: str(meta.complianceProfile),
    calledProcessId: str(meta.calledProcessId),
    isCriticalProcess: bool(meta.isCriticalProcess),
    riskRefs,
    controlRefs,
    documentRefs,
    raci,
    bcmKpi,
    ropa,
  };
}

/** GRC metadata of every flow node that carries some, keyed by BPMN element id. */
export function readGrcMetadataMap(
  definitions: ModdleElement,
): Map<string, GrcMetadata> {
  const out = new Map<string, GrcMetadata>();
  for (const process of getProcesses(definitions)) {
    for (const node of getFlowNodes(process)) {
      const meta = readGrcMetadata(node);
      const id = str(node.id);
      if (meta && id) out.set(id, meta);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Diagram interchange
// ---------------------------------------------------------------------------

export function getDiagrams(definitions: ModdleElement): ModdleElement[] {
  return children(definitions.diagrams);
}

export function getPlane(diagram: ModdleElement): ModdleElement | undefined {
  return isModdleElement(diagram.plane) ? diagram.plane : undefined;
}

export function getPlaneElements(plane: ModdleElement): ModdleElement[] {
  return children(plane.planeElement);
}

/**
 * Index of `bpmnElement` id → DI element (`BPMNShape` / `BPMNEdge`) across all
 * diagrams. A diagram may reference the same element from two planes; the last
 * one wins, mirroring what a viewer that renders planes in order would show.
 */
export function buildDiIndex(
  definitions: ModdleElement,
): Map<string, ModdleElement> {
  const out = new Map<string, ModdleElement>();
  for (const diagram of getDiagrams(definitions)) {
    const plane = getPlane(diagram);
    if (!plane) continue;
    for (const di of getPlaneElements(plane)) {
      const ref = di.bpmnElement;
      const id = isModdleElement(ref) ? str(ref.id) : str(ref);
      if (id) out.set(id, di);
    }
  }
  return out;
}

export function getBounds(diElement: ModdleElement): Bounds | undefined {
  const b = diElement.bounds;
  if (!isModdleElement(b)) return undefined;
  const x = num(b.x);
  const y = num(b.y);
  const width = num(b.width);
  const height = num(b.height);
  if (
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined
  ) {
    return undefined;
  }
  return { x, y, width, height };
}

export function getWaypoints(diElement: ModdleElement): Point[] {
  return children(diElement.waypoint)
    .map((w) => ({ x: num(w.x), y: num(w.y) }))
    .filter((p): p is Point => p.x !== undefined && p.y !== undefined);
}
