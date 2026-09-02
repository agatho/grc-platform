/**
 * `BpmnUpdater` — das Kernstück und die Hauptfehlerquelle (Auftrag Punkt 2,
 * Plan §2.3.1).
 *
 * Er hört auf die Kommandos von `diagram-js` und schreibt danach das
 * semantische Modell und die DI nach. `diagram-js` pflegt Baum 3 selbst
 * (`object-refs` bindet `parent`/`children`, `host`/`attachers`,
 * `source`/`outgoing`, `target`/`incoming` beidseitig); hier entstehen Baum 1
 * und Baum 2.
 *
 * ## Die Entwurfsentscheidung, an der die Undo-Korrektheit hängt
 *
 * Jedes Kommando braucht ein korrektes Inverses, sonst ist Undo Datenverlust
 * (SPIKE-MESSUNG-MODEL §6). Statt für jede Operation eine zweite,
 * handgeschriebene Rückwärts-Implementierung zu pflegen — die genau dann
 * falsch ist, wenn niemand hinsieht — arbeitet dieser Updater mit
 * **Rückwegen**: jede Mutation liefert die Funktion mit, die sie aufhebt
 * (`addToContainer`, `removeRef`, `setProperty`, `setBounds`, …). Sie werden
 * in der Kommando-Kontextmappe gesammelt und beim `reverted` in umgekehrter
 * Reihenfolge abgespielt.
 *
 * Das ist nicht nur weniger Code, es ist eine **strukturelle** Zusicherung:
 * Vorwärts- und Rückwärtsweg entstehen an derselben Stelle aus derselben
 * Information. Eine Mutation ohne Rückweg ist ein Typfehler, kein
 * Testversagen. Die Tests prüfen die Invarianten trotzdem nach jedem Undo —
 * die Zusicherung deckt die Mechanik ab, nicht die Absicht.
 *
 * ## Was hier bewusst *nicht* passiert
 *
 * Kaskaden (beim Löschen eines Knotens auch dessen Kanten, Beschriftungen,
 * Boundary-Events) laufen **nicht** hier, sondern als weitere Kommandos in
 * `preExecute` — teils von `diagram-js` selbst (`DeleteShapeHandler`,
 * `attach-support`, `label-support`), teils aus `behaviors/`. Damit hängt jede
 * Teilwirkung am `commandStack` und wird von einem einzigen `undo` mit
 * zurückgerollt.
 */

import CommandInterceptor from "diagram-js/lib/command/CommandInterceptor.js";
import type EventBus from "diagram-js/lib/core/EventBus.js";
import type { BpmnFactory } from "./BpmnFactory.js";
import {
  addDi,
  buildDiIndex,
  planeFor,
  planeOfDi,
  planesOf,
  removeDi,
} from "./di.js";
import { walkDocument } from "./invariants.js";
import {
  clearLabelBounds,
  externalLabelBounds,
  writeLabelBounds,
} from "./labels.js";
import {
  dropLaneRefs,
  laneFor,
  lanesRootOf,
  reassignLaneRefs,
} from "./lanes.js";
import type {
  BpmnConnection,
  BpmnElement,
  BpmnParent,
  BpmnShape,
  ModdleElement,
} from "./types.js";
import {
  addRef,
  addToContainer,
  asArray,
  boOf,
  collaborationOf,
  containmentProperty,
  is,
  isAny,
  isConnectionElement,
  isLabel,
  isModdleElement,
  isShapeElement,
  removeFromContainer,
  removeRef,
  semanticContainerOf,
  setProperty,
} from "./util.js";

type Revert = () => void;

/** Schlüssel der Rückwegliste in der Kommando-Kontextmappe. */
const REVERTS = "__arctosBpmnUpdaterReverts";

interface CommandContext {
  [key: string]: unknown;
}

function reverts(context: CommandContext): Revert[] {
  const existing = context[REVERTS];
  if (Array.isArray(existing)) return existing as Revert[];
  const created: Revert[] = [];
  context[REVERTS] = created;
  return created;
}

function undoAll(context: CommandContext): void {
  const list = context[REVERTS];
  if (!Array.isArray(list)) return;
  for (let index = list.length - 1; index >= 0; index -= 1) {
    (list[index] as Revert)();
  }
  context[REVERTS] = [];
}

export class BpmnUpdater extends CommandInterceptor {
  static $inject = ["eventBus", "bpmnFactory"];

  constructor(
    eventBus: EventBus,
    private readonly bpmnFactory: BpmnFactory,
  ) {
    super(eventBus);
    this.register();
  }

  // -------------------------------------------------------------------------
  // Registrierung
  // -------------------------------------------------------------------------

