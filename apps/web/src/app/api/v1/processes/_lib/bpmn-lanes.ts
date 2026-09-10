// bpmn-lanes.ts — Lanes und Pools aus dem BPMN-XML lesen und nach
// `process_lane` schreiben.
//
// [ARCTOS-FULL-2026-08-31 · OP-002] **`process_lane` blieb beim Import leer.**
//
// Gemessen am Stand `c635a970`: kein `INSERT INTO process_lane` und kein
// `insert(processLane)` irgendwo im Produktivcode — die einzige Fundstelle im
// ganzen Baum ist `packages/db/tests/rls/process-diagram-grc-isolation.test.ts`.
// In der geseedeten Datenbank `welle1_verify` (424 Migrationen) standen
// entsprechend **0 Zeilen** in `process_lane`, und `process_step.lane_step_id`
// war in **allen 17** Schrittzeilen NULL. Beide Layer, die von der Tabelle
// leben (`trust-boundary`/F5 und `lane`/F17), bekamen damit nie Daten.
//
// ── Warum das ein Produktdefekt ist und nicht nur eine fehlende Funktion ──
//
// Ohne Zeilen faellt die Diagrammschicht auf `laneOf()` aus
// `packages/bpmn/src/grc/graph.ts` zurueck. Das ist eine rein **geometrische**
// Regel: „der flaechenkleinste Rahmen, der den Mittelpunkt des Elements
// enthaelt, gewinnt" (`graph.ts:57` — „Containment rein geometrisch"). Bei
// sauber gestapelten Lanes stimmt das. Bei **ueberlappenden** Rahmen — und die
// erzeugt jeder Editor, der Lanes frei verschieben laesst — gewinnt der
// kleinere Rahmen, auch wenn das BPMN-Modell den Schritt ausdruecklich der
// anderen Lane zuweist. Nachgemessen in
// `src/__tests__/api/process-lane-import.test.ts`, Teil A.
//
// In einem GRC-Produkt ist das keine Kosmetik: die Lane traegt die
// **Verantwortlichkeit** (Rolle, Organisationseinheit, Dienstleister,
// Drittland). Eine falsch zugeordnete Lane heisst falsche Rolle in der
// SoD-Rueckfallbestimmung (F3), falsche Vertrauensgrenze (F5) und eine
// Kenntnisnahmequote (F17), die der falschen Einheit zugerechnet wird.
//
// ── Die Reparatur: BPMN sagt es selbst ────────────────────────────────────
//
// BPMN 2.0 braucht keine Geometrie. `bpmn:lane` fuehrt seine Mitglieder
// explizit als `bpmn:flowNodeRef`-Kindelemente, und `bpmn:participant`
// (der Pool) zeigt mit `processRef` auf den Prozess, dessen Elemente er
// enthaelt. Das ist die **Aussage des Modellierers**, nicht eine Ableitung
// aus Pixeln — und sie ueberlebt jedes Verschieben eines Rahmens.
//
// Dieser Leser benutzt denselben XML-Leser wie `packages/shared/bpmn-parser.ts`
// (`parseXml` aus `@grc/bpmn/util`) und dieselbe Namensraumaufloesung. Grund
// steht dort (OP-037): Praefixvergleiche lehnen `ns0:`- und
// `semantic:`-Dokumente ab, die gueltiges BPMN 2.0 sind.

import { parseXml, XmlParseError, type XmlElement } from "@grc/bpmn/util";

/** Der Namensraum des BPMN-Metamodells (OMG formal/2011-01-03). */
const BPMN_MODEL_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL";

export interface ParsedBpmnLane {
  /** `bpmn:lane`- bzw. `bpmn:participant`-ID aus dem XML. */
  bpmnElementId: string;
  name: string | null;
  kind: "lane" | "pool";
  /** ID der umschliessenden Lane bzw. des Pools; `null` auf der Wurzelebene. */
  parentBpmnElementId: string | null;
  /** Dokumentreihenfolge, ab 0 — wird als `sequence_order` abgelegt. */
  sequenceOrder: number;
  /**
   * Die BPMN-IDs der Elemente, die **diese** Lane als Mitglied fuehrt.
   *
   * Bei `bpmn:lane` sind das die `flowNodeRef`-Eintraege. Bei einem Pool
   * bleibt die Liste leer: seine Mitgliedschaft ergibt sich mittelbar ueber
   * `processRef` und wird in `assignLaneMembership()` aufgeloest, damit eine
   * inhaltlich engere Lane immer gewinnt.
   */
  flowNodeRefs: string[];
  /**
   * Nur bei `kind === "pool"`: die `process`-ID, auf die `processRef` zeigt.
   * `null`, wenn der Pool leer ist (ein „black box pool" nach BPMN — genau die
   * Form, mit der ein externer Beteiligter modelliert wird).
   */
  processRef: string | null;
}

export interface ParsedBpmnLanes {
  lanes: ParsedBpmnLane[];
  /** BPMN-ID des `bpmn:process` → seine unmittelbaren Flow-Node-IDs. */
  flowNodesByProcess: Map<string, string[]>;
}

