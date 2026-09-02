/**
 * ============================================================================
 *  TEMPORARY — this file exists only while `bpmn-js` is still in the tree.
 * ============================================================================
 *
 * `bpmn-js@18` is a working reference implementation of exactly the layer
 * ARCTOS is building. While it is installed, every question of the form "is our
 * answer right?" can be asked as "does the reference give the same answer?",
 * and that is worth more than any assertion written by hand. The moment it is
 * uninstalled, this file and everything under `test/verify/shadow*` stop
 * compiling — which is the intended way to notice.
 *
 * **How to tell that its time is up.** All four together:
 *   1. `packages/bpmn/package.json` (or the workspace root) no longer lists
 *      `bpmn-js` — plan §5.4, stage S5, "Wasserzeichen fällt";
 *   2. the shadow comparison has run green over the whole corpus for a full
 *      release cycle and the divergence registry in `../shadow.ts` contains no
 *      entry with verdict `ours-wrong` (plan §5.6, criterion 2);
 *   3. the property runner runs against `drivers/arctos.ts`, not against this
 *      driver, in CI (plan §5.6, criterion 1);
 *   4. shadow-compare-on-save (plan §5.4, stage S3) has run 30 days and 500
 *      saves without a deviation.
 * Until all four hold, deleting this file removes a safety net rather than dead
 * weight. When they hold, delete `src/verify/drivers/bpmnjs.ts`,
 * `src/verify/shadow.ts`, `test/verify/jsdom-svg.ts` and the three
 * `test/verify/shadow*.test.ts` files together, in one commit, with this
 * paragraph quoted in the message.
 *
 * `bpmn-js` is *called*, never copied: nothing in `src/` outside this file
 * mentions it, and the import below is dynamic so that no bundle can pull it
 * in by accident.
 */

/// <reference lib="dom" />

import type { ModdleElement } from "bpmn-moddle";
import type { ModelingDriver, OperationResult } from "../driver.js";
import type { CandidateKind, Operation } from "../operations.js";
import { CandidateOrder, resolveIndex } from "../driver.js";
import { isActivityType } from "../invariants.js";

// ---------------------------------------------------------------------------
// The slice of the bpmn-js surface this driver uses
// ---------------------------------------------------------------------------

interface DjsElement {
  id: string;
  type: string;
  parent?: DjsElement;
  businessObject?: ModdleElement;
  labelTarget?: DjsElement;
  host?: DjsElement;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  waypoints?: { x: number; y: number }[];
}

interface ElementRegistry {
  getAll(): DjsElement[];
  get(id: string): DjsElement | undefined;
}

interface Modeling {
  createShape(
    shape: DjsElement,
    position: { x: number; y: number },
    target: DjsElement,
    hints?: Record<string, unknown>,
  ): DjsElement;
  moveElements(
    elements: DjsElement[],
    delta: { x: number; y: number },
    target?: DjsElement,
    hints?: Record<string, unknown>,
  ): void;
  connect(
    source: DjsElement,
    target: DjsElement,
    attrs?: Record<string, unknown>,
  ): DjsElement;
  removeElements(elements: DjsElement[]): void;
  updateProperties(
    element: DjsElement,
    properties: Record<string, unknown>,
  ): void;
}

interface ElementFactory {
  createShape(attrs: Record<string, unknown>): DjsElement;
}

interface CommandStack {
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}

interface Rules {
  allowed(action: string, context: Record<string, unknown>): unknown;
}

interface Canvas {
  getRootElement(): DjsElement;
}

interface Modeler {
  get(name: "elementRegistry"): ElementRegistry;
  get(name: "modeling"): Modeling;
  get(name: "elementFactory"): ElementFactory;
  get(name: "commandStack"): CommandStack;
  get(name: "rules"): Rules;
  get(name: "canvas"): Canvas;
  importXML(xml: string): Promise<{ warnings: unknown[] }>;
  saveXML(options?: { format?: boolean }): Promise<{ xml?: string }>;
  getDefinitions(): ModdleElement | undefined;
  destroy(): void;
}

type ModelerConstructor = new (options: { container: HTMLElement }) => Modeler;

let modelerConstructor: Promise<ModelerConstructor | undefined> | undefined;

/** Load `bpmn-js` lazily. Returns `undefined` when it is no longer installed. */
export function loadBpmnJs(): Promise<ModelerConstructor | undefined> {
  modelerConstructor ??= (async (): Promise<ModelerConstructor | undefined> => {
    try {
      const specifier = ["bpmn-js", "lib", "Modeler.js"].join("/");
      const module = (await import(/* @vite-ignore */ specifier)) as {
        default?: ModelerConstructor;
      };
      return module.default;
    } catch {
      return undefined;
    }
  })();
  return modelerConstructor;
}

