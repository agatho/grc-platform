// Unit tests for Sprint 10 ESG/CSRD Module Zod schemas
// Tests materiality assessment, voting, measurement, target schemas

import { describe, it, expect } from "vitest";
import {
  createMaterialityAssessmentSchema,
  submitVoteSchema,
  recordMeasurementSchema,
  createTargetSchema,
} from "../src/schemas";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

// ---------------------------------------------------------------------------
// createMaterialityAssessmentSchema
// ---------------------------------------------------------------------------

describe("createMaterialityAssessmentSchema", () => {
  it("accepts valid reporting year", () => {
    const result = createMaterialityAssessmentSchema.safeParse({
      reportingYear: 2026,
    });
    expect(result.success).toBe(true);
  });

  it("accepts minimum year 2024", () => {
    const result = createMaterialityAssessmentSchema.safeParse({
      reportingYear: 2024,
    });
    expect(result.success).toBe(true);
  });

  it("accepts maximum year 2030", () => {
    const result = createMaterialityAssessmentSchema.safeParse({
      reportingYear: 2030,
    });
    expect(result.success).toBe(true);
  });

  it("rejects year below 2024", () => {
    const result = createMaterialityAssessmentSchema.safeParse({
      reportingYear: 2023,
    });
    expect(result.success).toBe(false);
  });

  it("rejects year above 2030", () => {
    const result = createMaterialityAssessmentSchema.safeParse({
      reportingYear: 2031,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing reportingYear", () => {
    const result = createMaterialityAssessmentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects non-integer year", () => {
    const result = createMaterialityAssessmentSchema.safeParse({
      reportingYear: 2026.5,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// submitVoteSchema
// ---------------------------------------------------------------------------

describe("submitVoteSchema", () => {
  it("accepts valid vote with required fields", () => {
    const result = submitVoteSchema.safeParse({
      topicId: UUID,
      impactScore: 7.5,
      financialScore: 4.0,
      voterType: "internal",
    });
    expect(result.success).toBe(true);
  });

  it("accepts vote with optional fields", () => {
    const result = submitVoteSchema.safeParse({
      topicId: UUID,
      impactScore: 8,
      financialScore: 6,
      voterType: "investor",
      voterName: "Fund Manager A",
      comment: "High strategic importance for our portfolio",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid voter types", () => {
    for (const vt of [
      "internal",
      "customer",
      "supplier",
      "investor",
      "ngo",
      "regulator",
    ]) {
      const result = submitVoteSchema.safeParse({
        topicId: UUID,
        impactScore: 5,
        financialScore: 5,
        voterType: vt,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid voter type", () => {
    const result = submitVoteSchema.safeParse({
      topicId: UUID,
      impactScore: 5,
      financialScore: 5,
      voterType: "employee",
    });
    expect(result.success).toBe(false);
  });

  it("rejects impactScore below 0", () => {
    const result = submitVoteSchema.safeParse({
      topicId: UUID,
      impactScore: -1,
      financialScore: 5,
      voterType: "internal",
    });
    expect(result.success).toBe(false);
  });

  it("rejects impactScore above 10", () => {
    const result = submitVoteSchema.safeParse({
      topicId: UUID,
      impactScore: 11,
      financialScore: 5,
      voterType: "internal",
    });
    expect(result.success).toBe(false);
  });

  it("rejects financialScore below 0", () => {
    const result = submitVoteSchema.safeParse({
      topicId: UUID,
      impactScore: 5,
      financialScore: -0.5,
      voterType: "internal",
    });
    expect(result.success).toBe(false);
  });

  it("rejects financialScore above 10", () => {
    const result = submitVoteSchema.safeParse({
      topicId: UUID,
      impactScore: 5,
      financialScore: 10.1,
      voterType: "internal",
    });
    expect(result.success).toBe(false);
  });

  it("accepts boundary scores of 0 and 10", () => {
    const result = submitVoteSchema.safeParse({
      topicId: UUID,
      impactScore: 0,
      financialScore: 10,
      voterType: "internal",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing topicId", () => {
    const result = submitVoteSchema.safeParse({
      impactScore: 5,
      financialScore: 5,
      voterType: "internal",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID topicId", () => {
    const result = submitVoteSchema.safeParse({
      topicId: "not-a-uuid",
      impactScore: 5,
      financialScore: 5,
      voterType: "internal",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// recordMeasurementSchema
// ---------------------------------------------------------------------------

describe("recordMeasurementSchema", () => {
  it("accepts valid measurement with required fields", () => {
    const result = recordMeasurementSchema.safeParse({
      metricId: UUID,
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      value: 42500.75,
      unit: "tCO2e",
      dataQuality: "measured",
    });
    expect(result.success).toBe(true);
  });

  it("accepts measurement with optional fields", () => {
    const result = recordMeasurementSchema.safeParse({
      metricId: UUID,
      periodStart: "2026-01-01",
      periodEnd: "2026-03-31",
      value: 1200,
      unit: "MWh",
      dataQuality: "estimated",
      source: "Utility bill",
      notes: "Estimated based on prior quarter",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid data quality values", () => {
    for (const dq of ["measured", "estimated", "calculated"]) {
      const result = recordMeasurementSchema.safeParse({
        metricId: UUID,
        periodStart: "2026-01-01",
        periodEnd: "2026-12-31",
        value: 100,
        unit: "kg",
        dataQuality: dq,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid data quality", () => {
    const result = recordMeasurementSchema.safeParse({
      metricId: UUID,
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      value: 100,
      unit: "kg",
      dataQuality: "assumed",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing metricId", () => {
    const result = recordMeasurementSchema.safeParse({
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      value: 100,
      unit: "kg",
      dataQuality: "measured",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing value", () => {
    const result = recordMeasurementSchema.safeParse({
      metricId: UUID,
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      unit: "kg",
      dataQuality: "measured",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing unit", () => {
    const result = recordMeasurementSchema.safeParse({
      metricId: UUID,
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      value: 100,
      dataQuality: "measured",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing dataQuality", () => {
    const result = recordMeasurementSchema.safeParse({
      metricId: UUID,
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      value: 100,
      unit: "kg",
    });
    expect(result.success).toBe(false);
  });

  it("accepts negative values (valid for deltas)", () => {
    const result = recordMeasurementSchema.safeParse({
      metricId: UUID,
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      value: -500,
      unit: "tCO2e",
      dataQuality: "calculated",
    });
    expect(result.success).toBe(true);
  });

  it("accepts zero value", () => {
    const result = recordMeasurementSchema.safeParse({
      metricId: UUID,
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      value: 0,
      unit: "tCO2e",
      dataQuality: "measured",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createTargetSchema
// ---------------------------------------------------------------------------

describe("createTargetSchema", () => {
  it("accepts valid target with required fields", () => {
    const result = createTargetSchema.safeParse({
      metricId: UUID,
      name: "Net Zero 2030",
      baselineYear: 2024,
      baselineValue: 50000,
      targetYear: 2030,
      targetValue: 0,
    });
    expect(result.success).toBe(true);
  });

  it("applies default values", () => {
    const result = createTargetSchema.safeParse({
      metricId: UUID,
      name: "Reduce emissions",
      baselineYear: 2025,
      baselineValue: 10000,
      targetYear: 2028,
      targetValue: 5000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetType).toBe("absolute");
      expect(result.data.sbtiAligned).toBe(false);
    }
  });

  it("accepts all valid target types", () => {
    for (const tt of ["absolute", "intensity", "relative"]) {
      const result = createTargetSchema.safeParse({
        metricId: UUID,
        name: "Target",
        baselineYear: 2024,
        baselineValue: 1000,
        targetYear: 2030,
        targetValue: 500,
        targetType: tt,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid target type", () => {
    const result = createTargetSchema.safeParse({
      metricId: UUID,
      name: "Target",
      baselineYear: 2024,
      baselineValue: 1000,
      targetYear: 2030,
      targetValue: 500,
      targetType: "percentage",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing metricId", () => {
    const result = createTargetSchema.safeParse({
      name: "Target",
      baselineYear: 2024,
      baselineValue: 1000,
      targetYear: 2030,
      targetValue: 500,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = createTargetSchema.safeParse({
      metricId: UUID,
      baselineYear: 2024,
      baselineValue: 1000,
      targetYear: 2030,
      targetValue: 500,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer baselineYear", () => {
    const result = createTargetSchema.safeParse({
      metricId: UUID,
      name: "Target",
      baselineYear: 2024.5,
      baselineValue: 1000,
      targetYear: 2030,
      targetValue: 500,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer targetYear", () => {
    const result = createTargetSchema.safeParse({
      metricId: UUID,
      name: "Target",
      baselineYear: 2024,
      baselineValue: 1000,
      targetYear: 2030.5,
      targetValue: 500,
    });
    expect(result.success).toBe(false);
  });
});
