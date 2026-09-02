/**
 * Structural invariants of a BPMN model — the assertions that hold after every
 * single modeling operation, not just at the end of one.
 *
 * The spike's finding was that a rendering defect shows up in a picture but a
 * *modeling* defect does not: it shows up in a file that a foreign tool cannot
 * read months later. Everything checked here is therefore stated over the
 * semantic and DI trees, never over the SVG — a violation means the document
 * that would be written to `process_version.bpmn_xml` is already wrong.
 *
 * Two levels:
 *   - `error`   — the document is broken. A reference points nowhere, an id
 *                 occurs twice, a shape has no element. `bpmn-moddle` will drop
 *                 what it cannot resolve on the next save (see
 *                 `test/model/ROUNDTRIP-REPORT.md`, cause 2), so an error here
 *                 is silent data loss one save later.
 *   - `warning` — legal BPMN, but a strong smell that the modeling layer lost
 *                 track: a flow node without DI in a diagram that otherwise has
 *                 DI, an empty lane set, a zero-area shape.
 *
 * The checker is total and never throws: it has to be able to walk a broken
 * tree in order to say what is broken about it.
 *
 * **Delegation to the modeling layer.** When `src/modeling/invariants.ts`
 * exists it is loaded at runtime and its findings are merged in under the
 * `modeling/` id prefix. It is loaded through a computed specifier so that a
 * missing module is a runtime `undefined`, not a compile error — this package
 * has to typecheck before that file is written.
 */

import type { ModdleElement } from "bpmn-moddle";
import {
  getAllFlowElements,
  getCollaborations,
  getDiagrams,
  getFlowElements,
  getLaneFlowNodes,
  getLanes,
  getLaneSets,
  getMessageFlows,
  getParticipants,
  getPlane,
  getPlaneElements,
  getProcesses,
  getRootElements,
  getWaypoints,
  isModdleElement,
} from "../model/access.js";

export type InvariantSeverity = "error" | "warning";

export interface InvariantViolation {
  /** Stable id, e.g. `ref/sequence-flow-source`. Used to suppress or classify. */
  readonly id: string;
  readonly severity: InvariantSeverity;
  /** Element the violation is anchored at, when there is one. */
  readonly elementId?: string;
  readonly elementType?: string;
  readonly message: string;
}

export interface InvariantReport {
  readonly violations: readonly InvariantViolation[];
  readonly errors: readonly InvariantViolation[];
  readonly warnings: readonly InvariantViolation[];
  readonly ok: boolean;
}

export interface CheckOptions {
  /**
   * Skip the DI invariants. Set for documents that legitimately carry no
   * `BPMNDiagram` at all — 25 of the 52 corpus files are in that group, and
   * `bpmn-js` refuses to open them at all, so DI is not comparable there
   * either.
   */
  readonly skipDi?: boolean;
  /** Invariant ids to downgrade to warnings, with a reason. */
  readonly tolerate?: Readonly<Record<string, string>>;
}

// ---------------------------------------------------------------------------
// Tree walking
// ---------------------------------------------------------------------------

interface Indexed {
  /** Every element in the tree, by id. Duplicate ids are recorded separately. */
  readonly byId: Map<string, ModdleElement>;
  readonly duplicateIds: string[];
  /** All elements reachable from `definitions`, in visit order. */
  readonly all: ModdleElement[];
}

const CHILD_PROPERTIES = [
  "rootElements",
  "flowElements",
  "artifacts",
  "laneSets",
  "lanes",
  "childLaneSet",
  "participants",
  "messageFlows",
  "diagrams",
  "plane",
  "planeElement",
  "eventDefinitions",
  "extensionElements",
  "values",
  "dataInputAssociations",
  "dataOutputAssociations",
  "loopCharacteristics",
  "$children",
] as const;

function childrenOf(element: ModdleElement): ModdleElement[] {
  const out: ModdleElement[] = [];
  for (const property of CHILD_PROPERTIES) {
    const value = element[property];
    if (Array.isArray(value)) {
      for (const entry of value) if (isModdleElement(entry)) out.push(entry);
    } else if (isModdleElement(value)) {
      out.push(value);
    }
  }
  return out;
}

