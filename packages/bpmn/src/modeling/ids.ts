/**
 * ID-Vergabe über das **gesamte** Definitions-Dokument.
 *
 * Plan §2.3.1 nennt kollisionsfreie IDs als eine der Fallen des `BpmnUpdater`.
 * Die Falle ist subtiler, als sie klingt: Es genügt nicht, gegen die Elemente
 * *einer* Ebene zu prüfen. Eine BPMN-Datei hat einen einzigen ID-Raum über
 * `rootElements`, alle `flowElements` aller Prozesse, `laneSets`, `artifacts`,
 * die gesamte DI und jedes Extension-Element. Wer nur den sichtbaren Prozess
 * betrachtet, erzeugt eine Kollision mit einem Element in einem Pool, den
 * gerade niemand ansieht — und `moddle` beschwert sich beim Schreiben nicht.
 *
 * Deshalb: einmal das Dokument einlesen, danach jede Vergabe **und jede
 * Freigabe** buchführen. Freigabe ist nötig, damit Undo eine ID nicht dauerhaft
 * verbrennt und ein Redo dieselbe ID wiederbekommt.
 */

import type { ModdleElement } from "./types";
import { walkDocument } from "./invariants";

/** `bpmn:UserTask` → `UserTask`, `bpmndi:BPMNShape` → `BPMNShape`. */
export function localName(type: string): string {
  const index = type.indexOf(":");
  return index === -1 ? type : type.slice(index + 1);
}

export class BpmnIds {
  private readonly used = new Set<string>();
  private readonly counters = new Map<string, number>();

  constructor(definitions?: ModdleElement) {
    if (definitions) this.scan(definitions);
  }

  /** Nimmt jede im Dokument vorkommende ID in den Bestand auf. */
  scan(definitions: ModdleElement): void {
    for (const { element } of walkDocument(definitions)) {
      const id = element["id"];
      if (typeof id === "string" && id !== "") this.used.add(id);
      // Unbekannte Attribute können ebenfalls IDs tragen (`$attrs["id"]`).
      const attrs = element["$attrs"];
      if (attrs && typeof attrs === "object") {
        const raw = (attrs as Record<string, unknown>)["id"];
        if (typeof raw === "string" && raw !== "") this.used.add(raw);
      }
    }
  }

  has(id: string): boolean {
    return this.used.has(id);
  }

  /** Reserviert eine bestimmte ID. `false`, wenn sie schon vergeben war. */
  claim(id: string): boolean {
    if (this.used.has(id)) return false;
    this.used.add(id);
    return true;
  }

  /**
   * Gibt eine ID wieder frei. Wird beim Undo eines `shape.create` gebraucht:
   * ohne Freigabe zählt der Zähler beim Redo weiter und das erzeugte XML
   * unterscheidet sich zwischen zwei identischen Bedienfolgen.
   */
  release(id: string): void {
    this.used.delete(id);
  }

  /**
   * Die nächste freie ID für einen Typ, im BPMN-üblichen Format
   * `UserTask_1`, `SequenceFlow_2`, …
   */
  next(type: string): string {
    const prefix = localName(type);
    let counter = this.counters.get(prefix) ?? 0;
    let candidate: string;
    do {
      counter += 1;
      candidate = `${prefix}_${String(counter)}`;
    } while (this.used.has(candidate));
    this.counters.set(prefix, counter);
    this.used.add(candidate);
    return candidate;
  }

  /** Nur für Tests und Fehlersuche. */
  size(): number {
    return this.used.size;
  }
}
