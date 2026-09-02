/**
 * `BpmnRules` — was darf womit verbunden, wohin darf was (Auftrag Punkt 3).
 *
 * Die Regeln sind die einzige Stelle der Schicht, an der ein Fehler *nicht*
 * still ist: eine zu strenge Regel merkt der Benutzer sofort, eine zu lockere
 * erzeugt ein Modell, das der Invariantenprüfer anschließend anmeckert. Beides
 * ist sichtbar. Deshalb sind sie hier bewusst **eng** formuliert — im Zweifel
 * verbieten — und die Ausnahmen stehen einzeln begründet.
 *
 * Grundlage ist BPMN 2.0, §7.3 und §10 (Sequenzfluss-Konnektivität):
 *
 *  - kein eingehender Sequenzfluss am Start-Ereignis, kein ausgehender am
 *    End-Ereignis;
 *  - Sequenzflüsse **nur innerhalb eines Pools**, Nachrichtenflüsse **nur
 *    zwischen** Pools;
 *  - Boundary Events nur an Aktivitäten;
 *  - Datenassoziationen nur zwischen Aktivität und Datenobjekt;
 *  - ein Ereignis-Subprozess (`triggeredByEvent`) hat weder ein- noch
 *    ausgehende Sequenzflüsse.
 *
 * `diagram-js` liefert den `RuleProvider`-Rahmen; die Fragen (`canConnect`,
 * `canMove`, …) stellt es, die Antworten stehen hier.
 */

import RuleProvider from "diagram-js/lib/features/rules/RuleProvider.js";
import type EventBus from "diagram-js/lib/core/EventBus.js";
import { isCollapsedDi } from "./di.js";
import { isLaneShape, isParticipantShape } from "./lanes.js";
import type {
  BpmnElement,
  BpmnParent,
  BpmnShape,
  ModdleElement,
} from "./types.js";
import {
  boOf,
  is,
  isAny,
  isConnectionElement,
  isEventSubProcess,
  isLabel,
  isShapeElement,
  participantOf,
} from "./util.js";

export interface ConnectionSuggestion {
  readonly type: string;
  readonly [key: string]: unknown;
}

export type ConnectionRuleResult = ConnectionSuggestion | boolean | null;

/** Typen, die überhaupt in einem Prozess platziert werden dürfen. */
const PLACEABLE = [
  "bpmn:FlowNode",
  "bpmn:DataObjectReference",
  "bpmn:DataStoreReference",
  "bpmn:TextAnnotation",
  "bpmn:Group",
] as const;

export class BpmnRules extends RuleProvider {
  static $inject = ["eventBus"];

  constructor(eventBus: EventBus) {
    super(eventBus);
  }

  override init(): void {
    this.addRule("connection.create", (context: unknown) => {
      const c = context as { source?: BpmnElement; target?: BpmnElement };
      return canConnect(c.source, c.target);
    });

    this.addRule("connection.reconnect", (context: unknown) => {
      const c = context as {
        connection?: BpmnElement;
        source?: BpmnElement;
        target?: BpmnElement;
      };
      return canReconnect(c.connection, c.source, c.target);
    });

    this.addRule("connection.updateWaypoints", () => true);

    this.addRule("shape.create", (context: unknown) => {
      const c = context as {
        shape?: BpmnShape;
        parent?: BpmnParent;
        target?: BpmnParent;
        source?: BpmnElement;
      };
      const target = c.target ?? c.parent;
      if (!c.shape || !target) return false;
      if (canAttach([c.shape], target) === "attach") return true;
      return canDrop(c.shape, target);
    });

    this.addRule("shape.attach", (context: unknown) => {
      const c = context as { shape?: BpmnShape; target?: BpmnParent };
      if (!c.shape || !c.target) return false;
      return canAttach([c.shape], c.target);
    });

    this.addRule("elements.create", (context: unknown) => {
      const c = context as { elements?: BpmnElement[]; target?: BpmnParent };
      if (!c.elements || !c.target) return false;
      return c.elements.every((element) =>
        isConnectionElement(element) || isLabel(element)
          ? true
          : canDrop(element as BpmnShape, c.target as BpmnParent) === true,
      );
    });

    this.addRule("elements.move", (context: unknown) => {
      const c = context as {
        shapes?: BpmnElement[];
        target?: BpmnParent;
        position?: { x: number; y: number };
      };
      return canMove(c.shapes ?? [], c.target);
    });

    this.addRule("shape.resize", (context: unknown) => {
      const c = context as { shape?: BpmnShape; newBounds?: unknown };
      if (!c.shape) return false;
      return canResize(c.shape);
    });

    this.addRule("elements.delete", (context: unknown) => {
      const c = context as { elements?: BpmnElement[] };
      // Alles darf gelöscht werden **außer** der Wurzel; das Löschen der
      // Kaskade (Kanten, Beschriftungen, Boundary Events) erledigen die
      // Handler, nicht die Regeln.
      return (c.elements ?? []).filter(
        (element) => element.parent !== undefined,
      );
    });

    this.addRule("shape.toggleCollapse", (context: unknown) => {
      const c = context as { shape?: BpmnShape };
      return isAny(boOf(c.shape), ["bpmn:SubProcess", "bpmn:Transaction"]);
    });
  }
}

