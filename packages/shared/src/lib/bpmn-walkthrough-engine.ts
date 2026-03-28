// Sprint 56: BPMN Walkthrough (Execution View) Engine
// Parses BPMN XML and derives sequential step-by-step flow

import type { WalkthroughStep, DecisionOption } from "../schemas/bpm-derived";

interface SequenceFlow {
  id: string;
  sourceRef: string;
  targetRef: string;
  name?: string;
}

interface FlowNode {
  id: string;
  name: string;
  type: "task" | "gateway" | "startEvent" | "endEvent" | "intermediateEvent";
  outgoing: string[];
  incoming: string[];
  laneId?: string;
}

/**
 * Derive a walkthrough (step-by-step execution view) from BPMN XML.
 *
 * Handles:
 * - Sequential tasks
 * - Exclusive gateways (decision points with options)
 * - Parallel gateways (concurrent paths merged)
 * - Start and end events
 */
export function deriveWalkthroughFromBPMN(bpmnXml: string): WalkthroughStep[] {
  const nodes = extractFlowNodes(bpmnXml);
  const flows = extractSequenceFlows(bpmnXml);
  const lanes = extractLaneMapping(bpmnXml);

  // Find start event
  const startEvent = nodes.find((n) => n.type === "startEvent");
  if (!startEvent) return [];

  const steps: WalkthroughStep[] = [];
  const visited = new Set<string>();
  let stepNumber = 1;

  // BFS traversal following sequence flows
  const queue: string[] = [startEvent.id];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const node = nodes.find((n) => n.id === currentId);
    if (!node) continue;

    if (node.type === "startEvent" || node.type === "endEvent" || node.type === "intermediateEvent") {
      // Events: add as event step only if they have a name
      if (node.name && node.type !== "startEvent") {
        steps.push({
          stepNumber: stepNumber++,
          type: "event",
          name: node.name,
          bpmnId: node.id,
          responsible: lanes.get(node.id) ?? "",
          documents: [],
          applications: [],
        });
      }

      // Follow outgoing flows
      const outFlows = flows.filter((f) => f.sourceRef === currentId);
      for (const flow of outFlows) {
        queue.push(flow.targetRef);
      }
    } else if (node.type === "gateway") {
      // Gateway: create decision point
      const outFlows = flows.filter((f) => f.sourceRef === currentId);

      if (outFlows.length > 1) {
        // Exclusive gateway: present decision options
        const decisionOptions: DecisionOption[] = [];

        for (const flow of outFlows) {
          const targetNode = nodes.find((n) => n.id === flow.targetRef);
          // Estimate the step number for the target (it will be assigned later)
          decisionOptions.push({
            label: flow.name || targetNode?.name || "Option",
            targetStepNumber: 0, // will be resolved after full traversal
          });
          queue.push(flow.targetRef);
        }

        steps.push({
          stepNumber: stepNumber++,
          type: "decision",
          name: node.name || "Decision",
          bpmnId: node.id,
          responsible: lanes.get(node.id) ?? "",
          documents: [],
          applications: [],
          decisionOptions,
        });
      } else {
        // Converging gateway or single-path: just follow
        for (const flow of outFlows) {
          queue.push(flow.targetRef);
        }
      }
    } else {
      // Task: add as step
      steps.push({
        stepNumber: stepNumber++,
        type: "task",
        name: node.name,
        bpmnId: node.id,
        responsible: lanes.get(node.id) ?? "",
        documents: extractDataObjectsForNode(bpmnXml, node.id),
        applications: [],
      });

      const outFlows = flows.filter((f) => f.sourceRef === currentId);
      for (const flow of outFlows) {
        queue.push(flow.targetRef);
      }
    }
  }

  // Resolve decision option target step numbers
  resolveDecisionTargets(steps, nodes, flows);

  return steps;
}

function resolveDecisionTargets(
  steps: WalkthroughStep[],
  nodes: FlowNode[],
  flows: SequenceFlow[],
): void {
  for (const step of steps) {
    if (step.type === "decision" && step.decisionOptions) {
      const outFlows = flows.filter((f) => f.sourceRef === step.bpmnId);

      for (let i = 0; i < step.decisionOptions.length && i < outFlows.length; i++) {
        const targetId = outFlows[i].targetRef;
        const targetStep = steps.find((s) => s.bpmnId === targetId);
        if (targetStep) {
          step.decisionOptions[i].targetStepNumber = targetStep.stepNumber;
        }
      }
    }
  }
}

// ─── XML Parsing Helpers ──────────────────────────────────────

function extractFlowNodes(xml: string): FlowNode[] {
  const nodes: FlowNode[] = [];

  // Extract tasks
  const taskRegex = /<bpmn:(task|userTask|serviceTask|sendTask|receiveTask|manualTask|scriptTask)\s+id="([^"]+)"(?:\s+name="([^"]*)")?/g;
  let m: RegExpExecArray | null;
  while ((m = taskRegex.exec(xml)) !== null) {
    nodes.push({ id: m[2], name: m[3] || m[2], type: "task", outgoing: [], incoming: [] });
  }

  // Extract gateways
  const gwRegex = /<bpmn:(exclusiveGateway|parallelGateway|inclusiveGateway)\s+id="([^"]+)"(?:\s+name="([^"]*)")?/g;
  while ((m = gwRegex.exec(xml)) !== null) {
    nodes.push({ id: m[2], name: m[3] || "", type: "gateway", outgoing: [], incoming: [] });
  }

  // Extract events
  const eventRegex = /<bpmn:(startEvent|endEvent|intermediateThrowEvent|intermediateCatchEvent)\s+id="([^"]+)"(?:\s+name="([^"]*)")?/g;
  while ((m = eventRegex.exec(xml)) !== null) {
    const type = m[1].includes("start") ? "startEvent" :
      m[1].includes("end") ? "endEvent" : "intermediateEvent";
    nodes.push({ id: m[2], name: m[3] || "", type, outgoing: [], incoming: [] });
  }

  return nodes;
}

function extractSequenceFlows(xml: string): SequenceFlow[] {
  const flows: SequenceFlow[] = [];
  const flowRegex = /<bpmn:sequenceFlow\s+id="([^"]+)"\s+sourceRef="([^"]+)"\s+targetRef="([^"]+)"(?:\s+name="([^"]*)")?/g;
  let m: RegExpExecArray | null;

  while ((m = flowRegex.exec(xml)) !== null) {
    flows.push({
      id: m[1],
      sourceRef: m[2],
      targetRef: m[3],
      name: m[4] || undefined,
    });
  }

  return flows;
}

function extractLaneMapping(xml: string): Map<string, string> {
  const mapping = new Map<string, string>();
  const laneRegex = /<bpmn:lane\s+id="[^"]*"(?:\s+name="([^"]*)")?[^>]*>([\s\S]*?)<\/bpmn:lane>/g;
  let m: RegExpExecArray | null;

  while ((m = laneRegex.exec(xml)) !== null) {
    const laneName = m[1] || "";
    const content = m[2];
    const refRegex = /<bpmn:flowNodeRef>([^<]+)<\/bpmn:flowNodeRef>/g;
    let refMatch: RegExpExecArray | null;
    while ((refMatch = refRegex.exec(content)) !== null) {
      mapping.set(refMatch[1], laneName);
    }
  }

  return mapping;
}

function extractDataObjectsForNode(_xml: string, _nodeId: string): string[] {
  // Simplified: would need full association parsing
  return [];
}
