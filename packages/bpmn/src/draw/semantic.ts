import type {
  BpmnConnection,
  BpmnElement,
  BpmnShape,
  ModdleElement,
} from "./types";
import { isConnection } from "./types";

/**
 * Typabfragen auf dem moddle-Baum.
 *
 * Bewusst *keine* Nutzung von `moddle`s `$instanceOf`: die Zeichenschicht soll
 * auch mit einfachen Objektliteralen (Tests, serverseitiges Rendern aus der DB)
 * funktionieren. Die wenigen Vererbungsbeziehungen, die der Renderer braucht,
 * stehen deshalb explizit in Tabellen.
 */

const EVENT_TYPES = new Set([
  "bpmn:StartEvent",
  "bpmn:EndEvent",
  "bpmn:IntermediateCatchEvent",
  "bpmn:IntermediateThrowEvent",
  "bpmn:BoundaryEvent",
  // [ARCTOS-FULL-2026-08-31 · OP-046] `bpmn:ImplicitThrowEvent` fehlte und
  // wurde deshalb als gestricheltes „nicht unterstützt"-Rechteck gezeichnet.
  // Es ist ein Ereignis der Ausführungssemantik (BPMN 2.0 §10.5.6) und wird
  // dargestellt wie ein werfendes Zwischenereignis — doppelter Rand, gefülltes
  // Symbol. Im Bestandskorpus kommt es nicht vor; das ist ein Grund, es klein
  // zu halten, aber keiner, ein Rechteck mit Typnamen dafür zu zeigen.
  "bpmn:ImplicitThrowEvent",
]);

const TASK_TYPES = new Set([
  "bpmn:Task",
  "bpmn:UserTask",
  "bpmn:ServiceTask",
  "bpmn:SendTask",
  "bpmn:ReceiveTask",
  "bpmn:ManualTask",
  "bpmn:BusinessRuleTask",
  "bpmn:ScriptTask",
]);

const SUBPROCESS_TYPES = new Set([
  "bpmn:SubProcess",
  "bpmn:AdHocSubProcess",
  "bpmn:Transaction",
]);

const GATEWAY_TYPES = new Set([
  "bpmn:ExclusiveGateway",
  "bpmn:ParallelGateway",
  "bpmn:InclusiveGateway",
  "bpmn:EventBasedGateway",
  "bpmn:ComplexGateway",
]);

const DATA_TYPES = new Set([
  "bpmn:DataObjectReference",
  "bpmn:DataStoreReference",
  "bpmn:DataInput",
  "bpmn:DataOutput",
]);

const CONNECTION_TYPES = new Set([
  "bpmn:SequenceFlow",
  "bpmn:MessageFlow",
  "bpmn:Association",
  "bpmn:DataInputAssociation",
  "bpmn:DataOutputAssociation",
]);

/** Alle Elementtypen, die dieser Renderer zeichnet. */
export const SUPPORTED_SHAPE_TYPES: readonly string[] = [
  ...EVENT_TYPES,
  ...TASK_TYPES,
  ...SUBPROCESS_TYPES,
  "bpmn:CallActivity",
  ...GATEWAY_TYPES,
  ...DATA_TYPES,
  "bpmn:Participant",
  "bpmn:Lane",
  "bpmn:TextAnnotation",
  "bpmn:Group",
];

export const SUPPORTED_CONNECTION_TYPES: readonly string[] = [
  ...CONNECTION_TYPES,
];

export function isEvent(type: string): boolean {
  return EVENT_TYPES.has(type);
}

export function isTask(type: string): boolean {
  return TASK_TYPES.has(type);
}

export function isSubProcess(type: string): boolean {
  return SUBPROCESS_TYPES.has(type);
}

export function isGateway(type: string): boolean {
  return GATEWAY_TYPES.has(type);
}

export function isActivity(type: string): boolean {
  return isTask(type) || isSubProcess(type) || type === "bpmn:CallActivity";
}

