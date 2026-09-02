/**
 * [ARCTOS-FULL-2026-08-31 · OP-033] Was der Benutzer sehen kann — und was
 * deshalb bedienbar ist.
 *
 * ── Der Befund ────────────────────────────────────────────────────────
 *
 * `shape.toggleCollapse` klappt einen Subprozess zu. `diagram-js` entfernt
 * seine Kinder dabei **nicht** aus der `elementRegistry`, es setzt an ihnen
 * `hidden = true` (A1 §7.5, B1 §7.3). Gemessen an `COLLABORATION`: nach dem
 * Einklappen von `Sub_A` stehen `Sub_Start`, `Sub_End` und `Sub_Flow`
 * weiterhin in der Registry, `Strg+A` wählt sie mit aus, und die Ansage sagt
 * unverändert „15 Elemente ausgewählt" — dieselbe Zahl wie vor dem
 * Einklappen, obwohl drei davon nicht auf dem Bildschirm sind.
 *
 * Für einen sehenden Benutzer ist das ein Ärgernis (Löschen trifft mehr, als
 * markiert aussieht). Für einen Screenreader-Benutzer ist es die
 * Orientierung selbst: die Ansage ist seine einzige Auskunft darüber, was
 * gerade ausgewählt ist.
 *
 * ── Die Entscheidung, die A1 §7.5 offen gelassen hat ──────────────────
 *
 * A1 §7.5 hielt fest: „Vor dem Bau der Selektion zu klären." Zwei Antworten
 * standen zur Wahl.
 *
 * **(A) Die Kinder beim Einklappen aus der Registry entfernen** und beim
 * Aufklappen neu erzeugen. Das wäre die aufgeräumte Registry — und der
 * teuerste denkbare Weg. Die Kinder tragen Objektidentität: der
 * `CommandStack` hält sie in den Kontexten aller vorangegangenen Kommandos,
 * `attachers`, `labels`, `incoming`/`outgoing` und `labelTarget` sind
 * Verweise auf genau diese Objekte. Ein Aufklappen, das neue Objekte
 * erzeugt, macht jedes ältere Undo zu einer Operation auf Leichen. Der
 * Aufwand entstünde für ein Problem, das gar nicht im Modell liegt: die DI
 * bleibt beim Einklappen gültig (A1 §7.5 stellt das ausdrücklich fest), und
 * der Export ist unverändert korrekt.
 *
 * **(B) `hidden` als Wahrheit nehmen und die BEDIENUNG daran binden.**
 * `hidden` ist die Darstellung, die `diagram-js` für „im Baum, aber nicht
 * gezeigt" selbst führt; `label-support`, `attach-support` und der Renderer
 * verlassen sich darauf. Der Defekt ist vollständig einer der Bedienung —
 * was ausgewählt, angesprungen, verbunden und gezählt werden darf.
 *
 * **Gewählt: (B).** Eine Regel, an einer Stelle: *ein unsichtbares Element
 * ist kein bedienbares Element.* Sie gilt damit für `Strg+A`, für die
 * Kandidatenlisten des Verbindungs- und des Container-Modus, für `Tab` im
 * Beschriftungsmodus, für die Suche und für die Frage, ob eine Stelle der
 * Zeichenfläche frei ist — statt siebenmal einzeln entschieden zu werden.
 *
 * ── Der Preis dieser Entscheidung, offen benannt ──────────────────────
 *
 * Die Suche (`Find.ts`) findet ein Element in einem eingeklappten Subprozess
 * jetzt **nicht** mehr. Das ist so lange richtig, wie es keinen Drill-down
 * gibt (OP-018): einen Treffer auszuwählen, den man anschliessend nicht
 * sieht, ist schlechter als kein Treffer. Sobald der Drill-down da ist, ist
 * die Suche der erste Ort, der ihn braucht — sie soll dann finden UND die
 * Ebene öffnen. Der Vermerk steht hier, weil hier die Entscheidung fällt.
 */

import type { BpmnElement, BpmnShape } from "../modeling/types";

/**
 * Bewusst die schmalste Form, die diese Datei braucht, und nicht
 * `ElementRegistry` von `diagram-js`: die Bedienschicht arbeitet durchgehend
 * gegen `ElementRegistryLike` aus `./types` (dieselbe Signatur), und der
 * Prüfstand reicht die echte Registry herein. Eine Datei, die beide Welten
 * bedienen muss, verlangt sonst an jeder Aufrufstelle eine Umtypung.
 */
interface RegistryLike {
  getAll(): BpmnElement[];
}

/**
 * Ist dieses Element auf der Zeichenfläche unsichtbar?
 *
 * Nicht nur `element.hidden`: bei geschachtelten Subprozessen setzt
 * `diagram-js` die Kennzeichnung an den Kindern der Ebene, die eingeklappt
 * wurde. Ein Enkel kann sichtbar markiert sein, während sein Vater verborgen
 * ist — die Kette muss also mitgeprüft werden. Beschriftungs-Shapes erben
 * die Sichtbarkeit ihres Ziels, auch wenn sie im Baum woanders hängen.
 */
export function isHiddenInDiagram(element: BpmnElement | undefined): boolean {
  let current: BpmnElement | undefined = element;
  const seen = new Set<BpmnElement>();
  while (current && !seen.has(current)) {
    seen.add(current);
    if ((current as { hidden?: boolean }).hidden === true) return true;
    const target = (current as BpmnShape).labelTarget;
    if (target && !seen.has(target) && isHiddenInDiagram(target)) return true;
    current = current.parent as BpmnElement | undefined;
  }
  return false;
}

/** Die Umkehrung — die Form, die in `filter(...)` lesbar ist. */
export function isVisibleInDiagram(element: BpmnElement | undefined): boolean {
  return element !== undefined && !isHiddenInDiagram(element);
}

/**
 * Alle Elemente, die der Benutzer sehen und deshalb bedienen kann.
 *
 * **Diese Funktion ist der einzige zugelassene Weg, in `src/editor/` über
 * alle Elemente zu laufen.** `test/editor/visibility.test.ts` prüft das über
 * den Quelltext: ein neues `elementRegistry.getAll()` in dieser Schicht
 * macht den Test rot. Der Grund ist der Befund selbst — OP-033 war nicht ein
 * vergessener Filter, sondern sieben Aufzählungen, von denen jede für sich
 * plausibel aussah.
 */
export function visibleElements(registry: RegistryLike): BpmnElement[] {
  return registry.getAll().filter(isVisibleInDiagram);
}