export default BpmnRules;

// ---------------------------------------------------------------------------
// Verbinden
// ---------------------------------------------------------------------------

/** Ist das Element ein Knoten, an dem eine Kante enden darf? */
function isConnectable(element: BpmnElement | undefined): boolean {
  if (!element || isLabel(element) || isConnectionElement(element))
    return false;
  return true;
}

/**
 * Darf ein **Sequenzfluss** von `source` nach `target` laufen?
 *
 * Die fünf Verbote der Spezifikation, jedes einzeln geprüft, damit ein
 * Regressionstest zeigen kann, *welches* gegriffen hat.
 */
export function canConnectSequenceFlow(
  source: BpmnElement | undefined,
  target: BpmnElement | undefined,
): boolean {
  const sourceBo = boOf(source);
  const targetBo = boOf(target);
  if (!sourceBo || !targetBo) return false;
  if (source === target) return false;

  // (1) beide müssen Flussknoten sein
  if (!is(sourceBo, "bpmn:FlowNode") || !is(targetBo, "bpmn:FlowNode")) {
    return false;
  }

  // (2) End-Ereignis hat keinen Ausgang, Start-Ereignis keinen Eingang
  if (is(sourceBo, "bpmn:EndEvent")) return false;
  if (is(targetBo, "bpmn:StartEvent")) return false;

  // (3) Boundary Events sind nur Quelle, nie Ziel eines Sequenzflusses
  if (is(targetBo, "bpmn:BoundaryEvent")) return false;

  // (4) Ereignis-Subprozesse hängen an keinem Sequenzfluss
  if (isEventSubProcess(sourceBo) || isEventSubProcess(targetBo)) return false;

  // (5) nur innerhalb desselben Pools und desselben Containers
  if (participantOf(source) !== participantOf(target)) return false;
  if (containerOf(source) !== containerOf(target)) return false;

  return true;
}

/** Der grafische Container, dessen `flowElements` ein Knoten angehört. */
function containerOf(element: BpmnElement | undefined): BpmnParent | undefined {
  let current: BpmnParent | undefined = element?.parent;
  while (current) {
    if (isLaneShape(current)) {
      current = current.parent;
      continue;
    }
    return current;
  }
  return undefined;
}

/**
 * Darf ein **Nachrichtenfluss** laufen? Nur zwischen verschiedenen Pools, und
 * nur von/zu Elementen, die Nachrichten senden oder empfangen können.
 */
export function canConnectMessageFlow(
  source: BpmnElement | undefined,
  target: BpmnElement | undefined,
): boolean {
  const sourceBo = boOf(source);
  const targetBo = boOf(target);
  if (!sourceBo || !targetBo || source === target) return false;

  const sourcePool = isParticipantShape(source)
    ? source
    : participantOf(source);
  const targetPool = isParticipantShape(target)
    ? target
    : participantOf(target);
  if (!sourcePool || !targetPool) return false;
  if (sourcePool === targetPool) return false;

  return isMessageEndpoint(sourceBo) && isMessageEndpoint(targetBo);
}

function isMessageEndpoint(bo: ModdleElement): boolean {
  return (
    is(bo, "bpmn:Participant") ||
    is(bo, "bpmn:Activity") ||
    is(bo, "bpmn:EndEvent") ||
    is(bo, "bpmn:IntermediateThrowEvent") ||
    is(bo, "bpmn:IntermediateCatchEvent") ||
    is(bo, "bpmn:StartEvent")
  );
}