export function isDataElement(type: string): boolean {
  return DATA_TYPES.has(type);
}

export function isSupportedShapeType(type: string): boolean {
  return SUPPORTED_SHAPE_TYPES.includes(type);
}

export function isSupportedConnectionType(type: string): boolean {
  return CONNECTION_TYPES.has(type);
}

/** Ereignisse, die ihr Symbol *werfen* (gefüllt gezeichnet). */
export function isThrowing(type: string): boolean {
  return (
    type === "bpmn:EndEvent" ||
    type === "bpmn:IntermediateThrowEvent" ||
    // [ARCTOS-FULL-2026-08-31 · OP-046] Ein implizites Wurfereignis wirft.
    type === "bpmn:ImplicitThrowEvent"
  );
}

/** Der Rand ist doppelt bei Zwischen- und Randereignissen. */
export function hasDoubleBorder(type: string): boolean {
  return (
    type === "bpmn:IntermediateCatchEvent" ||
    type === "bpmn:IntermediateThrowEvent" ||
    // [ARCTOS-FULL-2026-08-31 · OP-046]
    type === "bpmn:ImplicitThrowEvent" ||
    type === "bpmn:BoundaryEvent"
  );
}

/** Der Rand ist dick beim Endereignis. */
export function hasThickBorder(type: string): boolean {
  return type === "bpmn:EndEvent";
}

function asElement(value: unknown): ModdleElement | undefined {
  if (
    value !== null &&
    typeof value === "object" &&
    "$type" in (value as object)
  ) {
    return value as ModdleElement;
  }
  return undefined;
}

function asElements(value: unknown): ModdleElement[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: ModdleElement[] = [];
  for (const entry of value) {
    const element = asElement(entry);
    if (element) {
      out.push(element);
    }
  }
  return out;
}

export type EventDefinitionType =
  | "message"
  | "timer"
  | "error"
  | "escalation"
  | "cancel"
  | "compensate"
  | "conditional"
  | "link"
  | "signal"
  | "terminate"
  | "multiple"
  | "parallelMultiple"
  | "none";

const EVENT_DEFINITION_MAP: Readonly<Record<string, EventDefinitionType>> = {
  "bpmn:MessageEventDefinition": "message",
  "bpmn:TimerEventDefinition": "timer",
  "bpmn:ErrorEventDefinition": "error",
  "bpmn:EscalationEventDefinition": "escalation",
  "bpmn:CancelEventDefinition": "cancel",
  "bpmn:CompensateEventDefinition": "compensate",
  "bpmn:ConditionalEventDefinition": "conditional",
  "bpmn:LinkEventDefinition": "link",
  "bpmn:SignalEventDefinition": "signal",
  "bpmn:TerminateEventDefinition": "terminate",
};

/**
 * Ereignisart aus den `eventDefinitions`.
 *
 * Mehrere Definitionen ergeben `multiple` bzw. `parallelMultiple`, abhängig von
 * `parallelMultiple` am Ereignis (BPMN 2.0, Tabelle 10.87).
 */
export function getEventDefinitionType(
  businessObject: ModdleElement,
): EventDefinitionType {
  const definitions = asElements(businessObject["eventDefinitions"]);
  if (definitions.length === 0) {
    return "none";
  }
  if (definitions.length > 1) {
    return businessObject["parallelMultiple"] === true
      ? "parallelMultiple"
      : "multiple";
  }
  const first = definitions[0];
  if (!first) {
    return "none";
  }
  return EVENT_DEFINITION_MAP[first.$type] ?? "none";
}

/** Nicht unterbrechende Rand-/Ereignis-Subprozess-Startereignisse: gestrichelter Rand. */
export function isInterrupting(businessObject: ModdleElement): boolean {
  if (businessObject.$type === "bpmn:BoundaryEvent") {
    return businessObject["cancelActivity"] !== false;
  }
  if (businessObject.$type === "bpmn:StartEvent") {
    // `isInterrupting` ist nur bei Ereignis-Subprozess-Starts gesetzt.
    return businessObject["isInterrupting"] !== false;
  }
  return true;
}

