// Unit tests for Sprint 3 BPMN Process Modeling Zod schemas
// Tests createProcessSchema, createVersionSchema, transitionProcessStatusSchema,
// generateBpmnSchema, linkProcessRiskSchema, updateProcessStepSchema

import { describe, it, expect } from "vitest";
import {
  createProcessSchema,
  createVersionSchema,
  transitionProcessStatusSchema,
  generateBpmnSchema,
  linkProcessRiskSchema,
  updateProcessStepSchema,
} from "../src/schemas";

// ---------------------------------------------------------------------------
// createProcessSchema
// ---------------------------------------------------------------------------

describe("createProcessSchema", () => {
  it("valid input passes", () => {
    const result = createProcessSchema.safeParse({
      name: "Incident Response Process",
      level: 3,
      department: "IT Security",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Incident Response Process");
      expect(result.data.level).toBe(3);
    }
  });

  it("rejects name < 3 chars", () => {
    const result = createProcessSchema.safeParse({ name: "AB", level: 1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.flatten().fieldErrors;
      expect(issues.name).toBeDefined();
    }
  });

  it("rejects name > 500 chars", () => {
    const result = createProcessSchema.safeParse({
      name: "A".repeat(501),
      level: 1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts name at exactly 3 chars (minimum boundary)", () => {
    const result = createProcessSchema.safeParse({ name: "ABC", level: 1 });
    expect(result.success).toBe(true);
  });

  it("accepts name at exactly 500 chars (maximum boundary)", () => {
    const result = createProcessSchema.safeParse({
      name: "A".repeat(500),
      level: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects level 0 (below minimum 1)", () => {
    const result = createProcessSchema.safeParse({
      name: "Test Process",
      level: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects level 11 (above maximum 10)", () => {
    const result = createProcessSchema.safeParse({
      name: "Test Process",
      level: 11,
    });
    expect(result.success).toBe(false);
  });

  it("accepts level 1 (minimum boundary)", () => {
    const result = createProcessSchema.safeParse({
      name: "Test Process",
      level: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.level).toBe(1);
    }
  });

  it("accepts level 10 (maximum boundary)", () => {
    const result = createProcessSchema.safeParse({
      name: "Test Process",
      level: 10,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.level).toBe(10);
    }
  });

  it("defaults notation to 'bpmn'", () => {
    const result = createProcessSchema.parse({
      name: "Test Process",
      level: 1,
    });
    expect(result.notation).toBe("bpmn");
  });

  it("accepts all 3 notation values", () => {
    const notations = ["bpmn", "value_chain", "epc"] as const;
    for (const notation of notations) {
      const result = createProcessSchema.safeParse({
        name: "Test Process",
        level: 1,
        notation,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.notation).toBe(notation);
      }
    }
  });

  it("rejects invalid notation value", () => {
    const result = createProcessSchema.safeParse({
      name: "Test Process",
      level: 1,
      notation: "flowchart",
    });
    expect(result.success).toBe(false);
  });

  it("optional fields accepted as undefined", () => {
    const result = createProcessSchema.safeParse({
      name: "Test Process",
      level: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeUndefined();
      expect(result.data.parentProcessId).toBeUndefined();
      expect(result.data.processOwnerId).toBeUndefined();
      expect(result.data.reviewerId).toBeUndefined();
      expect(result.data.department).toBeUndefined();
    }
  });

  it("optional fields accepted as null", () => {
    const result = createProcessSchema.safeParse({
      name: "Test Process",
      level: 1,
      description: null,
      parentProcessId: null,
      processOwnerId: null,
      reviewerId: null,
      department: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID for parentProcessId", () => {
    const result = createProcessSchema.safeParse({
      name: "Test Process",
      level: 1,
      parentProcessId: "not-a-valid-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid UUID for parentProcessId", () => {
    const result = createProcessSchema.safeParse({
      name: "Test Process",
      level: 1,
      parentProcessId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("defaults isEssential to false", () => {
    const result = createProcessSchema.parse({
      name: "Test Process",
      level: 1,
    });
    expect(result.isEssential).toBe(false);
  });

  it("rejects non-integer level (float)", () => {
    const result = createProcessSchema.safeParse({
      name: "Test Process",
      level: 3.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = createProcessSchema.safeParse({ level: 3 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createVersionSchema
// ---------------------------------------------------------------------------

describe("createVersionSchema", () => {
  it("valid bpmnXml (50+ chars) passes", () => {
    const result = createVersionSchema.safeParse({
      bpmnXml: "A".repeat(50),
    });
    expect(result.success).toBe(true);
  });

  it("rejects bpmnXml < 50 chars", () => {
    const result = createVersionSchema.safeParse({
      bpmnXml: "short xml",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.flatten().fieldErrors;
      expect(issues.bpmnXml).toBeDefined();
    }
  });

  it("accepts bpmnXml at exactly 50 chars (minimum boundary)", () => {
    const result = createVersionSchema.safeParse({
      bpmnXml: "X".repeat(50),
    });
    expect(result.success).toBe(true);
  });

  it("change summary is optional", () => {
    const result = createVersionSchema.safeParse({
      bpmnXml: "A".repeat(100),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.changeSummary).toBeUndefined();
    }
  });

  it("accepts changeSummary when provided", () => {
    const result = createVersionSchema.safeParse({
      bpmnXml: "A".repeat(100),
      changeSummary: "Added new approval gateway",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.changeSummary).toBe("Added new approval gateway");
    }
  });

  it("rejects changeSummary > 500 chars", () => {
    const result = createVersionSchema.safeParse({
      bpmnXml: "A".repeat(100),
      changeSummary: "C".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts changeSummary at exactly 500 chars (maximum boundary)", () => {
    const result = createVersionSchema.safeParse({
      bpmnXml: "A".repeat(100),
      changeSummary: "C".repeat(500),
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing bpmnXml", () => {
    const result = createVersionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// transitionProcessStatusSchema
// ---------------------------------------------------------------------------

describe("transitionProcessStatusSchema", () => {
  it("valid status values pass", () => {
    const validStatuses = [
      "draft",
      "in_review",
      "approved",
      "published",
      "archived",
    ];
    for (const status of validStatuses) {
      const result = transitionProcessStatusSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = transitionProcessStatusSchema.safeParse({
      status: "pending",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty string status", () => {
    const result = transitionProcessStatusSchema.safeParse({ status: "" });
    expect(result.success).toBe(false);
  });

  it("comment is optional", () => {
    const result = transitionProcessStatusSchema.safeParse({
      status: "approved",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.comment).toBeUndefined();
    }
  });

  it("accepts comment when provided", () => {
    const result = transitionProcessStatusSchema.safeParse({
      status: "approved",
      comment: "Process review complete, looks good",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.comment).toBe("Process review complete, looks good");
    }
  });

  it("rejects comment > 1000 chars", () => {
    const result = transitionProcessStatusSchema.safeParse({
      status: "approved",
      comment: "X".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts comment at exactly 1000 chars (maximum boundary)", () => {
    const result = transitionProcessStatusSchema.safeParse({
      status: "approved",
      comment: "X".repeat(1000),
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing status", () => {
    const result = transitionProcessStatusSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateBpmnSchema
// ---------------------------------------------------------------------------

describe("generateBpmnSchema", () => {
  it("valid input passes", () => {
    const result = generateBpmnSchema.safeParse({
      name: "Incident Response",
      description: "A".repeat(50),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Incident Response");
      expect(result.data.industry).toBe("generic"); // default
    }
  });

  it("rejects description < 50 chars", () => {
    const result = generateBpmnSchema.safeParse({
      name: "Test Process",
      description: "Too short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.flatten().fieldErrors;
      expect(issues.description).toBeDefined();
    }
  });

  it("accepts description at exactly 50 chars (minimum boundary)", () => {
    const result = generateBpmnSchema.safeParse({
      name: "Test Process",
      description: "D".repeat(50),
    });
    expect(result.success).toBe(true);
  });

  it("rejects description > 2000 chars", () => {
    const result = generateBpmnSchema.safeParse({
      name: "Test Process",
      description: "D".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts description at exactly 2000 chars (maximum boundary)", () => {
    const result = generateBpmnSchema.safeParse({
      name: "Test Process",
      description: "D".repeat(2000),
    });
    expect(result.success).toBe(true);
  });

  it("accepts all industry values", () => {
    const industries = [
      "manufacturing",
      "it_services",
      "financial_services",
      "healthcare",
      "generic",
    ] as const;
    for (const industry of industries) {
      const result = generateBpmnSchema.safeParse({
        name: "Test Process",
        description: "A".repeat(50),
        industry,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.industry).toBe(industry);
      }
    }
  });

  it("rejects invalid industry value", () => {
    const result = generateBpmnSchema.safeParse({
      name: "Test Process",
      description: "A".repeat(50),
      industry: "automotive",
    });
    expect(result.success).toBe(false);
  });

  it("industry is optional (defaults to generic)", () => {
    const result = generateBpmnSchema.safeParse({
      name: "Test Process",
      description: "A".repeat(50),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.industry).toBe("generic");
    }
  });

  it("name min 3 chars", () => {
    const tooShort = generateBpmnSchema.safeParse({
      name: "AB",
      description: "A".repeat(50),
    });
    expect(tooShort.success).toBe(false);

    const atMin = generateBpmnSchema.safeParse({
      name: "ABC",
      description: "A".repeat(50),
    });
    expect(atMin.success).toBe(true);
  });

  it("name max 200 chars", () => {
    const tooLong = generateBpmnSchema.safeParse({
      name: "N".repeat(201),
      description: "A".repeat(50),
    });
    expect(tooLong.success).toBe(false);

    const atMax = generateBpmnSchema.safeParse({
      name: "N".repeat(200),
      description: "A".repeat(50),
    });
    expect(atMax.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = generateBpmnSchema.safeParse({
      description: "A".repeat(50),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing description", () => {
    const result = generateBpmnSchema.safeParse({
      name: "Test Process",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// linkProcessRiskSchema
// ---------------------------------------------------------------------------

describe("linkProcessRiskSchema", () => {
  it("valid riskId passes", () => {
    const result = linkProcessRiskSchema.safeParse({
      riskId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.riskId).toBe("550e8400-e29b-41d4-a716-446655440000");
    }
  });

  it("rejects invalid UUID for riskId", () => {
    const result = linkProcessRiskSchema.safeParse({
      riskId: "not-a-valid-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing riskId", () => {
    const result = linkProcessRiskSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("riskContext is optional", () => {
    const result = linkProcessRiskSchema.safeParse({
      riskId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.riskContext).toBeUndefined();
    }
  });

  it("accepts riskContext when provided", () => {
    const result = linkProcessRiskSchema.safeParse({
      riskId: "550e8400-e29b-41d4-a716-446655440000",
      riskContext: "This task handles sensitive financial data",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.riskContext).toBe(
        "This task handles sensitive financial data",
      );
    }
  });

  it("rejects riskContext > 1000 chars", () => {
    const result = linkProcessRiskSchema.safeParse({
      riskId: "550e8400-e29b-41d4-a716-446655440000",
      riskContext: "C".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts riskContext at exactly 1000 chars (maximum boundary)", () => {
    const result = linkProcessRiskSchema.safeParse({
      riskId: "550e8400-e29b-41d4-a716-446655440000",
      riskContext: "C".repeat(1000),
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateProcessStepSchema
// ---------------------------------------------------------------------------

describe("updateProcessStepSchema", () => {
  it("responsibleRole is optional", () => {
    const result = updateProcessStepSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts responsibleRole when provided", () => {
    const result = updateProcessStepSchema.safeParse({
      responsibleRole: "risk_manager",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.responsibleRole).toBe("risk_manager");
    }
  });

  it("rejects responsibleRole > 255 chars", () => {
    const result = updateProcessStepSchema.safeParse({
      responsibleRole: "R".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("accepts responsibleRole at exactly 255 chars (maximum boundary)", () => {
    const result = updateProcessStepSchema.safeParse({
      responsibleRole: "R".repeat(255),
    });
    expect(result.success).toBe(true);
  });

  it("accepts responsibleRole as null", () => {
    const result = updateProcessStepSchema.safeParse({
      responsibleRole: null,
    });
    expect(result.success).toBe(true);
  });

  it("description is optional", () => {
    const result = updateProcessStepSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeUndefined();
    }
  });

  it("accepts description when provided", () => {
    const result = updateProcessStepSchema.safeParse({
      description: "Verify all incoming documents for completeness",
    });
    expect(result.success).toBe(true);
  });

  it("rejects description > 2000 chars", () => {
    const result = updateProcessStepSchema.safeParse({
      description: "D".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts description at exactly 2000 chars (maximum boundary)", () => {
    const result = updateProcessStepSchema.safeParse({
      description: "D".repeat(2000),
    });
    expect(result.success).toBe(true);
  });

  it("accepts description as null", () => {
    const result = updateProcessStepSchema.safeParse({
      description: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts both fields together", () => {
    const result = updateProcessStepSchema.safeParse({
      responsibleRole: "process_owner",
      description: "Handle incoming order verification",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.responsibleRole).toBe("process_owner");
      expect(result.data.description).toBe(
        "Handle incoming order verification",
      );
    }
  });

  it("accepts empty object (all fields optional)", () => {
    const result = updateProcessStepSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
