// Sprint 3: BPMN XML Parser
// Extracts ProcessStep records from BPMN 2.0 XML for syncing to process_step table

import { XMLParser } from "fast-xml-parser";
import type { StepType } from "./types";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface ParsedProcessStep {
  bpmnElementId: string;
  name: string | null;
  stepType: StepType;
  sequenceOrder: number;
}

// ──────────────────────────────────────────────────────────────
// BPMN element type to step_type mapping
// ──────────────────────────────────────────────────────────────

const BPMN_TASK_TYPES = [
  "bpmn:task",
  "bpmn:userTask",
  "bpmn:serviceTask",
  "bpmn:sendTask",
  "bpmn:receiveTask",
  "bpmn:manualTask",
  "bpmn:businessRuleTask",
  "bpmn:scriptTask",
  // Unprefixed variants (some parsers strip namespace)
  "task",
  "userTask",
  "serviceTask",
  "sendTask",
  "receiveTask",
  "manualTask",
  "businessRuleTask",
  "scriptTask",
];

const BPMN_GATEWAY_TYPES = [
  "bpmn:exclusiveGateway",
  "bpmn:parallelGateway",
  "bpmn:inclusiveGateway",
  "bpmn:eventBasedGateway",
  "bpmn:complexGateway",
  "exclusiveGateway",
  "parallelGateway",
  "inclusiveGateway",
  "eventBasedGateway",
  "complexGateway",
];

const BPMN_EVENT_TYPES = [
  "bpmn:startEvent",
  "bpmn:endEvent",
  "bpmn:intermediateCatchEvent",
  "bpmn:intermediateThrowEvent",
  "bpmn:boundaryEvent",
  "startEvent",
  "endEvent",
  "intermediateCatchEvent",
  "intermediateThrowEvent",
  "boundaryEvent",
];

const BPMN_SUBPROCESS_TYPES = [
  "bpmn:subProcess",
  "bpmn:adHocSubProcess",
  "bpmn:transaction",
  "subProcess",
  "adHocSubProcess",
  "transaction",
];

const BPMN_CALL_ACTIVITY_TYPES = ["bpmn:callActivity", "callActivity"];

const ALL_BPMN_ELEMENT_TAGS = [
  ...BPMN_TASK_TYPES,
  ...BPMN_GATEWAY_TYPES,
  ...BPMN_EVENT_TYPES,
  ...BPMN_SUBPROCESS_TYPES,
  ...BPMN_CALL_ACTIVITY_TYPES,
];

function getStepType(elementTag: string): StepType | null {
  if (BPMN_TASK_TYPES.includes(elementTag)) return "task";
  if (BPMN_GATEWAY_TYPES.includes(elementTag)) return "gateway";
  if (BPMN_EVENT_TYPES.includes(elementTag)) return "event";
  if (BPMN_SUBPROCESS_TYPES.includes(elementTag)) return "subprocess";
  if (BPMN_CALL_ACTIVITY_TYPES.includes(elementTag)) return "call_activity";
  return null;
}

// ──────────────────────────────────────────────────────────────
// Parser
// ──────────────────────────────────────────────────────────────

export function parseBpmnXml(xml: string): ParsedProcessStep[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => {
      return ALL_BPMN_ELEMENT_TAGS.some((tag) => {
        const localName = tag.includes(":") ? tag.split(":")[1] : tag;
        return name === tag || name === localName;
      });
    },
  });

  const parsed = parser.parse(xml);
  const steps: ParsedProcessStep[] = [];

  // Navigate to the process element
  const definitions =
    parsed["bpmn:definitions"] || parsed["definitions"];
  if (!definitions) {
    throw new Error(
      "Invalid BPMN XML: missing <bpmn:definitions> root element",
    );
  }

  const processEl =
    definitions["bpmn:process"] || definitions["process"];
  if (!processEl) {
    throw new Error("Invalid BPMN XML: missing <bpmn:process> element");
  }

  // Handle single process or array of processes
  const processElements = Array.isArray(processEl)
    ? processEl
    : [processEl];

  for (const proc of processElements) {
    extractStepsFromProcess(proc, steps, 0);
  }

  // Re-number sequence order
  steps.forEach((step, idx) => {
    step.sequenceOrder = idx + 1;
  });

  return steps;
}

function extractStepsFromProcess(
  processObj: Record<string, unknown>,
  steps: ParsedProcessStep[],
  startOrder: number,
): void {
  let order = startOrder;

  for (const [key, value] of Object.entries(processObj)) {
    const stepType = getStepType(key);
    if (!stepType) continue;

    const elements = Array.isArray(value) ? value : [value];
    for (const element of elements) {
      if (typeof element !== "object" || element === null) continue;

      const el = element as Record<string, unknown>;
      const id = el["@_id"] as string;
      const name = (el["@_name"] as string) || null;

      if (!id) continue;

      steps.push({
        bpmnElementId: id,
        name,
        stepType,
        sequenceOrder: ++order,
      });

      // Recursively extract from subprocesses
      if (stepType === "subprocess") {
        extractStepsFromProcess(el, steps, order);
        order = steps.length;
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────
// Validator
// ──────────────────────────────────────────────────────────────

export function validateBpmnXml(xml: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    const steps = parseBpmnXml(xml);

    // Must have at least one start event
    const hasStart = steps.some(
      (s) =>
        s.bpmnElementId.toLowerCase().includes("start") ||
        s.stepType === "event",
    );
    if (!hasStart) {
      errors.push("BPMN XML must contain at least one start event");
    }

    // Must have at least one end event
    const hasEnd = steps.some(
      (s) =>
        s.bpmnElementId.toLowerCase().includes("end") ||
        s.stepType === "event",
    );
    if (!hasEnd) {
      errors.push("BPMN XML must contain at least one end event");
    }

    // Must have at least one task
    const hasTasks = steps.some((s) => s.stepType === "task");
    if (!hasTasks) {
      errors.push("BPMN XML must contain at least one task");
    }

    // Check for diagram layout (BPMNDiagram element)
    if (
      !xml.includes("BPMNDiagram") &&
      !xml.includes("bpmndi:BPMNDiagram")
    ) {
      errors.push(
        "BPMN XML must contain a BPMNDiagram element with layout coordinates",
      );
    }
  } catch (e) {
    errors.push(`XML parsing failed: ${(e as Error).message}`);
  }

  return { valid: errors.length === 0, errors };
}

// ──────────────────────────────────────────────────────────────
// Empty BPMN XML Template
// ──────────────────────────────────────────────────────────────

export const EMPTY_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="159" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
