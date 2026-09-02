/**
 * The driver for ARCTOS' own modeling layer (`src/modeling/`).
 *
 * The verification tools were written before that layer existed — the spike
 * decision put "Prüfwerkzeuge zuerst" ahead of the engine on purpose — so this
 * file does **not** import it statically. It loads `src/modeling/index.js` at
 * runtime and binds to `ModelingSession`, and when that module is absent or
 * broken every tool reports the reason and drives the `bpmn-js` reference
 * instead of passing quietly. That property is worth keeping even now that the
 * layer exists: a compile error in the modeling layer must not take the
 * harness that judges it down with it.
 *
 * What it binds to, and why that and not something narrower: `ModelingSession`
 * is the one place where the semantic tree, the DI tree and the `diagram-js`
 * graph are held together, and the invariant checker needs all three. Driving
 * anything below it would test a model the editor never has.
 */

/// <reference lib="dom" />

import type { ModdleElement } from "bpmn-moddle";
import type { ModelingDriver, OperationResult } from "../driver.js";
import { CandidateOrder, resolveIndex } from "../driver.js";
import type { CandidateKind, Operation } from "../operations.js";
import { isActivityType } from "../invariants.js";

// ---------------------------------------------------------------------------
// The slice of src/modeling/ this driver uses, declared structurally so that
// the import can stay dynamic.
// ---------------------------------------------------------------------------

