/**
 * [ARCTOS-FULL-2026-08-31 · OP-037] Die eine Stelle, an der `packages/shared`
 * BPMN liest.
 *
 * **Der Befund.** Zwei Dateien in `src/lib/` zogen BPMN mit regulären
 * Ausdrücken aus dem rohen XML — `bpmn-raci-engine.ts` (Lanes, Aufgaben,
 * Nachrichtenflüsse) und `bpmn-walkthrough-engine.ts` (Knoten, Kanten,
 * Lane-Zuordnung). Der Ausdruck sah so aus:
 *
 * ```
 * /<bpmn:lane\s+id="([^"]+)"(?:\s+name="([^"]*)")?[^>]*>([\s\S]*?)<\/bpmn:lane>/g
 * ```
 *
 * Was daran im Bestand bricht, gemessen an gültigen BPMN-Dokumenten:
 *
 * | Eingabe | regulärer Ausdruck | Wirklichkeit |
 * |---|---|---|
 * | `<ns0:lane …>` (JAXB), `<semantic:lane …>` (Signavio) | kein Treffer | gültiges BPMN |
 * | `<bpmn:lane name="A" id="L1">` (Attribute umgekehrt) | kein Treffer | die Reihenfolge ist in XML bedeutungslos |
 * | `<bpmn:lane id="L1"/>` (leer, selbstschliessend) | kein Treffer | gültige leere Lane |
 * | `<!-- <bpmn:task id="X"/> -->` (auskommentiert) | Treffer | ein Kommentar ist kein Element |
 * | `<bpmn:task id="T" name="a &gt; b"/>` | Name „a &gt; b" | Name „a > b" |
 * | `<x:task id="Fremd"/>` (fremder Namensraum) | Treffer, wenn `x` = `bpmn` | fremdes Element |
 *
 * Die Zeilen liefen an keiner Stelle durch einen Test — `grep -rl
 * "raci-engine\|walkthrough-engine" packages/shared/tests apps/web/src` ergab
 * am 2026-09-02 **null** Treffer. Sie sind damit die riskanteste der sechs
 * Dateien: falsch **und** unbeobachtet.
 *
 * **Gelesen wird jetzt mit `parseXml` aus `@grc/bpmn/util`** — derselbe Leser,
 * den die Engine für ihren Kanonisierer benutzt: synchron, ohne Abhängigkeit,
 * namensraumbewusst, mit dekodierten Entitäten. Das ist der Kern von OP-037:
 * **eine** Interpretation des Formats.
 */

import { parseXml, type XmlElement } from "@grc/bpmn/util";

/** Der Namensraum des BPMN-Metamodells (OMG formal/2011-01-03). */
export const BPMN_MODEL_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL";

export interface ExtractedLane {
  readonly id: string;
  readonly name: string;
  readonly flowNodeRefs: readonly string[];
}

export interface ExtractedNode {
  readonly id: string;
  readonly name: string;
  /** Lokaler BPMN-Name, z. B. `userTask`, `exclusiveGateway`, `startEvent`. */
  readonly localName: string;
}

export interface ExtractedFlow {
  readonly id: string;
  readonly sourceRef: string;
  readonly targetRef: string;
  readonly name: string | undefined;
}

export interface ExtractedMessageFlow {
  readonly sourceRef: string;
  readonly targetRef: string;
}

/** Was ein Aufruf aus einem Dokument herausholt. */
export interface ExtractedBpmn {
  readonly lanes: readonly ExtractedLane[];
  readonly nodes: readonly ExtractedNode[];
  readonly flows: readonly ExtractedFlow[];
  readonly messageFlows: readonly ExtractedMessageFlow[];
  /** `dataInputAssociation`: Zielknoten → referenzierte Datenobjekte. */
  readonly dataInputsByNode: ReadonlyMap<string, readonly string[]>;
}

const EMPTY: ExtractedBpmn = {
  lanes: [],
  nodes: [],
  flows: [],
  messageFlows: [],
  dataInputsByNode: new Map(),
};

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

/**
 * Gehört dieses Element zum BPMN-Metamodell?
 *
 * Ohne jede Namensraumdeklaration im Dokument wird der lokale Name genommen —
 * solche Dateien erzeugt der Excel-Import, und sie abzulehnen wäre eine
 * Verschlechterung. Es ist der einzige Fall, in dem geraten wird.
 */
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

/** Der reine Textinhalt eines Elements, Entitäten bereits dekodiert. */
function textOf(element: XmlElement): string {
  let out = "";
  for (const child of element.children) {
    if (child.kind === "text") out += child.value;
  }
  return out.trim();
}

