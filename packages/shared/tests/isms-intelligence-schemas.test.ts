import { describe, it, expect } from "vitest";
import {
  assignAssetCpeSchema,
  acknowledgeCveMatchSchema,
  convertCveToVulnerabilitySchema,
  triggerSoaGapAnalysisSchema,
  reviewSoaSuggestionSchema,
  triggerMaturityRoadmapSchema,
  updateRoadmapActionStatusSchema,
  bulkCveMatchStatusSchema,
  isValidCveMatchTransition,
} from "../src/schemas/isms-intelligence";

describe("assignAssetCpeSchema", () => {
  it("should accept valid CPE 2.3 URI", () => {
    const result = assignAssetCpeSchema.safeParse({
      assetId: "550e8400-e29b-41d4-a716-446655440000",
      cpeUri: "cpe:2.3:a:apache:log4j:2.14.1:*:*:*:*:*:*:*",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid CPE format", () => {
    const result = assignAssetCpeSchema.safeParse({
      assetId: "550e8400-e29b-41d4-a716-446655440000",
      cpeUri: "not-a-cpe-string",
    });
    expect(result.success).toBe(false);
  });

  it("should accept CPE with vendor/product/version", () => {
    const result = assignAssetCpeSchema.safeParse({
      assetId: "550e8400-e29b-41d4-a716-446655440000",
      cpeUri: "cpe:2.3:a:apache:log4j:*:*:*:*:*:*:*:*",
      vendor: "apache",
      product: "log4j",
      version: "2.14.1",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing assetId", () => {
    const result = assignAssetCpeSchema.safeParse({
      cpeUri: "cpe:2.3:a:apache:log4j:*",
    });
    expect(result.success).toBe(false);
  });

  it("should accept hardware CPE type", () => {
    const result = assignAssetCpeSchema.safeParse({
      assetId: "550e8400-e29b-41d4-a716-446655440000",
      cpeUri: "cpe:2.3:h:cisco:asr_1001:*:*:*:*:*:*:*:*",
    });
    expect(result.success).toBe(true);
  });

  it("should accept OS CPE type", () => {
    const result = assignAssetCpeSchema.safeParse({
      assetId: "550e8400-e29b-41d4-a716-446655440000",
      cpeUri: "cpe:2.3:o:linux:linux_kernel:5.4:*:*:*:*:*:*:*",
    });
    expect(result.success).toBe(true);
  });
});

describe("acknowledgeCveMatchSchema", () => {
  it("should accept acknowledged status", () => {
    const result = acknowledgeCveMatchSchema.safeParse({
      status: "acknowledged",
    });
    expect(result.success).toBe(true);
  });

  it("should accept mitigated status", () => {
    const result = acknowledgeCveMatchSchema.safeParse({ status: "mitigated" });
    expect(result.success).toBe(true);
  });

  it("should reject new status", () => {
    const result = acknowledgeCveMatchSchema.safeParse({ status: "new" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid status", () => {
    const result = acknowledgeCveMatchSchema.safeParse({ status: "invalid" });
    expect(result.success).toBe(false);
  });
});

describe("convertCveToVulnerabilitySchema", () => {
  it("should accept empty body (use defaults)", () => {
    const result = convertCveToVulnerabilitySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should accept custom title and severity", () => {
    const result = convertCveToVulnerabilitySchema.safeParse({
      title: "Custom vulnerability title",
      severity: "high",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid severity", () => {
    const result = convertCveToVulnerabilitySchema.safeParse({
      severity: "super_critical",
    });
    expect(result.success).toBe(false);
  });
});

describe("triggerSoaGapAnalysisSchema", () => {
  it("should accept framework parameter", () => {
    const result = triggerSoaGapAnalysisSchema.safeParse({
      framework: "iso27001",
    });
    expect(result.success).toBe(true);
  });

  it("should default to iso27001", () => {
    const result = triggerSoaGapAnalysisSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.framework).toBe("iso27001");
    }
  });
});

describe("reviewSoaSuggestionSchema", () => {
  it("should accept accepted status", () => {
    const result = reviewSoaSuggestionSchema.safeParse({ status: "accepted" });
    expect(result.success).toBe(true);
  });

  it("should accept rejected status", () => {
    const result = reviewSoaSuggestionSchema.safeParse({ status: "rejected" });
    expect(result.success).toBe(true);
  });

  it("should reject pending status", () => {
    const result = reviewSoaSuggestionSchema.safeParse({ status: "pending" });
    expect(result.success).toBe(false);
  });

  it("should accept controlId with accepted status", () => {
    const result = reviewSoaSuggestionSchema.safeParse({
      status: "accepted",
      controlId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });
});

describe("triggerMaturityRoadmapSchema", () => {
  it("should accept valid target maturity", () => {
    const result = triggerMaturityRoadmapSchema.safeParse({
      targetMaturity: 4,
    });
    expect(result.success).toBe(true);
  });

  it("should default to maturity level 3", () => {
    const result = triggerMaturityRoadmapSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetMaturity).toBe(3);
    }
  });

  it("should reject maturity level 0", () => {
    const result = triggerMaturityRoadmapSchema.safeParse({
      targetMaturity: 0,
    });
    expect(result.success).toBe(false);
  });

  it("should reject maturity level 6", () => {
    const result = triggerMaturityRoadmapSchema.safeParse({
      targetMaturity: 6,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateRoadmapActionStatusSchema", () => {
  it("should accept all valid statuses", () => {
    for (const status of [
      "proposed",
      "in_progress",
      "completed",
      "dismissed",
    ]) {
      const result = updateRoadmapActionStatusSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid status", () => {
    const result = updateRoadmapActionStatusSchema.safeParse({
      status: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("bulkCveMatchStatusSchema", () => {
  it("should accept valid bulk update", () => {
    const result = bulkCveMatchStatusSchema.safeParse({
      matchIds: ["550e8400-e29b-41d4-a716-446655440000"],
      status: "acknowledged",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty matchIds", () => {
    const result = bulkCveMatchStatusSchema.safeParse({
      matchIds: [],
      status: "acknowledged",
    });
    expect(result.success).toBe(false);
  });

  it("should reject more than 100 matchIds", () => {
    const ids = Array.from(
      { length: 101 },
      (_, i) => `550e8400-e29b-41d4-a716-44665544${String(i).padStart(4, "0")}`,
    );
    const result = bulkCveMatchStatusSchema.safeParse({
      matchIds: ids,
      status: "acknowledged",
    });
    expect(result.success).toBe(false);
  });

  it("should reject setting status to new", () => {
    const result = bulkCveMatchStatusSchema.safeParse({
      matchIds: ["550e8400-e29b-41d4-a716-446655440000"],
      status: "new",
    });
    expect(result.success).toBe(false);
  });
});

describe("isValidCveMatchTransition", () => {
  it("should allow new -> acknowledged", () => {
    expect(isValidCveMatchTransition("new", "acknowledged")).toBe(true);
  });

  it("should allow new -> not_applicable", () => {
    expect(isValidCveMatchTransition("new", "not_applicable")).toBe(true);
  });

  it("should allow acknowledged -> mitigated", () => {
    expect(isValidCveMatchTransition("acknowledged", "mitigated")).toBe(true);
  });

  it("should NOT allow new -> mitigated", () => {
    expect(isValidCveMatchTransition("new", "mitigated")).toBe(false);
  });

  it("should NOT allow mitigated -> any", () => {
    expect(isValidCveMatchTransition("mitigated", "new")).toBe(false);
    expect(isValidCveMatchTransition("mitigated", "acknowledged")).toBe(false);
  });

  it("should return false for unknown status", () => {
    expect(isValidCveMatchTransition("unknown", "new")).toBe(false);
  });
});
