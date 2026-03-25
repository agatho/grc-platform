// Sprint 3b: Advanced BPMN Validation Engine
// Configurable rule-based validation for BPMN 2.0 XML documents

import { XMLParser } from "fast-xml-parser";
import type { BpmnValidationIssue, BpmnValidationResult } from "./types";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export type ValidationRuleLevel = "error" | "warning" | "disabled";

export interface BpmnValidationConfig {
  missingStartEvent: ValidationRuleLevel;
  missingEndEvent: ValidationRuleLevel;
  disconnectedElements: ValidationRuleLevel;
  gatewayMissingDefault: ValidationRuleLevel;
}

export const DEFAULT_VALIDATION_CONFIG: BpmnValidationConfig = {
  missingStartEvent: "error",
  missingEndEvent: "error",
  disconnectedElements: "error",
  gatewayMissingDefault: "warning",
};

// ──────────────────────────────────────────────────────────────
// Internal helpers — extract BPMN elements from parsed XML
// ──────────────────────────────────────────────────────────────

// Tags that represent flow elements (both prefixed and unprefixed)
const START_EVENT_TAGS = ["bpmn:startEvent", "startEvent"];
const END_EVENT_TAGS = ["bpmn:endEvent", "endEvent"];
const EXCLUSIVE_GATEWAY_TAGS = ["bpmn:exclusiveGateway", "exclusiveGateway"];
const SEQUENCE_FLOW_TAGS = ["bpmn:sequenceFlow", "sequenceFlow"];

const FLOW_NODE_TAGS = [
  "bpmn:startEvent", "startEvent",
  "bpmn:endEvent", "endEvent",
  "bpmn:task", "task",
  "bpmn:userTask", "userTask",
  "bpmn:serviceTask", "serviceTask",
  "bpmn:sendTask", "sendTask",
  "bpmn:receiveTask", "receiveTask",
  "bpmn:manualTask", "manualTask",
  "bpmn:businessRuleTask", "businessRuleTask",
  "bpmn:scriptTask", "scriptTask",
  "bpmn:exclusiveGateway", "exclusiveGateway",
  "bpmn:parallelGateway", "parallelGateway",
  "bpmn:inclusiveGateway", "inclusiveGateway",
  "bpmn:eventBasedGateway", "eventBasedGateway",
  "bpmn:complexGateway", "complexGateway",
  "bpmn:intermediateCatchEvent", "intermediateCatchEvent",
  "bpmn:intermediateThrowEvent", "intermediateThrowEvent",
  "bpmn:boundaryEvent", "boundaryEvent",
  "bpmn:subProcess", "subProcess",
  "bpmn:adHocSubProcess", "adHocSubProcess",
  "bpmn:transaction", "transaction",
  "bpmn:callActivity", "callActivity",
];

interface BpmnElement {
  id: string;
  tag: string;
  name?: string;
  defaultFlow?: string;
}

interface SequenceFlow {
  id: string;
  sourceRef: string;
  targetRef: string;
  hasCondition: boolean;
}

function toArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

function extractFromProcess(
  proc: Record<string, unknown>,
): { elements: BpmnElement[]; flows: SequenceFlow[] } {
  const elements: BpmnElement[] = [];
  const flows: SequenceFlow[] = [];

  for (const [key, value] of Object.entries(proc)) {
    // Sequence flows
    if (SEQUENCE_FLOW_TAGS.includes(key)) {
      for (const item of toArray(value as Record<string, unknown>)) {
        if (typeof item !== "object" || item === null) continue;
        const el = item as Record<string, unknown>;
        const id = el["@_id"] as string;
        if (!id) continue;
        flows.push({
          id,
          sourceRef: (el["@_sourceRef"] as string) || "",
          targetRef: (el["@_targetRef"] as string) || "",
          hasCondition:
            !!el["bpmn:conditionExpression"] ||
            !!el["conditionExpression"],
        });
      }
      continue;
    }

    // Flow nodes
    if (FLOW_NODE_TAGS.includes(key)) {
      for (const item of toArray(value as Record<string, unknown>)) {
        if (typeof item !== "object" || item === null) continue;
        const el = item as Record<string, unknown>;
        const id = el["@_id"] as string;
        if (!id) continue;
        elements.push({
          id,
          tag: key,
          name: (el["@_name"] as string) || undefined,
          defaultFlow: (el["@_default"] as string) || undefined,
        });
      }
    }
  }

  return { elements, flows };
}

// ──────────────────────────────────────────────────────────────
// Main validation function
// ──────────────────────────────────────────────────────────────

