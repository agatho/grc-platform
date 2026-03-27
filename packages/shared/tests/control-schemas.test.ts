// Unit tests for Sprint 4 ICS + DMS Zod schemas
// Tests control, campaign, test execution, finding, evidence schemas

import { describe, it, expect } from "vitest";
import {
  createControlSchema,
  controlStatusTransitionSchema,
  createCampaignSchema,
  executeTestSchema,
  createFindingSchema,
  findingStatusTransitionSchema,
  createEvidenceSchema,
  VALID_CONTROL_TRANSITIONS,
  VALID_FINDING_TRANSITIONS,
} from "../src/schemas";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

// ---------------------------------------------------------------------------
// createControlSchema
// ---------------------------------------------------------------------------

describe("createControlSchema", () => {
  it("accepts valid input with all required fields", () => {
    const result = createControlSchema.safeParse({
      title: "Access Review Control",
      controlType: "detective",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid input with all optional fields", () => {
    const result = createControlSchema.safeParse({
      title: "Segregation of Duties",
      description: "Ensures no single person has conflicting roles",
      controlType: "preventive",
      frequency: "quarterly",
      automationLevel: "semi_automated",
      assertions: ["completeness", "accuracy"],
      ownerId: UUID,
      department: "IT Security",
      objective: "Prevent unauthorized access",
      testInstructions: "Review access matrix",
      reviewDate: "2026-06-30",
    });
    expect(result.success).toBe(true);
  });

  it("applies default values for frequency and automationLevel", () => {
    const result = createControlSchema.safeParse({
      title: "Test Control",
      controlType: "corrective",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.frequency).toBe("event_driven");
      expect(result.data.automationLevel).toBe("manual");
      expect(result.data.assertions).toEqual([]);
    }
  });

  it("rejects missing title", () => {
    const result = createControlSchema.safeParse({
      controlType: "preventive",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = createControlSchema.safeParse({
      title: "",
      controlType: "preventive",
    });
    expect(result.success).toBe(false);
  });

  it("rejects title exceeding 500 characters", () => {
    const result = createControlSchema.safeParse({
      title: "A".repeat(501),
      controlType: "preventive",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing controlType", () => {
    const result = createControlSchema.safeParse({
      title: "Some Control",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid controlType", () => {
    const result = createControlSchema.safeParse({
      title: "Some Control",
      controlType: "compensating",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid controlType values", () => {
    for (const ct of ["preventive", "detective", "corrective"]) {
      const result = createControlSchema.safeParse({
        title: "Ctrl",
        controlType: ct,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid frequency", () => {
    const result = createControlSchema.safeParse({
      title: "Ctrl",
      controlType: "preventive",
      frequency: "biweekly",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid automationLevel", () => {
    const result = createControlSchema.safeParse({
      title: "Ctrl",
      controlType: "preventive",
      automationLevel: "robotic",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid assertion value in array", () => {
    const result = createControlSchema.safeParse({
      title: "Ctrl",
      controlType: "preventive",
      assertions: ["completeness", "invalid_assertion"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID ownerId", () => {
    const result = createControlSchema.safeParse({
      title: "Ctrl",
      controlType: "preventive",
      ownerId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// controlStatusTransitionSchema
// ---------------------------------------------------------------------------

describe("controlStatusTransitionSchema", () => {
  it("accepts valid status value", () => {
    const result = controlStatusTransitionSchema.safeParse({
      status: "implemented",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid status values", () => {
    for (const s of ["designed", "implemented", "effective", "ineffective", "retired"]) {
      const result = controlStatusTransitionSchema.safeParse({ status: s });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = controlStatusTransitionSchema.safeParse({
      status: "pending",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing status", () => {
    const result = controlStatusTransitionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// VALID_CONTROL_TRANSITIONS
// ---------------------------------------------------------------------------

describe("VALID_CONTROL_TRANSITIONS", () => {
  it("allows designed -> implemented", () => {
    expect(VALID_CONTROL_TRANSITIONS["designed"]).toContain("implemented");
  });

  it("allows designed -> retired", () => {
    expect(VALID_CONTROL_TRANSITIONS["designed"]).toContain("retired");
  });

  it("allows implemented -> effective", () => {
    expect(VALID_CONTROL_TRANSITIONS["implemented"]).toContain("effective");
  });

  it("does not allow designed -> effective", () => {
    expect(VALID_CONTROL_TRANSITIONS["designed"]).not.toContain("effective");
  });

  it("does not allow retired to transition anywhere", () => {
    expect(VALID_CONTROL_TRANSITIONS["retired"]).toEqual([]);
  });

  it("allows ineffective -> implemented (re-implement)", () => {
    expect(VALID_CONTROL_TRANSITIONS["ineffective"]).toContain("implemented");
  });
});

// ---------------------------------------------------------------------------
// createCampaignSchema
// ---------------------------------------------------------------------------

describe("createCampaignSchema", () => {
  it("accepts valid campaign data", () => {
    const result = createCampaignSchema.safeParse({
      name: "Q1 2026 Testing",
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
    });
    expect(result.success).toBe(true);
  });

  it("accepts campaign with all optional fields", () => {
    const result = createCampaignSchema.safeParse({
      name: "Annual Review",
      description: "Full cycle review",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      responsibleId: UUID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createCampaignSchema.safeParse({
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createCampaignSchema.safeParse({
      name: "",
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing periodStart", () => {
    const result = createCampaignSchema.safeParse({
      name: "Test",
      periodEnd: "2026-03-31",
    });
    expect(result.success).toBe(false);
  });

  it("rejects periodEnd before periodStart", () => {
    const result = createCampaignSchema.safeParse({
      name: "Test",
      periodStart: "2026-06-01",
      periodEnd: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("accepts same periodStart and periodEnd", () => {
    const result = createCampaignSchema.safeParse({
      name: "Single Day",
      periodStart: "2026-05-15",
      periodEnd: "2026-05-15",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// executeTestSchema
// ---------------------------------------------------------------------------

describe("executeTestSchema", () => {
  it("accepts valid test execution", () => {
    const result = executeTestSchema.safeParse({
      controlId: UUID,
      testType: "design_effectiveness",
    });
    expect(result.success).toBe(true);
  });

  it("accepts test with all optional fields", () => {
    const result = executeTestSchema.safeParse({
      controlId: UUID,
      campaignId: UUID,
      testType: "operating_effectiveness",
      todResult: "effective",
      toeResult: "partially_effective",
      testDate: "2026-03-15",
      sampleSize: 25,
      sampleDescription: "Random selection of 25 transactions",
      conclusion: "Control operating effectively",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing controlId", () => {
    const result = executeTestSchema.safeParse({
      testType: "design_effectiveness",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid testType", () => {
    const result = executeTestSchema.safeParse({
      controlId: UUID,
      testType: "compliance_test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid todResult value", () => {
    const result = executeTestSchema.safeParse({
      controlId: UUID,
      testType: "design_effectiveness",
      todResult: "pass",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero sampleSize", () => {
    const result = executeTestSchema.safeParse({
      controlId: UUID,
      testType: "design_effectiveness",
      sampleSize: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative sampleSize", () => {
    const result = executeTestSchema.safeParse({
      controlId: UUID,
      testType: "design_effectiveness",
      sampleSize: -5,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createFindingSchema
// ---------------------------------------------------------------------------

describe("createFindingSchema", () => {
  it("accepts valid finding with required fields", () => {
    const result = createFindingSchema.safeParse({
      title: "Missing access logs",
      severity: "significant_nonconformity",
    });
    expect(result.success).toBe(true);
  });

  it("applies default source to control_test", () => {
    const result = createFindingSchema.safeParse({
      title: "Gap in backup policy",
      severity: "observation",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe("control_test");
    }
  });

  it("accepts all valid severity values", () => {
    const severities = [
      "observation",
      "recommendation",
      "improvement_requirement",
      "insignificant_nonconformity",
      "significant_nonconformity",
    ];
    for (const severity of severities) {
      const result = createFindingSchema.safeParse({ title: "Finding", severity });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid severity", () => {
    const result = createFindingSchema.safeParse({
      title: "Finding",
      severity: "critical",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", () => {
    const result = createFindingSchema.safeParse({
      severity: "observation",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid source enum", () => {
    const result = createFindingSchema.safeParse({
      title: "Finding",
      severity: "observation",
      source: "customer_complaint",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid source values", () => {
    const sources = ["control_test", "audit", "incident", "self_assessment", "external"];
    for (const source of sources) {
      const result = createFindingSchema.safeParse({
        title: "Finding",
        severity: "observation",
        source,
      });
      expect(result.success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// findingStatusTransitionSchema
// ---------------------------------------------------------------------------

describe("findingStatusTransitionSchema", () => {
  it("accepts valid finding status", () => {
    const result = findingStatusTransitionSchema.safeParse({
      status: "in_remediation",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid finding statuses", () => {
    for (const s of ["identified", "in_remediation", "remediated", "verified", "accepted", "closed"]) {
      const result = findingStatusTransitionSchema.safeParse({ status: s });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid finding status", () => {
    const result = findingStatusTransitionSchema.safeParse({
      status: "open",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// VALID_FINDING_TRANSITIONS
// ---------------------------------------------------------------------------

describe("VALID_FINDING_TRANSITIONS", () => {
  it("allows identified -> in_remediation", () => {
    expect(VALID_FINDING_TRANSITIONS["identified"]).toContain("in_remediation");
  });

  it("allows identified -> accepted", () => {
    expect(VALID_FINDING_TRANSITIONS["identified"]).toContain("accepted");
  });

  it("allows remediated -> verified", () => {
    expect(VALID_FINDING_TRANSITIONS["remediated"]).toContain("verified");
  });

  it("does not allow identified -> verified", () => {
    expect(VALID_FINDING_TRANSITIONS["identified"]).not.toContain("verified");
  });

  it("does not allow closed to transition anywhere", () => {
    expect(VALID_FINDING_TRANSITIONS["closed"]).toEqual([]);
  });

  it("allows verified -> closed", () => {
    expect(VALID_FINDING_TRANSITIONS["verified"]).toContain("closed");
  });
});

// ---------------------------------------------------------------------------
// createEvidenceSchema
// ---------------------------------------------------------------------------

describe("createEvidenceSchema", () => {
  it("accepts valid evidence with required fields", () => {
    const result = createEvidenceSchema.safeParse({
      entityType: "control",
      entityId: UUID,
      fileName: "access-log-export.csv",
      filePath: "/evidence/2026/access-log-export.csv",
    });
    expect(result.success).toBe(true);
  });

  it("applies default category of other", () => {
    const result = createEvidenceSchema.safeParse({
      entityType: "control_test",
      entityId: UUID,
      fileName: "screenshot.png",
      filePath: "/evidence/screenshot.png",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe("other");
    }
  });

  it("accepts all valid evidence categories", () => {
    const cats = [
      "screenshot", "document", "log_export", "email",
      "certificate", "report", "photo", "config_export", "other",
    ];
    for (const category of cats) {
      const result = createEvidenceSchema.safeParse({
        entityType: "finding",
        entityId: UUID,
        category,
        fileName: "file.pdf",
        filePath: "/path/file.pdf",
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects missing entityType", () => {
    const result = createEvidenceSchema.safeParse({
      entityId: UUID,
      fileName: "file.pdf",
      filePath: "/path/file.pdf",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing entityId", () => {
    const result = createEvidenceSchema.safeParse({
      entityType: "control",
      fileName: "file.pdf",
      filePath: "/path/file.pdf",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID entityId", () => {
    const result = createEvidenceSchema.safeParse({
      entityType: "control",
      entityId: "not-a-uuid",
      fileName: "file.pdf",
      filePath: "/path/file.pdf",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fileName", () => {
    const result = createEvidenceSchema.safeParse({
      entityType: "control",
      entityId: UUID,
      filePath: "/path/file.pdf",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty filePath", () => {
    const result = createEvidenceSchema.safeParse({
      entityType: "control",
      entityId: UUID,
      fileName: "file.pdf",
      filePath: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero fileSize", () => {
    const result = createEvidenceSchema.safeParse({
      entityType: "control",
      entityId: UUID,
      fileName: "file.pdf",
      filePath: "/path/file.pdf",
      fileSize: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative fileSize", () => {
    const result = createEvidenceSchema.safeParse({
      entityType: "control",
      entityId: UUID,
      fileName: "file.pdf",
      filePath: "/path/file.pdf",
      fileSize: -100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid evidence category", () => {
    const result = createEvidenceSchema.safeParse({
      entityType: "control",
      entityId: UUID,
      category: "video",
      fileName: "file.pdf",
      filePath: "/path/file.pdf",
    });
    expect(result.success).toBe(false);
  });
});
