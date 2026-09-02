/**
 * Semantische Hilfsfunktionen der Modellierungsschicht.
 *
 * Bewusst getrennt von `src/model/access.ts`: dort sind es *lesende* Zugriffe
 * auf einen fertigen Baum, hier sind es die Fragen, die eine Operation stellen
 * muss, bevor sie schreibt („in welchen Container gehört dieser Knoten?",
 * „welche Liste trägt diese Kante?"). `access.ts` gehört einem anderen
 * Arbeitsstrang und wird von hier aus nicht verändert.
 */

import type {
  BpmnConnection,
  BpmnElement,
  BpmnParent,
  BpmnShape,
  ModdleElement,
} from "./types";
import { isConnectionElement, isShapeElement } from "./types";

export { isConnectionElement, isShapeElement };

export function isModdleElement(value: unknown): value is ModdleElement {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { $type?: unknown }).$type === "string"
  );
}

/** `$instanceOf` mit Rückfall auf exakten `$type`-Vergleich. */
export function is(element: ModdleElement | undefined, type: string): boolean {
  if (!element) return false;
  const fn = (element as { $instanceOf?: unknown }).$instanceOf;
  if (typeof fn === "function") {
    return (fn as (t: string) => boolean).call(element, type);
  }
  return element.$type === type;
}

export function isAny(
  element: ModdleElement | undefined,
  types: readonly string[],
): boolean {
  return types.some((type) => is(element, type));
}

/** Der businessObject eines grafischen Elements, oder `undefined`. */
export function boOf(
  element: BpmnElement | undefined,
): ModdleElement | undefined {
  const bo = element?.businessObject;
  return isModdleElement(bo) ? bo : undefined;
}

/** Wie {@link boOf}, wirft aber — für Stellen, an denen ein fehlendes bo ein Fehler ist. */
export function requireBo(element: BpmnElement): ModdleElement {
  const bo = boOf(element);
  if (!bo) {
    throw new Error(
      `Grafisches Element ${element.id} hat kein businessObject — die Modellierungsschicht kann damit nicht arbeiten.`,
    );
  }
  return bo;
}

export function elementType(element: BpmnElement | undefined): string {
  if (!element) return "";
  const bo = boOf(element);
  return bo?.$type ?? (typeof element.type === "string" ? element.type : "");
}

/**
 * Ist dieses grafische Element eine Beschriftung?
 *
 * Die Prüfung auf `type === "label"` ist **nicht** redundant: `label-support`
 * aus `diagram-js` setzt `labelTarget` bereits im `execute` von `shape.delete`
 * auf `null`. Ein Updater, der erst im `executed` nachsieht, hielte die
 * Beschriftung dann für einen gewöhnlichen Knoten und entfernte deren
 * `businessObject` — also das des *beschrifteten* Elements — aus
 * `flowElements`. Genau diesen Fehler hat der Invariantenprüfer beim Bau
 * gefunden (`GRAPHIC_SEMANTIC_NOT_IN_DOCUMENT`), und er wäre am Bild nicht zu
 * sehen gewesen.
 */
export function isLabel(element: BpmnElement | undefined): boolean {
  if (element === undefined) return false;
  if (element.type === "label") return true;
  const target = (element as BpmnShape).labelTarget;
  return target !== undefined && target !== null;
}

export function isRoot(element: BpmnElement | undefined): boolean {
  return element !== undefined && element.parent === undefined;
}

export function asArray(value: unknown): ModdleElement[] {
  return Array.isArray(value) ? value.filter(isModdleElement) : [];
}

// ---------------------------------------------------------------------------
// Typgruppen
// ---------------------------------------------------------------------------

export const EVENT_TYPES = [
  "bpmn:StartEvent",
  "bpmn:EndEvent",
  "bpmn:IntermediateCatchEvent",
  "bpmn:IntermediateThrowEvent",
  "bpmn:BoundaryEvent",
] as const;

export const CONNECTION_TYPES = [
  "bpmn:SequenceFlow",
  "bpmn:MessageFlow",
  "bpmn:Association",
  "bpmn:DataInputAssociation",
  "bpmn:DataOutputAssociation",
] as const;

export function isConnectionType(type: string): boolean {
  return (CONNECTION_TYPES as readonly string[]).includes(type);
}

