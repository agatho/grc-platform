/**
 * Beschriftungsverhalten (Auftrag Punkt 7).
 *
 * `diagram-js`' `label-support` trägt die halbe Last: es verschiebt
 * Beschriftungen mit ihrem Ziel und löscht sie mit ihm. Was fehlt, ist die
 * BPMN-Frage **wann es überhaupt eine gibt**:
 *
 *  - Ereignisse, Gateways, Datenobjekte und Kanten tragen ihre Beschriftung
 *    außen — aber nur, wenn sie einen Namen haben;
 *  - Aufgaben und Subprozesse tragen sie innen, also gar kein eigenes Shape;
 *  - wird der Name geleert, verschwindet das Shape wieder, statt als leere,
 *    unsichtbare Box im Diagramm und in der DI stehen zu bleiben.
 *
 * Der letzte Punkt ist bewusst anders als in `bpmn-js`, wo leere Labels als
 * Geisterboxen überleben und beim Export `BPMNLabel`-Einträge ohne Inhalt
 * hinterlassen.
 */

import CommandInterceptor from "diagram-js/lib/command/CommandInterceptor.js";
import type EventBus from "diagram-js/lib/core/EventBus.js";
import {
  connectionLabelPosition,
  defaultLabelBounds,
  labelText,
  needsLabelShape,
} from "../labels";
import type { BpmnElement, BpmnParent, BpmnShape } from "../types";
import { boOf, isConnectionElement, isLabel } from "../util";

interface ModelingLike {
  createLabel(
    labelTarget: BpmnElement,
    position: { x: number; y: number },
    label: Record<string, unknown>,
    parent?: BpmnParent,
  ): BpmnShape;
  removeShape(shape: BpmnShape): void;
}

export class LabelBehavior extends CommandInterceptor {
  static $inject = ["eventBus", "modeling"];

  constructor(
    eventBus: EventBus,
    private readonly modeling: ModelingLike,
  ) {
    super(eventBus);

    this.postExecute(
      ["shape.create", "connection.create"],
      (event: { context?: Record<string, unknown> }) => {
        const context = event.context;
        if (!context) return;
        const element = (context["shape"] ?? context["connection"]) as
          BpmnElement | undefined;
        if (!element || isLabel(element)) return;
        this.ensureLabel(element);
      },
    );

    this.postExecute(
      "element.updateLabel",
      (event: { context?: Record<string, unknown> }) => {
        const context = event.context;
        const element = context?.["element"] as BpmnElement | undefined;
        if (!element) return;
        const target = isLabel(element)
          ? ((element as BpmnShape).labelTarget ?? element)
          : element;
        this.ensureLabel(target);
      },
    );
  }

  /** Legt das Beschriftungs-Shape an oder entfernt es — je nach Text. */
  private ensureLabel(element: BpmnElement): void {
    const existing = Array.isArray(element.labels)
      ? element.labels[0]
      : undefined;
    const wanted = needsLabelShape(element);

    if (wanted && !existing) {
      const position = isConnectionElement(element)
        ? connectionLabelPosition(element)
        : centerOf(defaultLabelBounds(element));
      this.modeling.createLabel(
        element,
        position,
        {
          id: `${element.id}_label`,
          businessObject: boOf(element),
          type: "label",
        },
        element.parent,
      );
      return;
    }

    if (!wanted && existing) {
      this.modeling.removeShape(existing);
    }
  }
}

function centerOf(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}): { x: number; y: number } {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

/** Nur für Tests: hat dieses Element den Beschriftungszustand, den es soll? */
export function labelStateIsConsistent(element: BpmnElement): boolean {
  const labels = Array.isArray(element.labels) ? element.labels : [];
  const wanted = needsLabelShape(element);
  if (wanted) return labels.length === 1;
  return labels.length === 0 || labelText(boOf(element)).trim() !== "";
}

export default LabelBehavior;
