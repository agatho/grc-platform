/**
 * The operation vocabulary the property tests generate and the shadow
 * comparison replays.
 *
 * **Why operations do not name elements by id.** The same sequence has to run
 * on two different engines, and every engine invents its own ids for elements
 * it creates (`Activity_0e81y14` here, `Task_3` there). An operation that said
 * `move("Activity_0e81y14")` would be unreplayable. So an operation names its
 * targets by a *selector*: a category plus an index, resolved against the
 * candidate list the engine reports at that moment, sorted so the resolution is
 * total and deterministic. Two engines that agree about the model therefore
 * pick the same element; two engines that disagree pick different ones, which
 * is itself a finding rather than a crash.
 *
 * Operations are plain data on purpose: they are hashable, printable, and
 * shrinkable, and a failing sequence can be pasted into a regression test
 * verbatim.
 */

/** Categories an engine must be able to enumerate for selector resolution. */
export type CandidateKind =
  /** Everything that can hold flow elements: root, sub-process, participant. */
  | "container"
  /** Task, sub-process, call activity — anything a boundary event may attach to. */
  | "activity"
  /** Any flow node (events, tasks, gateways) — the things one connects. */
  | "flowNode"
  /** Lanes of any lane set in the diagram. */
  | "lane"
  /** Any element that may be removed: flow nodes and flows. */
  | "removable";

export const CANDIDATE_KINDS: readonly CandidateKind[] = [
  "container",
  "activity",
  "flowNode",
  "lane",
  "removable",
];

/**
 * A reference to an element, resolved at execution time.
 *
 * `index` is taken modulo the candidate count, so a selector always resolves as
 * long as the category is non-empty. An empty category makes the operation a
 * no-op rather than a failure — the generator does not know the model state
 * when it emits the sequence, and a sequence that becomes inapplicable through
 * shrinking must still run.
 */
export interface ElementRef {
  readonly kind: CandidateKind;
  readonly index: number;
}

export function ref(kind: CandidateKind, index: number): ElementRef {
  return { kind, index: Math.abs(Math.trunc(index)) };
}

/** Shape types the generator may create. Kept to what the model layer supports. */
export const CREATABLE_TYPES: readonly string[] = [
  "bpmn:Task",
  "bpmn:UserTask",
  "bpmn:ServiceTask",
  "bpmn:ManualTask",
  "bpmn:StartEvent",
  "bpmn:EndEvent",
  "bpmn:IntermediateThrowEvent",
  "bpmn:IntermediateCatchEvent",
  "bpmn:ExclusiveGateway",
  "bpmn:ParallelGateway",
  "bpmn:InclusiveGateway",
  "bpmn:EventBasedGateway",
  "bpmn:SubProcess",
  "bpmn:CallActivity",
];

/** Event definitions a generated boundary event may carry. */
export const BOUNDARY_EVENT_DEFINITIONS: readonly (string | undefined)[] = [
  undefined,
  "bpmn:ErrorEventDefinition",
  "bpmn:TimerEventDefinition",
  "bpmn:MessageEventDefinition",
  "bpmn:SignalEventDefinition",
];

export type Operation =
  | {
      readonly kind: "createShape";
      readonly elementType: string;
      readonly parent: ElementRef;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly kind: "move";
      readonly target: ElementRef;
      readonly dx: number;
      readonly dy: number;
    }
  | {
      readonly kind: "connect";
      readonly source: ElementRef;
      readonly target: ElementRef;
    }
  | { readonly kind: "remove"; readonly target: ElementRef }
  /** Drag an element into another container (sub-process, participant, root). */
  | {
      readonly kind: "reparent";
      readonly target: ElementRef;
      readonly parent: ElementRef;
      readonly x: number;
      readonly y: number;
    }
  /** Move an element into a different lane of the same process. */
  | {
      readonly kind: "changeLane";
      readonly target: ElementRef;
      readonly lane: ElementRef;
    }
  | {
      readonly kind: "attachBoundary";
      readonly host: ElementRef;
      readonly eventDefinition: string | undefined;
    }
  | {
      readonly kind: "rename";
      readonly target: ElementRef;
      readonly name: string;
    }
  | { readonly kind: "undo" }
  | { readonly kind: "redo" };

export type OperationKind = Operation["kind"];

export const OPERATION_KINDS: readonly OperationKind[] = [
  "createShape",
  "move",
  "connect",
  "remove",
  "reparent",
  "changeLane",
  "attachBoundary",
  "rename",
  "undo",
  "redo",
];

function formatRef(value: ElementRef): string {
  return `${value.kind}#${value.index}`;
}

/** One line per operation, in a form that reads back as the failing case. */
export function formatOperation(op: Operation): string {
  switch (op.kind) {
    case "createShape":
      return `createShape(${op.elementType}, in ${formatRef(op.parent)}, at ${op.x},${op.y})`;
    case "move":
      return `move(${formatRef(op.target)}, by ${op.dx},${op.dy})`;
    case "connect":
      return `connect(${formatRef(op.source)} -> ${formatRef(op.target)})`;
    case "remove":
      return `remove(${formatRef(op.target)})`;
    case "reparent":
      return `reparent(${formatRef(op.target)} into ${formatRef(op.parent)}, at ${op.x},${op.y})`;
    case "changeLane":
      return `changeLane(${formatRef(op.target)} to ${formatRef(op.lane)})`;
    case "attachBoundary":
      return `attachBoundary(on ${formatRef(op.host)}, ${op.eventDefinition ?? "plain"})`;
    case "rename":
      return `rename(${formatRef(op.target)}, ${JSON.stringify(op.name)})`;
    case "undo":
      return "undo()";
    case "redo":
      return "redo()";
  }
}

/** The whole sequence, numbered — this is what a failure report prints. */
export function formatSequence(ops: readonly Operation[]): string {
  return ops
    .map((op, i) => `  ${String(i).padStart(3, " ")}  ${formatOperation(op)}`)
    .join("\n");
}

/**
 * A sequence as a JSON literal that can be pasted into a regression test.
 * Deliberately not pretty-printed per field — a failing sequence belongs in a
 * test file as one compact block.
 */
export function serializeSequence(ops: readonly Operation[]): string {
  return JSON.stringify(ops);
}

export function deserializeSequence(json: string): Operation[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error("not an operation sequence");
  return parsed as Operation[];
}