/** Assoziation zu/von einer Textannotation. */
export function canConnectAssociation(
  source: BpmnElement | undefined,
  target: BpmnElement | undefined,
): boolean {
  const sourceBo = boOf(source);
  const targetBo = boOf(target);
  if (!sourceBo || !targetBo || source === target) return false;
  return (
    is(sourceBo, "bpmn:TextAnnotation") || is(targetBo, "bpmn:TextAnnotation")
  );
}

function isDataElement(bo: ModdleElement | undefined): boolean {
  return isAny(bo, ["bpmn:DataObjectReference", "bpmn:DataStoreReference"]);
}

/** Datenassoziation: Aktivität ↔ Datenobjekt, in beide Richtungen. */
export function canConnectDataAssociation(
  source: BpmnElement | undefined,
  target: BpmnElement | undefined,
): "bpmn:DataInputAssociation" | "bpmn:DataOutputAssociation" | false {
  const sourceBo = boOf(source);
  const targetBo = boOf(target);
  if (!sourceBo || !targetBo || source === target) return false;
  if (isDataElement(sourceBo) && is(targetBo, "bpmn:Activity")) {
    return "bpmn:DataInputAssociation";
  }
  if (is(sourceBo, "bpmn:Activity") && isDataElement(targetBo)) {
    return "bpmn:DataOutputAssociation";
  }
  return false;
}

/**
 * Die Antwort auf `connection.create`: der Kantentyp, der hier entstehen
 * würde, oder `false`.
 *
 * Reihenfolge ist bedeutsam — Sequenzfluss vor Nachrichtenfluss, sonst würde
 * zwischen zwei Aufgaben desselben Pools nie ein Sequenzfluss vorgeschlagen.
 */
export function canConnect(
  source: BpmnElement | undefined,
  target: BpmnElement | undefined,
): ConnectionRuleResult {
  if (!isConnectable(source) || !isConnectable(target)) return false;

  if (canConnectSequenceFlow(source, target)) {
    return { type: "bpmn:SequenceFlow" };
  }
  const dataAssociation = canConnectDataAssociation(source, target);
  if (dataAssociation) return { type: dataAssociation };
  if (canConnectMessageFlow(source, target))
    return { type: "bpmn:MessageFlow" };
  if (canConnectAssociation(source, target))
    return { type: "bpmn:Association" };
  return false;
}

/** Umhängen ist erlaubt, wenn die neue Kombination denselben Kantentyp trägt. */
export function canReconnect(
  connection: BpmnElement | undefined,
  source: BpmnElement | undefined,
  target: BpmnElement | undefined,
): boolean {
  const bo = boOf(connection);
  if (!bo) return false;
  const suggestion = canConnect(source, target);
  if (suggestion === false || suggestion === null || suggestion === true) {
    return false;
  }
  return suggestion.type === bo.$type;
}

// ---------------------------------------------------------------------------
// Platzieren und Verschieben
// ---------------------------------------------------------------------------

