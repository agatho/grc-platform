/**
 * Attrappen für Regelabfragen.
 *
 * Palette, Kontextmenü und Einfügen müssen die Regeln fragen, **bevor** es das
 * Element gibt: „darf hier überhaupt eine Aufgabe hin?", „darf von hier aus
 * eine Kante zu einem Gateway laufen?". Ein Menüeintrag, der beim Anklicken
 * scheitert, ist schlechter als ein fehlender.
 *
 * Zwei Fallen stecken darin, und beide sind teuer, wenn man sie übersieht:
 *
 * **(1) Ein Objekt mit bloßem `$type` genügt nicht.** `BpmnRules` fragt über
 * `is(bo, "bpmn:FlowNode")`, also über die **Typhierarchie**. Die kennt nur ein
 * echtes moddle-Objekt (`$instanceOf`); ein `{ $type: "bpmn:Task" }` fällt auf
 * den Namensvergleich zurück und ist damit *kein* `bpmn:FlowNode`. Eine Palette,
 * die so prüft, bietet gar nichts an — und der Fehler sieht aus wie eine zu
 * strenge Regel.
 *
 * **(2) Die Elementfabrik darf es nicht sein.** `BpmnFactory.create` vergibt
 * eine ID aus dem dokumentweiten Zähler (`src/modeling/ids.ts`). Eine Attrappe
 * würde also eine ID verbrennen, und zwei gleiche Bedienfolgen erzeugten
 * unterschiedliche Dateien — genau die Eigenschaft, die der Modellstrang unter
 * „Z-B" absichert. `moddle.create` vergibt keine.
 *
 * Deshalb: echte moddle-Objekte, ohne ID, zwischengespeichert.
 */

import type { BpmnModdleInstance } from "bpmn-moddle";
import type { BpmnShape } from "./types";

export class ProbeFactory {
  static $inject = ["moddle"];

  private readonly cache = new Map<string, BpmnShape>();

  constructor(private readonly moddle: BpmnModdleInstance) {}

  /**
   * Ein Element, das es nicht gibt — mit korrekter Typhierarchie, Maßen und
   * den Listen, die `diagram-js` an jedem Element erwartet.
   */
  shape(type: string): BpmnShape {
    const cached = this.cache.get(type);
    if (cached) return cached;
    const bo = this.moddle.create(type, {});
    const probe = {
      id: `__probe_${type}`,
      type,
      businessObject: bo,
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      children: [],
      attachers: [],
      incoming: [],
      outgoing: [],
      labels: [],
    } as unknown as BpmnShape;
    this.cache.set(type, probe);
    return probe;
  }

  /**
   * Wie {@link ProbeFactory.shape}, aber mit Container.
   *
   * Nötig, weil mehrere Regeln über den Container entscheiden — ein
   * Sequenzfluss läuft nur „innerhalb desselben Pools **und** desselben
   * Containers" (`BpmnRules.canConnectSequenceFlow`, Verbot 5). Eine Attrappe
   * ohne Container hat den Container `undefined` und ist damit **nie**
   * verbindbar; eine Palette, die so fragt, bietet nichts zum Anhängen an. Der
   * Fehler sieht aus wie eine zu strenge Regel und ist keiner.
   */
  shapeIn(type: string, parent: unknown): BpmnShape {
    return { ...this.shape(type), parent } as unknown as BpmnShape;
  }
}

export default ProbeFactory;