const NODE_LOCAL_NAMES = new Set([
  "task",
  "userTask",
  "serviceTask",
  "sendTask",
  "receiveTask",
  "manualTask",
  "businessRuleTask",
  "scriptTask",
  "callActivity",
  "subProcess",
  "adHocSubProcess",
  "transaction",
  "exclusiveGateway",
  "parallelGateway",
  "inclusiveGateway",
  "eventBasedGateway",
  "complexGateway",
  "startEvent",
  "endEvent",
  "intermediateCatchEvent",
  "intermediateThrowEvent",
  "boundaryEvent",
]);

/**
 * Alles auf einmal, in **einem** Durchlauf.
 *
 * Bewusst eine Funktion und nicht sechs: die beiden Aufrufer brauchten je drei
 * bis vier Auszüge und liefen dafür drei- bis viermal über dasselbe Dokument.
 * Ein Baum, ein Durchlauf.
 *
 * Ein unlesbares Dokument liefert einen leeren Auszug statt zu werfen. Die
 * aufrufenden Motoren (RACI, Walkthrough) sind Auswertungen, keine Prüfer —
 * sie sollen bei kaputter Eingabe nichts finden, nicht die Seite mitreissen.
 * Wer eine Fehlermeldung will, nimmt `validateBpmnXml`.
 */
export function extractBpmn(xml: string): ExtractedBpmn {
  let root: XmlElement;
  try {
    root = parseXml(xml).root;
  } catch {
    return EMPTY;
  }

  const lanes: ExtractedLane[] = [];
  const nodes: ExtractedNode[] = [];
  const flows: ExtractedFlow[] = [];
  const messageFlows: ExtractedMessageFlow[] = [];
  const dataInputsByNode = new Map<string, string[]>();

  const visit = (element: XmlElement, parentScope: NsScope): void => {
    const scope = extendScope(element, parentScope);
    if (isBpmn(element, scope)) {
      collect(element, scope);
    }
    for (const child of element.children) {
      if (child.kind === "element") visit(child, scope);
    }
  };

  const collect = (element: XmlElement, scope: NsScope): void => {
    const id = attribute(element, "id");
    const name = attribute(element, "name");

    if (element.local === "lane" && id) {
      const flowNodeRefs: string[] = [];
      for (const child of element.children) {
        if (child.kind !== "element") continue;
        const childScope = extendScope(child, scope);
        if (child.local === "flowNodeRef" && isBpmn(child, childScope)) {
          const ref = textOf(child);
          if (ref) flowNodeRefs.push(ref);
        }
      }
      lanes.push({ id, name: name ?? id, flowNodeRefs });
      return;
    }

    if (NODE_LOCAL_NAMES.has(element.local) && id) {
      nodes.push({ id, name: name ?? "", localName: element.local });
      return;
    }

    if (element.local === "sequenceFlow") {
      const source = attribute(element, "sourceRef");
      const target = attribute(element, "targetRef");
      if (id && source && target) {
        flows.push({
          id,
          sourceRef: source,
          targetRef: target,
          name: name === undefined || name === "" ? undefined : name,
        });
      }
      return;
    }

    if (element.local === "messageFlow") {
      const source = attribute(element, "sourceRef");
      const target = attribute(element, "targetRef");
      if (source && target)
        messageFlows.push({ sourceRef: source, targetRef: target });
      return;
    }

    if (element.local === "dataInputAssociation") {
      // Die Zuordnung steht in zwei Kindelementen, nicht in Attributen —
      // `<sourceRef>` nennt das Datenobjekt, `<targetRef>` das Ziel. Der
      // Wirt ist das Elternelement; den kennt dieser Durchlauf nicht, also
      // wird über den Elternknoten zugeordnet, sobald `visit` ihn liefert.
      let source: string | undefined;
      let target: string | undefined;
      for (const child of element.children) {
        if (child.kind !== "element") continue;
        const childScope = extendScope(child, scope);
        if (!isBpmn(child, childScope)) continue;
        if (child.local === "sourceRef") source = textOf(child);
        if (child.local === "targetRef") target = textOf(child);
      }
      if (source && target) {
        const list = dataInputsByNode.get(source) ?? [];
        list.push(target);
        dataInputsByNode.set(source, list);
      }
    }
  };

  visit(root, new Map<string, string>());

  return { lanes, nodes, flows, messageFlows, dataInputsByNode };
}

/** Nur die Knoten, deren lokaler Name in `localNames` steht. */
export function nodesOfType(
  extracted: ExtractedBpmn,
  localNames: ReadonlySet<string>,
): readonly ExtractedNode[] {
  return extracted.nodes.filter((node) => localNames.has(node.localName));
}

/** Knoten-ID → Lane-Name, aus `flowNodeRef`. */
export function laneNameByNode(
  extracted: ExtractedBpmn,
): ReadonlyMap<string, string> {
  const mapping = new Map<string, string>();
  for (const lane of extracted.lanes) {
    for (const ref of lane.flowNodeRefs) mapping.set(ref, lane.name);
  }
  return mapping;
}