function indexTree(definitions: ModdleElement): Indexed {
  const byId = new Map<string, ModdleElement>();
  const duplicateIds: string[] = [];
  const all: ModdleElement[] = [];
  const seen = new Set<ModdleElement>();

  const visit = (element: ModdleElement): void => {
    if (seen.has(element)) return;
    seen.add(element);
    all.push(element);
    const id = typeof element.id === "string" ? element.id : undefined;
    if (id !== undefined && id !== "") {
      if (byId.has(id)) duplicateIds.push(id);
      else byId.set(id, element);
    }
    for (const child of childrenOf(element)) visit(child);
  };

  visit(definitions);
  return { byId, duplicateIds, all };
}

/** Resolve a moddle reference that may be an object or a bare id string. */
function resolve(
  index: Indexed,
  value: unknown,
): { found: ModdleElement | undefined; raw: string | undefined } {
  if (isModdleElement(value)) {
    const id = typeof value.id === "string" ? value.id : undefined;
    // A referenced object that is not part of the tree is just as dangling as
    // an unresolvable id — it will not be written as a reachable element.
    if (id !== undefined && index.byId.get(id) === value) {
      return { found: value, raw: id };
    }
    return { found: undefined, raw: id };
  }
  if (typeof value === "string" && value !== "") {
    return { found: index.byId.get(value), raw: value };
  }
  return { found: undefined, raw: undefined };
}

function typeOf(element: ModdleElement): string {
  return element.$type;
}

function idOf(element: ModdleElement): string | undefined {
  return typeof element.id === "string" && element.id !== ""
    ? element.id
    : undefined;
}

const ACTIVITY_TYPES = new Set([
  "bpmn:Task",
  "bpmn:UserTask",
  "bpmn:ServiceTask",
  "bpmn:ManualTask",
  "bpmn:ScriptTask",
  "bpmn:SendTask",
  "bpmn:ReceiveTask",
  "bpmn:BusinessRuleTask",
  "bpmn:SubProcess",
  "bpmn:Transaction",
  "bpmn:AdHocSubProcess",
  "bpmn:CallActivity",
]);

/** True for anything a boundary event may be attached to. */
export function isActivityType(type: string): boolean {
  return ACTIVITY_TYPES.has(type);
}

const NON_FLOW_NODE_TYPES = new Set([
  "bpmn:SequenceFlow",
  "bpmn:Association",
  "bpmn:DataObject",
  "bpmn:DataObjectReference",
  "bpmn:DataStoreReference",
  "bpmn:TextAnnotation",
  "bpmn:Group",
]);

function isFlowNode(element: ModdleElement): boolean {
  const type = typeOf(element);
  return type.startsWith("bpmn:") && !NON_FLOW_NODE_TYPES.has(type);
}

// ---------------------------------------------------------------------------
// The invariants
// ---------------------------------------------------------------------------

class Collector {
  readonly out: InvariantViolation[] = [];

  add(
    id: string,
    severity: InvariantSeverity,
    message: string,
    element?: ModdleElement,
  ): void {
    const violation: InvariantViolation = {
      id,
      severity,
      message,
      ...(element ? { elementType: typeOf(element) } : {}),
      ...(element && idOf(element) !== undefined
        ? { elementId: idOf(element) as string }
        : {}),
    };
    this.out.push(violation);
  }
}

function checkIds(index: Indexed, collect: Collector): void {
  for (const id of new Set(index.duplicateIds)) {
    collect.add(
      "id/duplicate",
      "error",
      `id "${id}" occurs more than once; on export the second element silently overwrites the first reference target`,
    );
  }
}

function containerOf(element: ModdleElement): ModdleElement | undefined {
  let parent = element.$parent;
  while (isModdleElement(parent)) {
    const type = typeOf(parent);
    if (
      type === "bpmn:Process" ||
      type === "bpmn:SubProcess" ||
      type === "bpmn:Transaction" ||
      type === "bpmn:AdHocSubProcess"
    ) {
      return parent;
    }
    parent = parent.$parent;
  }
  return undefined;
}

