/**
 * `element.updateLabel` — Beschriftung ändern (Auftrag Punkt 7).
 *
 * Getrennt von `updateProperties`, weil die Beschriftung mehr ist als eine
 * Eigenschaft: sie entscheidet, ob es ein **externes Beschriftungs-Shape**
 * gibt. Der Handler schreibt den Text, das `postExecute` legt das Shape an
 * oder entfernt es — als eigenes Kommando, damit ein `undo` beides zusammen
 * zurücknimmt.
 *
 * Welches Feld den Text trägt, hängt am Typ: `bpmn:TextAnnotation` benutzt
 * `text`, alles andere `name`. Das ist keine Feinheit — wer bei einer
 * Annotation `name` schreibt, erzeugt eine Datei, in der der Text im Editor
 * steht und im Fremdwerkzeug fehlt.
 */

import type { BpmnElement, BpmnShape } from "../types";
import { boOf, is, isLabel } from "../util";

export interface UpdateLabelContext {
  element: BpmnElement;
  newLabel: string;
  oldLabel?: string;
  oldExisted?: boolean;
}

/** Die Eigenschaft, in der ein Typ seine Beschriftung führt. */
export function labelProperty(element: BpmnElement): string {
  return is(boOf(element), "bpmn:TextAnnotation") ? "text" : "name";
}

export class UpdateLabelHandler {
  execute(context: UpdateLabelContext): BpmnElement[] {
    const element = context.element;
    const target = isLabel(element)
      ? ((element as BpmnShape).labelTarget ?? element)
      : element;
    const bo = boOf(target);
    if (!bo) return [element];

    const property = labelProperty(target);
    context.oldExisted = property in bo;
    context.oldLabel =
      typeof bo[property] === "string" ? (bo[property] as string) : undefined;
    bo[property] = context.newLabel;

    return this.dirty(target);
  }

  revert(context: UpdateLabelContext): BpmnElement[] {
    const element = context.element;
    const target = isLabel(element)
      ? ((element as BpmnShape).labelTarget ?? element)
      : element;
    const bo = boOf(target);
    if (!bo) return [element];

    const property = labelProperty(target);
    if (context.oldExisted) {
      bo[property] = context.oldLabel;
    } else {
      delete bo[property];
    }
    return this.dirty(target);
  }

  private dirty(target: BpmnElement): BpmnElement[] {
    const labels = Array.isArray(target.labels) ? target.labels : [];
    return [target, ...labels];
  }
}

export default UpdateLabelHandler;
