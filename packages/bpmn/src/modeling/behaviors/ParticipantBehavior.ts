/**
 * Der Übergang Prozessdiagramm ↔ Kollaborationsdiagramm.
 *
 * BPMN kennt für dasselbe Bild zwei Wurzeln: Ein Diagramm ohne Pools zeigt
 * einen `bpmn:Process`, ein Diagramm mit Pools eine `bpmn:Collaboration`. Der
 * Benutzer merkt davon nichts — er zieht einen Pool auf die Fläche. Die
 * Modellierungsschicht muss den Wurzelwechsel dahinter erledigen, sonst
 * entsteht ein Pool, der im Editor steht und in der Datei fehlt (Plan §2.3.1).
 *
 * Beide Richtungen laufen als **zusammengesetztes Kommando**: ein kleines
 * Kommando mit handgeschriebenem Rückweg (`root.rebind`, drei Verweise) plus
 * gewöhnliche Modellierungsoperationen für alles andere. Ein einziges `undo`
 * nimmt den ganzen Übergang zurück.
 *
 * **Hinweg** (erster Pool):
 *   1. `bpmn:Collaboration` anlegen, Wurzel darauf umbinden;
 *   2. der neue Participant bekommt den **vorhandenen** Prozess als
 *      `processRef` — nicht einen neuen, sonst hinge der bisherige Inhalt an
 *      einem Prozess, den niemand mehr darstellt;
 *   3. alles, was bisher auf der Wurzel lag, wandert in den Pool.
 *
 * **Rückweg** (letzter Pool wird gelöscht):
 *   1. der Inhalt des Pools wandert auf die Wurzel — **vor** der Löschkaskade,
 *      sonst nimmt `DeleteShapeHandler` ihn mit;
 *   2. Wurzel zurück auf den Prozess umbinden, Collaboration entfernen.
 */

import CommandInterceptor from "diagram-js/lib/command/CommandInterceptor.js";
import type EventBus from "diagram-js/lib/core/EventBus.js";
import type { BpmnFactory } from "../BpmnFactory.js";
import { planeFor } from "../di.js";
import { processOfParticipant } from "../cmd/RootRebindHandler.js";
import type {
  BpmnElement,
  BpmnParent,
  BpmnRoot,
  BpmnShape,
  ModdleElement,
} from "../types.js";
import { asArray, boOf, is, isShapeElement } from "../util.js";

const HIGH_PRIORITY = 2000;

interface ModelingLike {
  moveElements(
    shapes: BpmnElement[],
    delta: { x: number; y: number },
    target?: BpmnParent,
    hints?: Record<string, unknown>,
  ): void;
}

interface CommandStackLike {
  execute(command: string, context: Record<string, unknown>): void;
}

interface CanvasLike {
  getRootElement(): unknown;
}

export class ParticipantBehavior extends CommandInterceptor {
  static $inject = [
    "eventBus",
    "modeling",
    "commandStack",
    "canvas",
    "bpmnFactory",
  ];

  constructor(
    eventBus: EventBus,
    private readonly modeling: ModelingLike,
    private readonly commandStack: CommandStackLike,
    private readonly canvas: CanvasLike,
    private readonly bpmnFactory: BpmnFactory,
  ) {
    super(eventBus);

    this.preExecute(
      "shape.create",
      HIGH_PRIORITY,
      (event: { context?: Record<string, unknown> }) => {
        const context = event.context;
        if (!context) return;
        this.onCreateParticipant(context);
      },
    );

    this.postExecute(
      "shape.create",
      (event: { context?: Record<string, unknown> }) => {
        const context = event.context;
        if (!context) return;
        this.movePreviousContentIntoPool(context);
      },
    );

    this.preExecute(
      "shape.delete",
      HIGH_PRIORITY,
      (event: { context?: Record<string, unknown> }) => {
        const context = event.context;
        if (!context) return;
        this.onDeleteLastParticipant(context);
      },
    );
  }

  // -------------------------------------------------------------------------
  // Hinweg
  // -------------------------------------------------------------------------

