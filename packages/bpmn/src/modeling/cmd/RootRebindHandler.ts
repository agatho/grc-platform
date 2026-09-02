/**
 * `root.rebind` — das Wurzelelement der Ebene semantisch austauschen.
 *
 * Plan §2.3.1 nennt den Fall: „Ein Pool wird gelöscht: die gesamte
 * `bpmn:Collaboration` kann kollabieren, das Wurzelelement wechselt von
 * `Collaboration` zurück zu `Process`." Der Hinweg ist derselbe Vorgang
 * rückwärts — sobald der **erste** Pool entsteht, ist das Diagramm keine
 * Prozess- mehr, sondern eine Kollaborationsdarstellung.
 *
 * ## Warum das ohne Wechsel des grafischen Wurzelelements geht
 *
 * Der naheliegende Weg wäre, ein neues `diagram-js`-Wurzelelement anzulegen
 * und alle Kinder hinüberzuziehen. Das ist der teure Weg: `Canvas` führt je
 * Wurzel eine eigene SVG-Ebene, die Grafiken müssten neu eingehängt werden,
 * und die Umkehrfunktion müsste dasselbe rückwärts tun.
 *
 * Nötig ist es nicht. Das grafische Wurzelelement ist ein **Behälter ohne
 * eigene Aussage**; welchen semantischen Sinn es hat, sagt allein sein
 * `businessObject`. Dieses Kommando tauscht deshalb nur drei Verweise:
 *
 *   1. `root.businessObject` — womit `semanticContainerOf` ab sofort die
 *      Collaboration (bzw. wieder den Prozess) findet;
 *   2. `plane.bpmnElement` — womit die DI beim Export auf die neue Wurzel
 *      zeigt;
 *   3. `definitions.rootElements` — die Collaboration kommt hinzu bzw. geht.
 *
 * Alles Übrige — die Knoten in den Pool ziehen, die Lanes, die Kanten — sind
 * gewöhnliche Modellierungskommandos und werden von `CreateParticipantBehavior`
 * ausgelöst. Dieses Kommando hat als einziges einen handgeschriebenen Rückweg,
 * und der ist so klein, dass man ihn ansehen kann.
 */

import type { BpmnElement, BpmnRoot, ModdleElement } from "../types.js";
import { isModdleElement } from "../util.js";

export interface RootRebindContext {
  root: BpmnRoot;
  plane: ModdleElement;
  definitions: ModdleElement;
  /** Das neue Wurzel-Businessobjekt (`bpmn:Collaboration` oder `bpmn:Process`). */
  newBo: ModdleElement;
  /**
   * Wurzelelemente, die mit dem Wechsel in `definitions.rootElements` kommen
   * oder gehen. Beim Hinweg die neue Collaboration, beim Rückweg dieselbe.
   */
  addToRootElements?: ModdleElement | undefined;
  removeFromRootElements?: ModdleElement | undefined;

  oldBo?: ModdleElement;
  oldPlaneBo?: unknown;
  removedIndex?: number;
  oldId?: string;
}

/** Was dieses Kommando von `elementRegistry` braucht. */
interface ElementRegistryLike {
  updateId(element: unknown, newId: string): void;
}

export class RootRebindHandler {
  static $inject = ["elementRegistry"];

  constructor(private readonly elementRegistry: ElementRegistryLike) {}

  execute(context: RootRebindContext): BpmnElement[] {
    const { root, plane, definitions, newBo } = context;

    context.oldBo = root.businessObject;
    context.oldPlaneBo = plane["bpmnElement"];
    context.oldId = root.id;

    root.businessObject = newBo;
    plane["bpmnElement"] = newBo;
    // Die **grafische** ID muss der semantischen folgen: `elementRegistry` ist
    // über sie indiziert, und der Invariantenprüfer vergleicht beide
    // (`GRAPHIC_ID_MISMATCH`). Ohne diesen Schritt hieße die Wurzel weiter
    // `Process_1`, während sie eine Collaboration ist — ein Zustand, in dem
    // `elementRegistry.get(bo.id)` ins Leere greift.
    this.rename(root, newBo);

    if (context.addToRootElements) {
      list(definitions).push(context.addToRootElements);
      context.addToRootElements["$parent"] = definitions;
    }
    if (context.removeFromRootElements) {
      const elements = list(definitions);
      const index = elements.indexOf(context.removeFromRootElements);
      context.removedIndex = index;
      if (index !== -1) elements.splice(index, 1);
    }

    return [root];
  }

  revert(context: RootRebindContext): BpmnElement[] {
    const { root, plane, definitions } = context;

    if (context.removeFromRootElements && context.removedIndex !== undefined) {
      const elements = list(definitions);
      if (context.removedIndex !== -1) {
        elements.splice(
          Math.min(context.removedIndex, elements.length),
          0,
          context.removeFromRootElements,
        );
      }
    }
    if (context.addToRootElements) {
      const elements = list(definitions);
      const index = elements.indexOf(context.addToRootElements);
      if (index !== -1) elements.splice(index, 1);
    }

    if (context.oldBo) {
      root.businessObject = context.oldBo;
      if (context.oldId !== undefined) this.renameTo(root, context.oldId);
    }
    plane["bpmnElement"] = context.oldPlaneBo;

    return [root];
  }

  private rename(root: BpmnRoot, bo: ModdleElement): void {
    const id = bo.id;
    if (typeof id !== "string" || id === "" || id === root.id) return;
    this.renameTo(root, id);
  }

  private renameTo(root: BpmnRoot, id: string): void {
    if (root.id === id) return;
    this.elementRegistry.updateId(root, id);
    root.id = id;
  }
}

function list(definitions: ModdleElement): ModdleElement[] {
  const existing = definitions["rootElements"];
  if (Array.isArray(existing)) return existing as ModdleElement[];
  const created: ModdleElement[] = [];
  definitions["rootElements"] = created;
  return created;
}

export default RootRebindHandler;

/** Der `bpmn:Process` hinter einem Participant, falls aufgelöst. */
export function processOfParticipant(
  participant: ModdleElement,
): ModdleElement | undefined {
  const process = participant["processRef"];
  return isModdleElement(process) ? process : undefined;
}