  private register(): void {
    const pair = (
      events: string | string[],
      apply: (context: CommandContext) => void,
    ): void => {
      this.executed(events, (event: { context?: CommandContext }) => {
        const context = event.context;
        if (!context) return;
        context[REVERTS] = [];
        apply(context);
      });
      this.reverted(events, (event: { context?: CommandContext }) => {
        if (event.context) undoAll(event.context);
      });
    };

    pair("shape.create", (c) => {
      this.onShapeCreate(c);
    });
    pair("shape.delete", (c) => {
      this.onShapeDelete(c);
    });
    pair("shape.move", (c) => {
      this.onShapeMove(c);
    });
    pair("shape.resize", (c) => {
      this.onShapeResize(c);
    });
    pair("shape.toggleCollapse", (c) => {
      this.onToggleCollapse(c);
    });
    pair("label.create", (c) => {
      this.onLabelCreate(c);
    });
    pair("connection.create", (c) => {
      this.onConnectionCreate(c);
    });
    pair("connection.delete", (c) => {
      this.onConnectionDelete(c);
    });
    pair(
      ["connection.layout", "connection.updateWaypoints", "connection.move"],
      (c) => {
        this.onConnectionGeometry(c);
      },
    );
    pair("connection.reconnect", (c) => {
      this.onConnectionReconnect(c);
    });
    pair("element.updateAttachment", (c) => {
      this.onUpdateAttachment(c);
    });
    pair("element.updateProperties", (c) => {
      this.onUpdateProperties(c);
    });
    pair("element.updateLabel", (c) => {
      this.onUpdateLabel(c);
    });
  }

  // -------------------------------------------------------------------------
  // Zugriff auf die Bäume
  // -------------------------------------------------------------------------

  private definitions(): ModdleElement | undefined {
    return this.bpmnFactory.getDefinitions();
  }

  /**
   * Die Ebene, in die die DI eines Elements gehört.
   *
   * Der Weg läuft über die grafische Wurzel: `importer.ts` hängt an jedes
   * Wurzelelement die zugehörige `BPMNPlane` als `di`. Damit ist die Zuordnung
   * eindeutig, auch wenn ein Dokument mehrere Diagramme hat — der Fall, den
   * `buildScene` im Betrachter noch mit einer Warnung abtut.
   */
  private planeOf(element: BpmnElement | undefined): ModdleElement | undefined {
    let current: BpmnElement | undefined = element;
    while (current) {
      if (current.parent === undefined) break;
      current = current.parent;
    }
    const di = current?.di;
    if (isModdleElement(di) && di.$type === "bpmndi:BPMNPlane") return di;

    const definitions = this.definitions();
    if (!definitions) return undefined;
    const rootBo = boOf(current);
    if (rootBo) {
      const found = planeFor(definitions, rootBo);
      if (found) return found;
    }
    return planesOf(definitions)[0];
  }

  private diOf(element: BpmnElement): ModdleElement | undefined {
    if (isModdleElement(element.di)) return element.di;
    const definitions = this.definitions();
    const bo = boOf(element);
    if (!definitions || !bo) return undefined;
    return buildDiIndex(definitions).get(bo);
  }

  // -------------------------------------------------------------------------
  // shape.create
  // -------------------------------------------------------------------------

  private onShapeCreate(context: CommandContext): void {
    const shape = context["shape"] as BpmnShape | undefined;
    if (!shape) return;
    const undo = reverts(context);

    if (isLabel(shape)) {
      this.attachLabelToDi(shape, undo);
      return;
    }

    const bo = boOf(shape);
    if (!bo) return;

    this.insertSemantic(shape, bo, undo);
    this.createDiFor(shape, bo, undo);
    this.syncLaneMembership(shape, undo);
    this.syncBoundaryHost(shape, undo);
  }

  /**
   * Hängt das semantische Objekt in den richtigen Container.
   *
   * Die drei Sonderfälle, die das von „push in flowElements" unterscheiden,
   * sind genau die aus §2.3.1:
   *  - **Participant**: gehört in die `bpmn:Collaboration`, und der Prozess
   *    dahinter in `definitions.rootElements`;
   *  - **Lane**: gehört in einen `bpmn:LaneSet` des Prozesses, nicht in
   *    `flowElements`;
   *  - **Artifact** (TextAnnotation, Group): gehört in `artifacts`.
   */
  private insertSemantic(
    element: BpmnElement,
    bo: ModdleElement,
    undo: Revert[],
  ): void {
    const definitions = this.definitions();

    if (is(bo, "bpmn:Participant")) {
      const collaboration = definitions
        ? collaborationOf(definitions)
        : undefined;
      if (collaboration)
        undo.push(addToContainer(collaboration, bo, "participants"));

      // Ein Pool **ohne** `processRef` ist kein Pool, sondern ein Rechteck:
      // die Lanes, die man hineinlegt, hätten keinen Prozess, und
      // `flowNodeRef` zeigte auf Knoten, die nirgends stehen. Der Prozess
      // entsteht deshalb zusammen mit dem Pool und wandert mit ihm in
      // `rootElements`.
      let process = bo["processRef"];
      if (!isModdleElement(process)) {
        process = this.bpmnFactory.create(
          "bpmn:Process",
          { isExecutable: false },
          definitions ? { parent: definitions } : {},
        );
        undo.push(setProperty(bo, "processRef", process));
      }
      if (definitions && isModdleElement(process)) {
        undo.push(addToContainer(definitions, process, "rootElements"));
      }
      return;
    }

    if (is(bo, "bpmn:Lane")) {
      const container = semanticContainerOf(element.parent);
      if (!container) return;
      const parentBo = boOf(element.parent);
      const laneSet = this.laneSetFor(container, parentBo, undo);
      undo.push(addToContainer(laneSet, bo, "lanes"));
      return;
    }

    const container = semanticContainerOf(element.parent);
    if (!container) return;
    undo.push(addToContainer(container, bo, containmentProperty(bo)));
  }

