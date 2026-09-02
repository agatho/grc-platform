/**
 * Pflege des DI-Baums (Baum 2).
 *
 * Der Plan nennt in §2.3.1 ausdrücklich: „eine `BPMNShape`, die in der
 * richtigen Reihenfolge im `BPMNPlane` steht (`di-ordering`) — sonst rendern
 * andere Werkzeuge falsch." Die Regel, die hier umgesetzt ist, lautet:
 * **alle `BPMNShape` vor allen `BPMNEdge`**, und innerhalb der Formen die
 * Reihenfolge des Einfügens. Sie ist bewusst einfach und stabil, weil
 * Idempotenz (Z-B) wichtiger ist als eine ausgefeilte Sortierung: dieselbe
 * Bedienfolge muss zweimal dieselbe Datei ergeben.
 */

import type { ModdleElement, Point } from "./types.js";
import { asArray, is, isModdleElement } from "./util.js";

export function diagramsOf(definitions: ModdleElement): ModdleElement[] {
  return asArray(definitions["diagrams"]);
}

export function planeOfDiagram(
  diagram: ModdleElement,
): ModdleElement | undefined {
  const plane = diagram["plane"];
  return isModdleElement(plane) ? plane : undefined;
}

/** Alle Ebenen des Dokuments, in Dokumentreihenfolge. */
export function planesOf(definitions: ModdleElement): ModdleElement[] {
  return diagramsOf(definitions)
    .map(planeOfDiagram)
    .filter((p): p is ModdleElement => p !== undefined);
}

/** Die Ebene, die `bo` als Wurzel hat (`BPMNPlane/@bpmnElement`). */
export function planeFor(
  definitions: ModdleElement,
  bo: ModdleElement,
): ModdleElement | undefined {
  return planesOf(definitions).find((plane) => plane["bpmnElement"] === bo);
}

export function planeElementsOf(plane: ModdleElement): ModdleElement[] {
  return asArray(plane["planeElement"]);
}

/** Index `semantisches Element → DI-Eintrag` über alle Ebenen. */
export function buildDiIndex(
  definitions: ModdleElement,
): Map<ModdleElement, ModdleElement> {
  const out = new Map<ModdleElement, ModdleElement>();
  for (const plane of planesOf(definitions)) {
    for (const di of planeElementsOf(plane)) {
      const ref = di["bpmnElement"];
      if (isModdleElement(ref)) out.set(ref, di);
    }
  }
  return out;
}

/** Die Ebene, in der ein DI-Eintrag steht. */
export function planeOfDi(
  definitions: ModdleElement,
  di: ModdleElement,
): ModdleElement | undefined {
  return planesOf(definitions).find((plane) =>
    planeElementsOf(plane).includes(di),
  );
}

/**
 * Hängt einen DI-Eintrag in die Ebene ein — Formen vor Kanten — und liefert
 * den exakten Rückweg (Position **und** `$parent`).
 */
export function addDi(plane: ModdleElement, di: ModdleElement): () => void {
  const existing = plane["planeElement"];
  const list: unknown[] = Array.isArray(existing) ? existing : [];
  if (!Array.isArray(existing)) plane["planeElement"] = list;

  if (list.includes(di)) return () => undefined;

  let at = list.length;
  if (di.$type === "bpmndi:BPMNShape") {
    const firstEdge = list.findIndex(
      (entry) => isModdleElement(entry) && entry.$type === "bpmndi:BPMNEdge",
    );
    if (firstEdge !== -1) at = firstEdge;
  }
  list.splice(at, 0, di);
  const previousParent = di["$parent"];
  di["$parent"] = plane;

  return () => {
    const index = list.indexOf(di);
    if (index !== -1) list.splice(index, 1);
    di["$parent"] = previousParent;
  };
}

export function removeDi(plane: ModdleElement, di: ModdleElement): () => void {
  const list = plane["planeElement"];
  if (!Array.isArray(list)) return () => undefined;
  const index = list.indexOf(di);
  if (index === -1) return () => undefined;
  list.splice(index, 1);
  const previousParent = di["$parent"];
  di["$parent"] = undefined;
  return () => {
    list.splice(Math.min(index, list.length), 0, di);
    di["$parent"] = previousParent;
  };
}

export function waypointsOf(di: ModdleElement): Point[] {
  return asArray(di["waypoint"])
    .map((w) => ({ x: Number(w["x"]), y: Number(w["y"]) }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

export function boundsOf(
  di: ModdleElement,
): { x: number; y: number; width: number; height: number } | undefined {
  const bounds = di["bounds"];
  if (!isModdleElement(bounds)) return undefined;
  const x = Number(bounds["x"]);
  const y = Number(bounds["y"]);
  const width = Number(bounds["width"]);
  const height = Number(bounds["height"]);
  if (![x, y, width, height].every((n) => Number.isFinite(n))) return undefined;
  return { x, y, width, height };
}

/** Bounds der `BPMNLabel` eines DI-Eintrags, falls vorhanden. */
export function labelBoundsOf(
  di: ModdleElement,
): { x: number; y: number; width: number; height: number } | undefined {
  const label = di["label"];
  if (!isModdleElement(label)) return undefined;
  return boundsOf(label);
}

/** Trägt dieses DI-Element eine eingeklappte Darstellung? */
export function isCollapsedDi(di: ModdleElement | undefined): boolean {
  if (!di) return false;
  return di["isExpanded"] === false;
}

/** Pool-/Lane-Ausrichtung; BPMN-Vorgabe ist waagerecht. */
export function isHorizontalDi(di: ModdleElement | undefined): boolean {
  if (!di) return true;
  return di["isHorizontal"] !== false;
}

/** Der `bpmn:Participant`/`bpmn:Process` einer Ebene. */
export function rootBoOfPlane(plane: ModdleElement): ModdleElement | undefined {
  const bo = plane["bpmnElement"];
  return isModdleElement(bo) ? bo : undefined;
}

export function isDiagramRootBo(bo: ModdleElement): boolean {
  return is(bo, "bpmn:Process") || is(bo, "bpmn:Collaboration");
}
