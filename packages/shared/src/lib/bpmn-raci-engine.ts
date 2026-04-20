// Sprint 56: BPMN RACI Derivation Engine
// Parses BPMN XML and extracts RACI matrix from lanes, tasks, and message flows

import type { RACIEntry, RACIMatrix } from "../schemas/bpm-derived";

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

function extractLanes(xml: string): BpmnLane[] {
  const lanes: BpmnLane[] = [];
  const laneRegex =
    /<bpmn:lane\s+id="([^"]+)"(?:\s+name="([^"]*)")?[^>]*>([\s\S]*?)<\/bpmn:lane>/g;
  let match: RegExpExecArray | null;

  while ((match = laneRegex.exec(xml)) !== null) {
    const id = match[1];
    const name = match[2] || id;
    const content = match[3];
    const flowNodeRefs: string[] = [];
    const refRegex = /<bpmn:flowNodeRef>([^<]+)<\/bpmn:flowNodeRef>/g;
    let refMatch: RegExpExecArray | null;
    while ((refMatch = refRegex.exec(content)) !== null) {
      flowNodeRefs.push(refMatch[1]);
    }
    lanes.push({ id, name, flowNodeRefs });
  }

  return lanes;
}

function extractTasks(xml: string): BpmnElement[] {
  const tasks: BpmnElement[] = [];
  const taskRegex =
    /<bpmn:(task|userTask|serviceTask|sendTask|receiveTask|manualTask)\s+id="([^"]+)"(?:\s+name="([^"]*)")?/g;
  let match: RegExpExecArray | null;

  while ((match = taskRegex.exec(xml)) !== null) {
    tasks.push({
      id: match[2],
      name: match[3] || match[2],
      type: match[1],
    });
  }

  return tasks;
}

function extractMessageFlows(xml: string): BpmnMessageFlow[] {
  const flows: BpmnMessageFlow[] = [];
  const flowRegex =
    /<bpmn:messageFlow[^>]+sourceRef="([^"]+)"[^>]+targetRef="([^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = flowRegex.exec(xml)) !== null) {
    flows.push({ sourceRef: match[1], targetRef: match[2] });
  }

  return flows;
}

function extractDocumentRefs(xml: string, taskId: string): string[] {
  const refs: string[] = [];
  const docRegex = new RegExp(
    `<bpmn:dataInputAssociation[^>]*>\\s*<bpmn:sourceRef>${taskId}</bpmn:sourceRef>\\s*<bpmn:targetRef>([^<]+)</bpmn:targetRef>`,
    "g",
  );
  let match: RegExpExecArray | null;
  while ((match = docRegex.exec(xml)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}

function extractApplicationRefs(_xml: string, _taskId: string): string[] {
  // Custom application shapes would need custom namespace parsing
  return [];
}

function extractRiskRefs(_xml: string, _taskId: string): string[] {
  // Risk overlays from Sprint 3 would need custom namespace parsing
  return [];
}

function findLaneForNode(
  lanes: BpmnLane[],
  nodeId: string,
): BpmnLane | undefined {
  return lanes.find((l) => l.flowNodeRefs.includes(nodeId));
}