  private laneSetFor(
    container: ModdleElement,
    parentBo: ModdleElement | undefined,
    undo: Revert[],
  ): ModdleElement {
    if (parentBo && is(parentBo, "bpmn:Lane")) {
      const existing = parentBo["childLaneSet"];
      if (isModdleElement(existing)) return existing;
      const created = this.bpmnFactory.create(
        "bpmn:LaneSet",
        {},
        { parent: parentBo },
      );
      parentBo["childLaneSet"] = created;
      undo.push(() => {
        delete parentBo["childLaneSet"];
      });
      return created;
    }
    const sets = asArray(container["laneSets"]);
    const first = sets[0];
    if (first) return first;
    const created = this.bpmnFactory.create(
      "bpmn:LaneSet",
      {},
      { parent: container },
    );
    undo.push(addToContainer(container, created, "laneSets"));
    return created;
  }

  private createDiFor(
    element: BpmnElement,
    bo: ModdleElement,
    undo: Revert[],
  ): void {
    const plane = this.planeOf(element);
    if (!plane) return;
    const existing = this.diOf(element);
    if (existing) {
      // Wiederherstellung nach Undo/Redo: die DI existiert noch, sie muss nur
      // zurück in die Ebene. Ein zweiter Eintrag wäre DI_DUPLICATE.
      if (!planeOfDi(this.definitions() ?? plane, existing)) {
        undo.push(addDi(plane, existing));
      }
      element.di = existing;
      return;
    }
    const di = isConnectionElement(element)
      ? this.bpmnFactory.createDiEdge(bo, element.waypoints)
      : this.bpmnFactory.createDiShape(bo, element as BpmnShape);
    undo.push(addDi(plane, di));
    element.di = di;
    undo.push(() => {
      element.di = undefined;
    });
  }

  /** Beschriftungs-Shape → `BPMNLabel/bounds` am DI des Ziels. */
  private attachLabelToDi(label: BpmnShape, undo: Revert[]): void {
    const target = label.labelTarget;
    if (!target) return;
    const di = this.diOf(target);
    if (!di) return;
    undo.push(writeLabelBounds(this.bpmnFactory, di, label));
  }

  private onLabelCreate(context: CommandContext): void {
    const shape = context["shape"] as BpmnShape | undefined;
    if (!shape) return;
    this.attachLabelToDi(shape, reverts(context));
  }

  // -------------------------------------------------------------------------
  // shape.delete
  // -------------------------------------------------------------------------

  private onShapeDelete(context: CommandContext): void {
    const shape = context["shape"] as BpmnShape | undefined;
    if (!shape) return;
    const undo = reverts(context);

    if (isLabel(shape)) {
      const target = shape.labelTarget;
      const di = target ? this.diOf(target) : undefined;
      if (di) undo.push(clearLabelBounds(di));
      return;
    }

    const bo = boOf(shape);
    if (!bo) return;

    // 1. Lane-Verweise: ein Knoten, der gelöscht wird, aber in `flowNodeRef`
    //    stehen bleibt, ist genau die stille Referenzleiche, vor der
    //    SPIKE-MESSUNG-MODEL §6.3 warnt.
    const oldParent =
      (context["oldParent"] as BpmnParent | undefined) ?? shape.parent;
    const container = semanticContainerOf(oldParent);
    if (is(bo, "bpmn:FlowNode")) {
      undo.push(...dropLaneRefs(container, bo));
    }

    // Verschwindet eine **Lane**, fallen ihre Knoten in die Lane darüber —
    // oder in gar keine. Beides muss `flowNodeRef` widerspiegeln. Ohne diese
    // Neuzuordnung stünde nach dem Entfernen der letzten inneren Lane ein
    // Knoten in keiner einzigen Lane, obwohl er geometrisch mitten in der
    // äußeren liegt.
    if (is(bo, "bpmn:Lane")) {
      const laneRoot = oldParent
        ? (lanesRootOf(oldParent) ?? oldParent)
        : undefined;
      this.resyncLaneMembersUnder(laneRoot, undo);
    }

    // 2. DI aus der Ebene nehmen (die DI selbst bleibt am Element hängen,
    //    damit ein Undo sie unverändert zurückgeben kann).
    const di = this.diOf(shape);
    const definitions = this.definitions();
    if (di && definitions) {
      const plane = planeOfDi(definitions, di) ?? this.planeOf(shape);
      if (plane) undo.push(removeDi(plane, di));
    }

    // 3. semantisch aushängen
    this.removeSemantic(bo, undo);

    // 4. Participant: der Prozess dahinter geht mit — seine flowElements sind
    //    zu diesem Zeitpunkt bereits von `DeleteShapeHandler` geleert.
    if (is(bo, "bpmn:Participant") && definitions) {
      const process = bo["processRef"];
      // **Es sei denn, der Prozess ist gerade zur Wurzel geworden.** Beim
      // Löschen des letzten Pools bindet `ParticipantBehavior` die Ebene
      // vorher auf diesen Prozess zurück (Plan §2.3.1: die Collaboration
      // kollabiert). Ihn dann aus `rootElements` zu nehmen, hieße: das
      // Diagramm zeigt einen Prozess, den das Dokument nicht mehr enthält.
      // Geprüft wird an der **DI**, nicht am grafischen Baum: zu diesem
      // Zeitpunkt ist der Pool schon aus der Fläche genommen, sein `parent`
      // also nicht mehr aussagekräftig. Trägt eine Ebene den Prozess als
      // `bpmnElement`, ist er die neue Wurzel und bleibt.
      const isPlaneRoot =
        isModdleElement(process) &&
        planesOf(definitions).some((plane) => plane["bpmnElement"] === process);
      if (isModdleElement(process) && !isPlaneRoot) {
        undo.push(removeFromContainer(definitions, process, "rootElements"));
      }
    }

    // 5. Datenassoziationen, die auf das gelöschte Element zeigen.
    this.dropDataAssociations(bo, undo);

    // 5b. Datenassoziationen, die das gelöschte Element **selbst besitzt**.
    this.dropOwnedDataAssociationDi(bo, undo);

    // 6. Eigene Diagrammebenen des Elements und seiner Nachfahren.
    this.dropOwnPlanes(bo, undo);
  }

