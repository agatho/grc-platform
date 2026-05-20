// BPM Overhaul Phase 5: rehydrate round-trip test.
//
// Mocks the tx interface to verify that the rehydrator emits the right
// INSERTs based on a sample BPMN XML with arctos:* metadata.

import { describe, it, expect, vi } from "vitest";
import { rehydrateFromBpmnXml } from "@/lib/bpmn-arctos-rehydrate";

const RISK_UUID = "00000000-0000-0000-0000-000000000001";
const CTRL_UUID = "00000000-0000-0000-0000-000000000002";
const DOC_UUID = "00000000-0000-0000-0000-000000000003";
const STEP_UUID = "11111111-1111-1111-1111-111111111111";

const XML_WITH_GRC = `<?xml version="1.0"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:arctos="https://arctos.grc/schema/bpmn/1.0">
  <bpmn:process id="Proc">
    <bpmn:userTask id="Task_1" name="Approve">
      <bpmn:extensionElements>
        <arctos:grcMetadata lineOfDefense="first">
          <arctos:riskRefs>
            <arctos:riskRef id="${RISK_UUID}" title="Fraud" inherentScore="12" residualScore="6"/>
          </arctos:riskRefs>
          <arctos:controlRefs>
            <arctos:controlRef id="${CTRL_UUID}" title="Dual approval" effectiveness="effective"/>
          </arctos:controlRefs>
          <arctos:documentRefs>
            <arctos:documentRef id="${DOC_UUID}" title="SOP" documentType="sop"/>
          </arctos:documentRefs>
          <arctos:ropa isProcessingActivity="true" purpose="Order processing" legalBasis="contract"/>
        </arctos:grcMetadata>
      </bpmn:extensionElements>
    </bpmn:userTask>
  </bpmn:process>
</bpmn:definitions>`;

describe("rehydrateFromBpmnXml", () => {
  it("emits insert/update statements for each arctos:* declaration", async () => {
    const exec = vi.fn(async () => []);
    const tx = { execute: exec };

    const stats = await rehydrateFromBpmnXml({
      tx: tx as any,
      processId: "proc-1",
      orgId: "org-1",
      userId: "user-1",
      bpmnXml: XML_WITH_GRC,
      stepIdByBpmnElement: new Map([["Task_1", STEP_UUID]]),
    });

    expect(stats.lodAssignments).toBe(1);
    expect(stats.riskLinksAdded).toBe(1);
    expect(stats.controlLinksAdded).toBe(1);
    expect(stats.documentLinksAdded).toBe(1);
    expect(stats.ropaProfilesUpdated).toBe(1);

    // Verify execute was called at least 5x (one per dimension above)
    expect(exec.mock.calls.length).toBeGreaterThanOrEqual(5);
  });

  it("returns zero stats when no arctos:* metadata is present", async () => {
    const exec = vi.fn(async () => []);
    const tx = { execute: exec };
    const xml =
      '<?xml version="1.0"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"><bpmn:process id="p"><bpmn:userTask id="T1"/></bpmn:process></bpmn:definitions>';

    const stats = await rehydrateFromBpmnXml({
      tx: tx as any,
      processId: "p1",
      orgId: "o1",
      userId: "u1",
      bpmnXml: xml,
      stepIdByBpmnElement: new Map([["T1", STEP_UUID]]),
    });

    expect(stats).toEqual({
      riskLinksAdded: 0,
      controlLinksAdded: 0,
      documentLinksAdded: 0,
      lodAssignments: 0,
      ropaProfilesUpdated: 0,
    });
    expect(exec.mock.calls.length).toBe(0);
  });

  it("skips steps without a mapping entry (DB step not yet synced)", async () => {
    const exec = vi.fn(async () => []);
    const tx = { execute: exec };

    const stats = await rehydrateFromBpmnXml({
      tx: tx as any,
      processId: "proc-1",
      orgId: "org-1",
      userId: "user-1",
      bpmnXml: XML_WITH_GRC,
      stepIdByBpmnElement: new Map(), // empty — no steps known
    });

    // Risks/controls/LoD are step-scoped so they should not fire
    expect(stats.lodAssignments).toBe(0);
    expect(stats.riskLinksAdded).toBe(0);
    expect(stats.controlLinksAdded).toBe(0);
    // Documents + ROPA are process-scoped so they still fire
    expect(stats.documentLinksAdded).toBe(1);
    expect(stats.ropaProfilesUpdated).toBe(1);
  });
});
