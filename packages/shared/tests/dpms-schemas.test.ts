// Unit tests for Sprint 7 Data Protection Management System (DPMS) Zod schemas
// Tests ROPA, DSR, Data Breach, DPIA, TIA schemas and status transitions

import { describe, it, expect } from "vitest";
import {
  createRopaEntrySchema,
  createDsrSchema,
  createDataBreachSchema,
  createDpiaSchema,
  createTiaSchema,
  VALID_ROPA_STATUS_TRANSITIONS,
  DSR_STATUS_TRANSITIONS,
  isValidDsrTransition,
  BREACH_STATUS_TRANSITIONS,
  isValidBreachTransition,
  VALID_DPIA_STATUS_TRANSITIONS,
  dsrStatusTransitionSchema,
  breachStatusTransitionSchema,
  dpiaStatusTransitionSchema,
  ropaStatusTransitionSchema,
} from "../src/schemas";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

// ---------------------------------------------------------------------------
// createRopaEntrySchema
// ---------------------------------------------------------------------------

describe("createRopaEntrySchema", () => {
  it("accepts valid ROPA entry with required fields", () => {
    const result = createRopaEntrySchema.safeParse({
      title: "Employee Data Processing",
      purpose: "HR management and payroll",
      legalBasis: "contract",
    });
    expect(result.success).toBe(true);
  });

  it("accepts ROPA entry with all optional fields", () => {
    const result = createRopaEntrySchema.safeParse({
      title: "Marketing Analytics",
      purpose: "Customer behavior analysis",
      legalBasis: "consent",
      legalBasisDetail: "Explicit opt-in via web form",
      controllerOrgId: UUID,
      processorName: "Analytics Provider",
      processingDescription: "Tracking website interactions",
      retentionPeriod: "24 months",
      retentionJustification: "Business need for trend analysis",
      technicalMeasures: "Encryption at rest and in transit",
      organizationalMeasures: "Access limited to analytics team",
      internationalTransfer: true,
      transferCountry: "US",
      transferSafeguard: "SCCs",
      responsibleId: UUID,
      nextReviewDate: "2027-01-01",
    });
    expect(result.success).toBe(true);
  });

  it("applies default for internationalTransfer", () => {
    const result = createRopaEntrySchema.safeParse({
      title: "Test",
      purpose: "Testing",
      legalBasis: "legitimate_interest",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.internationalTransfer).toBe(false);
    }
  });

  it("accepts all valid legal basis values", () => {
    const bases = [
      "consent",
      "contract",
      "legal_obligation",
      "vital_interest",
      "public_interest",
      "legitimate_interest",
    ];
    for (const legalBasis of bases) {
      const result = createRopaEntrySchema.safeParse({
        title: "Entry",
        purpose: "Purpose",
        legalBasis,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid legal basis", () => {
    const result = createRopaEntrySchema.safeParse({
      title: "Entry",
      purpose: "Purpose",
      legalBasis: "business_need",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", () => {
    const result = createRopaEntrySchema.safeParse({
      purpose: "Purpose",
      legalBasis: "consent",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing purpose", () => {
    const result = createRopaEntrySchema.safeParse({
      title: "Entry",
      legalBasis: "consent",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing legalBasis", () => {
    const result = createRopaEntrySchema.safeParse({
      title: "Entry",
      purpose: "Purpose",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ROPA Status Transitions
// ---------------------------------------------------------------------------

describe("VALID_ROPA_STATUS_TRANSITIONS", () => {
  it("allows draft -> active", () => {
    expect(VALID_ROPA_STATUS_TRANSITIONS["draft"]).toContain("active");
  });

  it("allows active -> archived", () => {
    expect(VALID_ROPA_STATUS_TRANSITIONS["active"]).toContain("archived");
  });

  it("allows archived -> draft (reactivate)", () => {
    expect(VALID_ROPA_STATUS_TRANSITIONS["archived"]).toContain("draft");
  });

  it("does not allow draft -> archived directly", () => {
    expect(VALID_ROPA_STATUS_TRANSITIONS["draft"]).not.toContain("archived");
  });
});

describe("ropaStatusTransitionSchema", () => {
  it("accepts all valid ROPA statuses", () => {
    for (const s of ["draft", "active", "under_review", "archived"]) {
      const result = ropaStatusTransitionSchema.safeParse({ status: s });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid ROPA status", () => {
    const result = ropaStatusTransitionSchema.safeParse({ status: "deleted" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createDsrSchema
// ---------------------------------------------------------------------------

describe("createDsrSchema", () => {
  it("accepts valid DSR with required fields", () => {
    const result = createDsrSchema.safeParse({
      requestType: "access",
      subjectName: "Max Mustermann",
    });
    expect(result.success).toBe(true);
  });

  it("accepts DSR with optional email", () => {
    const result = createDsrSchema.safeParse({
      requestType: "erasure",
      subjectName: "Jane Doe",
      subjectEmail: "jane@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid DSR request types", () => {
    for (const rt of [
      "access",
      "erasure",
      "restriction",
      "portability",
      "objection",
    ]) {
      const result = createDsrSchema.safeParse({
        requestType: rt,
        subjectName: "Subject",
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid request type", () => {
    const result = createDsrSchema.safeParse({
      requestType: "deletion",
      subjectName: "Subject",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing subjectName", () => {
    const result = createDsrSchema.safeParse({
      requestType: "access",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = createDsrSchema.safeParse({
      requestType: "access",
      subjectName: "Subject",
      subjectEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DSR Status Transitions
// ---------------------------------------------------------------------------

describe("DSR_STATUS_TRANSITIONS", () => {
  it("allows received -> verified", () => {
    expect(isValidDsrTransition("received", "verified")).toBe(true);
  });

  it("allows verified -> processing", () => {
    expect(isValidDsrTransition("verified", "processing")).toBe(true);
  });

  it("allows processing -> response_sent", () => {
    expect(isValidDsrTransition("processing", "response_sent")).toBe(true);
  });

  it("allows response_sent -> closed", () => {
    expect(isValidDsrTransition("response_sent", "closed")).toBe(true);
  });

  it("does not allow received -> processing (must verify first)", () => {
    expect(isValidDsrTransition("received", "processing")).toBe(false);
  });

  it("does not allow closed to transition anywhere", () => {
    expect(DSR_STATUS_TRANSITIONS["closed"]).toEqual([]);
  });

  it("allows received -> rejected", () => {
    expect(isValidDsrTransition("received", "rejected")).toBe(true);
  });

  it("returns false for unknown from-status", () => {
    expect(isValidDsrTransition("unknown", "verified")).toBe(false);
  });
});

describe("dsrStatusTransitionSchema", () => {
  it("accepts all valid DSR statuses", () => {
    for (const s of [
      "received",
      "verified",
      "processing",
      "response_sent",
      "closed",
      "rejected",
    ]) {
      const result = dsrStatusTransitionSchema.safeParse({ status: s });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid DSR status", () => {
    const result = dsrStatusTransitionSchema.safeParse({ status: "pending" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createDataBreachSchema
// ---------------------------------------------------------------------------

describe("createDataBreachSchema", () => {
  it("accepts valid data breach with required fields", () => {
    const result = createDataBreachSchema.safeParse({
      title: "Unauthorized email access",
      detectedAt: "2026-03-20T14:30:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("applies default values", () => {
    const result = createDataBreachSchema.safeParse({
      title: "Breach",
      detectedAt: "2026-03-20T14:30:00Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.severity).toBe("medium");
      expect(result.data.isDpaNotificationRequired).toBe(true);
      expect(result.data.isIndividualNotificationRequired).toBe(false);
      expect(result.data.dataCategoriesAffected).toEqual([]);
      expect(result.data.affectedCountries).toEqual([]);
    }
  });

  it("accepts all valid breach severities", () => {
    for (const severity of ["low", "medium", "high", "critical"]) {
      const result = createDataBreachSchema.safeParse({
        title: "Breach",
        detectedAt: "2026-01-01T00:00:00Z",
        severity,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid severity", () => {
    const result = createDataBreachSchema.safeParse({
      title: "Breach",
      detectedAt: "2026-01-01T00:00:00Z",
      severity: "extreme",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", () => {
    const result = createDataBreachSchema.safeParse({
      detectedAt: "2026-01-01T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing detectedAt", () => {
    const result = createDataBreachSchema.safeParse({
      title: "Breach",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid datetime for detectedAt", () => {
    const result = createDataBreachSchema.safeParse({
      title: "Breach",
      detectedAt: "2026-03-20",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative estimatedRecordsAffected", () => {
    const result = createDataBreachSchema.safeParse({
      title: "Breach",
      detectedAt: "2026-01-01T00:00:00Z",
      estimatedRecordsAffected: -10,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Breach Status Transitions
// ---------------------------------------------------------------------------

describe("BREACH_STATUS_TRANSITIONS", () => {
  it("allows detected -> assessing", () => {
    expect(isValidBreachTransition("detected", "assessing")).toBe(true);
  });

  it("allows assessing -> notifying_dpa", () => {
    expect(isValidBreachTransition("assessing", "notifying_dpa")).toBe(true);
  });

  it("allows notifying_individuals -> remediation", () => {
    expect(
      isValidBreachTransition("notifying_individuals", "remediation"),
    ).toBe(true);
  });

  it("allows remediation -> closed", () => {
    expect(isValidBreachTransition("remediation", "closed")).toBe(true);
  });

  it("does not allow detected -> closed (must assess first)", () => {
    expect(isValidBreachTransition("detected", "closed")).toBe(false);
  });

  it("does not allow closed to transition anywhere", () => {
    expect(BREACH_STATUS_TRANSITIONS["closed"]).toEqual([]);
  });

  it("returns false for unknown from-status", () => {
    expect(isValidBreachTransition("unknown", "assessing")).toBe(false);
  });
});

describe("breachStatusTransitionSchema", () => {
  it("accepts all valid breach statuses", () => {
    for (const s of [
      "detected",
      "assessing",
      "notifying_dpa",
      "notifying_individuals",
      "remediation",
      "closed",
    ]) {
      const result = breachStatusTransitionSchema.safeParse({ status: s });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid breach status", () => {
    const result = breachStatusTransitionSchema.safeParse({
      status: "investigating",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createDpiaSchema
// ---------------------------------------------------------------------------

describe("createDpiaSchema", () => {
  it("accepts valid DPIA with required fields", () => {
    const result = createDpiaSchema.safeParse({
      title: "Profiling DPIA",
    });
    expect(result.success).toBe(true);
  });

  it("accepts DPIA with all optional fields", () => {
    const result = createDpiaSchema.safeParse({
      title: "AI-based scoring DPIA",
      processingDescription: "Automated decision-making for credit scoring",
      legalBasis: "legitimate_interest",
      necessityAssessment: "Required by Art. 35 GDPR",
      dpoConsultationRequired: true,
    });
    expect(result.success).toBe(true);
  });

  it("applies default dpoConsultationRequired", () => {
    const result = createDpiaSchema.safeParse({ title: "DPIA" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dpoConsultationRequired).toBe(false);
    }
  });

  it("rejects missing title", () => {
    const result = createDpiaSchema.safeParse({
      legalBasis: "consent",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid legalBasis for DPIA", () => {
    const result = createDpiaSchema.safeParse({
      title: "DPIA",
      legalBasis: "business_interest",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DPIA Status Transitions
// ---------------------------------------------------------------------------

describe("VALID_DPIA_STATUS_TRANSITIONS", () => {
  it("allows draft -> in_progress", () => {
    expect(VALID_DPIA_STATUS_TRANSITIONS["draft"]).toContain("in_progress");
  });

  it("allows pending_dpo_review -> approved", () => {
    expect(VALID_DPIA_STATUS_TRANSITIONS["pending_dpo_review"]).toContain(
      "approved",
    );
  });

  it("allows pending_dpo_review -> rejected", () => {
    expect(VALID_DPIA_STATUS_TRANSITIONS["pending_dpo_review"]).toContain(
      "rejected",
    );
  });

  it("does not allow approved to transition further", () => {
    expect(VALID_DPIA_STATUS_TRANSITIONS["approved"]).toEqual([]);
  });

  it("allows rejected -> draft (rework)", () => {
    expect(VALID_DPIA_STATUS_TRANSITIONS["rejected"]).toContain("draft");
  });
});

describe("dpiaStatusTransitionSchema", () => {
  it("accepts all valid DPIA statuses", () => {
    for (const s of [
      "draft",
      "in_progress",
      "completed",
      "pending_dpo_review",
      "approved",
      "rejected",
    ]) {
      const result = dpiaStatusTransitionSchema.safeParse({ status: s });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid DPIA status", () => {
    const result = dpiaStatusTransitionSchema.safeParse({ status: "started" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createTiaSchema
// ---------------------------------------------------------------------------

describe("createTiaSchema", () => {
  it("accepts valid TIA with required fields", () => {
    const result = createTiaSchema.safeParse({
      title: "US Cloud Transfer Assessment",
      transferCountry: "US",
      legalBasis: "sccs",
    });
    expect(result.success).toBe(true);
  });

  it("applies default riskRating", () => {
    const result = createTiaSchema.safeParse({
      title: "TIA",
      transferCountry: "IN",
      legalBasis: "adequacy",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.riskRating).toBe("medium");
    }
  });

  it("accepts all valid TIA legal basis values", () => {
    for (const lb of ["adequacy", "sccs", "bcrs", "derogation"]) {
      const result = createTiaSchema.safeParse({
        title: "TIA",
        transferCountry: "US",
        legalBasis: lb,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid TIA legal basis", () => {
    const result = createTiaSchema.safeParse({
      title: "TIA",
      transferCountry: "US",
      legalBasis: "consent",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid risk ratings", () => {
    for (const rr of ["low", "medium", "high"]) {
      const result = createTiaSchema.safeParse({
        title: "TIA",
        transferCountry: "CN",
        legalBasis: "sccs",
        riskRating: rr,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects missing transferCountry", () => {
    const result = createTiaSchema.safeParse({
      title: "TIA",
      legalBasis: "sccs",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing legalBasis", () => {
    const result = createTiaSchema.safeParse({
      title: "TIA",
      transferCountry: "US",
    });
    expect(result.success).toBe(false);
  });
});