  /**
   * Nimmt die DI der eigenen Datenassoziationen aus der Ebene.
   *
   * Der Spiegelfall zu {@link dropDataAssociations}: Dort geht es um
   * Assoziationen **anderer** Aktivitäten, die auf das gelöschte Datenobjekt
   * zeigen; hier um die, die die gelöschte **Aktivität selbst trägt**. Sie
   * verschwinden semantisch von allein — sie stehen in
   * `activity.dataInputAssociations` und gehen mit der Aktivität aus
   * `flowElements`. Ihre `bpmndi:BPMNEdge` steht aber in der Ebene und bleibt
   * dort zurück, weil eine Datenassoziation regelmäßig kein grafisches
   * Element hat und die Kaskade von `DeleteShapeHandler` sie deshalb nicht
   * anfasst. Ergebnis: eine Kante in der Ebene, die auf ein Element zeigt, das
   * es nicht mehr gibt — `moddle` verwirft den Verweis beim nächsten Speichern
   * still (Round-Trip-Bericht, Ursache 2).
   *
   * Gefunden vom Eigenschaftslauf über 1.000 Folgen: `remove(D_Task_Erfassen)`
   * in `synth-data-objects-and-artifacts`, eine einzige Operation.
   */
  private dropOwnedDataAssociationDi(bo: ModdleElement, undo: Revert[]): void {
    const definitions = this.definitions();
    if (!definitions) return;
    const index = buildDiIndex(definitions);

    for (const { element } of walkDocument(bo)) {
      if (
        !isAny(element, [
          "bpmn:DataInputAssociation",
          "bpmn:DataOutputAssociation",
        ])
      ) {
        continue;
      }
      const di = index.get(element);
      if (!di) continue;
      const plane = planeOfDi(definitions, di);
      if (plane) undo.push(removeDi(plane, di));
    }
  }

  /**
   * Entfernt jede `dataInputAssociation`/`dataOutputAssociation` im Dokument,
   * die auf das gelöschte Element zeigt.
   *
   * Warum das nicht über die grafische Kaskade läuft: Eine Datenassoziation ist
   * im Korpus regelmäßig **nicht gezeichnet**. `DataOutputAssoc_1` in
   * `synth-data-objects-and-artifacts` hat nur einen `targetRef` und gar keinen
   * `sourceRef`, `DataInputAssoc_1` zeigt auf eine `bpmn:Property` als
   * Platzhalter. Solche Assoziationen haben kein grafisches Gegenstück, also
   * greift `DeleteShapeHandler` nicht — und der Verweis überlebt das Löschen
   * des Datenobjekts. Beim nächsten Speichern verwirft `moddle` ihn still
   * (Round-Trip-Bericht, Ursache 2). Gefunden vom Eigenschaftslauf des
   * Verifikationsstrangs bei Folge 90 von 200 (§3.4).
   */
  private dropDataAssociations(bo: ModdleElement, undo: Revert[]): void {
    const definitions = this.definitions();
    if (!definitions) return;

    for (const { element } of walkDocument(definitions)) {
      for (const property of [
        "dataInputAssociations",
        "dataOutputAssociations",
      ] as const) {
        for (const assoc of asArray(element[property])) {
          if (!referencesElement(assoc, bo)) continue;
          undo.push(removeFromContainer(element, assoc, property));
          const di = buildDiIndex(definitions).get(assoc);
          if (!di) continue;
          const plane = planeOfDi(definitions, di);
          if (plane) undo.push(removeDi(plane, di));
        }
      }
    }
  }

