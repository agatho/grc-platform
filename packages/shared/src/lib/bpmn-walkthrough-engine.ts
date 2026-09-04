// Sprint 56: BPMN Walkthrough (Execution View) Engine
// Parses BPMN XML and derives sequential step-by-step flow

import type { WalkthroughStep, DecisionOption } from "../schemas/bpm-derived";
// [ARCTOS-FULL-2026-08-31 · OP-037] Eine Interpretation des Formats.
import { extractBpmn, laneNameByNode } from "./bpmn-extract";

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

    if (
      node.type === "startEvent" ||
      node.type === "endEvent" ||
      node.type === "intermediateEvent"
    ) {
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

      // [OP-065] Zwei Felder wurden über denselben Index gelesen und
      // beschrieben; die Schranke `i < …length && i < …length` sicherte
      // beides, war für den Compiler aber nicht mit den Zugriffen verbunden.
      // `entries()` über die kürzere der beiden Listen reicht Wert UND Index
      // heraus, und der zweite Zugriff wird ausdrücklich geprüft, statt
      // behauptet zu werden.
      for (const [i, option] of step.decisionOptions.entries()) {
        const flow = outFlows[i];
        if (flow === undefined) break;
        const targetStep = steps.find((s) => s.bpmnId === flow.targetRef);
        if (targetStep) {
          option.targetStepNumber = targetStep.stepNumber;
        }
      }
    }
  }
}

// ─── XML Parsing Helpers ──────────────────────────────────────
//
// [ARCTOS-FULL-2026-08-31 · OP-037] Hier standen vier reguläre Ausdrücke über
// dem rohen XML — einer je Elementfamilie, jeder mit `<bpmn:` fest verdrahtet.
// Ersetzt durch `extractBpmn`; die Fehlerliste der alten Fassung steht im Kopf
// von `bpmn-extract.ts`.
//
// Ein Verhaltensunterschied, beabsichtigt: die Knoten kommen jetzt in
// **Dokumentreihenfolge**, nicht mehr in drei Blöcken (erst alle Aufgaben,
// dann alle Gateways, dann alle Ereignisse). Für die Durchsprache ist das die
// richtige Reihenfolge — sie folgt dem Diagramm statt der Reihenfolge, in der
// jemand die regulären Ausdrücke hingeschrieben hat.

const WALKTHROUGH_TASK_LOCAL_NAMES: ReadonlySet<string> = new Set([
  "task",
  "userTask",
  "serviceTask",
  "sendTask",
  "receiveTask",
  "manualTask",
  "scriptTask",
]);

const WALKTHROUGH_GATEWAY_LOCAL_NAMES: ReadonlySet<string> = new Set([
  "exclusiveGateway",
  "parallelGateway",
  "inclusiveGateway",
]);

const WALKTHROUGH_EVENT_LOCAL_NAMES: ReadonlySet<string> = new Set([
  "startEvent",
  "endEvent",
  "intermediateThrowEvent",
  "intermediateCatchEvent",
]);

function extractFlowNodes(xml: string): FlowNode[] {
  const nodes: FlowNode[] = [];
  for (const node of extractBpmn(xml).nodes) {
    if (WALKTHROUGH_TASK_LOCAL_NAMES.has(node.localName)) {
      // Wie bisher: eine Aufgabe ohne Namen wird über ihre Kennung benannt,
      // ein Gateway oder Ereignis ohne Namen bleibt namenlos.
      nodes.push({
        id: node.id,
        name: node.name || node.id,
        type: "task",
        outgoing: [],
        incoming: [],
      });
      continue;
    }
    if (WALKTHROUGH_GATEWAY_LOCAL_NAMES.has(node.localName)) {
      nodes.push({
        id: node.id,
        name: node.name,
        type: "gateway",
        outgoing: [],
        incoming: [],
      });
      continue;
    }
    if (WALKTHROUGH_EVENT_LOCAL_NAMES.has(node.localName)) {
      nodes.push({
        id: node.id,
        name: node.name,
        type: node.localName.startsWith("start")
          ? "startEvent"
          : node.localName.startsWith("end")
            ? "endEvent"
            : "intermediateEvent",
        outgoing: [],
        incoming: [],
      });
    }
  }
  return nodes;
}

function extractSequenceFlows(xml: string): SequenceFlow[] {
  return extractBpmn(xml).flows.map((flow) => ({
    id: flow.id,
    sourceRef: flow.sourceRef,
    targetRef: flow.targetRef,
    ...(flow.name !== undefined ? { name: flow.name } : {}),
  }));
}

function extractLaneMapping(xml: string): Map<string, string> {
  return new Map(laneNameByNode(extractBpmn(xml)));
}

function extractDataObjectsForNode(_xml: string, _nodeId: string): string[] {
  // Simplified: would need full association parsing
  return [];
}
