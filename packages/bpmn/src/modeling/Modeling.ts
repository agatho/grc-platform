/**
 * `BpmnModeling` — die öffentliche Bedienfläche der Modellierungsschicht.
 *
 * Erweitert `diagram-js`' `Modeling` um die Kommandos, die BPMN braucht und
 * die es dort nicht gibt: Eigenschaften ändern, beschriften, Lanes
 * hinzufügen/teilen/entfernen. Die generischen Kommandos (`createShape`,
 * `moveShape`, `resizeShape`, `connect`, `removeElements`, `reconnect`, …)
 * kommen unverändert von dort — Plan §2.2: `CommandStack` **inklusive
 * Undo/Redo** wird nicht nachgebaut.
 *
 * Eine Ergänzung ist inhaltlich wichtig: `connect` fragt die Regeln, **welche**
 * Kantenart zwischen zwei Elementen entsteht. Ohne das müsste jeder Aufrufer
 * (Palette, ContextPad, Tastatur, Import) diese Entscheidung wiederholen — und
 * genau dort entstehen die Nachrichtenflüsse, die in Wahrheit Sequenzflüsse
 * sind.
 */

import BaseModeling from "diagram-js/lib/features/modeling/Modeling.js";
import type CommandStack from "diagram-js/lib/command/CommandStack.js";
import type ElementFactory from "diagram-js/lib/core/ElementFactory.js";
import type EventBus from "diagram-js/lib/core/EventBus.js";
import UpdateLabelHandler from "./cmd/UpdateLabelHandler";
import UpdatePropertiesHandler from "./cmd/UpdatePropertiesHandler";
import {
  AddLaneHandler,
  RemoveLaneHandler,
  SplitLaneHandler,
} from "./cmd/LaneHandlers";
import ReplaceShapeHandler from "./cmd/ReplaceShapeHandler";
import RootRebindHandler from "./cmd/RootRebindHandler";
import type { LaneLocation } from "./lanes";
import type {
  BpmnConnection,
  BpmnElement,
  BpmnShape,
  ModdleElement,
} from "./types";
import { boOf } from "./util";

interface RulesLike {
  allowed(action: string, context?: unknown): unknown;
}

interface CommandStackLike {
  execute(command: string, context: Record<string, unknown>): void;
}

export class BpmnModeling extends BaseModeling {
  static override $inject = [
    "eventBus",
    "elementFactory",
    "commandStack",
    "rules",
  ];

  private readonly stack: CommandStackLike;

  constructor(
    eventBus: EventBus,
    elementFactory: ElementFactory,
    commandStack: CommandStack,
    private readonly rules: RulesLike,
  ) {
    super(eventBus, elementFactory, commandStack);
    this.stack = commandStack as unknown as CommandStackLike;
  }

  override getHandlers(): Map<string, never> {
    const handlers = super.getHandlers() as unknown as Record<string, unknown>;
    return {
      ...handlers,
      "element.updateProperties": UpdatePropertiesHandler,
      // Ersetzt den generischen Handler von `diagram-js`: der Typwechsel ist
      // in BPMN kein reines Austauschen (Eigenschaften, extensionElements,
      // Anhefter, ID) — siehe `cmd/ReplaceShapeHandler.ts`.
      "shape.replace": ReplaceShapeHandler,
      "element.updateLabel": UpdateLabelHandler,
      "root.rebind": RootRebindHandler,
      "lane.add": AddLaneHandler,
      "lane.split": SplitLaneHandler,
      "lane.remove": RemoveLaneHandler,
    } as unknown as Map<string, never>;
  }

  /**
   * Verbindet zwei Elemente mit der Kantenart, die die Regeln vorschlagen.
   * Liefern sie keine, entsteht nichts — stillschweigend einen Sequenzfluss
   * anzulegen wäre der bequeme und falsche Weg.
   */
  override connect(
    source: BpmnElement,
    target: BpmnElement,
    attrs?: Record<string, unknown>,
    hints?: Record<string, unknown>,
  ): BpmnConnection {
    const suggestion = this.rules.allowed("connection.create", {
      source,
      target,
    }) as { type?: string } | boolean | null;

    let type = attrs?.["type"];
    if (
      typeof type !== "string" &&
      suggestion &&
      typeof suggestion === "object"
    ) {
      type = suggestion.type;
    }
    if (typeof type !== "string") {
      throw new Error(
        `Zwischen ${source.id} und ${target.id} ist nach den BPMN-Regeln keine Verbindung zulässig.`,
      );
    }

    return super.connect(
      source as never,
      target as never,
      { ...attrs, type } as never,
      hints as never,
    ) as unknown as BpmnConnection;
  }

  /**
   * Typwechsel eines Elements.
   *
   * `newData.type` ist der Zieltyp; `eventDefinitionType` setzt zugleich die
   * Ereignisdefinition. Die ID bleibt erhalten, weil ARCTOS BPMN-Elemente aus
   * der Datenbank heraus über sie referenziert — mit `hints.newId` lässt sich
   * das abschalten.
   */
  override replaceShape(
    oldShape: BpmnShape,
    newData: Record<string, unknown>,
    hints?: Record<string, unknown>,
  ): BpmnShape {
    const context: Record<string, unknown> = { oldShape, newData, hints };
    this.stack.execute("shape.replace", context);
    return context["newShape"] as BpmnShape;
  }

  /** Semantische Eigenschaften eines Elements ändern (inkl. `id`). */
  updateProperties(
    element: BpmnElement,
    properties: Record<string, unknown>,
  ): void {
    this.stack.execute("element.updateProperties", { element, properties });
  }

  /**
   * Eigenschaften eines beliebigen moddle-Objekts unterhalb des Elements
   * ändern — etwa einer `arctos:grcMetadata`. Getrennt, damit ein
   * Eigenschaftenpanel nicht das businessObject als Ziel vortäuschen muss.
   */
  updateModdleProperties(
    element: BpmnElement,
    moddleElement: ModdleElement,
    properties: Record<string, unknown>,
  ): void {
    this.stack.execute("element.updateProperties", {
      element,
      moddleElement,
      properties,
    });
  }

  /** Beschriftung setzen; legt das externe Beschriftungs-Shape an oder entfernt es. */
  updateLabel(element: BpmnElement, newLabel: string): void {
    this.stack.execute("element.updateLabel", { element, newLabel });
  }

  /** Lane über/unter (bzw. links/rechts von) `shape` einfügen. */
  addLane(shape: BpmnShape, location: LaneLocation = "bottom"): void {
    this.stack.execute("lane.add", { shape, location });
  }

  /** Lane (oder lane-losen Pool) in `count` Streifen teilen. */
  splitLane(shape: BpmnShape, count: number): void {
    this.stack.execute("lane.split", { shape, count });
  }

  /** Lane entfernen und die Lücke schließen. */
  removeLane(shape: BpmnShape): void {
    this.stack.execute("lane.remove", { shape });
  }

  /** Der BPMN-Typ eines Elements — Bequemlichkeit für Aufrufer. */
  typeOf(element: BpmnElement): string {
    return boOf(element)?.$type ?? "";
  }
}

export default BpmnModeling;