  /**
   * Entfernt die eigene `BPMNPlane` des gelöschten Elements — und die seiner
   * semantischen Nachfahren.
   *
   * Ein aufgeklappter oder eingeklappter Subprozess kann eine eigene
   * Diagrammebene haben (`<bpmndi:BPMNPlane bpmnElement="Sub_L1">`). Wird er
   * gelöscht, bleibt diese Ebene mit allen `BPMNShape`/`BPMNEdge` darin im
   * Dokument stehen und zeigt auf Elemente, die es nicht mehr gibt
   * (Verifikationsbericht §3.2: eine Operation, kein Undo, sieben verwaiste
   * Einträge).
   *
   * Die **Nachfahren** müssen mit, weil ein eingeklappter Subprozess seine
   * Kinder gar nicht erst grafisch bekommt: sie verschwinden mit ihm aus dem
   * semantischen Baum, ohne dass je ein `shape.delete` für sie liefe. Ihre
   * Ebenen kennt deshalb nur dieser Durchlauf.
   */
  private dropOwnPlanes(bo: ModdleElement, undo: Revert[]): void {
    const definitions = this.definitions();
    if (!definitions) return;

    const removed = new Set<ModdleElement>([bo]);
    const collect = (container: ModdleElement): void => {
      for (const child of asArray(container["flowElements"])) {
        if (removed.has(child)) continue;
        removed.add(child);
        collect(child);
      }
    };
    collect(bo);

    for (const diagram of asArray(definitions["diagrams"])) {
      const plane = diagram["plane"];
      if (!isModdleElement(plane)) continue;
      const root = plane["bpmnElement"];
      if (!isModdleElement(root) || !removed.has(root)) continue;
      undo.push(removeFromContainer(definitions, diagram, "diagrams"));
    }
  }

  private removeSemantic(bo: ModdleElement, undo: Revert[]): void {
    const parent = bo["$parent"];
    if (!isModdleElement(parent)) return;
    if (is(bo, "bpmn:Lane")) {
      undo.push(removeFromContainer(parent, bo, "lanes"));
      return;
    }
    undo.push(removeFromContainer(parent, bo, containmentProperty(bo)));
  }

  // -------------------------------------------------------------------------
  // shape.move
  // -------------------------------------------------------------------------

  private onShapeMove(context: CommandContext): void {
    const shape = context["shape"] as BpmnShape | undefined;
    if (!shape) return;
    const undo = reverts(context);

    if (isLabel(shape)) {
      const target = shape.labelTarget;
      const di = target ? this.diOf(target) : undefined;
      if (di) undo.push(writeLabelBounds(this.bpmnFactory, di, shape));
      return;
    }

    const bo = boOf(shape);
    if (!bo) return;

    // Geometrie
    const di = this.diOf(shape);
    if (di) undo.push(this.bpmnFactory.setBounds(di, shape));

    // Containerwechsel: **nur** wenn sich der semantische Container ändert.
    // Der Wechsel in eine andere Lane desselben Pools ändert ihn nicht — das
    // ist der Unterschied, den §2.3.1 als Musterfall nennt.
    const oldParent = context["oldParent"] as BpmnParent | undefined;
    const oldContainer = semanticContainerOf(oldParent);
    const newContainer = semanticContainerOf(shape.parent);
    if (newContainer && oldContainer !== newContainer) {
      this.moveSemantic(bo, oldContainer, newContainer, undo);
    }

    this.syncLaneMembership(shape, undo, oldContainer);
    this.syncBoundaryHost(shape, undo);
  }

  private moveSemantic(
    bo: ModdleElement,
    oldContainer: ModdleElement | undefined,
    newContainer: ModdleElement,
    undo: Revert[],
  ): void {
    const property = containmentProperty(bo);
    const from = isModdleElement(bo["$parent"]) ? bo["$parent"] : oldContainer;
    if (from) undo.push(removeFromContainer(from, bo, property));
    undo.push(addToContainer(newContainer, bo, property));
  }

  /**
   * `flowNodeRef` an die geometrisch innerste Lane hängen.
   *
   * Wird nach **jedem** Erzeugen, Verschieben und Anheften aufgerufen, weil
   * jede dieser Operationen die Lane wechseln kann, ohne dass der Benutzer es
   * beabsichtigt hätte — und weil ein falscher `flowNodeRef` am Bild nicht zu
   * sehen ist.
   */
  private syncLaneMembership(
    shape: BpmnShape,
    undo: Revert[],
    previousContainer?: ModdleElement | undefined,
  ): void {
    const bo = boOf(shape);
    if (!bo || !is(bo, "bpmn:FlowNode")) return;

    const container = semanticContainerOf(shape.parent);
    if (previousContainer && previousContainer !== container) {
      undo.push(...dropLaneRefs(previousContainer, bo));
    }
    if (!container) return;

    const root = lanesRootOf(shape);
    const lane = root ? laneFor(shape, root) : undefined;
    const laneBo = boOf(lane);
    undo.push(...reassignLaneRefs(container, bo, laneBo));
  }

  /** `attachedToRef` eines Boundary Events an den grafischen Wirt angleichen. */
  private syncBoundaryHost(shape: BpmnShape, undo: Revert[]): void {
    const bo = boOf(shape);
    if (!bo || !is(bo, "bpmn:BoundaryEvent")) return;
    const hostBo = boOf(shape.host);
    if (hostBo && bo["attachedToRef"] !== hostBo) {
      undo.push(setProperty(bo, "attachedToRef", hostBo));
    }
  }

