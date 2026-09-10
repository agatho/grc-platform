import { describe, it, expect } from "vitest";
import {
  cciFactorWeightsSchema,
  updateCciConfigurationSchema,
  cciPeriodSchema,
  cciHistoryQuerySchema,
  cciDepartmentsQuerySchema,
  cacheInvalidateSchema,
  cciTrendSchema,
  cciSnapshotSchema,
} from "../src/schemas/compliance-culture";

describe("cciFactorWeightsSchema", () => {
  it("should accept valid weights summing to 1.0", () => {
    const valid = {
      task_compliance: 0.2,
      policy_ack_rate: 0.15,
      training_completion: 0.15,
      incident_response_time: 0.2,
      audit_finding_closure: 0.15,
      self_assessment_participation: 0.15,
    };
    const result = cciFactorWeightsSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("should reject weights not summing to 1.0", () => {
    const invalid = {
      task_compliance: 0.5,
      policy_ack_rate: 0.5,
      training_completion: 0.15,
      incident_response_time: 0.2,
      audit_finding_closure: 0.15,
      self_assessment_participation: 0.15,
    };
    const result = cciFactorWeightsSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject negative weights", () => {
    const negative = {
      task_compliance: -0.1,
      policy_ack_rate: 0.25,
      training_completion: 0.25,
      incident_response_time: 0.2,
      audit_finding_closure: 0.2,
      self_assessment_participation: 0.2,
    };
    const result = cciFactorWeightsSchema.safeParse(negative);
    expect(result.success).toBe(false);
  });

  it("should reject weights > 1.0", () => {
    const tooHigh = {
      task_compliance: 1.5,
      policy_ack_rate: 0,
      training_completion: 0,
      incident_response_time: 0,
      audit_finding_closure: 0,
      self_assessment_participation: 0,
    };
    const result = cciFactorWeightsSchema.safeParse(tooHigh);
    expect(result.success).toBe(false);
  });
});

describe("updateCciConfigurationSchema", () => {
  it("should accept valid configuration update", () => {
    const valid = {
      factorWeights: {
        task_compliance: 0.2,
        policy_ack_rate: 0.15,
        training_completion: 0.15,
        incident_response_time: 0.2,
        audit_finding_closure: 0.15,
        self_assessment_participation: 0.15,
      },
    };
    const result = updateCciConfigurationSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

describe("cciPeriodSchema", () => {
  it("should accept valid YYYY-MM format", () => {
    expect(cciPeriodSchema.safeParse("2026-03").success).toBe(true);
    expect(cciPeriodSchema.safeParse("2025-12").success).toBe(true);
    expect(cciPeriodSchema.safeParse("2026-01").success).toBe(true);
  });

  it("should reject invalid formats", () => {
    expect(cciPeriodSchema.safeParse("2026-13").success).toBe(false);
    expect(cciPeriodSchema.safeParse("2026-00").success).toBe(false);
    expect(cciPeriodSchema.safeParse("26-03").success).toBe(false);
    expect(cciPeriodSchema.safeParse("2026/03").success).toBe(false);
    expect(cciPeriodSchema.safeParse("March 2026").success).toBe(false);
  });
});

describe("cciHistoryQuerySchema", () => {
  it("should accept valid months", () => {
    expect(cciHistoryQuerySchema.safeParse({ months: 12 }).success).toBe(true);
    expect(cciHistoryQuerySchema.safeParse({ months: "6" }).success).toBe(true);
  });

  it("should default to 12", () => {
    const result = cciHistoryQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.months).toBe(12);
    }
  });

  it("should reject out-of-range months", () => {
    expect(cciHistoryQuerySchema.safeParse({ months: 0 }).success).toBe(false);
    expect(cciHistoryQuerySchema.safeParse({ months: 37 }).success).toBe(false);
  });
});

describe("cciTrendSchema", () => {
  it("should accept valid trends", () => {
    expect(cciTrendSchema.safeParse("up").success).toBe(true);
    expect(cciTrendSchema.safeParse("down").success).toBe(true);
    expect(cciTrendSchema.safeParse("stable").success).toBe(true);
  });

  it("should reject invalid trends", () => {
    expect(cciTrendSchema.safeParse("sideways").success).toBe(false);
  });
});

describe("cacheInvalidateSchema", () => {
  it("should accept empty object", () => {
    expect(cacheInvalidateSchema.safeParse({}).success).toBe(true);
  });

  it("should accept valid org ID", () => {
    expect(
      cacheInvalidateSchema.safeParse({
        orgId: "550e8400-e29b-41d4-a716-446655440000",
      }).success,
    ).toBe(true);
  });

  it("should reject invalid UUID", () => {
    expect(
      cacheInvalidateSchema.safeParse({ orgId: "not-a-uuid" }).success,
    ).toBe(false);
  });
});

// ── [N-2 · Welle 6a] Zwei Schemata standen in der Importliste dieser Suite
// und wurden von keiner einzigen Zusicherung angefasst. Ein Import ist keine
// Abdeckung; die Suite behauptete sie trotzdem. Statt die Importe zu
// entfernen, stehen die Pruefungen jetzt hier — und `cciSnapshotSchema` hat
// dabei gleich seinen eigentlichen Befund offengelegt (siehe unten).
describe("cciDepartmentsQuerySchema", () => {
  it("nimmt eine gueltige Periode an", () => {
    const r = cciDepartmentsQuerySchema.safeParse({ period: "2026-01" });
    expect(r.success).toBe(true);
  });

  it("weist eine Periode ab, die dem Format nicht entspricht", () => {
    const r = cciDepartmentsQuerySchema.safeParse({ period: "2026-Q1" });
    expect(r.success).toBe(false);
  });
});

describe("cciSnapshotSchema", () => {
  // Der Kommentar am Schema sagt „for API response validation". Gemessen am
  // 2026-09-07 hat es ausserhalb dieser Suite KEINEN Aufrufer:
  //   grep -rn cciSnapshotSchema --include=*.ts apps packages
  //   -> schemas/compliance-culture.ts:75 (Deklaration), diese Datei
  // Es validiert also keine Antwort. Bis das jemand verdrahtet, haelt
  // wenigstens diese Suite fest, WAS es zusichern wuerde.
  const gueltig = {
    id: "11111111-1111-1111-1111-111111111111",
    orgId: "22222222-2222-2222-2222-222222222222",
    period: "2026-01",
    overallScore: 72,
    factorScores: { task_compliance: 80 },
    factorWeights: { task_compliance: 0.2 },
    rawMetrics: { task_compliance: { total: 10, successful: 8 } },
    trend: "up",
    createdAt: "2026-09-07T00:00:00.000Z",
  };

  it("nimmt eine vollstaendige Momentaufnahme an", () => {
    expect(cciSnapshotSchema.safeParse(gueltig).success).toBe(true);
  });

  it("weist einen Gesamtwert ausserhalb von 0..100 ab", () => {
    expect(
      cciSnapshotSchema.safeParse({ ...gueltig, overallScore: 101 }).success,
    ).toBe(false);
  });

  it("weist ein Gewicht ausserhalb von 0..1 ab", () => {
    expect(
      cciSnapshotSchema.safeParse({
        ...gueltig,
        factorWeights: { task_compliance: 1.5 },
      }).success,
    ).toBe(false);
  });
});
