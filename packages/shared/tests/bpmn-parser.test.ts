// Unit tests for BPMN XML Parser (Sprint 3)
// Tests parseBpmnXml() and validateBpmnXml() from bpmn-parser.ts

import { describe, it, expect } from "vitest";
import { parseBpmnXml, validateBpmnXml } from "../src/bpmn-parser";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const VALID_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="Start_1" name="Order Received" />
    <bpmn:userTask id="Task_1" name="Review Order" />
    <bpmn:exclusiveGateway id="Gateway_1" name="Approved?" />
    <bpmn:serviceTask id="Task_2" name="Process Payment" />
    <bpmn:endEvent id="End_1" name="Order Completed" />
    <bpmn:subProcess id="Sub_1" name="Shipping">
      <bpmn:task id="SubTask_1" name="Pack Items" />
    </bpmn:subProcess>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1"><dc:Bounds x="100" y="100" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1"><dc:Bounds x="200" y="80" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1"><dc:Bounds x="350" y="95" width="50" height="50"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_2_di" bpmnElement="Task_2"><dc:Bounds x="450" y="80" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1"><dc:Bounds x="600" y="100" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_1_di" bpmnElement="Sub_1"><dc:Bounds x="200" y="200" width="200" height="150"/></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

// ---------------------------------------------------------------------------
// parseBpmnXml
// ---------------------------------------------------------------------------