  // -------------------------------------------------------------------------
  // shape.resize / toggleCollapse
  // -------------------------------------------------------------------------

  private onShapeResize(context: CommandContext): void {
    const shape = context["shape"] as BpmnShape | undefined;
    if (!shape) return;
    const undo = reverts(context);
    const di = this.diOf(shape);
    if (di) undo.push(this.bpmnFactory.setBounds(di, shape));
    this.syncLaneMembership(shape, undo);

    // Wächst oder schrumpft eine **Lane**, wechseln nicht ihre eigenen
    // Koordinaten die Zugehörigkeit, sondern die der Knoten, die dadurch neu
    // in sie hinein- oder aus ihr herausfallen. Ohne diese Zeile bleibt ein
    // Knoten nach `lane.remove` an der gelöschten Lane hängen — ein Fehler,
    // der am Bild vollkommen richtig aussieht und den erst
    // `LANE_REF_NOT_IN_DOCUMENT` sichtbar macht.
    const bo = boOf(shape);
    if (is(bo, "bpmn:Lane") || is(bo, "bpmn:Participant")) {
      this.resyncLaneMembers(shape, undo);
    }
  }

  /** Alle Flussknoten unter der Lane-Wurzel neu zuordnen. */
  private resyncLaneMembers(shape: BpmnShape, undo: Revert[]): void {
    this.resyncLaneMembersUnder(lanesRootOf(shape) ?? shape, undo);
  }

  private resyncLaneMembersUnder(
    root: BpmnParent | undefined,
    undo: Revert[],
  ): void {
    if (!root) return;
    const children = (root as BpmnShape).children ?? [];
    for (const child of children) {
      if (!isShapeElement(child)) continue;
      const childBo = boOf(child);
      if (!is(childBo, "bpmn:FlowNode")) continue;
      this.syncLaneMembership(child, undo);
    }
  }

  private onToggleCollapse(context: CommandContext): void {
    const shape = context["shape"] as BpmnShape | undefined;
    if (!shape) return;
    const undo = reverts(context);
    const di = this.diOf(shape);
    if (!di) return;
    undo.push(setProperty(di, "isExpanded", shape.collapsed !== true));
    undo.push(this.bpmnFactory.setBounds(di, shape));
  }

  // -------------------------------------------------------------------------
  // Verbindungen
  // -------------------------------------------------------------------------

  private onConnectionCreate(context: CommandContext): void {
    const connection = context["connection"] as BpmnConnection | undefined;
    if (!connection) return;
    const undo = reverts(context);
    const bo = boOf(connection);
    if (!bo) return;

    const source =
      (context["source"] as BpmnElement | undefined) ?? connection.source;
    const target =
      (context["target"] as BpmnElement | undefined) ?? connection.target;

    this.wireEndpoints(bo, source, target, undo);
    this.insertConnectionSemantic(connection, bo, source, target, undo);
    this.createDiFor(connection, bo, undo);
  }

  /**
   * `sourceRef`/`targetRef` **und** die beidseitigen `incoming`/`outgoing`-
   * Listen. Beide Richtungen, immer — die Invarianten `OUTGOING_MISSING`,
   * `INCOMING_MISSING`, `OUTGOING_STALE` und `INCOMING_STALE` prüfen genau
   * das, weil `moddle` beim Schreiben nur `sourceRef` serialisiert und eine
   * halb gepflegte Liste erst beim nächsten Lesen auffliegt.
   */
  private wireEndpoints(
    bo: ModdleElement,
    source: BpmnElement | undefined,
    target: BpmnElement | undefined,
    undo: Revert[],
  ): void {
    const sourceBo = boOf(source);
    const targetBo = boOf(target);

    if (
      is(bo, "bpmn:DataInputAssociation") ||
      is(bo, "bpmn:DataOutputAssociation")
    ) {
      // Datenassoziationen führen keine incoming/outgoing-Listen; ihre Quelle
      // ist eine Mengeneigenschaft.
      if (sourceBo) undo.push(setProperty(bo, "sourceRef", [sourceBo]));
      if (targetBo) undo.push(setProperty(bo, "targetRef", targetBo));
      return;
    }

    // **Nur Sequenzflüsse.** `bpmn:FlowNode.incoming` und `.outgoing` sind im
    // BPMN-2.0-Metamodell als Verweise auf `bpmn:SequenceFlow` typisiert. Ein
    // Nachrichtenfluss, der dort steht, wird vom nächsten Leser als
    // Sequenzfluss aufgelöst — das Diagramm sieht richtig aus, der Prozess ist
    // ein anderer. Der Vergleichslauf gegen `bpmn-js` hat den Fall entschieden
    // (Verifikationsbericht §3.3): gleiche Eingabe, gleiche Operation,
    // Referenz widerspricht, und das Metamodell gibt der Referenz recht.
    const twoSided = is(bo, "bpmn:SequenceFlow");

    if (sourceBo) {
      undo.push(setProperty(bo, "sourceRef", sourceBo));
      if (twoSided) undo.push(addRef(sourceBo, "outgoing", bo));
    }
    if (targetBo) {
      undo.push(setProperty(bo, "targetRef", targetBo));
      if (twoSided) undo.push(addRef(targetBo, "incoming", bo));
    }
  }