// ── Namensraumaufloesung (wie in packages/shared/src/bpmn-parser.ts) ────────

type NsScope = ReadonlyMap<string, string>;

function extendScope(element: XmlElement, parent: NsScope): NsScope {
  let scope: Map<string, string> | undefined;
  for (const attribute of element.attributes) {
    if (attribute.qname === "xmlns") {
      scope ??= new Map(parent);
      scope.set("", attribute.value);
    } else if (attribute.prefix === "xmlns") {
      scope ??= new Map(parent);
      scope.set(attribute.local, attribute.value);
    }
  }
  return scope ?? parent;
}

function isBpmn(element: XmlElement, scope: NsScope): boolean {
  const uri = scope.get(element.prefix);
  if (uri === undefined) return scope.size === 0;
  return uri === BPMN_MODEL_NS;
}

function attribute(element: XmlElement, name: string): string | undefined {
  for (const candidate of element.attributes) {
    if (candidate.prefix === "" && candidate.local === name) {
      return candidate.value;
    }
  }
  return undefined;
}

function textOf(element: XmlElement): string {
  let out = "";
  for (const child of element.children) {
    if (child.kind === "text") out += child.value;
  }
  return out.trim();
}

/**
 * Elementnamen, die als Flow-Node eines Prozesses gelten.
 *
 * Bewusst **nicht** deckungsgleich mit der Schritt-Liste von
 * `parseBpmnXml`: hier zaehlt, was ein Pool ueber `processRef` einschliesst.
 * Kanten (`sequenceFlow`), Datenobjekte und Artefakte tragen keine
 * Lane-Zugehoerigkeit im Sinne einer Verantwortlichkeit und wuerden die
 * Mitgliederliste nur aufblaehen.
 */
const FLOW_NODE_LOCALS = new Set([
  "task",
  "userTask",
  "serviceTask",
  "scriptTask",
  "manualTask",
  "businessRuleTask",
  "sendTask",
  "receiveTask",
  "subProcess",
  "transaction",
  "adHocSubProcess",
  "callActivity",
  "startEvent",
  "endEvent",
  "intermediateThrowEvent",
  "intermediateCatchEvent",
  "boundaryEvent",
  "exclusiveGateway",
  "parallelGateway",
  "inclusiveGateway",
  "eventBasedGateway",
  "complexGateway",
]);

/**
 * Liest alle Lanes und Pools eines BPMN-Dokuments.
 *
 * Wirft nur, wenn das Dokument als Ganzes unlesbar ist — ein Diagramm **ohne**
 * Lanes ist kein Fehler, sondern der Normalfall eines einfachen Prozesses und
 * liefert eine leere Liste.
 */
export function parseBpmnLanes(xml: string): ParsedBpmnLanes {
  let root: XmlElement;
  try {
    root = parseXml(xml).root;
  } catch (error) {
    throw error instanceof XmlParseError
      ? new Error(`Invalid BPMN XML: ${error.message}`)
      : error;
  }

  const rootScope = extendScope(root, new Map<string, string>());
  if (root.local !== "definitions" || !isBpmn(root, rootScope)) {
    throw new Error(
      "Invalid BPMN XML: missing <bpmn:definitions> root element",
    );
  }

  const lanes: ParsedBpmnLane[] = [];
  const flowNodesByProcess = new Map<string, string[]>();
  const counter = { next: 0 };

  for (const child of root.children) {
    if (child.kind !== "element") continue;
    const scope = extendScope(child, rootScope);
    if (!isBpmn(child, scope)) continue;

    if (child.local === "collaboration") {
      collectParticipants(child, scope, lanes, counter);
    } else if (child.local === "process") {
      const processId = attribute(child, "id");
      if (processId) {
        flowNodesByProcess.set(processId, collectFlowNodeIds(child, scope));
      }
      collectLaneSets(child, scope, null, lanes, counter);
    }
  }

  return { lanes, flowNodesByProcess };
}

function collectParticipants(
  collaboration: XmlElement,
  scope: NsScope,
  out: ParsedBpmnLane[],
  counter: { next: number },
): void {
  for (const child of collaboration.children) {
    if (child.kind !== "element") continue;
    const childScope = extendScope(child, scope);
    if (!isBpmn(child, childScope) || child.local !== "participant") continue;
    const id = attribute(child, "id");
    if (!id) continue;
    out.push({
      bpmnElementId: id,
      name: attribute(child, "name") ?? null,
      kind: "pool",
      parentBpmnElementId: null,
      sequenceOrder: counter.next++,
      flowNodeRefs: [],
      processRef: attribute(child, "processRef") ?? null,
    });
  }
}

/**
 * `bpmn:laneSet` → `bpmn:lane` → (`bpmn:flowNodeRef` | `bpmn:childLaneSet`).
 *
 * Die Elternbeziehung kommt aus dem Modell, nicht aus der Geometrie: eine Lane
 * unterhalb eines `childLaneSet` ist Kind der Lane, die dieses `childLaneSet`
 * traegt. Genau diese Verschachtelung bildet `process_lane.parent_lane_id` ab.
 */
