/**
 * Die Ebenen eines BPMN-Dokuments — und der Weg zwischen ihnen.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-018] `buildScene` nimmt seit jeher einen
 * `diagramIndex` entgegen und kann jede `BPMNPlane` zeichnen; was fehlte, war
 * die Frage davor: **welche** Ebene gehört zu welchem Element, und wie kommt
 * man von einer in die andere. Ohne diese Datei war die Antwort
 * „Ebene 0, immer" — gemessen an `test/corpus/synth-nested-subprocesses.bpmn`:
 * 2 Ebenen, gezeichnet wurden 3 Formen und 2 Kanten der ersten, die 4 Formen
 * und 3 Kanten der zweiten waren mit keiner Bedienung erreichbar.
 *
 * **Was BPMN-DI hier vorschreibt.** Ein eingeklappter Subprozess
 * (`isExpanded="false"` an seiner `BPMNShape`) darf eine **eigene**
 * `BPMNDiagram`/`BPMNPlane` haben, deren `bpmnElement` der Subprozess selbst
 * ist. Das ist der Drill-Down, den jedes Fremdwerkzeug anbietet. Die Zuordnung
 * ist damit rein datengetrieben: `plane.bpmnElement === subProcess` — geraten
 * wird nichts.
 *
 * **Warum eine eigene Datei und nicht `scene.ts`.** `scene.ts` beantwortet
 * „wie sieht *eine* Ebene aus"; hier steht „welche Ebenen gibt es und wie
 * hängen sie zusammen". Die zweite Frage braucht die Zeichenschicht nie —
 * `BpmnCanvas` und die Bedienschicht schon.
 */

import type { ModdleElement } from "./types";

/** Eine zeichenbare Ebene des Dokuments. */
export interface PlaneInfo {
  /** Position in `definitions.diagrams` — das Argument von `buildScene`. */
  readonly index: number;
  readonly diagramId: string | undefined;
  readonly planeId: string | undefined;
  /** `bpmnElement` der Ebene: der Prozess, die Kollaboration, der Subprozess. */
  readonly rootId: string | undefined;
  readonly rootType: string | undefined;
  readonly rootName: string | undefined;
  /**
   * Index der Ebene, in der dieses Element als Form vorkommt, oder
   * `undefined` für die oberste Ebene. Das ist die Kante des Ebenenbaums.
   */
  readonly parentIndex: number | undefined;
}

function asElement(value: unknown): ModdleElement | undefined {
  if (
    value !== null &&
    typeof value === "object" &&
    "$type" in (value as object)
  ) {
    return value as ModdleElement;
  }
  return undefined;
}

function asElements(value: unknown): ModdleElement[] {
  if (!Array.isArray(value)) return [];
  const out: ModdleElement[] = [];
  for (const entry of value) {
    const element = asElement(entry);
    if (element) out.push(element);
  }
  return out;
}

/**
 * Alle Ebenen des Dokuments, in Dokumentreihenfolge.
 *
 * Eine `BPMNDiagram` ohne `BPMNPlane` wird übersprungen — sie ist nicht
 * zeichenbar, und `buildScene` sagt das bereits. Die Indizes bleiben trotzdem
 * die des `diagrams`-Arrays, weil genau die an `buildScene` gehen: eine
 * eigene Zählung wäre eine zweite Wahrheit über dieselbe Liste.
 */
export function planesOf(definitions: ModdleElement): readonly PlaneInfo[] {
  const diagrams = asElements(definitions["diagrams"]);
  const raw: Array<{
    index: number;
    diagram: ModdleElement;
    plane: ModdleElement;
    rootBo: ModdleElement | undefined;
  }> = [];

  for (let index = 0; index < diagrams.length; index += 1) {
    const diagram = diagrams[index];
    if (!diagram) continue;
    const plane = asElement(diagram["plane"]);
    if (!plane) continue;
    raw.push({
      index,
      diagram,
      plane,
      rootBo: asElement(plane["bpmnElement"]),
    });
  }

  // Welche Ebene zeigt welche Form? Erst danach lässt sich `parentIndex`
  // bestimmen — ein Subprozess auf Ebene 1 kann seine eigene Ebene 2 haben,
  // und die Reihenfolge im Dokument sagt darüber nichts.
  const shownIn = new Map<ModdleElement, number>();
  for (const entry of raw) {
    for (const di of asElements(entry.plane["planeElement"])) {
      if (di.$type !== "bpmndi:BPMNShape") continue;
      const bo = asElement(di["bpmnElement"]);
      if (bo && !shownIn.has(bo)) shownIn.set(bo, entry.index);
    }
  }

  return raw.map((entry) => ({
    index: entry.index,
    diagramId:
      typeof entry.diagram.id === "string" ? entry.diagram.id : undefined,
    planeId: typeof entry.plane.id === "string" ? entry.plane.id : undefined,
    rootId: typeof entry.rootBo?.id === "string" ? entry.rootBo.id : undefined,
    rootType: entry.rootBo?.$type,
    rootName:
      typeof entry.rootBo?.["name"] === "string" && entry.rootBo["name"] !== ""
        ? (entry.rootBo["name"] as string)
        : undefined,
    parentIndex: entry.rootBo ? shownIn.get(entry.rootBo) : undefined,
  }));
}

/**
 * Die Ebene, die sich hinter diesem Element verbirgt — oder `undefined`.
 *
 * Bewusst über die Element-**Kennung** und nicht über das moddle-Objekt: die
 * Bedienschicht hat einen `diagram-js`-Shape in der Hand, dessen
 * `businessObject` nach einem Neuimport ein anderes Objekt sein kann. Die
 * Kennung überlebt beides.
 */
export function planeIndexFor(
  definitions: ModdleElement,
  elementId: string,
): number | undefined {
  for (const plane of planesOf(definitions)) {
    if (plane.rootId === elementId) return plane.index;
  }
  return undefined;
}

/**
 * Der Weg von der obersten Ebene bis zu `index`, als Brotkrume.
 *
 * Endet bei der ersten Ebene ohne `parentIndex`. Ein Kreis im Dokument
 * (Ebene A zeigt B, B zeigt A — kommt bei erzeugten Dateien vor) wird
 * abgebrochen statt endlos verfolgt.
 */
export function planePath(
  definitions: ModdleElement,
  index: number,
): readonly PlaneInfo[] {
  const planes = planesOf(definitions);
  const byIndex = new Map(planes.map((plane) => [plane.index, plane]));
  const path: PlaneInfo[] = [];
  const seen = new Set<number>();

  let cursor: number | undefined = index;
  while (cursor !== undefined && !seen.has(cursor)) {
    seen.add(cursor);
    const plane: PlaneInfo | undefined = byIndex.get(cursor);
    if (!plane) break;
    path.unshift(plane);
    cursor = plane.parentIndex;
  }
  return path;
}

/**
 * Anzeigename einer Ebene.
 *
 * `name` vor `id` vor Typ — dieselbe Rangfolge wie in der Textalternative, und
 * aus demselben Grund: ein Diagramm ohne Namen soll trotzdem einen Satz
 * ergeben, den ein Screenreader vorlesen kann.
 */
export function planeLabel(plane: PlaneInfo): string {
  return plane.rootName ?? plane.rootId ?? plane.rootType ?? "Ebene";
}