export function validateBpmnAdvanced(
  xml: string,
  config?: Partial<BpmnValidationConfig>,
): BpmnValidationResult {
  const cfg: BpmnValidationConfig = {
    ...DEFAULT_VALIDATION_CONFIG,
    ...config,
  };
  const issues: BpmnValidationIssue[] = [];

  // Parse XML
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => {
      return (
        FLOW_NODE_TAGS.includes(name) ||
        SEQUENCE_FLOW_TAGS.includes(name)
      );
    },
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xml) as Record<string, unknown>;
  } catch (e) {
    return {
      isValid: false,
      errorCount: 1,
      warningCount: 0,
      issues: [
        {
          elementId: "",
          rule: "xmlParse",
          category: "error",
          message: `XML parsing failed: ${(e as Error).message}`,
        },
      ],
    };
  }

  // Navigate to process element
  const definitions =
    (parsed["bpmn:definitions"] as Record<string, unknown>) ||
    (parsed["definitions"] as Record<string, unknown>);
  if (!definitions) {
    return {
      isValid: false,
      errorCount: 1,
      warningCount: 0,
      issues: [
        {
          elementId: "",
          rule: "structure",
          category: "error",
          message: "Missing <bpmn:definitions> root element",
        },
      ],
    };
  }

  const processEl = definitions["bpmn:process"] || definitions["process"];
  if (!processEl) {
    return {
      isValid: false,
      errorCount: 1,
      warningCount: 0,
      issues: [
        {
          elementId: "",
          rule: "structure",
          category: "error",
          message: "Missing <bpmn:process> element",
        },
      ],
    };
  }

  const processes = Array.isArray(processEl) ? processEl : [processEl];

  // Collect all elements and flows across all processes
  const allElements: BpmnElement[] = [];
  const allFlows: SequenceFlow[] = [];

  for (const proc of processes) {
    const { elements, flows } = extractFromProcess(
      proc as Record<string, unknown>,
    );
    allElements.push(...elements);
    allFlows.push(...flows);
  }

  // ─── Rule: missingStartEvent ────────────────────────────────
  if (cfg.missingStartEvent !== "disabled") {
    const startEvents = allElements.filter((el) =>
      START_EVENT_TAGS.includes(el.tag),
    );
    if (startEvents.length === 0) {
      issues.push({
        elementId: "",
        rule: "missingStartEvent",
        category: cfg.missingStartEvent,
        message: "Process has no start event",
      });
    }
  }

  // ─── Rule: missingEndEvent ──────────────────────────────────
  if (cfg.missingEndEvent !== "disabled") {
    const endEvents = allElements.filter((el) =>
      END_EVENT_TAGS.includes(el.tag),
    );
    if (endEvents.length === 0) {
      issues.push({
        elementId: "",
        rule: "missingEndEvent",
        category: cfg.missingEndEvent,
        message: "Process has no end event",
      });
    }
  }

  // ─── Rule: disconnectedElements ─────────────────────────────
  if (cfg.disconnectedElements !== "disabled") {
    // Build incoming/outgoing maps
    const incoming = new Set<string>();
    const outgoing = new Set<string>();
    for (const flow of allFlows) {
      if (flow.sourceRef) outgoing.add(flow.sourceRef);
      if (flow.targetRef) incoming.add(flow.targetRef);
    }

    for (const el of allElements) {
      // Start events only need outgoing, end events only need incoming
      const isStart = START_EVENT_TAGS.includes(el.tag);
      const isEnd = END_EVENT_TAGS.includes(el.tag);

      if (isStart) {
        // Start events should have outgoing
        if (!outgoing.has(el.id)) {
          issues.push({
            elementId: el.id,
            rule: "disconnectedElements",
            category: cfg.disconnectedElements,
            message: `Start event "${el.name || el.id}" has no outgoing sequence flow`,
          });
        }
      } else if (isEnd) {
        // End events should have incoming
        if (!incoming.has(el.id)) {
          issues.push({
            elementId: el.id,
            rule: "disconnectedElements",
            category: cfg.disconnectedElements,
            message: `End event "${el.name || el.id}" has no incoming sequence flow`,
          });
        }
      } else {
        // All other elements need both incoming and outgoing
        if (!incoming.has(el.id) && !outgoing.has(el.id)) {
          issues.push({
            elementId: el.id,
            rule: "disconnectedElements",
            category: cfg.disconnectedElements,
            message: `Element "${el.name || el.id}" is disconnected (no incoming or outgoing flows)`,
          });
        }
      }
    }
  }

  // ─── Rule: gatewayMissingDefault ────────────────────────────
  if (cfg.gatewayMissingDefault !== "disabled") {
    const exclusiveGateways = allElements.filter((el) =>
      EXCLUSIVE_GATEWAY_TAGS.includes(el.tag),
    );

    for (const gw of exclusiveGateways) {
      const outgoingFlows = allFlows.filter(
        (f) => f.sourceRef === gw.id,
      );

      // Only check gateways with more than 1 outgoing flow (split gateways)
      if (outgoingFlows.length > 1) {
        const hasDefault = !!gw.defaultFlow;
        const allHaveConditions = outgoingFlows.every(
          (f) => f.hasCondition || f.id === gw.defaultFlow,
        );

        if (!hasDefault && !allHaveConditions) {
          issues.push({
            elementId: gw.id,
            rule: "gatewayMissingDefault",
            category: cfg.gatewayMissingDefault,
            message: `Exclusive gateway "${gw.name || gw.id}" has multiple outgoing flows but no default flow or conditions`,
          });
        }
      }
    }
  }

  const errorCount = issues.filter((i) => i.category === "error").length;
  const warningCount = issues.filter((i) => i.category === "warning").length;

  return {
    isValid: errorCount === 0,
    errorCount,
    warningCount,
    issues,
  };
}