/** True while `bpmn-js` is installed and the shadow comparison can run. */
export async function isBpmnJsAvailable(): Promise<boolean> {
  return (await loadBpmnJs()) !== undefined;
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

function isLabel(element: DjsElement): boolean {
  return element.labelTarget !== undefined || element.type === "label";
}

function isRoot(element: DjsElement): boolean {
  return element.parent === undefined;
}

export class BpmnJsDriver implements ModelingDriver {
  readonly name = "bpmn-js";

  private modeler: Modeler | undefined;
  private container: HTMLElement | undefined;
  private readonly order = new CandidateOrder();

  constructor(private readonly Modeler: ModelerConstructor) {}

  /** Build a driver, or `undefined` when `bpmn-js` is gone. */
  static async create(): Promise<BpmnJsDriver | undefined> {
    const ctor = await loadBpmnJs();
    return ctor ? new BpmnJsDriver(ctor) : undefined;
  }

  async load(xml: string): Promise<void> {
    this.destroy();
    const container = document.createElement("div");
    document.body.appendChild(container);
    this.container = container;
    const modeler = new this.Modeler({ container });
    this.modeler = modeler;
    await modeler.importXML(xml);
    this.order.reset(this.allIds());
  }

  /** Every id the registry currently knows, labels excluded. */
  private allIds(): string[] {
    return this.elements().map((element) => element.id);
  }

  private require(): Modeler {
    if (!this.modeler)
      throw new Error("BpmnJsDriver.load() has not been called");
    return this.modeler;
  }

  private elements(): DjsElement[] {
    return this.require()
      .get("elementRegistry")
      .getAll()
      .filter((element) => !isLabel(element));
  }

  candidates(kind: CandidateKind): readonly string[] {
    let list: DjsElement[];
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
        const root = this.require().get("canvas").getRootElement();
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

  private lookup(kind: CandidateKind, index: number): DjsElement | undefined {
    const id = resolveIndex(this.candidates(kind), index);
    if (id === undefined) return undefined;
    return this.require().get("elementRegistry").get(id);
  }

  /** Keep a position inside the parent, so a create is not rejected on geometry. */
  private inside(
    parent: DjsElement,
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

  async apply(op: Operation): Promise<OperationResult> {
    const result = await this.applyOne(op);
    // Assign creation ordinals *after* every operation, so that a replay of the
    // same sequence resolves the same selectors even though the ids differ.
    this.order.observe(this.allIds());
    return result;
  }

  private async applyOne(op: Operation): Promise<OperationResult> {
    const modeler = this.require();
    const modeling = modeler.get("modeling");
    const factory = modeler.get("elementFactory");
    const stack = modeler.get("commandStack");
    const resolved: string[] = [];

    try {
      switch (op.kind) {
        case "createShape": {
          const parent = this.lookup(op.parent.kind, op.parent.index);
          if (!parent) return { outcome: "unresolved", resolved };
          resolved.push(parent.id);
          const attrs: Record<string, unknown> = { type: op.elementType };
          if (op.elementType === "bpmn:SubProcess") attrs["isExpanded"] = true;
          const shape = factory.createShape(attrs);
          const position = this.inside(parent, op.x, op.y);
          // Ask the rules first. A generator that does not is not testing the
          // engine, it is testing what happens when the engine is misused: both
          // engines refuse a flow node inside a bpmn:Collaboration, one by
          // saying no and one by throwing, and neither answer is interesting.
          const allowed = modeler.get("rules").allowed("shape.create", {
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
          const allowed = modeler
            .get("rules")
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
          const allowed = modeler
            .get("rules")
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
          const attrs: Record<string, unknown> = { type: "bpmn:BoundaryEvent" };
          if (op.eventDefinition !== undefined) {
            attrs["eventDefinitionType"] = op.eventDefinition;
          }
          const shape = factory.createShape(attrs);
          const position = {
            x: (host.x ?? 0) + (host.width ?? 100) / 2,
            y: (host.y ?? 0) + (host.height ?? 80),
          };
          const attachAllowed = modeler.get("rules").allowed("shape.attach", {
            shape,
            target: host,
            position,
          });
          if (attachAllowed === false) return { outcome: "rejected", resolved };
          const created = modeling.createShape(shape, position, host, {
            attach: true,
          });
          resolved.push(created.id);
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

  private contains(ancestor: DjsElement, candidate: DjsElement): boolean {
    let current: DjsElement | undefined = candidate;
    while (current) {
      if (current === ancestor) return true;
      current = current.parent;
    }
    return false;
  }

  async exportXml(): Promise<string> {
    const { xml } = await this.require().saveXML({ format: true });
    if (typeof xml !== "string") throw new Error("bpmn-js returned no XML");
    return xml;
  }

  liveDefinitions(): ModdleElement | undefined {
    return this.modeler?.getDefinitions();
  }

  destroy(): void {
    try {
      this.modeler?.destroy();
    } catch {
      // A destroy that throws must not mask the finding that led here.
    }
    this.modeler = undefined;
    this.container?.remove();
    this.container = undefined;
  }
}