export function isFlowNodeBo(bo: ModdleElement | undefined): boolean {
  return is(bo, "bpmn:FlowNode");
}

export function isActivityBo(bo: ModdleElement | undefined): boolean {
  return is(bo, "bpmn:Activity");
}

export function isEventBo(bo: ModdleElement | undefined): boolean {
  return is(bo, "bpmn:Event");
}

export function isGatewayBo(bo: ModdleElement | undefined): boolean {
  return is(bo, "bpmn:Gateway");
}

export function isDataBo(bo: ModdleElement | undefined): boolean {
  return isAny(bo, [
    "bpmn:DataObjectReference",
    "bpmn:DataStoreReference",
    "bpmn:DataInput",
    "bpmn:DataOutput",
  ]);
}

/**
 * Ereignis-Subprozess: `bpmn:SubProcess` mit `triggeredByEvent`.
 * Er darf laut Spezifikation weder ein- noch ausgehende Sequenzflüsse haben.
 */
export function isEventSubProcess(bo: ModdleElement | undefined): boolean {
  return is(bo, "bpmn:SubProcess") && bo?.["triggeredByEvent"] === true;
}

export function isExpandedSubProcess(element: BpmnShape): boolean {
  const bo = boOf(element);
  if (!is(bo, "bpmn:SubProcess") && !is(bo, "bpmn:Transaction")) return false;
  return element.collapsed !== true;
}

/** Container, die `flowElements` tragen. */
export function isFlowElementContainerBo(
  bo: ModdleElement | undefined,
): boolean {
  return isAny(bo, [
    "bpmn:Process",
    "bpmn:SubProcess",
    "bpmn:AdHocSubProcess",
    "bpmn:Transaction",
  ]);
}

// ---------------------------------------------------------------------------
// Container-Auflösung — der Kern von §2.3.1
// ---------------------------------------------------------------------------

/**
 * Der semantische Container, dessen `flowElements` einen Knoten unter `parent`
 * aufnehmen.
 *
 * Das ist die Funktion, an der die Unterscheidung aus Plan §2.3.1 hängt:
 *
 *   - Ziel ist eine **Lane** → der Container ist der Prozess *hinter* der Lane;
 *     `flowElements` ändert sich nicht, nur `flowNodeRef`.
 *   - Ziel ist ein **Participant** → der Container ist dessen `processRef`.
 *   - Ziel ist ein **SubProcess** → der Container ist der SubProcess selbst;
 *     `flowElements` wechselt tatsächlich.
 *   - Ziel ist die **Wurzel** → Prozess oder Collaboration.
 */
export function semanticContainerOf(
  parent: BpmnParent | undefined,
): ModdleElement | undefined {
  let current: BpmnParent | undefined = parent;
  while (current) {
    const bo = boOf(current);
    if (bo) {
      if (isFlowElementContainerBo(bo)) return bo;
      if (is(bo, "bpmn:Participant")) {
        const process = bo["processRef"];
        if (isModdleElement(process)) return process;
      }
      if (is(bo, "bpmn:Collaboration")) return bo;
    }
    current = current.parent;
  }
  return undefined;
}

/** Der `bpmn:Participant`, in dem ein grafisches Element liegt, falls es einen gibt. */
export function participantOf(
  element: BpmnElement | undefined,
): BpmnShape | undefined {
  let current: BpmnParent | undefined = element?.parent;
  while (current) {
    if (is(boOf(current), "bpmn:Participant")) return current as BpmnShape;
    current = current.parent;
  }
  return undefined;
}

/** Die umgebende `bpmn:Collaboration`, falls das Diagramm eine hat. */
export function collaborationOf(
  definitions: ModdleElement,
): ModdleElement | undefined {
  return asArray(definitions["rootElements"]).find((e) =>
    is(e, "bpmn:Collaboration"),
  );
}

/**
 * In welche Liste des Containers gehört ein Element?
 *
 * `flowElements` für Knoten und Sequenzflüsse, `artifacts` für Annotationen
 * und Gruppen, `messageFlows`/`participants` für die Collaboration.
 */
