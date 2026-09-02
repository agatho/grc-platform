/**
 * Semantischer Abzug eines Diagramms — die Vergleichsgrundlage des
 * Round-Trip-Tests.
 *
 * Verglichen wird **nicht** der XML-Text: dessen Normalisierung durch
 * `moddle-xml` ist Gegenstand der Zusicherungen Z-A und Z-B und wird vom
 * Round-Trip-Prüfstand des Modellstrangs (`test/model/`) gemessen. Hier geht es
 * um die Frage danach: *Steht im geschriebenen XML dasselbe Modell, das der
 * Editor im Speicher hatte?*
 *
 * Der Abzug enthält deshalb genau das, was eine Operation kaputt machen kann
 * und was ein Fremdwerkzeug später liest — Typ, Name, Container, Endpunkte,
 * Lane-Zugehörigkeit, Anheftung, DI-Geometrie —, in stabiler Sortierung, damit
 * ein Unterschied im Diff sichtbar wird statt in einer Reihenfolge unterzugehen.
 */

import {
  boundsOf,
  buildDiIndex,
  waypointsOf,
} from "../../../src/modeling/di.js";
import { walkDocument } from "../../../src/modeling/invariants.js";
import type { ModdleElement } from "../../../src/modeling/types.js";
import { asArray, is, isModdleElement } from "../../../src/modeling/util.js";

export interface NodeSnapshot {
  id: string;
  type: string;
  name?: string;
  container?: string;
  attachedTo?: string;
  lane?: string;
  bounds?: string;
}

export interface EdgeSnapshot {
  id: string;
  type: string;
  name?: string;
  source?: string;
  target?: string;
  container?: string;
  waypoints?: string;
}

export interface DiagramSnapshot {
  root?: string;
  nodes: NodeSnapshot[];
  edges: EdgeSnapshot[];
  lanes: Array<{ id: string; process?: string; members: string[] }>;
  participants: Array<{ id: string; process?: string }>;
}

function id(element: unknown): string | undefined {
  if (!isModdleElement(element)) return undefined;
  return typeof element.id === "string" ? element.id : undefined;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function semanticSnapshot(definitions: ModdleElement): DiagramSnapshot {
  const walked = walkDocument(definitions);
  const di = buildDiIndex(definitions);
  const ownerOf = new Map<ModdleElement, ModdleElement | undefined>();
  for (const entry of walked) {
    if (!ownerOf.has(entry.element)) ownerOf.set(entry.element, entry.owner);
  }

  const laneOf = new Map<ModdleElement, string>();
  for (const { element } of walked) {
    if (element.$type !== "bpmn:Lane") continue;
    for (const node of asArray(element["flowNodeRef"])) {
      const laneId = id(element);
      if (laneId) laneOf.set(node, laneId);
    }
  }

  const nodes: NodeSnapshot[] = [];
  const edges: EdgeSnapshot[] = [];
  const lanes: DiagramSnapshot["lanes"] = [];
  const participants: DiagramSnapshot["participants"] = [];

  for (const { element } of walked) {
    const elementId = id(element);
    if (!elementId) continue;

    if (element.$type === "bpmn:Lane") {
      lanes.push({
        id: elementId,
        ...(ownerOfProcess(ownerOf, element)
          ? { process: ownerOfProcess(ownerOf, element) }
          : {}),
        members: asArray(element["flowNodeRef"])
          .map((n) => id(n) ?? "?")
          .sort(),
      });
      continue;
    }

    if (element.$type === "bpmn:Participant") {
      participants.push({
        id: elementId,
        ...(id(element["processRef"])
          ? { process: id(element["processRef"])! }
          : {}),
      });
      continue;
    }

    const diElement = di.get(element);

    if (
      element.$type === "bpmn:SequenceFlow" ||
      element.$type === "bpmn:MessageFlow" ||
      element.$type === "bpmn:Association"
    ) {
      const waypoints = diElement ? waypointsOf(diElement) : [];
      edges.push({
        id: elementId,
        type: element.$type,
        ...(typeof element["name"] === "string" && element["name"] !== ""
          ? { name: element["name"] }
          : {}),
        ...(id(element["sourceRef"])
          ? { source: id(element["sourceRef"])! }
          : {}),
        ...(id(element["targetRef"])
          ? { target: id(element["targetRef"])! }
          : {}),
        ...(id(ownerOf.get(element))
          ? { container: id(ownerOf.get(element))! }
          : {}),
        ...(waypoints.length > 0
          ? {
              waypoints: waypoints
                .map((p) => `${String(round(p.x))},${String(round(p.y))}`)
                .join(" "),
            }
          : {}),
      });
      continue;
    }

    if (
      !is(element, "bpmn:FlowNode") &&
      element.$type !== "bpmn:DataObjectReference" &&
      element.$type !== "bpmn:DataStoreReference" &&
      element.$type !== "bpmn:TextAnnotation" &&
      element.$type !== "bpmn:Group"
    ) {
      continue;
    }

    const bounds = diElement ? boundsOf(diElement) : undefined;
    nodes.push({
      id: elementId,
      type: element.$type,
      ...(typeof element["name"] === "string" && element["name"] !== ""
        ? { name: element["name"] }
        : {}),
      ...(id(ownerOf.get(element))
        ? { container: id(ownerOf.get(element))! }
        : {}),
      ...(id(element["attachedToRef"])
        ? { attachedTo: id(element["attachedToRef"])! }
        : {}),
      ...(laneOf.get(element) ? { lane: laneOf.get(element)! } : {}),
      ...(bounds
        ? {
            bounds: `${String(round(bounds.x))},${String(round(bounds.y))},${String(
              round(bounds.width),
            )},${String(round(bounds.height))}`,
          }
        : {}),
    });
  }

  const byId = <T extends { id: string }>(list: T[]): T[] =>
    [...list].sort((a, b) => a.id.localeCompare(b.id));

  const rootPlane = asArray(definitions["diagrams"])[0]?.["plane"];
  return {
    ...(id(isModdleElement(rootPlane) ? rootPlane["bpmnElement"] : undefined)
      ? { root: id((rootPlane as ModdleElement)["bpmnElement"])! }
      : {}),
    nodes: byId(nodes),
    edges: byId(edges),
    lanes: byId(lanes),
    participants: byId(participants),
  };
}

function ownerOfProcess(
  ownerOf: ReadonlyMap<ModdleElement, ModdleElement | undefined>,
  lane: ModdleElement,
): string | undefined {
  let owner = ownerOf.get(lane);
  let guard = 0;
  while (owner && guard++ < 32) {
    if (is(owner, "bpmn:Process") || is(owner, "bpmn:SubProcess"))
      return id(owner);
    owner = ownerOf.get(owner);
  }
  return undefined;
}
