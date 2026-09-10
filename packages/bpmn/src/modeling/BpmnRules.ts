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
import { DEFAULT_SIZES } from "./BpmnFactory";
import { isCollapsedDi } from "./di";
import { isLaneShape, isParticipantShape } from "./lanes";
import type {
  BpmnElement,
  BpmnParent,
  BpmnShape,
  ModdleElement,
} from "./types";
import {
  boOf,
  is,
  isAny,
  isConnectionElement,
  isEventSubProcess,
  isLabel,
  isShapeElement,
  participantOf,
} from "./util";

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

    // [ARCTOS-FULL-2026-08-31 · OP-023/OP-025] Hier stand vor `canDrop` noch
    // eine Abkürzung: `if (canAttach([c.shape], target) === "attach") return
    // true;`. Sie war doppelt falsch.
    //
    // (a) **`diagram-js` fragt das Anheften ohnehin zuerst.**
    // `features/create/Create.js` prüft `shape.attach` und erst, wenn das
    // ablehnt, `shape.create`. Die Abkürzung beantwortete also eine Frage, die
    // an dieser Regel gar nicht gestellt wird.
    //
    // (b) **Sie hat das Ablegen erlaubt, wo nur das Anheften zulässig wäre.**
    // Ein `bpmn:IntermediateThrowEvent` ist ein Anheftkandidat; jede Aktivität
    // ist ein zulässiger Wirt. Damit lieferte `shape.create` für „Zwischen-
    // Ereignis auf eine Aktivität" ein `true`, der Aufrufer rief aber
    // `modeling.createShape(shape, position, parent)` **ohne** `isAttach` —
    // das Ereignis landete als gewöhnliches Kind *im* Subprozess statt auf
    // seinem Rand, und die eigentliche Prüfung `canDrop` lief nie. Deren
    // Verbot „ein eingeklappter Subprozess nimmt nichts auf" war damit
    // wirkungslos.
    //
    // Gemessen im Vergleichslauf: `createShape(bpmn:IntermediateThrowEvent,
    // in Sub_Pruefung)` auf `synth-boundary-events` — ARCTOS führte aus,
    // die Referenz lehnte ab (`outcome/createShape/applied-vs-rejected`, 2×).
    // Das so entstandene `IntermediateThrowEvent_1` steckte danach in einem
    // eingeklappten Subprozess, war auf keiner Ebene sichtbar und tauchte als
    // `candidate-set/*/more-ours` wieder auf (2×) — das eine Element zu viel,
    // das der Bericht `STUFE2-D` §2.5 einem `connect`+`undo` zuschrieb.
    this.addRule("shape.create", (context: unknown) => {
      const c = context as {
        shape?: BpmnShape;
        parent?: BpmnParent;
        target?: BpmnParent;
        source?: BpmnElement;
      };
      const target = c.target ?? c.parent;
      if (!c.shape || !target) return false;
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

    // Ausrichten, Verteilen, Kopieren.
    //
    // Sie stehen hier, weil `CommandStack.canExecute` für ein Kommando **ohne
    // Handler** hart `false` liefert: eine nicht formulierte Regel verbietet
    // die Funktion, sie erlaubt sie nicht. Ohne diese drei Zeilen bleiben
    // „ausrichten", „verteilen" und die **gesamte Zwischenablage** stumm
    // wirkungslos (Befund 1 aus `STUFE2-B1-EDITOR.md` §6).
    this.addRule("elements.align", (context: unknown) => {
      const c = context as { elements?: BpmnElement[] };
      return (c.elements ?? []).filter(canAlign);
    });
    this.addRule("elements.distribute", (context: unknown) => {
      const c = context as { elements?: BpmnElement[] };
      return (c.elements ?? []).filter(canAlign);
    });
    this.addRule("element.copy", (context: unknown) => {
      const c = context as { element?: BpmnElement };
      return canCopy(c.element);
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

    this.addRule("shape.replace", (context: unknown) => {
      const c = context as {
        element?: BpmnShape;
        oldShape?: BpmnShape;
        newData?: { type?: string };
      };
      return canReplace(c.oldShape ?? c.element, c.newData?.type);
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

  return isMessageFlowSource(sourceBo) && isMessageFlowTarget(targetBo);
}

/**
 * Ein Nachrichtenfluss hat eine **Richtung**, und ein Ereignis hat sie auch.
 *
 * Hier stand bis zur Divergenzabarbeitung eine einzige Funktion
 * `isMessageEndpoint`, die Start-, End-, Zwischen-Fang- und
 * Zwischen-Wurf-Ereignis auf **beiden** Seiten zuließ. Damit ging
 * `Task → EndEvent` über die Poolgrenze durch — im Vergleichslauf gemessen
 * (`Task_Bank_Entscheiden → End_Kunde` in `synth-collaboration-pools-lanes`),
 * von `bpmn-js` abgelehnt.
 *
 * **Das Urteil kommt nicht von der Referenz, sondern vom Metamodell.** BPMN
 * 2.0 lässt einen Nachrichtenfluss nur zwischen Elementen laufen, die
 * Nachrichten in der jeweiligen Richtung verarbeiten: senden darf ein
 * *werfendes* Ereignis (End, Zwischen-Wurf), empfangen ein *fangendes*
 * (Start, Zwischen-Fang). Ein Nachrichtenfluss **auf** ein End-Ereignis hieße
 * „dieses Ereignis empfängt eine Nachricht" — ein End-Ereignis empfängt
 * nichts, es beendet. Referenz und Spezifikation stimmen überein, ARCTOS war
 * der Ausreißer.
 *
 * Ein Randereignis scheidet auf beiden Seiten aus: es hängt an einer
 * Aktivität und wird von deren Verlauf ausgelöst, nicht von einer Nachricht
 * über die Poolgrenze.
 *
 * **Nicht** übernommen wurde die zusätzliche Strenge von `bpmn-js`, eine
 * `bpmn:MessageEventDefinition` zu verlangen: es lässt ein Ereignis **ohne**
 * jede Ereignisdefinition ebenfalls zu (`hasEventDefinitionOrNone`), und ein
 * frisch gezeichnetes Zwischenereignis hat noch keine. Wer die Nachricht
 * anschließend anlegt, soll die Kante vorher ziehen dürfen.
 */
function isMessageFlowSource(bo: ModdleElement): boolean {
  if (is(bo, "bpmn:Participant")) return true;
  if (is(bo, "bpmn:BoundaryEvent")) return false;
  // Werfend: EndEvent und IntermediateThrowEvent.
  if (is(bo, "bpmn:Event")) return is(bo, "bpmn:ThrowEvent");
  return is(bo, "bpmn:Activity");
}

function isMessageFlowTarget(bo: ModdleElement): boolean {
  if (is(bo, "bpmn:Participant")) return true;
  if (is(bo, "bpmn:BoundaryEvent")) return false;
  // Fangend: StartEvent und IntermediateCatchEvent.
  if (is(bo, "bpmn:Event")) return is(bo, "bpmn:CatchEvent");
  return is(bo, "bpmn:Activity");
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
    // Auf der Wurzel — und zwar auf beiden Sorten Wurzel. Liegt dort noch ein
    // `bpmn:Process`, wandelt `ParticipantBehavior` ihn beim Anlegen des
    // ersten Pools in eine `bpmn:Collaboration` um.
    if (target.parent !== undefined) return false;
    return is(targetBo, "bpmn:Collaboration") || is(targetBo, "bpmn:Process");
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
  if (shape === target) return false;

  // Drei Aktivitäten, an die **kein** Boundary Event gehört. Die Regel „Ziel
  // ist eine Aktivität" allein ist zu grob; der Vergleichslauf gegen `bpmn-js`
  // hat die Lücke gezeigt (Verifikationsbericht §3.7), und die Spezifikation
  // gibt der Referenz recht — es ist also keine Nachahmung, sondern eine
  // Korrektur.
  //
  // (1) **Ereignis-Subprozess.** Er wird durch sein Startereignis ausgelöst,
  //     nicht durch einen Sequenzfluss, und hat weder Rand- noch Kantenkontakt.
  if (isEventSubProcess(targetBo)) return false;

  // (2) **Kompensationsaktivität.** Sie läuft außerhalb des normalen Ablaufs;
  //     ein Ereignis auf ihrem Rand hätte keinen Auslösekontext.
  if (targetBo["isForCompensation"] === true) return false;

  // (3) **Receive Task hinter einem ereignisbasierten Gateway.** Das Gateway
  //     entscheidet dort bereits über das eintreffende Ereignis; ein
  //     zusätzliches Boundary Event wäre ein zweiter, widersprüchlicher
  //     Auslöser.
  if (is(targetBo, "bpmn:ReceiveTask") && followsEventBasedGateway(target)) {
    return false;
  }

  return "attach";
}

/** Hat dieses Element einen eingehenden Fluss aus einem ereignisbasierten Gateway? */
function followsEventBasedGateway(element: BpmnParent): boolean {
  const incoming = (element as { incoming?: unknown }).incoming;
  if (!Array.isArray(incoming)) return false;
  return incoming.some((connection) => {
    const source = (connection as { source?: BpmnElement }).source;
    return is(boOf(source), "bpmn:EventBasedGateway");
  });
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

/**
 * Darf dieses Element durch den genannten Typ ersetzt werden?
 *
 * Verboten sind die Strukturträger: Ein Pool oder eine Lane zu „ersetzen"
 * hieße, den Prozess dahinter, seine Lane-Hierarchie und die
 * `flowNodeRef`-Zuordnungen aller Knoten umzuhängen — das ist kein Typwechsel,
 * sondern ein Umbau des Diagramms, und er steht nicht in dieser Stufe.
 */
export function canReplace(
  element: BpmnShape | undefined,
  newType: string | undefined,
): boolean {
  const bo = boOf(element);
  if (!bo || typeof newType !== "string" || newType === "") return false;
  if (isAny(bo, ["bpmn:Participant", "bpmn:Lane"])) return false;
  // Zieltyp muss selbst platzierbar sein — ein `bpmn:Participant` als Ziel
  // wäre derselbe Strukturumbau von der anderen Seite.
  if (newType === "bpmn:Participant" || newType === "bpmn:Lane") return false;
  return true;
}

const RESIZABLE = [
  "bpmn:SubProcess",
  "bpmn:Transaction",
  "bpmn:AdHocSubProcess",
  "bpmn:Participant",
  "bpmn:Lane",
  "bpmn:Group",
  "bpmn:TextAnnotation",
] as const;

/**
 * Was ist in seiner Größe veränderbar — und wie klein darf es werden?
 *
 * Die Antwort ist bewusst **kein** blankes `true`: `diagram-js` liest die
 * Untergrenze aus `context.minDimensions` und nimmt ohne Angabe 10 × 10 an.
 * Ein Pool mit 10 × 10 ist kein Pool mehr — er zeigt weder seinen Namen noch
 * seine Lanes, und die Lane-Zuordnung rechnet anschließend jeden Knoten aus
 * ihm heraus. Die Untergrenze ist damit eine **Regel** und keine Frage der
 * Bedienoberfläche; sie stand bis hierher in der Editor-Schicht
 * (`STUFE2-B1-EDITOR.md` §6, Befund 2) und gehört hierher.
 *
 * Das Ergebnis ist wahrheitswertig verwendbar (`false` oder ein Objekt), so
 * wie `canConnect` es mit seinem Kantenvorschlag schon hält.
 */
export type ResizeRuleResult = false | { readonly minDimensions: Dimensions };

export interface Dimensions {
  readonly width: number;
  readonly height: number;
}

export function canResize(shape: BpmnShape | undefined): ResizeRuleResult {
  const bo = boOf(shape);
  if (!bo || !isAny(bo, RESIZABLE)) return false;
  return { minDimensions: minDimensionsFor(shape as BpmnShape) };
}

/**
 * Mindestmaße je Typ.
 *
 * Container werden auf einen Bruchteil ihrer Vorgabegröße begrenzt: klein
 * genug, dass Umbauen möglich bleibt, groß genug, dass Beschriftung und Inhalt
 * noch Platz haben. Abgeleitet aus {@link DEFAULT_SIZES} derselben Schicht,
 * damit es keine zweite Wahrheit über Elementgrößen gibt.
 */
export function minDimensionsFor(shape: BpmnShape | undefined): Dimensions {
  const bo = boOf(shape);
  const type = bo?.$type ?? shape?.type ?? "";
  if (isAny(bo, ["bpmn:Participant", "bpmn:Lane"])) {
    return { width: 300, height: 60 };
  }
  if (is(bo, "bpmn:TextAnnotation")) return { width: 50, height: 30 };
  if (
    isAny(bo, [
      "bpmn:Group",
      "bpmn:SubProcess",
      "bpmn:Transaction",
      "bpmn:AdHocSubProcess",
    ])
  ) {
    return { width: 140, height: 120 };
  }
  const fallback = DEFAULT_SIZES[type];
  if (fallback) {
    return {
      width: Math.max(36, Math.round(fallback.width / 2)),
      height: Math.max(36, Math.round(fallback.height / 2)),
    };
  }
  return { width: 50, height: 50 };
}

// ---------------------------------------------------------------------------
// Ausrichten, Verteilen, Kopieren
// ---------------------------------------------------------------------------

/**
 * Was sich ausrichten und verteilen lässt.
 *
 * Rein strukturell: keine Kanten (ihre Geometrie folgt den Knoten), keine
 * Beschriftungen (sie folgen ihrem Ziel), keine Rahmen (Pools, Lanes, Gruppen
 * — sie *sind* das Raster, an dem ausgerichtet wird; ein ausgerichteter Pool
 * verschöbe die Lane-Zuordnung aller Knoten darin).
 */
export function canAlign(element: BpmnElement | undefined): boolean {
  if (!element || element.parent === undefined) return false;
  const shape = element as BpmnShape;
  if (typeof shape.width !== "number") return false;
  if (shape.labelTarget !== undefined) return false;
  if (shape.isFrame === true) return false;
  return !isAny(boOf(element), ["bpmn:Participant", "bpmn:Lane", "bpmn:Group"]);
}

/**
 * Kopiert wird alles außer der Wurzel.
 *
 * Was mit einem kopierten Element anschließend geschehen darf, entscheidet
 * `elements.create` beim Einfügen — hier eine zweite Meinung darüber zu
 * formulieren wäre der Anfang zweier Wahrheiten.
 */
export function canCopy(element: BpmnElement | undefined): boolean {
  return element !== undefined && element.parent !== undefined;
}