function checkFlows(index: Indexed, collect: Collector): void {
  for (const element of index.all) {
    const type = typeOf(element);
    if (type !== "bpmn:SequenceFlow" && type !== "bpmn:MessageFlow") continue;
    const isSequence = type === "bpmn:SequenceFlow";
    const label = isSequence ? "sequence-flow" : "message-flow";

    for (const end of ["sourceRef", "targetRef"] as const) {
      const { found, raw } = resolve(index, element[end]);
      if (!found) {
        collect.add(
          `ref/${label}-${end === "sourceRef" ? "source" : "target"}`,
          "error",
          raw === undefined
            ? `${type} has no ${end}`
            : `${end} "${raw}" does not resolve to an element of this document; moddle drops the attribute on export`,
          element,
        );
      }
    }

    if (!isSequence) continue;

    const { found: source } = resolve(index, element.sourceRef);
    const { found: target } = resolve(index, element.targetRef);
    if (source && target) {
      const sourceContainer = containerOf(source);
      const targetContainer = containerOf(target);
      if (
        sourceContainer &&
        targetContainer &&
        sourceContainer !== targetContainer
      ) {
        collect.add(
          "structure/sequence-flow-crosses-container",
          "error",
          `sequence flow connects ${idOf(source) ?? "?"} in ${idOf(sourceContainer) ?? "?"} to ${idOf(target) ?? "?"} in ${idOf(targetContainer) ?? "?"}; BPMN allows a sequence flow only inside one container, across it must be a message flow`,
          element,
        );
      }
    }

    // The flow itself must live in the same container as its ends.
    const flowContainer = containerOf(element);
    if (flowContainer && source) {
      const sourceContainer = containerOf(source);
      if (sourceContainer && sourceContainer !== flowContainer) {
        collect.add(
          "structure/flow-in-wrong-container",
          "error",
          `sequence flow sits in ${idOf(flowContainer) ?? "?"} but its source sits in ${idOf(sourceContainer) ?? "?"}`,
          element,
        );
      }
    }
  }
}

function checkIncomingOutgoing(index: Indexed, collect: Collector): void {
  const expectedIn = new Map<ModdleElement, Set<ModdleElement>>();
  const expectedOut = new Map<ModdleElement, Set<ModdleElement>>();

  for (const element of index.all) {
    if (typeOf(element) !== "bpmn:SequenceFlow") continue;
    const { found: source } = resolve(index, element.sourceRef);
    const { found: target } = resolve(index, element.targetRef);
    if (source) {
      const set = expectedOut.get(source) ?? new Set();
      set.add(element);
      expectedOut.set(source, set);
    }
    if (target) {
      const set = expectedIn.get(target) ?? new Set();
      set.add(element);
      expectedIn.set(target, set);
    }
  }

  const listed = (value: unknown): ModdleElement[] =>
    Array.isArray(value) ? value.filter(isModdleElement) : [];

  for (const element of index.all) {
    if (!isFlowNode(element)) continue;
    const declaredOut = new Set(listed(element.outgoing));
    const declaredIn = new Set(listed(element.incoming));
    const realOut = expectedOut.get(element) ?? new Set<ModdleElement>();
    const realIn = expectedIn.get(element) ?? new Set<ModdleElement>();

    for (const [declared, real, direction] of [
      [declaredOut, realOut, "outgoing"],
      [declaredIn, realIn, "incoming"],
    ] as const) {
      for (const flow of declared) {
        if (real.has(flow)) continue;
        if (typeOf(flow) !== "bpmn:SequenceFlow") {
          // `bpmn:FlowNode.incoming/outgoing` are typed as SequenceFlow
          // references in the BPMN 2.0 metamodel. Listing a message flow there
          // writes `<bpmn:outgoing>MessageFlow_3</bpmn:outgoing>`, which the
          // next reader resolves as a sequence flow that is not one.
          collect.add(
            "consistency/incoming-outgoing-wrong-type",
            "error",
            `${direction} lists ${idOf(flow) ?? "?"}, which is a ${typeOf(flow)}; only sequence flows belong in incoming/outgoing`,
            element,
          );
          continue;
        }
        collect.add(
          `consistency/${direction}-stale`,
          "error",
          `${direction} lists ${idOf(flow) ?? "?"}, but that flow does not point back here`,
          element,
        );
      }
      for (const flow of real) {
        if (declared.has(flow)) continue;
        // `<bpmn:incoming>` / `<bpmn:outgoing>` are redundant with the flow's
        // own sourceRef/targetRef, and BPMN 2.0 lets a document leave them out
        // entirely — several corpus files do. So a missing entry is only an
        // error where the element already carries *some*: that means the
        // document uses the convention and this one entry was not kept up to
        // date, which is the partial-update defect worth catching. Where the
        // element carries none at all, it is a warning.
        collect.add(
          `consistency/${direction}-missing`,
          declared.size > 0 ? "error" : "warning",
          declared.size > 0
            ? `flow ${idOf(flow) ?? "?"} points here but is not listed in ${direction}, while other flows are — the list was updated partially`
            : `flow ${idOf(flow) ?? "?"} points here and this element lists no ${direction} at all; legal BPMN, but nothing keeps the two in step`,
          element,
        );
      }
    }
  }
}

