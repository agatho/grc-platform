/**
 * `element.updateProperties` — Eigenschaften eines semantischen Objekts ändern.
 *
 * Eigener Handler statt eines Interceptors, weil das Inverse hier **exakt**
 * sein muss: `undefined` und „Eigenschaft war nicht gesetzt" sind in `moddle`
 * unterscheidbar, und ein Undo, das eine nie gesetzte Eigenschaft als
 * `undefined` zurücklässt, erzeugt beim Schreiben ein leeres Attribut. Der
 * Handler merkt sich deshalb nicht den Wert, sondern den **Zustand**
 * (vorhanden/nicht vorhanden plus Wert).
 *
 * Sonderfall `id`: sie steht in drei Bäumen. Semantisch am businessObject,
 * grafisch als Schlüssel der `elementRegistry`, und in der DI **nicht** — die
 * verweist über die Objektidentität, nicht über die id. Genau deshalb ist ein
 * ID-Wechsel hier billig und in einem string-basierten Modell teuer.
 */

import type ElementRegistry from "diagram-js/lib/core/ElementRegistry.js";
import type { BpmnElement, ModdleElement } from "../types.js";
import { boOf, isModdleElement } from "../util.js";

interface Snapshot {
  readonly existed: boolean;
  readonly value: unknown;
}

export interface UpdatePropertiesContext {
  element: BpmnElement;
  properties: Record<string, unknown>;
  /** Wird gesetzt, wenn das Ziel nicht das businessObject selbst ist. */
  moddleElement?: ModdleElement;
  oldProperties?: Record<string, Snapshot>;
  oldId?: string;
  changed?: BpmnElement[];
}

export class UpdatePropertiesHandler {
  static $inject = ["elementRegistry"];

  constructor(private readonly elementRegistry: ElementRegistry) {}

  execute(context: UpdatePropertiesContext): BpmnElement[] {
    const element = context.element;
    const target = context.moddleElement ?? boOf(element);
    if (!isModdleElement(target)) return [element];

    const snapshots: Record<string, Snapshot> = {};
    for (const [key, value] of Object.entries(context.properties)) {
      // `Object.hasOwn`, nicht `in`: `moddle` legt Schema-Vorgabewerte auf der
      // **Prototypkette** ab. Mit `in` gälte jede vorgabebehaftete Eigenschaft
      // als „vorhanden", und das Undo schriebe den Vorgabewert als eigene
      // Eigenschaft zurück — womit beim Export ein Attribut entstünde, das in
      // der Eingabe nie stand.
      snapshots[key] = {
        existed: Object.hasOwn(target, key),
        value: target[key],
      };
      if (value === undefined) {
        delete target[key];
      } else {
        target[key] = value;
      }
    }
    context.oldProperties = snapshots;

    const nextId = context.properties["id"];
    if (typeof nextId === "string" && nextId !== element.id) {
      context.oldId = element.id;
      this.elementRegistry.updateId(element as never, nextId);
      element.id = nextId;
    }

    context.changed = [element];
    return context.changed;
  }

  revert(context: UpdatePropertiesContext): BpmnElement[] {
    const element = context.element;
    const target = context.moddleElement ?? boOf(element);

    if (context.oldId !== undefined) {
      this.elementRegistry.updateId(element as never, context.oldId);
      element.id = context.oldId;
      delete context.oldId;
    }

    if (isModdleElement(target) && context.oldProperties) {
      for (const [key, snapshot] of Object.entries(context.oldProperties)) {
        if (snapshot.existed) {
          target[key] = snapshot.value;
        } else {
          delete target[key];
        }
      }
    }
    return [element];
  }
}

export default UpdatePropertiesHandler;
