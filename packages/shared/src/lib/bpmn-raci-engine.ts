// Sprint 56: BPMN RACI Derivation Engine
// Parses BPMN XML and extracts RACI matrix from lanes, tasks, and message flows

import type { RACIEntry, RACIMatrix } from "../schemas/bpm-derived";
// [ARCTOS-FULL-2026-08-31 · OP-037] Eine Interpretation des Formats.
import { extractBpmn, nodesOfType } from "./bpmn-extract";

interface BpmnElement {
  id: string;
  name: string;
  type: string;
}

interface BpmnLane {
  id: string;
  name: string;
  flowNodeRefs: string[];
}

interface BpmnMessageFlow {
  sourceRef: string;
  targetRef: string;
}

/**
 * Derive a RACI matrix from BPMN XML.
 *
 * Rules:
 * - Activity in a lane => R (Responsible) for the lane owner
 * - Pool/process owner => A (Accountable) for all activities in their pool
 * - Connected via messageFlow source => C (Consulted)
 * - Connected via messageFlow target => I (Informed)
 */
export function deriveRACIFromBPMN(bpmnXml: string): RACIMatrix {
  const activities: { id: string; name: string }[] = [];
  const participants: { id: string; name: string }[] = [];
  const entries: RACIEntry[] = [];

  // Parse XML using regex-based extraction (lightweight, no DOM dependency)
  const lanes = extractLanes(bpmnXml);
  const tasks = extractTasks(bpmnXml);
  const messageFlows = extractMessageFlows(bpmnXml);

  // Build participant list from lanes
  for (const lane of lanes) {
    participants.push({ id: lane.id, name: lane.name });
  }

  // Build activity list from tasks
  for (const task of tasks) {
    activities.push({ id: task.id, name: task.name });
  }

  // Assign R for task-in-lane
  for (const lane of lanes) {
    for (const task of tasks) {
      if (lane.flowNodeRefs.includes(task.id)) {
        entries.push({
          activityId: task.id,
          activityName: task.name,
          participantId: lane.id,
          participantName: lane.name,
          role: "R",
          isOverride: false,
          documents: extractDocumentRefs(bpmnXml, task.id),
          applications: extractApplicationRefs(bpmnXml, task.id),
          risks: extractRiskRefs(bpmnXml, task.id),
        });
      }
    }
  }

  // Assign C/I for message flows
  for (const flow of messageFlows) {
    const sourceLane = findLaneForNode(lanes, flow.sourceRef);
    const targetLane = findLaneForNode(lanes, flow.targetRef);
    const sourceTask = tasks.find((t) => t.id === flow.sourceRef);
    const targetTask = tasks.find((t) => t.id === flow.targetRef);

    if (targetLane && sourceTask) {
      entries.push({
        activityId: sourceTask.id,
        activityName: sourceTask.name,
        participantId: targetLane.id,
        participantName: targetLane.name,
        role: "I",
        isOverride: false,
        documents: [],
        applications: [],
        risks: [],
      });
    }

    if (sourceLane && targetTask) {
      entries.push({
        activityId: targetTask.id,
        activityName: targetTask.name,
        participantId: sourceLane.id,
        participantName: sourceLane.name,
        role: "C",
        isOverride: false,
        documents: [],
        applications: [],
        risks: [],
      });
    }
  }

  return { activities, participants, entries };
}

/**
 * Apply manual overrides to a derived RACI matrix.
 */
export function applyRACIOverrides(
  matrix: RACIMatrix,
  overrides: {
    activityBpmnId: string;
    participantBpmnId: string;
    raciRole: string;
  }[],
): RACIMatrix {
  const updatedEntries = [...matrix.entries];

  for (const override of overrides) {
    const existingIdx = updatedEntries.findIndex(
      (e) =>
        e.activityId === override.activityBpmnId &&
        e.participantId === override.participantBpmnId,
    );

    const entry: RACIEntry = {
      activityId: override.activityBpmnId,
      activityName:
        matrix.activities.find((a) => a.id === override.activityBpmnId)?.name ??
        "",
      participantId: override.participantBpmnId,
      participantName:
        matrix.participants.find((p) => p.id === override.participantBpmnId)
          ?.name ?? "",
      role: override.raciRole as "R" | "A" | "C" | "I",
      isOverride: true,
      documents: existingIdx >= 0 ? updatedEntries[existingIdx].documents : [],
      applications:
        existingIdx >= 0 ? updatedEntries[existingIdx].applications : [],
      risks: existingIdx >= 0 ? updatedEntries[existingIdx].risks : [],
    };

    if (existingIdx >= 0) {
      updatedEntries[existingIdx] = entry;
    } else {
      updatedEntries.push(entry);
    }
  }

  return { ...matrix, entries: updatedEntries };
}

// ─── XML parsing helpers ──────────────────────────────────────
//
// [ARCTOS-FULL-2026-08-31 · OP-037] Hier standen fünf reguläre Ausdrücke über
// dem rohen XML. Sie sind durch `extractBpmn` ersetzt — dieselbe
// Interpretation des Formats, die `@grc/bpmn` benutzt. Was die Ausdrücke
// falsch machten (Präfixe, Attributreihenfolge, leere Lanes, Kommentare,
// Entitäten, fremde Namensräume), steht im Kopf von `bpmn-extract.ts`.

/** Die Aufgabentypen, die diese Auswertung als „Aufgabe" zählt. */
const RACI_TASK_LOCAL_NAMES: ReadonlySet<string> = new Set([
  "task",
  "userTask",
  "serviceTask",
  "sendTask",
  "receiveTask",
  "manualTask",
]);

function extractLanes(xml: string): BpmnLane[] {
  return extractBpmn(xml).lanes.map((lane) => ({
    id: lane.id,
    name: lane.name,
    flowNodeRefs: [...lane.flowNodeRefs],
  }));
}

function extractTasks(xml: string): BpmnElement[] {
  return nodesOfType(extractBpmn(xml), RACI_TASK_LOCAL_NAMES).map((node) => ({
    id: node.id,
    // Wie bisher: ohne Namen steht die Kennung. Sie ist in der Matrix die
    // einzige Möglichkeit, die Zeile wiederzuerkennen.
    name: node.name || node.id,
    type: node.localName,
  }));
}

function extractMessageFlows(xml: string): BpmnMessageFlow[] {
  return extractBpmn(xml).messageFlows.map((flow) => ({
    sourceRef: flow.sourceRef,
    targetRef: flow.targetRef,
  }));
}

function extractDocumentRefs(xml: string, taskId: string): string[] {
  return [...(extractBpmn(xml).dataInputsByNode.get(taskId) ?? [])];
}

function extractApplicationRefs(_xml: string, _taskId: string): string[] {
  // Anwendungsformen wären eine eigene Namensraumerweiterung; es gibt sie
  // heute nicht (unverändert gegenüber der Regex-Fassung).
  return [];
}

function extractRiskRefs(_xml: string, _taskId: string): string[] {
  // Risiko-Overlays hängen an der Datenbank, nicht am BPMN (unverändert).
  return [];
}

function findLaneForNode(
  lanes: BpmnLane[],
  nodeId: string,
): BpmnLane | undefined {
  return lanes.find((l) => l.flowNodeRefs.includes(nodeId));
}