function checkBoundaryEvents(index: Indexed, collect: Collector): void {
  for (const element of index.all) {
    if (typeOf(element) !== "bpmn:BoundaryEvent") continue;
    const { found, raw } = resolve(index, element.attachedToRef);
    if (!found) {
      collect.add(
        "ref/boundary-attached-to",
        "error",
        raw === undefined
          ? "boundary event has no attachedToRef"
          : `attachedToRef "${raw}" does not resolve; the event survives the save without a host and no tool can place it`,
        element,
      );
      continue;
    }
    if (!isActivityType(typeOf(found))) {
      collect.add(
        "structure/boundary-host-not-activity",
        "error",
        `boundary event is attached to ${typeOf(found)}, which is not an activity`,
        element,
      );
    }
    const hostContainer = containerOf(found);
    const eventContainer = containerOf(element);
    if (hostContainer && eventContainer && hostContainer !== eventContainer) {
      collect.add(
        "structure/boundary-host-other-container",
        "error",
        `boundary event sits in ${idOf(eventContainer) ?? "?"} but its host sits in ${idOf(hostContainer) ?? "?"}`,
        element,
      );
    }
  }
}

function checkLanes(
  definitions: ModdleElement,
  index: Indexed,
  collect: Collector,
): void {
  const containers: ModdleElement[] = [];
  for (const process of getProcesses(definitions)) {
    containers.push(process);
    for (const element of getAllFlowElements(process)) {
      const type = typeOf(element);
      if (type === "bpmn:SubProcess" || type === "bpmn:Transaction") {
        containers.push(element);
      }
    }
  }

  for (const container of containers) {
    const laneSets = getLaneSets(container);
    const ownFlowNodes = new Set(getFlowElements(container).filter(isFlowNode));
    const assignment = new Map<ModdleElement, ModdleElement[]>();

    for (const laneSet of laneSets) {
      // `getLanes()` takes the *container*, not the lane set: it walks
      // `laneSets` and descends through `childLaneSet`. Calling it with a lane
      // set returns nothing, which is how this check silently passed on a
      // document with two lanes until the checker's own test caught it.
      if (!Array.isArray(laneSet.lanes) || laneSet.lanes.length === 0) {
        collect.add(
          "structure/empty-lane-set",
          "warning",
          "lane set without lanes; a save leaves an empty <laneSet> behind that other tools show as a stray band",
          laneSet,
        );
      }
    }

    {
      for (const lane of getLanes(container)) {
        for (const node of getLaneFlowNodes(lane)) {
          const list = assignment.get(node) ?? [];
          list.push(lane);
          assignment.set(node, list);
        }
        // `getLaneFlowNodes` only returns resolved elements; count the raw
        // entries to notice the ones moddle could not resolve.
        const raw = Array.isArray(lane.flowNodeRef) ? lane.flowNodeRef : [];
        const unresolved = raw.filter((entry) => {
          const { found } = resolve(index, entry);
          return !found;
        });
        for (const _entry of unresolved) {
          collect.add(
            "ref/lane-flow-node",
            "error",
            "lane references a flow node that does not exist in this document",
            lane,
          );
        }
      }
    }

    for (const [node, lanes] of assignment) {
      if (lanes.length > 1) {
        collect.add(
          "structure/flow-node-in-several-lanes",
          "error",
          `flow node is referenced by ${lanes.length} lanes (${lanes.map((l) => idOf(l) ?? "?").join(", ")}); a lane assignment is exclusive`,
          node,
        );
      }
      if (!ownFlowNodes.has(node)) {
        collect.add(
          "structure/lane-references-foreign-node",
          "error",
          `lane ${lanes.map((l) => idOf(l) ?? "?").join(", ")} references a flow node that is not a flow element of ${idOf(container) ?? "?"}`,
          node,
        );
      }
    }
  }
}