  private onCreateParticipant(context: Record<string, unknown>): void {
    const shape = context["shape"] as BpmnShape | undefined;
    const bo = boOf(shape);
    if (!shape || !bo || !is(bo, "bpmn:Participant")) return;

    const root = this.root();
    const rootBo = boOf(root);
    if (!rootBo || !is(rootBo, "bpmn:Process")) return;

    const definitions = this.bpmnFactory.getDefinitions();
    const plane = definitions ? planeFor(definitions, rootBo) : undefined;
    if (!definitions || !plane) return;

    // Der bisherige Inhalt der Wurzel muss **vor** dem Umbinden festgehalten
    // werden: danach ist die Wurzel eine Collaboration, und was dort liegt,
    // wäre semantisch nicht mehr einzuordnen.
    context["__previousRootChildren"] = [...(root.children ?? [])].filter(
      (child) => child !== shape,
    );

    const collaboration = this.bpmnFactory.create(
      "bpmn:Collaboration",
      {},
      { parent: definitions },
    );

    this.commandStack.execute("root.rebind", {
      root,
      plane,
      definitions,
      newBo: collaboration,
      addToRootElements: collaboration,
    });

    // Der Pool übernimmt den vorhandenen Prozess. Ohne das legte der Updater
    // einen zweiten an, und der bisherige Inhalt hinge an einem Prozess, den
    // keine Ebene mehr zeigt.
    if (bo["processRef"] === undefined) bo["processRef"] = rootBo;
  }

  private movePreviousContentIntoPool(context: Record<string, unknown>): void {
    const shape = context["shape"] as BpmnShape | undefined;
    const previous = context["__previousRootChildren"] as
      BpmnElement[] | undefined;
    if (!shape || !previous || previous.length === 0) return;

    // Beschriftungen wandern mit ihrem Ziel; sie einzeln zu bewegen führte zu
    // doppelten Verschiebungen.
    const movable = previous.filter(
      (element) => (element as BpmnShape).labelTarget === undefined,
    );
    if (movable.length === 0) return;
    this.modeling.moveElements(movable, { x: 0, y: 0 }, shape, {
      autoResize: false,
    });
  }

  // -------------------------------------------------------------------------
  // Rückweg
  // -------------------------------------------------------------------------

  private onDeleteLastParticipant(context: Record<string, unknown>): void {
    const shape = context["shape"] as BpmnShape | undefined;
    const bo = boOf(shape);
    if (!shape || !bo || !is(bo, "bpmn:Participant")) return;

    const root = this.root();
    const rootBo = boOf(root);
    if (!rootBo || !is(rootBo, "bpmn:Collaboration")) return;

    // Nur wenn es der letzte Pool ist.
    const remaining = (root.children ?? []).filter(
      (child) => child !== shape && is(boOf(child), "bpmn:Participant"),
    );
    if (remaining.length > 0) return;

    const process = processOfParticipant(bo);
    if (!process) return;

    const definitions = this.bpmnFactory.getDefinitions();
    const plane = definitions ? planeFor(definitions, rootBo) : undefined;
    if (!definitions || !plane) return;

    // (1) **Zuerst** die Wurzel zurückbinden, dann den Inhalt bewegen.
    //
    // Die Reihenfolge ist nicht beliebig: `semanticContainerOf` liest den
    // Container aus dem `businessObject` der Wurzel. Bewegte man den Inhalt
    // vorher, wäre die Wurzel noch die Collaboration — und der Updater
    // schriebe die Knoten in `collaboration.flowElements`, eine Eigenschaft,
    // die das Schema nicht kennt und die der Export stillschweigend fallen
    // lässt. Nach dem Umbinden ist die Wurzel der Prozess, in dem die Knoten
    // ohnehin stehen; das Bewegen ist dann semantisch ein Nullschritt und
    // grafisch genau das, was es sein soll.
    this.commandStack.execute("root.rebind", {
      root,
      plane,
      definitions,
      newBo: process,
      removeFromRootElements: rootBo,
    });

    // (2) Inhalt retten — vor der Löschkaskade. Lanes gehen mit dem Pool.
    const content = [...(shape.children ?? [])].filter(
      (child) =>
        isShapeElement(child) &&
        !is(boOf(child), "bpmn:Lane") &&
        (child as BpmnShape).labelTarget === undefined,
    );
    if (content.length > 0) {
      this.modeling.moveElements(content, { x: 0, y: 0 }, root, {
        autoResize: false,
      });
    }
  }

  private root(): BpmnRoot {
    return this.canvas.getRootElement() as BpmnRoot;
  }
}

export default ParticipantBehavior;

/** Die Pools eines Diagramms — für Regeln und Tests. */
export function participantsOf(root: BpmnParent | undefined): BpmnShape[] {
  const children = (root as BpmnShape | undefined)?.children ?? [];
  return children.filter(
    (child): child is BpmnShape =>
      isShapeElement(child) && is(boOf(child), "bpmn:Participant"),
  );
}

/** Alle `bpmn:Participant` eines moddle-Dokuments. */
export function semanticParticipants(
  collaboration: ModdleElement,
): ModdleElement[] {
  return asArray(collaboration["participants"]);
}