export interface ActivityMarkers {
  /** Zusammengeklappter Subprozess/CallActivity: Kasten mit Plus. */
  readonly collapsed: boolean;
  readonly loop: boolean;
  readonly parallelMultiInstance: boolean;
  readonly sequentialMultiInstance: boolean;
  readonly compensation: boolean;
  readonly adHoc: boolean;
}

/** Marker am unteren Rand einer Aktivität (BPMN 2.0, Tabelle 10.3). */
export function getActivityMarkers(shape: BpmnShape): ActivityMarkers {
  const bo = shape.businessObject;
  const loopCharacteristics = asElement(bo["loopCharacteristics"]);
  const loopType = loopCharacteristics?.$type;
  const isMultiInstance = loopType === "bpmn:MultiInstanceLoopCharacteristics";
  const isSequential =
    isMultiInstance && loopCharacteristics?.["isSequential"] === true;

  return {
    collapsed: isCollapsed(shape),
    loop: loopType === "bpmn:StandardLoopCharacteristics",
    parallelMultiInstance: isMultiInstance && !isSequential,
    sequentialMultiInstance: isSequential,
    compensation: bo["isForCompensation"] === true,
    adHoc: bo.$type === "bpmn:AdHocSubProcess",
  };
}

/**
 * Ein Subprozess gilt als zugeklappt, wenn die DI `isExpanded` nicht auf `true`
 * setzt. CallActivities sind per Definition immer zugeklappt dargestellt.
 */
export function isCollapsed(shape: BpmnShape): boolean {
  const type = shape.type;
  if (type === "bpmn:CallActivity") {
    return true;
  }
  if (!isSubProcess(type)) {
    return false;
  }
  const di = shape.di;
  if (di && "isExpanded" in di) {
    return di["isExpanded"] !== true;
  }
  return true;
}

/** Wagerechter Pool? BPMN-DI-Attribut `isHorizontal`, Vorgabe: waagerecht. */
export function isHorizontal(shape: BpmnShape): boolean {
  const di = shape.di;
  if (di && "isHorizontal" in di) {
    return di["isHorizontal"] !== false;
  }
  return true;
}

/** Ein Pool ohne Prozessreferenz wird als „black box" ohne Lanes gezeichnet. */
export function isBlackBoxPool(shape: BpmnShape): boolean {
  return (
    shape.type === "bpmn:Participant" && !shape.businessObject["processRef"]
  );
}

/** Bedingter Ablauf: `conditionExpression` und kein Gateway als Quelle. */
export function isConditionalFlow(connection: BpmnConnection): boolean {
  if (connection.type !== "bpmn:SequenceFlow") {
    return false;
  }
  if (!connection.businessObject["conditionExpression"]) {
    return false;
  }
  const sourceType = connection.source?.type;
  return sourceType === undefined || !isGateway(sourceType);
}

/** Standardablauf: das Quellelement zeigt mit `default` auf diese Kante. */
export function isDefaultFlow(connection: BpmnConnection): boolean {
  if (connection.type !== "bpmn:SequenceFlow") {
    return false;
  }
  const source = connection.source;
  if (!source) {
    return false;
  }
  const defaultRef = source.businessObject["default"];
  const referenced = asElement(defaultRef);
  if (referenced) {
    return referenced.id === connection.id;
  }
  return typeof defaultRef === "string" && defaultRef === connection.id;
}

export function isDirectedAssociation(connection: BpmnConnection): boolean {
  const direction = connection.businessObject["associationDirection"];
  return direction === "One" || direction === "Both";
}