  /**
   * In welchen Container gehört eine Kante?
   *
   *  - `MessageFlow` → die `bpmn:Collaboration`, immer;
   *  - `Association` → `artifacts` des gemeinsamen Containers;
   *  - `DataInput/OutputAssociation` → an die Aktivität, nicht in `flowElements`;
   *  - `SequenceFlow` → `flowElements` des **gemeinsamen** Containers von
   *    Quelle und Ziel. Bei einem Sprung über Containergrenzen hinweg wäre die
   *    Kante ohnehin regelwidrig; die Regeln fangen das vorher ab.
   */
  private insertConnectionSemantic(
    connection: BpmnConnection,
    bo: ModdleElement,
    source: BpmnElement | undefined,
    target: BpmnElement | undefined,
    undo: Revert[],
  ): void {
    const definitions = this.definitions();

    if (is(bo, "bpmn:MessageFlow")) {
      const collaboration = definitions
        ? collaborationOf(definitions)
        : undefined;
      if (collaboration)
        undo.push(addToContainer(collaboration, bo, "messageFlows"));
      return;
    }

    if (is(bo, "bpmn:DataInputAssociation")) {
      const activityBo = boOf(target);
      if (activityBo) {
        undo.push(addToContainer(activityBo, bo, "dataInputAssociations"));
      }
      return;
    }
    if (is(bo, "bpmn:DataOutputAssociation")) {
      const activityBo = boOf(source);
      if (activityBo) {
        undo.push(addToContainer(activityBo, bo, "dataOutputAssociations"));
      }
      return;
    }

    const container =
      semanticContainerOf(connection.parent) ??
      semanticContainerOf(source?.parent) ??
      semanticContainerOf(target?.parent);
    if (!container) return;
    undo.push(addToContainer(container, bo, containmentProperty(bo)));
  }

  private onConnectionDelete(context: CommandContext): void {
    const connection = context["connection"] as BpmnConnection | undefined;
    if (!connection) return;
    const undo = reverts(context);
    const bo = boOf(connection);
    if (!bo) return;

    const sourceBo = boOf(
      (context["source"] as BpmnElement | undefined) ?? connection.source,
    );
    const targetBo = boOf(
      (context["target"] as BpmnElement | undefined) ?? connection.target,
    );

    // `default`-Fluss: wer den Standardausgang eines Gateways löscht, muss
    // die Rückreferenz mitnehmen. Sonst zeigt `default` beim nächsten
    // Speichern ins Leere und moddle verschluckt sie stumm.
    if (sourceBo && sourceBo["default"] === bo) {
      undo.push(setProperty(sourceBo, "default", undefined));
    }

    if (sourceBo) undo.push(removeRef(sourceBo, "outgoing", bo));
    if (targetBo) undo.push(removeRef(targetBo, "incoming", bo));

    const di = this.diOf(connection);
    const definitions = this.definitions();
    if (di && definitions) {
      const plane = planeOfDi(definitions, di) ?? this.planeOf(connection);
      if (plane) undo.push(removeDi(plane, di));
    }

    const parent = bo["$parent"];
    if (isModdleElement(parent)) {
      undo.push(removeFromContainer(parent, bo, this.connectionProperty(bo)));
    }
  }

  private connectionProperty(bo: ModdleElement): string {
    if (is(bo, "bpmn:MessageFlow")) return "messageFlows";
    if (is(bo, "bpmn:DataInputAssociation")) return "dataInputAssociations";
    if (is(bo, "bpmn:DataOutputAssociation")) return "dataOutputAssociations";
    if (is(bo, "bpmn:Association")) return "artifacts";
    return "flowElements";
  }

  private onConnectionGeometry(context: CommandContext): void {
    const connection = context["connection"] as BpmnConnection | undefined;
    if (!connection) return;
    const undo = reverts(context);
    const di = this.diOf(connection);
    if (di) undo.push(this.bpmnFactory.setWaypoints(di, connection.waypoints));

    // `connection.move` kann den Container wechseln (Kante in einen
    // SubProcess hinein): dann wandert auch `flowElements`.
    const bo = boOf(connection);
    if (!bo || is(bo, "bpmn:MessageFlow")) return;
    const oldParent = context["oldParent"] as BpmnParent | undefined;
    if (!oldParent) return;
    const oldContainer = semanticContainerOf(oldParent);
    const newContainer = semanticContainerOf(connection.parent);
    if (newContainer && oldContainer !== newContainer) {
      this.moveSemantic(bo, oldContainer, newContainer, undo);
    }
  }