function checkParticipants(
  definitions: ModdleElement,
  index: Indexed,
  collect: Collector,
): void {
  for (const collaboration of getCollaborations(definitions)) {
    for (const participant of getParticipants(collaboration)) {
      const raw = participant.processRef;
      if (raw === undefined || raw === null) continue;
      const { found, raw: id } = resolve(index, raw);
      if (!found) {
        collect.add(
          "ref/participant-process",
          "error",
          `participant references process "${id ?? "?"}", which does not exist`,
          participant,
        );
      }
    }
    for (const flow of getMessageFlows(collaboration)) {
      for (const end of ["sourceRef", "targetRef"] as const) {
        const { found } = resolve(index, flow[end]);
        if (!found) {
          collect.add(
            `ref/message-flow-${end === "sourceRef" ? "source" : "target"}`,
            "error",
            `message flow ${end} does not resolve`,
            flow,
          );
        }
      }
    }
  }
}

function checkDi(
  definitions: ModdleElement,
  index: Indexed,
  collect: Collector,
): void {
  const diagrams = getDiagrams(definitions);
  if (diagrams.length === 0) return;

  const shapeFor = new Map<string, ModdleElement[]>();

  for (const diagram of diagrams) {
    const plane = getPlane(diagram);
    if (!plane) {
      collect.add(
        "di/plane-missing",
        "error",
        "BPMNDiagram without a BPMNPlane",
        diagram,
      );
      continue;
    }
    const { found: planeElement } = resolve(index, plane.bpmnElement);
    if (plane.bpmnElement !== undefined && !planeElement) {
      collect.add(
        "di/plane-element",
        "error",
        "BPMNPlane/@bpmnElement does not resolve; moddle drops the attribute and the diagram loses its anchor",
        plane,
      );
    }

    for (const di of getPlaneElements(plane)) {
      const type = typeOf(di);
      const { found, raw } = resolve(index, di.bpmnElement);
      if (!found) {
        collect.add(
          "di/orphan",
          "error",
          raw === undefined
            ? `${type} has no bpmnElement`
            : `${type} points at "${raw}", which does not exist; moddle drops the attribute on export (round-trip report, cause 2)`,
          di,
        );
        continue;
      }
      const targetId = idOf(found);
      if (targetId !== undefined) {
        const list = shapeFor.get(targetId) ?? [];
        list.push(di);
        shapeFor.set(targetId, list);
      }

      if (type === "bpmndi:BPMNShape") {
        // Read the raw `dc:Bounds` rather than going through `getBounds()`:
        // that helper drops non-finite numbers, which would turn "this shape
        // has NaN for x" into the much less useful "this shape has no bounds".
        const rawBounds = di["bounds"];
        const bounds = isModdleElement(rawBounds)
          ? {
              x: Number(rawBounds["x"] ?? Number.NaN),
              y: Number(rawBounds["y"] ?? Number.NaN),
              width: Number(rawBounds["width"] ?? Number.NaN),
              height: Number(rawBounds["height"] ?? Number.NaN),
            }
          : undefined;
        if (!bounds) {
          collect.add(
            "di/shape-without-bounds",
            "error",
            "BPMNShape without dc:Bounds",
            di,
          );
        } else {
          const values = [bounds.x, bounds.y, bounds.width, bounds.height];
          if (values.some((v) => !Number.isFinite(v))) {
            collect.add(
              "di/bounds-not-finite",
              "error",
              `bounds are not finite: ${JSON.stringify(bounds)}`,
              di,
            );
          } else if (bounds.width <= 0 || bounds.height <= 0) {
            collect.add(
              "di/bounds-empty",
              "error",
              `bounds have no area: ${bounds.width}x${bounds.height}`,
              di,
            );
          }
        }
      } else if (type === "bpmndi:BPMNEdge") {
        const waypoints = getWaypoints(di);
        if (waypoints.length < 2) {
          collect.add(
            "di/edge-waypoints",
            "error",
            `BPMNEdge has ${waypoints.length} waypoint(s); an edge needs at least two`,
            di,
          );
        } else if (
          waypoints.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
        ) {
          collect.add(
            "di/waypoint-not-finite",
            "error",
            "waypoint is not finite",
            di,
          );
        }
      }
    }
  }

  for (const [id, dis] of shapeFor) {
    if (dis.length > 1) {
      collect.add(
        "di/duplicate",
        "error",
        `element "${id}" has ${dis.length} DI entries; on import the later one wins and the diagram jumps`,
      );
    }
  }

  // Every flow node that lives in a plane's process should have DI. A missing
  // shape is legal BPMN, but for an element the modeling layer just created it
  // means the semantic and the graphical tree drifted apart.
  for (const process of getProcesses(definitions)) {
    for (const element of getAllFlowElements(process)) {
      if (!isFlowNode(element) && typeOf(element) !== "bpmn:SequenceFlow")
        continue;
      const id = idOf(element);
      if (id === undefined) {
        collect.add(
          "structure/flow-element-without-id",
          "error",
          "flow element without an id; it cannot be referenced and cannot carry DI",
          element,
        );
        continue;
      }
      if (!shapeFor.has(id)) {
        collect.add(
          "di/missing",
          "warning",
          "flow element has no DI in a document that otherwise has a diagram; it will be invisible in every editor",
          element,
        );
      }
    }
  }
}