function collectLaneSets(
  container: XmlElement,
  scope: NsScope,
  parentLaneId: string | null,
  out: ParsedBpmnLane[],
  counter: { next: number },
): void {
  for (const child of container.children) {
    if (child.kind !== "element") continue;
    const childScope = extendScope(child, scope);
    if (!isBpmn(child, childScope)) continue;
    if (child.local !== "laneSet" && child.local !== "childLaneSet") continue;

    for (const laneNode of child.children) {
      if (laneNode.kind !== "element") continue;
      const laneScope = extendScope(laneNode, childScope);
      if (!isBpmn(laneNode, laneScope) || laneNode.local !== "lane") continue;
      const id = attribute(laneNode, "id");
      if (!id) continue;

      const flowNodeRefs: string[] = [];
      for (const ref of laneNode.children) {
        if (ref.kind !== "element") continue;
        const refScope = extendScope(ref, laneScope);
        if (!isBpmn(ref, refScope) || ref.local !== "flowNodeRef") continue;
        // `flowNodeRef` ist ein IDREF im Textinhalt, kein Attribut.
        const value = textOf(ref);
        if (value) flowNodeRefs.push(value);
      }

      out.push({
        bpmnElementId: id,
        name: attribute(laneNode, "name") ?? null,
        kind: "lane",
        parentBpmnElementId: parentLaneId,
        sequenceOrder: counter.next++,
        flowNodeRefs,
        processRef: null,
      });

      collectLaneSets(laneNode, laneScope, id, out, counter);
    }
  }
}

/** Die unmittelbaren Flow-Node-IDs eines `bpmn:process` (ohne Rekursion). */
function collectFlowNodeIds(process: XmlElement, scope: NsScope): string[] {
  const ids: string[] = [];
  for (const child of process.children) {
    if (child.kind !== "element") continue;
    const childScope = extendScope(child, scope);
    if (!isBpmn(child, childScope)) continue;
    if (!FLOW_NODE_LOCALS.has(child.local)) continue;
    const id = attribute(child, "id");
    if (id) ids.push(id);
  }
  return ids;
}

/**
 * Ordnet jedem Flow-Node **genau eine** Lane zu.
 *
 * Rangfolge, und sie ist die eigentliche fachliche Entscheidung dieser Datei:
 *
 *  1. Die **tiefste** Lane, die das Element als `flowNodeRef` fuehrt. Eine
 *     Unterlane („Sachbearbeitung Team Nord") ist die genauere Aussage als die
 *     Oberlane („Sachbearbeitung"), und die Verantwortlichkeit haengt an der
 *     genaueren.
 *  2. Nur wenn keine Lane das Element nennt: der Pool, dessen `processRef` auf
 *     den Prozess zeigt, in dem das Element steht. Ein Pool ohne Lanes ist die
 *     uebliche Form fuer einen externen Beteiligten — dort ist der Pool die
 *     Verantwortlichkeitsaussage.
 *
 * Ein Element, das **mehrere** Lanes derselben Tiefe nennen, ist im Modell ein
 * Widerspruch (BPMN erlaubt einem Flow-Node genau eine Lane je LaneSet). Hier
 * gewinnt die zuerst dokumentierte — und `syncProcessLanes` meldet den Fall in
 * `ambiguous`, statt ihn zu verschlucken.
 */
export function assignLaneMembership(parsed: ParsedBpmnLanes): {
  laneByFlowNode: Map<string, string>;
  ambiguous: string[];
} {
  const depthOf = new Map<string, number>();
  const byId = new Map(parsed.lanes.map((l) => [l.bpmnElementId, l]));
  for (const lane of parsed.lanes) {
    let depth = 0;
    let cursor = lane.parentBpmnElementId;
    const guard = new Set<string>([lane.bpmnElementId]);
    while (cursor && !guard.has(cursor)) {
      guard.add(cursor);
      depth++;
      cursor = byId.get(cursor)?.parentBpmnElementId ?? null;
    }
    depthOf.set(lane.bpmnElementId, depth);
  }

  const laneByFlowNode = new Map<string, string>();
  const chosenDepth = new Map<string, number>();
  const ambiguous: string[] = [];

  for (const lane of parsed.lanes) {
    if (lane.kind !== "lane") continue;
    const depth = depthOf.get(lane.bpmnElementId) ?? 0;
    for (const node of lane.flowNodeRefs) {
      const previous = chosenDepth.get(node);
      if (previous === undefined || depth > previous) {
        laneByFlowNode.set(node, lane.bpmnElementId);
        chosenDepth.set(node, depth);
      } else if (previous === depth) {
        ambiguous.push(node);
      }
    }
  }

  for (const pool of parsed.lanes) {
    if (pool.kind !== "pool" || !pool.processRef) continue;
    for (const node of parsed.flowNodesByProcess.get(pool.processRef) ?? []) {
      if (laneByFlowNode.has(node)) continue;
      laneByFlowNode.set(node, pool.bpmnElementId);
    }
  }

  return { laneByFlowNode, ambiguous: [...new Set(ambiguous)] };
}
