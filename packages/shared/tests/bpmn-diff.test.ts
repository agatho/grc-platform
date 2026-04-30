// Tests für computeBpmnDiff
// Bezug: packages/shared/src/bpmn-diff.ts

import { describe, it, expect } from "vitest";
import { computeBpmnDiff } from "../src/bpmn-diff";

const BASE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="Process_1">
    <bpmn:startEvent id="Start_1" name="Start" />
    <bpmn:task id="Task_1" name="Original" />
    <bpmn:endEvent id="End_1" name="Done" />
  </bpmn:process>
</bpmn:definitions>`;

const ADDED_TASK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="Process_1">
    <bpmn:startEvent id="Start_1" name="Start" />
    <bpmn:task id="Task_1" name="Original" />
    <bpmn:task id="Task_2_NEW" name="New Task" />
    <bpmn:endEvent id="End_1" name="Done" />
  </bpmn:process>
</bpmn:definitions>`;

const REMOVED_TASK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="Process_1">
    <bpmn:startEvent id="Start_1" name="Start" />
    <bpmn:endEvent id="End_1" name="Done" />
  </bpmn:process>
</bpmn:definitions>`;

const RENAMED_TASK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="Process_1">
    <bpmn:startEvent id="Start_1" name="Start" />
    <bpmn:task id="Task_1" name="RENAMED Task" />
    <bpmn:endEvent id="End_1" name="Done" />
  </bpmn:process>
</bpmn:definitions>`;

describe("computeBpmnDiff — identity", () => {
  it("returns empty diff for identical XMLs", () => {
    const d = computeBpmnDiff(BASE_XML, BASE_XML);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.modified).toEqual([]);
    expect(d.stats).toEqual({ added: 0, removed: 0, modified: 0 });
  });
});

describe("computeBpmnDiff — additions", () => {
  it("detects new element", () => {
    const d = computeBpmnDiff(BASE_XML, ADDED_TASK_XML);
    expect(d.added).toContain("Task_2_NEW");
    expect(d.removed).toEqual([]);
    expect(d.stats.added).toBe(1);
  });
});

describe("computeBpmnDiff — removals", () => {
  it("detects removed element", () => {
    const d = computeBpmnDiff(BASE_XML, REMOVED_TASK_XML);
    expect(d.removed).toContain("Task_1");
    expect(d.added).toEqual([]);
    expect(d.stats.removed).toBe(1);
  });
});

describe("computeBpmnDiff — modifications", () => {
  it("detects renamed task as modified", () => {
    const d = computeBpmnDiff(BASE_XML, RENAMED_TASK_XML);
    expect(d.modified).toContain("Task_1");
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.stats.modified).toBe(1);
  });
});

describe("computeBpmnDiff — combined operations", () => {
  it("detects add + remove + modify in same diff", () => {
    const COMBINED = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="Process_1">
    <bpmn:startEvent id="Start_1" name="Start" />
    <bpmn:task id="Task_1" name="MODIFIED" />
    <bpmn:task id="Task_3_ADDED" name="New" />
  </bpmn:process>
</bpmn:definitions>`;
    const d = computeBpmnDiff(BASE_XML, COMBINED);
    expect(d.added).toContain("Task_3_ADDED");
    expect(d.removed).toContain("End_1");
    expect(d.modified).toContain("Task_1");
    expect(d.stats.added).toBeGreaterThanOrEqual(1);
    expect(d.stats.removed).toBeGreaterThanOrEqual(1);
    expect(d.stats.modified).toBe(1);
  });
});

describe("computeBpmnDiff — stats invariants", () => {
  it("stats values match array lengths", () => {
    const d = computeBpmnDiff(BASE_XML, ADDED_TASK_XML);
    expect(d.stats.added).toBe(d.added.length);
    expect(d.stats.removed).toBe(d.removed.length);
    expect(d.stats.modified).toBe(d.modified.length);
  });
});