interface GraphElement {
  id: string;
  type: string;
  parent?: GraphElement;
  businessObject?: ModdleElement;
  labelTarget?: GraphElement;
  host?: GraphElement;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface Registry {
  getAll(): GraphElement[];
  get(id: string): GraphElement | undefined;
}

interface Modeling {
  createShape(
    shape: GraphElement,
    position: { x: number; y: number },
    target: GraphElement,
    hints?: unknown,
  ): GraphElement;
  moveElements(
    elements: GraphElement[],
    delta: { x: number; y: number },
    target?: GraphElement,
    hints?: unknown,
  ): void;
  connect(
    source: GraphElement,
    target: GraphElement,
    attrs?: unknown,
  ): GraphElement;
  removeElements(elements: GraphElement[]): void;
  updateProperties(
    element: GraphElement,
    properties: Record<string, unknown>,
  ): void;
}

interface Factory {
  createShape(attrs: Record<string, unknown>): GraphElement;
}

interface SemanticFactory {
  create(
    type: string,
    attrs?: Record<string, unknown>,
    options?: { parent?: ModdleElement | undefined },
  ): ModdleElement;
}

interface Stack {
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}

interface CanvasLike {
  getRootElement(): GraphElement;
}

interface RuleSet {
  allowed(action: string, context: Record<string, unknown>): unknown;
}

interface Session {
  readonly elementRegistry: Registry;
  readonly commandStack: Stack;
  readonly modeling: Modeling;
  importXml(xml: string): Promise<unknown>;
  exportXml(): Promise<string>;
  definitions(): ModdleElement;
  get<T>(service: string): T;
  destroy(): void;
}

interface ModelingModule {
  readonly ModelingSession?: new (options?: Record<string, unknown>) => Session;
}

// The *promise* is cached, not its result: assigning to a module-level
// variable after an `await` is a race whenever two callers load at once, and
// caching the promise removes both the race and the duplicate import.
let cached: Promise<ModelingModule | null> | undefined;

function loadModelingModule(): Promise<ModelingModule | null> {
  cached ??= (async (): Promise<ModelingModule | null> => {
    const specifier = ["..", "..", "modeling", "index.js"].join("/");
    try {
      return (await import(/* @vite-ignore */ specifier)) as ModelingModule;
    } catch {
      return null;
    }
  })();
  return cached;
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

const CONNECTION_TYPES = new Set([
  "bpmn:SequenceFlow",
  "bpmn:MessageFlow",
  "bpmn:Association",
  "bpmn:DataInputAssociation",
  "bpmn:DataOutputAssociation",
]);

const NON_NODE_TYPES = new Set([
  "bpmn:Participant",
  "bpmn:Lane",
  "bpmn:TextAnnotation",
  "bpmn:Group",
  "bpmn:DataObjectReference",
  "bpmn:DataStoreReference",
  "label",
]);

function isLabel(element: GraphElement): boolean {
  return element.labelTarget !== undefined || element.type === "label";
}

function isRoot(element: GraphElement): boolean {
  return element.parent === undefined;
}

export class ArctosDriver implements ModelingDriver {
  readonly name = "arctos";

  private session: Session | undefined;
  private readonly order = new CandidateOrder();

  constructor(
    private readonly SessionCtor: new (
      options?: Record<string, unknown>,
    ) => Session,
  ) {}

  async load(xml: string): Promise<void> {
    this.destroy();
    const container =
      typeof document !== "undefined"
        ? document.createElement("div")
        : undefined;
    if (container) document.body.appendChild(container);
    const session = new this.SessionCtor(container ? { container } : {});
    this.session = session;
    await session.importXml(xml);
    this.order.reset(this.allIds());
  }

  private require(): Session {
    if (!this.session)
      throw new Error("ArctosDriver.load() has not been called");
    return this.session;
  }

  private elements(): GraphElement[] {
    return this.require()
      .elementRegistry.getAll()
      .filter((element) => !isLabel(element));
  }

  private allIds(): string[] {
    return this.elements().map((element) => element.id);
  }

  candidates(kind: CandidateKind): readonly string[] {
    let list: GraphElement[];
    switch (kind) {
      case "container": {
        // Only the *current* root, never every root in the registry: bpmn-js
        // keeps one root element per BPMNPlane, so a document with an expanded
        // sub-process has two or three of them while ARCTOS has one. Including
        // them all made the same selector index resolve to different elements
        // in the two engines, and the shadow comparison then reported a rules
        // divergence that was really a candidate-set divergence. Found by that
        // comparison; the lesson is that a selector is only replayable if the
        // candidate list means the same thing on both sides.
        const root = this.require().get<CanvasLike>("canvas").getRootElement();
        list = [
          root,
          ...this.elements().filter(
            (element) =>
              !isRoot(element) &&
              (element.type === "bpmn:Participant" ||
                element.type === "bpmn:SubProcess" ||
                element.type === "bpmn:Transaction"),
          ),
        ];
        break;
      }
      case "activity":
        list = this.elements().filter((element) =>
          isActivityType(element.type),
        );
        break;
      case "flowNode":
        list = this.elements().filter(
          (element) =>
            !isRoot(element) &&
            !CONNECTION_TYPES.has(element.type) &&
            !NON_NODE_TYPES.has(element.type),
        );
        break;
      case "lane":
        list = this.elements().filter(
          (element) => element.type === "bpmn:Lane",
        );
        break;
      case "removable":
        list = this.elements().filter(
          (element) => !isRoot(element) && element.type !== "bpmn:Lane",
        );
        break;
    }
    return this.order.sort(list.map((element) => element.id));
  }

  private lookup(kind: CandidateKind, index: number): GraphElement | undefined {
    const id = resolveIndex(this.candidates(kind), index);
    if (id === undefined) return undefined;
    return this.require().elementRegistry.get(id);
  }

  private inside(
    parent: GraphElement,
    x: number,
    y: number,
  ): { x: number; y: number } {
    if (
      parent.x === undefined ||
      parent.y === undefined ||
      parent.width === undefined ||
      parent.height === undefined
    ) {
      return { x, y };
    }
    const margin = 60;
    return {
      x: Math.min(
        Math.max(x, parent.x + margin),
        Math.max(parent.x + margin, parent.x + parent.width - margin),
      ),
      y: Math.min(
        Math.max(y, parent.y + margin),
        Math.max(parent.y + margin, parent.y + parent.height - margin),
      ),
    };
  }

  private contains(ancestor: GraphElement, candidate: GraphElement): boolean {
    let current: GraphElement | undefined = candidate;
    while (current) {
      if (current === ancestor) return true;
      current = current.parent;
    }
    return false;
  }

  async apply(op: Operation): Promise<OperationResult> {
    const result = await this.applyOne(op);
    this.order.observe(this.allIds());
    return result;
  }

  private async applyOne(op: Operation): Promise<OperationResult> {
    const session = this.require();
    const modeling = session.modeling;
    const factory = session.get<Factory>("elementFactory");
    const stack = session.commandStack;
    const resolved: string[] = [];

    try {
      switch (op.kind) {
        case "createShape": {
          const parent = this.lookup(op.parent.kind, op.parent.index);
          if (!parent) return { outcome: "unresolved", resolved };
          resolved.push(parent.id);
          const attrs: Record<string, unknown> = { type: op.elementType };
          if (op.elementType === "bpmn:SubProcess") attrs["collapsed"] = false;
          const shape = factory.createShape(attrs);
          const position = this.inside(parent, op.x, op.y);
          // Ask the rules first. A generator that does not is not testing the
          // engine, it is testing what happens when the engine is misused: both
          // engines refuse a flow node inside a bpmn:Collaboration, one by
          // saying no and one by throwing, and neither answer is interesting.
          const allowed = session
            .get<RuleSet>("rules")
            .allowed("shape.create", {
              shape,
              target: parent,
              position,
            });
          if (allowed === false) return { outcome: "rejected", resolved };
          const created = modeling.createShape(shape, position, parent);
          resolved.push(created.id);
          return { outcome: "applied", resolved };
        }
        case "move": {
          const target = this.lookup(op.target.kind, op.target.index);
          if (!target) return { outcome: "unresolved", resolved };
          resolved.push(target.id);
          modeling.moveElements([target], { x: op.dx, y: op.dy });
          return { outcome: "applied", resolved };
        }
        case "connect": {
          const source = this.lookup(op.source.kind, op.source.index);
          const target = this.lookup(op.target.kind, op.target.index);
          if (!source || !target) return { outcome: "unresolved", resolved };
          resolved.push(source.id, target.id);
          if (source === target) return { outcome: "rejected", resolved };
          const allowed = session
            .get<RuleSet>("rules")
            .allowed("connection.create", { source, target });
          if (!allowed) return { outcome: "rejected", resolved };
          const created = modeling.connect(source, target);
          resolved.push(created.id);
          return { outcome: "applied", resolved };
        }
        case "remove": {
          const target = this.lookup(op.target.kind, op.target.index);
          if (!target) return { outcome: "unresolved", resolved };
          resolved.push(target.id);
          modeling.removeElements([target]);
          return { outcome: "applied", resolved };
        }
        case "reparent": {
          const target = this.lookup(op.target.kind, op.target.index);
          const parent = this.lookup(op.parent.kind, op.parent.index);
          if (!target || !parent) return { outcome: "unresolved", resolved };
          resolved.push(target.id, parent.id);
          if (target === parent || this.contains(target, parent)) {
            return { outcome: "rejected", resolved };
          }
          const allowed = session
            .get<RuleSet>("rules")
            .allowed("elements.move", { shapes: [target], target });
          if (allowed === false) return { outcome: "rejected", resolved };
          const position = this.inside(parent, op.x, op.y);
          modeling.moveElements(
            [target],
            {
              x: position.x - (target.x ?? 0),
              y: position.y - (target.y ?? 0),
            },
            parent,
          );
          return { outcome: "applied", resolved };
        }
        case "changeLane": {
          const target = this.lookup(op.target.kind, op.target.index);
          const lane = this.lookup(op.lane.kind, op.lane.index);
          if (!target || !lane) return { outcome: "unresolved", resolved };
          resolved.push(target.id, lane.id);
          const position = this.inside(
            lane,
            (lane.x ?? 0) + (lane.width ?? 200) / 2,
            (lane.y ?? 0) + (lane.height ?? 100) / 2,
          );
          modeling.moveElements([target], {
            x: position.x - (target.x ?? 0),
            y: position.y - (target.y ?? 0),
          });
          return { outcome: "applied", resolved };
        }
        case "attachBoundary": {
          const host = this.lookup(op.host.kind, op.host.index);
          if (!host) return { outcome: "unresolved", resolved };
          resolved.push(host.id);
          if (!isActivityType(host.type))
            return { outcome: "rejected", resolved };
          const shape = factory.createShape({ type: "bpmn:BoundaryEvent" });
          const position = {
            x: (host.x ?? 0) + (host.width ?? 100) / 2,
            y: (host.y ?? 0) + (host.height ?? 80),
          };
          const attachAllowed = session
            .get<RuleSet>("rules")
            .allowed("shape.attach", {
              shape,
              target: host,
              position,
            });
          if (attachAllowed === false) return { outcome: "rejected", resolved };
          const created = modeling.createShape(shape, position, host, {
            attach: true,
          });
          resolved.push(created.id);
          if (op.eventDefinition !== undefined) {
            // `src/modeling/`'s element factory takes no `eventDefinitionType`;
            // the event definition is set as a property afterwards, which is
            // the same end state bpmn-js reaches in one step.
            const bpmnFactory = session.get<SemanticFactory>("bpmnFactory");
            // The `$parent` back-link has to be set by the caller: the factory
            // takes it as an option and `updateProperties` does not infer it.
            // Leaving it out made the modeling layer's own PARENT_LINK_BROKEN
            // invariant fire — on this harness, not on the engine.
            const definition = bpmnFactory.create(
              op.eventDefinition,
              {},
              { parent: created.businessObject },
            );
            modeling.updateProperties(created, {
              eventDefinitions: [definition],
            });
          }
          return { outcome: "applied", resolved };
        }
        case "rename": {
          const target = this.lookup(op.target.kind, op.target.index);
          if (!target) return { outcome: "unresolved", resolved };
          resolved.push(target.id);
          modeling.updateProperties(target, { name: op.name });
          return { outcome: "applied", resolved };
        }
        case "undo": {
          if (!stack.canUndo()) return { outcome: "rejected", resolved };
          stack.undo();
          return { outcome: "applied", resolved };
        }
        case "redo": {
          if (!stack.canRedo()) return { outcome: "rejected", resolved };
          stack.redo();
          return { outcome: "applied", resolved };
        }
      }
    } catch (error) {
      return {
        outcome: "threw",
        resolved,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async exportXml(): Promise<string> {
    return this.require().exportXml();
  }

  liveDefinitions(): ModdleElement | undefined {
    try {
      return this.session?.definitions();
    } catch {
      return undefined;
    }
  }

  destroy(): void {
    try {
      this.session?.destroy();
    } catch {
      // A destroy that throws must not mask the finding that led here.
    }
    this.session = undefined;
  }
}

/**
 * A driver over `src/modeling/`, or `undefined` while that layer does not
 * exist or does not export `ModelingSession`.
 */
export async function createArctosDriver(): Promise<
  ModelingDriver | undefined
> {
  const module = await loadModelingModule();
  const ctor = module?.ModelingSession;
  if (typeof ctor !== "function") return undefined;
  return new ArctosDriver(ctor);
}

/** Why the ARCTOS driver is unavailable, phrased for a skip message. */
export async function arctosDriverStatus(): Promise<
  { available: true } | { available: false; reason: string }
> {
  const module = await loadModelingModule();
  if (!module) {
    return {
      available: false,
      reason:
        "src/modeling/index.ts cannot be loaded — the verification tools were built before the modeling layer, on purpose. Everything here runs against the bpmn-js reference driver in the meantime.",
    };
  }
  if (typeof module.ModelingSession !== "function") {
    return {
      available: false,
      reason:
        "src/modeling/index.ts exists but does not export ModelingSession; the driver binds to that class.",
    };
  }
  return { available: true };
}