describe("parseBpmnXml", () => {
  it("extracts all BPMN element types correctly", () => {
    const steps = parseBpmnXml(VALID_BPMN);
    // Expected: Start_1 (event), Task_1 (task), Gateway_1 (gateway),
    //           Task_2 (task), End_1 (event), Sub_1 (subprocess), SubTask_1 (task)
    expect(steps).toHaveLength(7);

    const types = steps.map((s) => s.stepType);
    expect(types.filter((t) => t === "event")).toHaveLength(2);
    expect(types.filter((t) => t === "task")).toHaveLength(3);
    expect(types.filter((t) => t === "gateway")).toHaveLength(1);
    expect(types.filter((t) => t === "subprocess")).toHaveLength(1);
  });

  it("maps element types to correct stepType", () => {
    const steps = parseBpmnXml(VALID_BPMN);
    const byId = new Map(steps.map((s) => [s.bpmnElementId, s]));

    expect(byId.get("Start_1")?.stepType).toBe("event");
    expect(byId.get("Task_1")?.stepType).toBe("task");
    expect(byId.get("Gateway_1")?.stepType).toBe("gateway");
    expect(byId.get("Task_2")?.stepType).toBe("task");
    expect(byId.get("End_1")?.stepType).toBe("event");
    expect(byId.get("Sub_1")?.stepType).toBe("subprocess");
    expect(byId.get("SubTask_1")?.stepType).toBe("task");
  });

  it("extracts names from BPMN elements", () => {
    const steps = parseBpmnXml(VALID_BPMN);
    const byId = new Map(steps.map((s) => [s.bpmnElementId, s]));

    expect(byId.get("Start_1")?.name).toBe("Order Received");
    expect(byId.get("Task_1")?.name).toBe("Review Order");
    expect(byId.get("Gateway_1")?.name).toBe("Approved?");
    expect(byId.get("Task_2")?.name).toBe("Process Payment");
    expect(byId.get("End_1")?.name).toBe("Order Completed");
    expect(byId.get("Sub_1")?.name).toBe("Shipping");
    expect(byId.get("SubTask_1")?.name).toBe("Pack Items");
  });

  it("handles elements without name attribute (returns null)", () => {
    const xml = VALID_BPMN.replace(' name="Review Order"', "");
    const steps = parseBpmnXml(xml);
    const task = steps.find((s) => s.bpmnElementId === "Task_1");
    expect(task).toBeDefined();
    expect(task?.name).toBeNull();
  });

  it("assigns sequential order starting from 1", () => {
    const steps = parseBpmnXml(VALID_BPMN);
    const orders = steps.map((s) => s.sequenceOrder);

    // All orders should be sequential starting from 1
    expect(orders[0]).toBe(1);

    // Each order should be unique
    expect(new Set(orders).size).toBe(orders.length);

    // Orders should be in ascending sequence
    for (let i = 1; i < orders.length; i++) {
      expect(orders[i]).toBeGreaterThan(orders[i - 1]);
    }
  });

  it("throws on invalid XML (not XML at all)", () => {
    expect(() => parseBpmnXml("not xml at all")).toThrow();
  });

  it("throws on XML without bpmn:definitions root element", () => {
    const noDefinitions = `<?xml version="1.0" encoding="UTF-8"?><root><child/></root>`;
    expect(() => parseBpmnXml(noDefinitions)).toThrow(
      "missing <bpmn:definitions>",
    );
  });

  it("handles empty process with no elements (returns [])", () => {
    const emptyProcess = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false" />
</bpmn:definitions>`;
    const steps = parseBpmnXml(emptyProcess);
    expect(steps).toHaveLength(0);
    expect(steps).toEqual([]);
  });

  it("extracts steps from subprocess recursively", () => {
    const steps = parseBpmnXml(VALID_BPMN);
    const innerTask = steps.find((s) => s.bpmnElementId === "SubTask_1");
    expect(innerTask).toBeDefined();
    expect(innerTask?.stepType).toBe("task");
    expect(innerTask?.name).toBe("Pack Items");
  });

  it("preserves bpmnElementId for all elements", () => {
    const steps = parseBpmnXml(VALID_BPMN);
    const expectedIds = [
      "Start_1",
      "Task_1",
      "Gateway_1",
      "Task_2",
      "End_1",
      "Sub_1",
      "SubTask_1",
    ];
    const actualIds = steps.map((s) => s.bpmnElementId);
    for (const id of expectedIds) {
      expect(actualIds).toContain(id);
    }
  });

  it("returns ParsedProcessStep objects with correct shape", () => {
    const steps = parseBpmnXml(VALID_BPMN);
    for (const step of steps) {
      expect(step).toHaveProperty("bpmnElementId");
      expect(step).toHaveProperty("name");
      expect(step).toHaveProperty("stepType");
      expect(step).toHaveProperty("sequenceOrder");
      expect(typeof step.bpmnElementId).toBe("string");
      expect(typeof step.stepType).toBe("string");
      expect(typeof step.sequenceOrder).toBe("number");
      expect(step.name === null || typeof step.name === "string").toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// validateBpmnXml
// ---------------------------------------------------------------------------

describe("validateBpmnXml", () => {
  it("validates correct BPMN XML (returns { valid: true, errors: [] })", () => {
    const result = validateBpmnXml(VALID_BPMN);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects XML without start event", () => {
    const noStart = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="D1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="P1" isExecutable="false">
    <bpmn:userTask id="Task_1" name="Do Something" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BD1"><bpmndi:BPMNPlane id="BP1" bpmnElement="P1" /></bpmndi:BPMNDiagram>
</bpmn:definitions>`;
    const result = validateBpmnXml(noStart);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("start"))).toBe(
      true,
    );
  });

  it("rejects XML without end event", () => {
    const noEnd = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="D1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="P1" isExecutable="false">
    <bpmn:userTask id="Task_1" name="Do Something" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BD1"><bpmndi:BPMNPlane id="BP1" bpmnElement="P1" /></bpmndi:BPMNDiagram>
</bpmn:definitions>`;
    const result = validateBpmnXml(noEnd);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("end"))).toBe(
      true,
    );
  });

  it("rejects XML without any task", () => {
    const noTask = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="D1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="P1" isExecutable="false">
    <bpmn:startEvent id="Start_1" name="Start" />
    <bpmn:endEvent id="End_1" name="End" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BD1"><bpmndi:BPMNPlane id="BP1" bpmnElement="P1" /></bpmndi:BPMNDiagram>
</bpmn:definitions>`;
    const result = validateBpmnXml(noTask);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("task"))).toBe(
      true,
    );
  });

  it("rejects XML without BPMNDiagram element", () => {
    const noDiagram = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="P1" isExecutable="false">
    <bpmn:startEvent id="Start_1" name="Start" />
    <bpmn:userTask id="Task_1" name="Do Something" />
    <bpmn:endEvent id="End_1" name="End" />
  </bpmn:process>
</bpmn:definitions>`;
    const result = validateBpmnXml(noDiagram);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("BPMNDiagram"))).toBe(true);
  });

  it("rejects completely invalid XML (not XML at all)", () => {
    const result = validateBpmnXml("this is not xml at all <<<>>>");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("validates minimal valid BPMN XML with all requirements", () => {
    const minimal = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="D1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="P1" isExecutable="false">
    <bpmn:startEvent id="Start_1" name="Start" />
    <bpmn:userTask id="Task_1" name="Do Work" />
    <bpmn:endEvent id="End_1" name="End" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BD1"><bpmndi:BPMNPlane id="BP1" bpmnElement="P1" /></bpmndi:BPMNDiagram>
</bpmn:definitions>`;
    const result = validateBpmnXml(minimal);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns errors array (not undefined) even on failure", () => {
    const result = validateBpmnXml("garbage");
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