function checkContainment(
  definitions: ModdleElement,
  collect: Collector,
): void {
  const seen = new Set<ModdleElement>();
  const stack: ModdleElement[] = [];

  const visit = (element: ModdleElement): void => {
    if (stack.includes(element)) {
      collect.add(
        "structure/containment-cycle",
        "error",
        "element contains itself through its child chain",
        element,
      );
      return;
    }
    if (seen.has(element)) {
      collect.add(
        "structure/shared-child",
        "error",
        "element occurs in two different containers; on export it is written twice with the same id",
        element,
      );
      return;
    }
    seen.add(element);
    stack.push(element);
    for (const child of getFlowElements(element)) visit(child);
    stack.pop();
  };

  for (const root of getRootElements(definitions)) {
    if (typeOf(root) === "bpmn:Process") visit(root);
  }
}

function checkParentLinks(index: Indexed, collect: Collector): void {
  for (const element of index.all) {
    if (!isFlowNode(element) && typeOf(element) !== "bpmn:SequenceFlow")
      continue;
    const parent = element.$parent;
    if (parent !== undefined && !isModdleElement(parent)) {
      collect.add(
        "structure/parent-not-element",
        "error",
        "$parent is set but is not a moddle element",
        element,
      );
      continue;
    }
    if (isModdleElement(parent)) {
      // A parent may hold its children in any of several collections — a
      // collaboration holds participants and message flows, not flow elements —
      // so the membership test has to look at all of them. Checking only
      // `flowElements` reported every participant in the corpus as an orphan;
      // that was a defect in this checker, found by running it against a
      // collaboration on the first day.
      if (!childrenOf(parent).includes(element)) {
        collect.add(
          "structure/parent-does-not-contain-child",
          "error",
          `$parent points at ${idOf(parent) ?? typeOf(parent)}, but that element is not among its children`,
          element,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Check every invariant on a definitions tree. Never throws.
 */
export function checkInvariants(
  definitions: ModdleElement,
  options: CheckOptions = {},
): InvariantReport {
  const collect = new Collector();
  try {
    const index = indexTree(definitions);
    checkIds(index, collect);
    checkFlows(index, collect);
    checkIncomingOutgoing(index, collect);
    checkBoundaryEvents(index, collect);
    checkLanes(definitions, index, collect);
    checkParticipants(definitions, index, collect);
    checkContainment(definitions, collect);
    checkParentLinks(index, collect);
    if (options.skipDi !== true) checkDi(definitions, index, collect);
  } catch (error) {
    collect.add(
      "checker/crashed",
      "error",
      `the invariant checker itself failed on this tree: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return finish(collect.out, options);
}

function finish(
  raw: readonly InvariantViolation[],
  options: CheckOptions,
): InvariantReport {
  const tolerate = options.tolerate ?? {};
  const violations = raw.map((v) =>
    Object.hasOwn(tolerate, v.id) && v.severity === "error"
      ? {
          ...v,
          severity: "warning" as const,
          message: `${v.message} [tolerated: ${tolerate[v.id] ?? ""}]`,
        }
      : v,
  );
  const errors = violations.filter((v) => v.severity === "error");
  const warnings = violations.filter((v) => v.severity === "warning");
  return { violations, errors, warnings, ok: errors.length === 0 };
}

/** One line per violation, for a failure message. */
export function formatViolations(
  violations: readonly InvariantViolation[],
): string {
  if (violations.length === 0) return "  (none)";
  return violations
    .map(
      (v) =>
        `  [${v.severity}] ${v.id}${v.elementId ? ` @ ${v.elementId}` : ""}${
          v.elementType ? ` (${v.elementType})` : ""
        }: ${v.message}`,
    )
    .join("\n");
}

// ---------------------------------------------------------------------------
// Delegation to the modeling layer's own checker, when it exists
// ---------------------------------------------------------------------------

/**
 * The shape `src/modeling/invariants.ts` exposes.
 *
 * Its `checkInvariants` takes a **context object**, not a definitions element,
 * because it checks all three trees (semantic, DI, graphical) and needs the
 * element registry for the third. Passing it a bare tree makes it throw — the
 * property runner found exactly that on the first run, which is a small but
 * real demonstration that the delegation is wired live and not decorative.
 * Findings come back with `code`, not `id`; both spellings are accepted here so
 * that a later rename on either side does not silently drop the delegation.
 */
interface ModelingInvariantsModule {
  readonly checkInvariants?: (context: {
    definitions: ModdleElement;
    elementRegistry?: unknown;
  }) => unknown;
}

let modelingModule: Promise<ModelingInvariantsModule | null> | undefined;

/**
 * Load `src/modeling/invariants.ts` when it exists, otherwise `null`. Cached
 * after the first attempt. The specifier is computed so TypeScript does not
 * resolve a module that need not exist for this file to compile.
 */
export function loadModelingInvariants(): Promise<ModelingInvariantsModule | null> {
  // The promise is cached rather than its result: assigning a module-level
  // variable after an `await` races with a second caller, and this one is
  // called once per operation in the property runner.
  modelingModule ??= (async (): Promise<ModelingInvariantsModule | null> => {
    const specifier = ["..", "modeling", "invariants.js"].join("/");
    try {
      return (await import(
        /* @vite-ignore */ specifier
      )) as ModelingInvariantsModule;
    } catch {
      return null;
    }
  })();
  return modelingModule;
}

/** True once the modeling layer contributes its own invariants. */
export async function hasModelingInvariants(): Promise<boolean> {
  const module = await loadModelingInvariants();
  return typeof module?.checkInvariants === "function";
}

function coerceViolations(value: unknown): InvariantViolation[] {
  const list: unknown[] = Array.isArray(value)
    ? value
    : Array.isArray((value as { violations?: unknown })?.violations)
      ? (value as { violations: unknown[] }).violations
      : [];
  const out: InvariantViolation[] = [];
  for (const entry of list) {
    if (typeof entry === "string") {
      out.push({ id: "modeling/unnamed", severity: "error", message: entry });
      continue;
    }
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const rawId =
      typeof record["code"] === "string"
        ? record["code"]
        : typeof record["id"] === "string"
          ? record["id"]
          : "unnamed";
    const message =
      typeof record["message"] === "string"
        ? record["message"]
        : JSON.stringify(record);
    const severity: InvariantSeverity =
      record["severity"] === "warning" ? "warning" : "error";
    out.push({
      id: rawId.startsWith("modeling/") ? rawId : `modeling/${rawId}`,
      severity,
      message,
      ...(typeof record["elementId"] === "string"
        ? { elementId: record["elementId"] }
        : {}),
      ...(typeof record["elementType"] === "string"
        ? { elementType: record["elementType"] }
        : {}),
    });
  }
  return out;
}

export interface AllInvariantsOptions extends CheckOptions {
  /**
   * The `diagram-js` element registry, when the caller has one. The modeling
   * layer's checker compares the graphical tree against the other two only
   * when it gets this; without it, it silently checks less.
   */
  readonly elementRegistry?: unknown;
}

/**
 * The full check: this file's invariants plus whatever the modeling layer
 * contributes, merged under a `modeling/` prefix.
 */
export async function checkAllInvariants(
  definitions: ModdleElement,
  options: AllInvariantsOptions = {},
): Promise<InvariantReport> {
  const own = checkInvariants(definitions, options);
  const module = await loadModelingInvariants();
  const fn = module?.checkInvariants;
  if (typeof fn !== "function") return own;
  let extra: InvariantViolation[];
  try {
    extra = coerceViolations(
      fn({
        definitions,
        ...(options.elementRegistry !== undefined
          ? { elementRegistry: options.elementRegistry }
          : {}),
      }),
    );
  } catch (error) {
    extra = [
      {
        id: "modeling/checker-crashed",
        severity: "error",
        message: `src/modeling/invariants.ts threw: ${error instanceof Error ? error.message : String(error)}`,
      },
    ];
  }
  return finish([...own.violations, ...extra], options);
}
