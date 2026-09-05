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
 *
 * [ARCTOS-FULL-2026-08-31 · OP-030] `bpmn:Group` ist der dritte Fall, und der
 * einzige, bei dem der Text **gar nicht am Element** hängt: eine Gruppe trägt
 * keinen Namen, sondern einen Verweis `categoryValueRef` auf eine
 * `bpmn:CategoryValue`, die als `bpmn:Category` unter `bpmn:Definitions`
 * steht. `bpmn:Group` hat im Schema kein `name`-Attribut — wer es trotzdem
 * setzt, bekommt keinen Fehler, sondern Stille: `moddle` behält die
 * Eigenschaft im Speicher und lässt sie beim Schreiben weg.
 *
 * Was das im Betrieb hiess (gemessen, nicht vermutet): Der Benutzer benennt
 * eine Gruppe um, der Editor zeigt weiter den ALTEN Text — denn `labelText()`
 * liest seit jeher richtig aus `categoryValueRef.value` —, und beim Speichern
 * ist die Eingabe spurlos weg. Nicht erst „beim Austausch mit anderen
 * Werkzeugen": schon im eigenen Round-Trip.
 */

import type { BpmnFactory } from "../BpmnFactory";
import type { BpmnElement, BpmnShape, ModdleElement } from "../types";
import { boOf, is, isLabel, isModdleElement } from "../util";

export interface UpdateLabelContext {
  element: BpmnElement;
  newLabel: string;
  oldLabel?: string;
  oldExisted?: boolean;
  /** Rücknahme des Gruppenzweigs — siehe {@link UpdateLabelHandler}. */
  undoCategory?: () => void;
}

/**
 * Die Eigenschaft, in der ein Typ seine Beschriftung führt.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-030] Für `bpmn:Group` gibt es keine — der Text
 * steht in einem anderen Objekt. Die Funktion liefert deshalb `undefined`,
 * statt `"name"` zurückzugeben und damit die Lüge fortzuschreiben, die den
 * Defekt ausgemacht hat. Aufrufer ausserhalb dieses Handlers behandeln
 * `undefined` als „dieser Typ wird nicht über eine einzelne Eigenschaft
 * beschriftet".
 */
export function labelProperty(element: BpmnElement): string | undefined {
  const bo = boOf(element);
  if (is(bo, "bpmn:Group")) return undefined;
  return is(bo, "bpmn:TextAnnotation") ? "text" : "name";
}

export class UpdateLabelHandler {
  static $inject = ["bpmnFactory"];

  constructor(private readonly bpmnFactory: BpmnFactory) {}

  execute(context: UpdateLabelContext): BpmnElement[] {
    const target = targetOf(context.element);
    const bo = boOf(target);
    if (!bo) return [context.element];

    if (is(bo, "bpmn:Group")) {
      context.undoCategory = this.writeCategoryValue(bo, context.newLabel);
      return this.dirty(target);
    }

    const property = labelProperty(target)!;
    context.oldExisted = property in bo;
    context.oldLabel =
      typeof bo[property] === "string" ? (bo[property] as string) : undefined;
    bo[property] = context.newLabel;

    return this.dirty(target);
  }

  revert(context: UpdateLabelContext): BpmnElement[] {
    const target = targetOf(context.element);
    const bo = boOf(target);
    if (!bo) return [context.element];

    if (context.undoCategory) {
      context.undoCategory();
      context.undoCategory = undefined;
      return this.dirty(target);
    }

    const property = labelProperty(target);
    if (property === undefined) return this.dirty(target);
    if (context.oldExisted) {
      bo[property] = context.oldLabel;
    } else {
      delete bo[property];
    }
    return this.dirty(target);
  }

  /**
   * Schreibt den Text einer Gruppe und liefert den Rückweg.
   *
   * Drei Fälle, und der dritte ist der, aus dem sonst Müll im Dokument
   * entsteht:
   *
   *  1. Es gibt schon eine `categoryValueRef` → nur ihr `value` ändern. Die
   *     `bpmn:Category` bleibt, wo sie ist; andere Gruppen können auf
   *     denselben Wert zeigen, und ihn hier zu ersetzen wäre eine stille
   *     Änderung an fremden Elementen.
   *  2. Es gibt keine und der neue Text ist nicht leer → eine `bpmn:Category`
   *     mit genau einer `bpmn:CategoryValue` anlegen und unter
   *     `definitions.rootElements` hängen. Eine EIGENE Kategorie und keine
   *     vorhandene wiederverwendet: `bpmn:Category` trägt selbst einen
   *     `name` und ist damit eine fachliche Einordnung, kein Ablagefach —
   *     einen fremden Ordner mitzubenutzen, weil er zufällig da ist, ändert
   *     seine Bedeutung.
   *  3. Es gibt keine und der neue Text ist leer → **nichts** anlegen. Eine
   *     leere Beschriftung ist kein Element, sondern nichts; dieselbe Regel
   *     befolgt `needsLabelShape()` für das Beschriftungs-Shape. Sonst
   *     hinterliesse jedes versehentliche Enter im Beschriftungsfeld eine
   *     leere Kategorie in der Datei.
   */
  private writeCategoryValue(bo: ModdleElement, text: string): () => void {
    const existing = bo["categoryValueRef"];
    if (isModdleElement(existing)) {
      const had = Object.hasOwn(existing, "value");
      const previous = existing["value"];
      existing["value"] = text;
      return () => {
        if (had) existing["value"] = previous;
        else delete existing["value"];
      };
    }

    if (text.trim() === "") return () => undefined;

    const definitions = this.bpmnFactory.getDefinitions();
    if (!definitions) {
      // Ohne Dokument gibt es kein `rootElements`, in das die Kategorie
      // gehörte. Lieber nichts schreiben als einen Verweis auf ein Objekt,
      // das beim Export nicht mitgeschrieben wird — das wäre wieder genau
      // der stille Verlust, den OP-030 meint.
      return () => undefined;
    }

    const category = this.bpmnFactory.create(
      "bpmn:Category",
      {},
      {
        parent: definitions,
      },
    );
    const categoryValue = this.bpmnFactory.create(
      "bpmn:CategoryValue",
      { value: text },
      { parent: category },
    );
    category["categoryValue"] = [categoryValue];

    const roots = Array.isArray(definitions["rootElements"])
      ? (definitions["rootElements"] as ModdleElement[])
      : [];
    definitions["rootElements"] = roots;
    roots.push(category);
    bo["categoryValueRef"] = categoryValue;

    return () => {
      delete bo["categoryValueRef"];
      const at = roots.indexOf(category);
      if (at >= 0) roots.splice(at, 1);
      // IDs zurückgeben, sonst zählt ein Undo/Redo-Zyklus die Zähler hoch
      // und das nächste `Category_…` heisst anders als beim ersten Mal.
      const categoryId = category.id;
      const valueId = categoryValue.id;
      if (typeof categoryId === "string")
        this.bpmnFactory.releaseId(categoryId);
      if (typeof valueId === "string") this.bpmnFactory.releaseId(valueId);
    };
  }

  private dirty(target: BpmnElement): BpmnElement[] {
    const labels = Array.isArray(target.labels) ? target.labels : [];
    return [target, ...labels];
  }
}

function targetOf(element: BpmnElement): BpmnElement {
  return isLabel(element)
    ? ((element as BpmnShape).labelTarget ?? element)
    : element;
}

export default UpdateLabelHandler;