/** Darf `shape` in `target` abgelegt werden? */
export function canDrop(
  shape: BpmnShape | undefined,
  target: BpmnParent | undefined,
): boolean {
  const bo = boOf(shape);
  const targetBo = boOf(target);
  if (!shape || !bo || !target) return false;
  if (isLabel(shape)) return true;

  // Boundary Events kommen nur über `attach` an ihren Platz.
  if (is(bo, "bpmn:BoundaryEvent")) return false;

  // Pools liegen ausschließlich auf der Wurzel — **und** nur dann, wenn die
  // Wurzel bereits eine `bpmn:Collaboration` ist.
  //
  // Der Übergang „Prozess wird zur Collaboration, sobald der erste Pool
  // entsteht" (und der umgekehrte Kollaps beim Löschen des letzten Pools,
  // Plan §2.3.1) wechselt das **Wurzelelement der Ebene**. Das ist eine
  // Operation über alle drei Bäume hinweg und ist in dieser Stufe nicht
  // gebaut. Sie hier zu verbieten ist die ehrliche Variante: der Benutzer
  // bekommt ein „geht nicht", statt eines Pools, der im Editor erscheint und
  // in der Datei fehlt.
  if (is(bo, "bpmn:Participant")) {
    return target.parent === undefined && is(targetBo, "bpmn:Collaboration");
  }

  // Lanes liegen in einem Pool oder in einer Lane.
  if (is(bo, "bpmn:Lane")) {
    return isParticipantShape(target) || isLaneShape(target);
  }

  if (!isAny(bo, PLACEABLE)) return false;

  // In eine Lane darf alles, was auch in den Pool darf.
  if (isLaneShape(target)) return true;
  if (isParticipantShape(target)) return true;

  if (targetBo && isAny(targetBo, ["bpmn:SubProcess", "bpmn:Transaction"])) {
    // Ein eingeklappter Subprozess nimmt nichts auf — sonst entstünden
    // Elemente, die auf keiner Ebene sichtbar sind.
    if ((target as BpmnShape).collapsed === true) return false;
    if (isCollapsedDi(target.di)) return false;
    return true;
  }

  if (targetBo && isAny(targetBo, ["bpmn:Process", "bpmn:Collaboration"])) {
    // In eine Collaboration gehören nur Pools.
    return !is(targetBo, "bpmn:Collaboration");
  }

  // Wurzel ohne businessObject (impliziter Root): erlaubt.
  return target.parent === undefined;
}

/**
 * Darf `shapes` an `target` angeheftet werden? Antwort `"attach"` ist die
 * Konvention von `diagram-js`: sie bedeutet „ja, und zwar als Anheftung".
 */
export function canAttach(
  shapes: readonly BpmnElement[],
  target: BpmnParent | undefined,
): "attach" | false {
  if (shapes.length !== 1) return false;
  const shape = shapes[0];
  if (!shape || !isShapeElement(shape) || !target) return false;

  const bo = boOf(shape);
  const targetBo = boOf(target);
  if (!bo || !targetBo) return false;

  // Nur Boundary Events (und zwischenzeitliche Ereignisse, die dabei zu
  // welchen werden) heften an — und nur an Aktivitäten.
  if (
    !isAny(bo, [
      "bpmn:BoundaryEvent",
      "bpmn:IntermediateThrowEvent",
      "bpmn:IntermediateCatchEvent",
    ])
  ) {
    return false;
  }
  if (!is(targetBo, "bpmn:Activity")) return false;
  // An sich selbst und an einen eingeklappten Container nicht.
  if (shape === target) return false;
  return "attach";
}

/**
 * `elements.move`: alle bewegten Elemente müssen im Ziel zulässig sein.
 *
 * Lanes sind der Sonderfall — sie dürfen ihren Pool nicht verlassen, weil ihr
 * `flowNodeRef` sonst auf Knoten eines fremden Prozesses zeigte
 * (`LANE_REF_FOREIGN_PROCESS`).
 */
export function canMove(
  elements: readonly BpmnElement[],
  target: BpmnParent | undefined,
): boolean {
  if (elements.length === 0) return false;
  if (!target) return true; // Verschieben innerhalb des bisherigen Containers

  for (const element of elements) {
    if (isLabel(element)) continue;
    if (isConnectionElement(element)) continue;
    if (!isShapeElement(element)) return false;

    const bo = boOf(element);
    if (is(bo, "bpmn:Lane")) {
      const pool = participantOf(element);
      const targetPool = isParticipantShape(target)
        ? target
        : participantOf(target);
      if (pool !== targetPool) return false;
      continue;
    }
    if (is(bo, "bpmn:BoundaryEvent")) {
      // Ein Boundary Event bewegt sich nur mit seinem Wirt oder über `attach`.
      if (element.parent === target) continue;
      return false;
    }
    if (!canDrop(element, target)) return false;
  }
  return true;
}

/** Was ist in seiner Größe veränderbar? Ereignisse und Gateways nicht. */
export function canResize(shape: BpmnShape | undefined): boolean {
  const bo = boOf(shape);
  if (!bo) return false;
  return isAny(bo, [
    "bpmn:SubProcess",
    "bpmn:Transaction",
    "bpmn:AdHocSubProcess",
    "bpmn:Participant",
    "bpmn:Lane",
    "bpmn:Group",
    "bpmn:TextAnnotation",
  ]);
}
