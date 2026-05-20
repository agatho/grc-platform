// BPM Overhaul Phase 5: Round-trip tests for arctos:* GRC metadata.

import { describe, it, expect } from "vitest";
import {
  ensureArctosNamespace,
  extractGrcMetadata,
  injectGrcMetadata,
} from "@/components/bpmn/arctos-grc-extractor";

const BASIC = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  id="Defs">
  <bpmn:process id="Proc">
    <bpmn:userTask id="Task_1" name="Approve Order"/>
  </bpmn:process>
</bpmn:definitions>`;

describe("ensureArctosNamespace", () => {
  it("adds xmlns:arctos when missing", () => {
    const out = ensureArctosNamespace(BASIC);
    expect(out).toContain("xmlns:arctos=");
  });

  it("is idempotent", () => {
    const once = ensureArctosNamespace(BASIC);
    const twice = ensureArctosNamespace(once);
    expect(twice.split("xmlns:arctos=").length).toBe(2); // appears exactly once
  });
});

describe("injectGrcMetadata → extractGrcMetadata round-trip", () => {
  it("preserves risk + control refs, LoD, RACI, BCM KPI, ROPA", () => {
    const meta = {
      lineOfDefense: "first",
      isCriticalProcess: true,
      riskRefs: [
        {
          id: "00000000-0000-0000-0000-000000000001",
          title: "Fraud",
          inherentScore: 12,
          residualScore: 6,
        },
      ],
      controlRefs: [
        {
          id: "00000000-0000-0000-0000-000000000002",
          title: "Dual Approval",
          effectiveness: "effective",
        },
      ],
      raci: { responsibleRoleId: "r1", accountableRoleId: "a1" },
      bcmKpi: {
        mtpdMinutes: 240,
        rtoMinutes: 120,
        rpoMinutes: 60,
        criticality: "high",
      },
      ropa: {
        isProcessingActivity: true,
        purpose: "Order processing",
        legalBasis: "contract",
      },
    };

    const xml = injectGrcMetadata(BASIC, "Task_1", meta);
    expect(xml).toContain("xmlns:arctos=");
    expect(xml).toContain("<arctos:grcMetadata");
    expect(xml).toContain("Dual Approval");

    const round = extractGrcMetadata(xml, "Task_1");
    expect(round).toBeTruthy();
    expect(round!.lineOfDefense).toBe("first");
    expect(round!.isCriticalProcess).toBe(true);
    expect(round!.riskRefs?.[0]?.id).toBe(
      "00000000-0000-0000-0000-000000000001",
    );
    expect(round!.controlRefs?.[0]?.title).toBe("Dual Approval");
    expect(round!.raci?.responsibleRoleId).toBe("r1");
    expect(round!.bcmKpi?.mtpdMinutes).toBe(240);
    expect(round!.ropa?.isProcessingActivity).toBe(true);
  });

  it("returns null when no GRC metadata present", () => {
    expect(extractGrcMetadata(BASIC, "Task_1")).toBeNull();
  });

  it("returns null when element id not found", () => {
    expect(extractGrcMetadata(BASIC, "Missing_999")).toBeNull();
  });
});