export function containmentProperty(bo: ModdleElement): string {
  if (is(bo, "bpmn:MessageFlow")) return "messageFlows";
  if (is(bo, "bpmn:Participant")) return "participants";
  if (is(bo, "bpmn:Artifact")) return "artifacts";
  if (is(bo, "bpmn:FlowElement")) return "flowElements";
  return "flowElements";
}

/**
 * Fügt `child` in die passende Liste von `container` ein und setzt `$parent`.
 * Gibt eine Funktion zurück, die genau das rückgängig macht — die Grundlage
 * der Undo-Korrektheit dieser Schicht (siehe `BpmnUpdater`).
 */
export function addToContainer(
  container: ModdleElement,
  child: ModdleElement,
  property = containmentProperty(child),
  index?: number,
): () => void {
  const existing = container[property];
  const list: unknown[] = Array.isArray(existing) ? existing : [];
  if (!Array.isArray(existing)) container[property] = list;

  if (list.includes(child)) {
    // Schon drin — nichts zu tun, aber der Rückweg muss trotzdem stimmen.
    const previousParent = child["$parent"];
    child["$parent"] = container;
    return () => {
      child["$parent"] = previousParent;
    };
  }

  const at =
    index === undefined
      ? list.length
      : Math.max(0, Math.min(index, list.length));
  list.splice(at, 0, child);
  const previousParent = child["$parent"];
  child["$parent"] = container;

  return () => {
    const position = list.indexOf(child);
    if (position !== -1) list.splice(position, 1);
    child["$parent"] = previousParent;
  };
}

/** Entfernt `child` aus der Liste; die Rückgabe stellt Position und `$parent` wieder her. */
export function removeFromContainer(
  container: ModdleElement,
  child: ModdleElement,
  property = containmentProperty(child),
): () => void {
  const list = container[property];
  if (!Array.isArray(list)) return () => undefined;
  const index = list.indexOf(child);
  if (index === -1) return () => undefined;
  list.splice(index, 1);
  const previousParent = child["$parent"];
  child["$parent"] = undefined;
  return () => {
    list.splice(Math.min(index, list.length), 0, child);
    child["$parent"] = previousParent;
  };
}

/** Fügt in eine Referenzliste ein (`incoming`, `outgoing`, `flowNodeRef`). */
export function addRef(
  owner: ModdleElement,
  property: string,
  target: ModdleElement,
): () => void {
  const existing = owner[property];
  const list: unknown[] = Array.isArray(existing) ? existing : [];
  if (!Array.isArray(existing)) owner[property] = list;
  if (list.includes(target)) return () => undefined;
  list.push(target);
  return () => {
    const index = list.indexOf(target);
    if (index !== -1) list.splice(index, 1);
  };
}

export function removeRef(
  owner: ModdleElement,
  property: string,
  target: ModdleElement,
): () => void {
  const list = owner[property];
  if (!Array.isArray(list)) return () => undefined;
  const index = list.indexOf(target);
  if (index === -1) return () => undefined;
  list.splice(index, 1);
  return () => {
    list.splice(Math.min(index, list.length), 0, target);
  };
}

/** Setzt eine Eigenschaft und liefert den Rückweg. */
export function setProperty(
  owner: ModdleElement,
  property: string,
  value: unknown,
): () => void {
  const previous = owner[property];
  const existed = property in owner;
  owner[property] = value;
  return () => {
    if (existed) {
      owner[property] = previous;
    } else {
      delete owner[property];
    }
  };
}

// ---------------------------------------------------------------------------
// Grafik
// ---------------------------------------------------------------------------

export function connectionsOf(element: BpmnElement): BpmnConnection[] {
  return [...element.incoming, ...element.outgoing];
}

/** Alle Nachfahren eines grafischen Elements, Blätter zuerst. */
export function descendants(element: BpmnElement): BpmnElement[] {
  const out: BpmnElement[] = [];
  const visit = (node: BpmnElement): void => {
    const children = (node as BpmnShape).children;
    if (Array.isArray(children)) {
      for (const child of children) visit(child);
    }
    const attachers = (node as BpmnShape).attachers;
    if (Array.isArray(attachers)) {
      for (const attacher of attachers) {
        if (!out.includes(attacher)) visit(attacher);
      }
    }
    if (node !== element) out.push(node);
  };
  visit(element);
  return out;
}