  /**
   * Umhängen einer Kante: `sourceRef`/`targetRef`, **beide** Listen auf
   * **beiden** alten und neuen Knoten, und die Wegpunkte. Der Fall, den
   * Plan §2.3.1 als zweites Beispiel nennt.
   */
  private onConnectionReconnect(context: CommandContext): void {
    const connection = context["connection"] as BpmnConnection | undefined;
    if (!connection) return;
    const undo = reverts(context);
    const bo = boOf(connection);
    if (!bo) return;

    const oldSource = boOf(context["oldSource"] as BpmnElement | undefined);
    const oldTarget = boOf(context["oldTarget"] as BpmnElement | undefined);
    const newSource = boOf(
      (context["newSource"] as BpmnElement | undefined) ?? connection.source,
    );
    const newTarget = boOf(
      (context["newTarget"] as BpmnElement | undefined) ?? connection.target,
    );

    // Eintragen nur für Sequenzflüsse (siehe `wireEndpoints`), **austragen**
    // dagegen immer: eine Altdatei kann einen Nachrichtenfluss fälschlich in
    // den Listen führen, und dann muss das Umhängen ihn dort auch entfernen.
    const twoSided = is(bo, "bpmn:SequenceFlow");

    if (newSource && newSource !== oldSource) {
      if (oldSource) {
        if (oldSource["default"] === bo) {
          undo.push(setProperty(oldSource, "default", undefined));
        }
        undo.push(removeRef(oldSource, "outgoing", bo));
      }
      undo.push(setProperty(bo, "sourceRef", newSource));
      if (twoSided) undo.push(addRef(newSource, "outgoing", bo));
    }

    if (newTarget && newTarget !== oldTarget) {
      if (oldTarget) undo.push(removeRef(oldTarget, "incoming", bo));
      undo.push(setProperty(bo, "targetRef", newTarget));
      if (twoSided) undo.push(addRef(newTarget, "incoming", bo));
    }

    const di = this.diOf(connection);
    if (di) undo.push(this.bpmnFactory.setWaypoints(di, connection.waypoints));
  }

  // -------------------------------------------------------------------------
  // Anheften
  // -------------------------------------------------------------------------

  private onUpdateAttachment(context: CommandContext): void {
    const shape = context["shape"] as BpmnShape | undefined;
    if (!shape) return;
    const undo = reverts(context);
    const bo = boOf(shape);
    if (!bo) return;

    const newHost = context["newHost"] as BpmnShape | undefined;
    const hostBo = boOf(newHost);
    undo.push(setProperty(bo, "attachedToRef", hostBo));

    // Ein abgelöstes Boundary Event bleibt ein `bpmn:BoundaryEvent` ohne Wirt
    // — das ist ein ungültiges Modell. Die Regeln verbieten das Ablösen
    // deshalb; hier wird nur der Zustand nachgeführt, den `diagram-js`
    // hergestellt hat, damit die Invariante den Fehler *meldet* statt ihn zu
    // verstecken.
    if (hostBo) {
      const container = semanticContainerOf(newHost?.parent);
      const currentContainer = isModdleElement(bo["$parent"])
        ? bo["$parent"]
        : undefined;
      if (container && currentContainer !== container) {
        this.moveSemantic(bo, currentContainer, container, undo);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Eigenschaften und Beschriftung
  // -------------------------------------------------------------------------

  /**
   * Nach `element.updateProperties` ist die Semantik bereits vom Handler
   * geschrieben (dort liegt auch der Rückweg). Hier bleibt die Nachführung
   * der anderen beiden Bäume: eine geänderte `id` muss in der
   * `elementRegistry` ankommen — das erledigt der Handler —, und eine
   * geänderte Beschriftung braucht eine Beschriftungsbox in der DI.
   */
  private onUpdateProperties(context: CommandContext): void {
    const element = context["element"] as BpmnElement | undefined;
    if (!element) return;
    const undo = reverts(context);
    this.syncLabelBox(element, undo);
  }

  private onUpdateLabel(context: CommandContext): void {
    const element = context["element"] as BpmnElement | undefined;
    if (!element) return;
    this.syncLabelBox(element, reverts(context));
  }

  private syncLabelBox(element: BpmnElement, undo: Revert[]): void {
    const target = isLabel(element)
      ? ((element as BpmnShape).labelTarget ?? element)
      : element;
    const di = this.diOf(target);
    if (!di) return;
    const labelShape = Array.isArray(target.labels)
      ? target.labels[0]
      : undefined;
    if (labelShape) {
      undo.push(writeLabelBounds(this.bpmnFactory, di, labelShape));
      return;
    }
    const text = boOf(target)?.["name"];
    if (typeof text === "string" && text !== "") {
      undo.push(
        writeLabelBounds(this.bpmnFactory, di, externalLabelBounds(target, di)),
      );
    }
  }
}

export default BpmnUpdater;

/**
 * Zeigt eine Datenassoziation auf `target`? Geprüft werden beide Enden, und
 * `sourceRef` auch als Mengeneigenschaft — das Schema erlaubt dort mehrere.
 */
function referencesElement(
  assoc: ModdleElement,
  target: ModdleElement,
): boolean {
  for (const property of ["sourceRef", "targetRef"] as const) {
    const value = assoc[property];
    if (value === target) return true;
    if (Array.isArray(value) && value.includes(target)) return true;
  }
  return false;
}

/** Nur für Tests: sind an einem Element alle drei Bäume verbunden? */
export function isFullyLinked(element: BpmnElement): boolean {
  return (
    isModdleElement(element.businessObject) &&
    (isLabel(element) || isModdleElement(element.di)) &&
    (isShapeElement(element) || isConnectionElement(element))
  );
}
