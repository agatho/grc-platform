// Tests für BPMN-Validierungs-Engine
// Bezug: packages/shared/src/bpmn-validator.ts

import { describe, it, expect } from "vitest";
import {
  validateBpmnAdvanced,
  DEFAULT_VALIDATION_CONFIG,
} from "../src/bpmn-validator";

const VALID_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="Process_1">
    <bpmn:startEvent id="StartEvent_1" />
    <bpmn:task id="Task_1" name="Do Work" />
    <bpmn:endEvent id="EndEvent_1" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="EndEvent_1" />
  </bpmn:process>
</bpmn:definitions>`;

const NO_START_EVENT = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="Process_1">
    <bpmn:task id="Task_1" />
    <bpmn:endEvent id="EndEvent_1" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Task_1" targetRef="EndEvent_1" />
  </bpmn:process>
</bpmn:definitions>`;

const NO_END_EVENT = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="Process_1">
    <bpmn:startEvent id="StartEvent_1" />
    <bpmn:task id="Task_1" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1" />
  </bpmn:process>
</bpmn:definitions>`;

const DISCONNECTED_TASK = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="Process_1">
    <bpmn:startEvent id="StartEvent_1" />
    <bpmn:task id="Task_1" />
    <bpmn:task id="Task_2_orphan" />
    <bpmn:endEvent id="EndEvent_1" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="EndEvent_1" />
  </bpmn:process>
</bpmn:definitions>`;

// Gateway with mixed flows: one conditional, one without — triggers
// `gatewayMissingDefault` because there's no default AND not all flows have conditions.
const GATEWAY_NO_DEFAULT = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="Process_1">
    <bpmn:startEvent id="StartEvent_1" />
    <bpmn:exclusiveGateway id="Gw_1" />
    <bpmn:task id="Task_A" />
    <bpmn:task id="Task_B" />
    <bpmn:endEvent id="EndEvent_1" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Gw_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Gw_1" targetRef="Task_A">
      <bpmn:conditionExpression>x == 1</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Gw_1" targetRef="Task_B" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Task_A" targetRef="EndEvent_1" />
    <bpmn:sequenceFlow id="Flow_5" sourceRef="Task_B" targetRef="EndEvent_1" />
  </bpmn:process>
</bpmn:definitions>`;

describe("DEFAULT_VALIDATION_CONFIG", () => {
  it("contains 4 expected rules with sensible defaults", () => {
    expect(DEFAULT_VALIDATION_CONFIG).toEqual({
      missingStartEvent: "error",
      missingEndEvent: "error",
      disconnectedElements: "error",
      gatewayMissingDefault: "warning",
    });
  });
});

describe("validateBpmnAdvanced — valid input", () => {
  it("a complete BPMN passes with no issues", () => {
    const r = validateBpmnAdvanced(VALID_BPMN);
    expect(r.isValid).toBe(true);
    expect(r.errorCount).toBe(0);
  });
});

describe("validateBpmnAdvanced — missing start event", () => {
  it("flags as error by default", () => {
    const r = validateBpmnAdvanced(NO_START_EVENT);
    expect(r.isValid).toBe(false);
    expect(
      r.issues.some(
        (i) => i.rule === "missingStartEvent" && i.category === "error",
      ),
    ).toBe(true);
  });

  it("can be downgraded to warning", () => {
    const r = validateBpmnAdvanced(NO_START_EVENT, {
      missingStartEvent: "warning",
    });
    const startIssue = r.issues.find((i) => i.rule === "missingStartEvent");
    expect(startIssue?.category).toBe("warning");
  });

  it("can be disabled", () => {
    const r = validateBpmnAdvanced(NO_START_EVENT, {
      missingStartEvent: "disabled",
    });
    expect(r.issues.some((i) => i.rule === "missingStartEvent")).toBe(false);
  });
});

describe("validateBpmnAdvanced — missing end event", () => {
  it("flags as error by default", () => {
    const r = validateBpmnAdvanced(NO_END_EVENT);
    expect(r.isValid).toBe(false);
    expect(
      r.issues.some(
        (i) => i.rule === "missingEndEvent" && i.category === "error",
      ),
    ).toBe(true);
  });

  it("can be disabled", () => {
    const r = validateBpmnAdvanced(NO_END_EVENT, {
      missingEndEvent: "disabled",
    });
    expect(r.issues.some((i) => i.rule === "missingEndEvent")).toBe(false);
  });
});

describe("validateBpmnAdvanced — disconnected elements", () => {
  it("flags orphan tasks as error", () => {
    const r = validateBpmnAdvanced(DISCONNECTED_TASK);
    const issue = r.issues.find(
      (i) => i.rule === "disconnectedElements" && i.elementId === "Task_2_orphan",
    );
    expect(issue).toBeDefined();
    expect(issue?.category).toBe("error");
  });

  it("can be disabled", () => {
    const r = validateBpmnAdvanced(DISCONNECTED_TASK, {
      disconnectedElements: "disabled",
    });
    expect(r.issues.some((i) => i.rule === "disconnectedElements")).toBe(false);
  });
});

describe("validateBpmnAdvanced — gateway without default flow", () => {
  it("flags exclusive gateway with conditional outflows but no default as warning", () => {
    const r = validateBpmnAdvanced(GATEWAY_NO_DEFAULT);
    const issue = r.issues.find(
      (i) => i.rule === "gatewayMissingDefault" && i.elementId === "Gw_1",
    );
    expect(issue).toBeDefined();
    expect(issue?.category).toBe("warning");
  });

  it("can be upgraded to error", () => {
    const r = validateBpmnAdvanced(GATEWAY_NO_DEFAULT, {
      gatewayMissingDefault: "error",
    });
    const issue = r.issues.find((i) => i.rule === "gatewayMissingDefault");
    expect(issue?.category).toBe("error");
  });
});

describe("validateBpmnAdvanced — output structure", () => {
  it("counts errors and warnings separately", () => {
    const r = validateBpmnAdvanced(NO_START_EVENT, {
      missingStartEvent: "error",
      missingEndEvent: "warning",
      disconnectedElements: "error",
      gatewayMissingDefault: "warning",
    });
    const totalIssues = r.errorCount + r.warningCount;
    expect(totalIssues).toBe(r.issues.length);
  });

  it("isValid=true requires zero errors (warnings allowed)", () => {
    const r = validateBpmnAdvanced(GATEWAY_NO_DEFAULT, {
      // no errors expected, only warnings on default-flow
      missingStartEvent: "error",
      missingEndEvent: "error",
      disconnectedElements: "error",
      gatewayMissingDefault: "warning",
    });
    expect(r.errorCount).toBe(0);
    expect(r.isValid).toBe(true);
  });

  it("each issue carries elementId, rule, category, message", () => {
    const r = validateBpmnAdvanced(NO_START_EVENT);
    for (const i of r.issues) {
      expect(typeof i.elementId).toBe("string");
      expect(["error", "warning"]).toContain(i.category);
      expect(i.rule.length).toBeGreaterThan(0);
      expect(i.message.length).toBeGreaterThan(0);
    }
  });
});