/** Der Name, der als Beschriftung gezeichnet wird. */
export function getLabelText(element: BpmnElement): string {
  const bo = element.businessObject;
  if (bo.$type === "bpmn:TextAnnotation") {
    const text = bo["text"];
    return typeof text === "string" ? text : "";
  }
  return typeof bo.name === "string" ? bo.name : "";
}

/**
 * Zugängliche Rollenbezeichnung für ARIA (§4.2): Aktivitäten und Gateways sind
 * bedienbar (`button`), Artefakte und Kanten sind rein darstellend (`img`).
 */
export function getAriaRole(element: BpmnElement): "button" | "img" {
  if (isConnection(element)) {
    return "img";
  }
  const type = element.type;
  if (type === "bpmn:TextAnnotation" || type === "bpmn:Group") {
    return "img";
  }
  return "button";
}

/** Menschenlesbarer Typname (deutsch) für Vorlesetexte und Textalternative. */
export function getTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type.replace(/^bpmn:/, "");
}

const TYPE_LABELS: Readonly<Record<string, string>> = {
  "bpmn:StartEvent": "Startereignis",
  "bpmn:EndEvent": "Endereignis",
  "bpmn:IntermediateCatchEvent": "eintretendes Zwischenereignis",
  "bpmn:IntermediateThrowEvent": "ausgelöstes Zwischenereignis",
  "bpmn:BoundaryEvent": "Randereignis",
  "bpmn:Task": "Aufgabe",
  "bpmn:UserTask": "Benutzeraufgabe",
  "bpmn:ServiceTask": "Serviceaufgabe",
  "bpmn:SendTask": "Sendeaufgabe",
  "bpmn:ReceiveTask": "Empfangsaufgabe",
  "bpmn:ManualTask": "manuelle Aufgabe",
  "bpmn:BusinessRuleTask": "Geschäftsregelaufgabe",
  "bpmn:ScriptTask": "Skriptaufgabe",
  "bpmn:CallActivity": "Aufruf eines Unterprozesses",
  "bpmn:SubProcess": "Unterprozess",
  "bpmn:AdHocSubProcess": "Ad-hoc-Unterprozess",
  "bpmn:Transaction": "Transaktion",
  "bpmn:ExclusiveGateway": "exklusives Gateway",
  "bpmn:ParallelGateway": "paralleles Gateway",
  "bpmn:InclusiveGateway": "inklusives Gateway",
  "bpmn:EventBasedGateway": "ereignisbasiertes Gateway",
  "bpmn:ComplexGateway": "komplexes Gateway",
  "bpmn:DataObjectReference": "Datenobjekt",
  "bpmn:DataStoreReference": "Datenspeicher",
  "bpmn:DataInput": "Dateneingabe",
  "bpmn:DataOutput": "Datenausgabe",
  "bpmn:Participant": "Pool",
  "bpmn:Lane": "Lane",
  "bpmn:TextAnnotation": "Textanmerkung",
  "bpmn:Group": "Gruppe",
  "bpmn:SequenceFlow": "Sequenzfluss",
  "bpmn:ImplicitThrowEvent": "Implizites Wurfereignis",
  "bpmn:MessageFlow": "Nachrichtenfluss",
  "bpmn:Association": "Assoziation",
  "bpmn:DataInputAssociation": "Dateneingabe-Assoziation",
  "bpmn:DataOutputAssociation": "Datenausgabe-Assoziation",
};

const EVENT_DEFINITION_LABELS: Readonly<Record<EventDefinitionType, string>> = {
  message: "Nachricht",
  timer: "Zeit",
  error: "Fehler",
  escalation: "Eskalation",
  cancel: "Abbruch",
  compensate: "Kompensation",
  conditional: "Bedingung",
  link: "Verknüpfung",
  signal: "Signal",
  terminate: "Terminierung",
  multiple: "mehrere Auslöser",
  parallelMultiple: "mehrere parallele Auslöser",
  none: "",
};

export function getEventDefinitionLabel(type: EventDefinitionType): string {
  return EVENT_DEFINITION_LABELS[type];
}
