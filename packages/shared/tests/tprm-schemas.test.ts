// Unit tests for Sprint 9 TPRM + Contract Management Zod schemas
// Tests Vendor, Contract, SLA, SLA Measurement schemas and status transitions

import { describe, it, expect } from "vitest";
import {
  createVendorSchema,
  createContractSchema,
  createSlaSchema,
  createSlaMeasurementSchema,
  vendorStatusTransitionSchema,
  contractStatusTransitionSchema,
  VALID_VENDOR_TRANSITIONS,
  VALID_CONTRACT_TRANSITIONS,
} from "../src/schemas";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

// ---------------------------------------------------------------------------
// createVendorSchema
// ---------------------------------------------------------------------------

describe("createVendorSchema", () => {
  it("accepts valid vendor with required fields", () => {
    const result = createVendorSchema.safeParse({
      name: "Cloud Provider GmbH",
    });
    expect(result.success).toBe(true);
  });

  it("applies default values", () => {
    const result = createVendorSchema.safeParse({
      name: "Test Vendor",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe("other");
      expect(result.data.tier).toBe("standard");
      expect(result.data.isLksgRelevant).toBe(false);
    }
  });

  it("accepts vendor with all optional fields", () => {
    const result = createVendorSchema.safeParse({
      name: "Security Solutions AG",
      legalName: "Security Solutions Aktiengesellschaft",
      description: "Managed security services provider",
      category: "it_services",
      tier: "critical",
      country: "DEU",
      address: "Musterstrasse 1, 10115 Berlin",
      website: "https://security-solutions.example.com",
      taxId: "DE123456789",
      isLksgRelevant: true,
      lksgTier: "direct_supplier",
      ownerId: UUID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createVendorSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createVendorSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name exceeding 500 characters", () => {
    const result = createVendorSchema.safeParse({ name: "V".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("accepts all valid vendor categories", () => {
    const cats = [
      "it_services", "cloud_provider", "consulting", "facility",
      "logistics", "raw_materials", "financial", "hr_services", "other",
    ];
    for (const category of cats) {
      const result = createVendorSchema.safeParse({ name: "Vendor", category });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid vendor category", () => {
    const result = createVendorSchema.safeParse({
      name: "Vendor",
      category: "marketing",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid vendor tiers", () => {
    for (const tier of ["critical", "important", "standard", "low_risk"]) {
      const result = createVendorSchema.safeParse({ name: "Vendor", tier });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid vendor tier", () => {
    const result = createVendorSchema.safeParse({
      name: "Vendor",
      tier: "platinum",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID ownerId", () => {
    const result = createVendorSchema.safeParse({
      name: "Vendor",
      ownerId: "bad-uuid",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// vendorStatusTransitionSchema
// ---------------------------------------------------------------------------

describe("vendorStatusTransitionSchema", () => {
  it("accepts all valid vendor statuses", () => {
    for (const s of ["prospect", "onboarding", "active", "under_review", "suspended", "terminated"]) {
      const result = vendorStatusTransitionSchema.safeParse({ status: s });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid vendor status", () => {
    const result = vendorStatusTransitionSchema.safeParse({ status: "approved" });
    expect(result.success).toBe(false);
  });

  it("rejects missing status", () => {
    const result = vendorStatusTransitionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// VALID_VENDOR_TRANSITIONS
// ---------------------------------------------------------------------------

describe("VALID_VENDOR_TRANSITIONS", () => {
  it("allows prospect -> onboarding", () => {
    expect(VALID_VENDOR_TRANSITIONS["prospect"]).toContain("onboarding");
  });

  it("allows onboarding -> active", () => {
    expect(VALID_VENDOR_TRANSITIONS["onboarding"]).toContain("active");
  });

  it("allows active -> under_review", () => {
    expect(VALID_VENDOR_TRANSITIONS["active"]).toContain("under_review");
  });

  it("allows active -> suspended", () => {
    expect(VALID_VENDOR_TRANSITIONS["active"]).toContain("suspended");
  });

  it("allows suspended -> active (reinstate)", () => {
    expect(VALID_VENDOR_TRANSITIONS["suspended"]).toContain("active");
  });

  it("does not allow terminated to transition", () => {
    expect(VALID_VENDOR_TRANSITIONS["terminated"]).toEqual([]);
  });

  it("does not allow prospect -> active directly", () => {
    expect(VALID_VENDOR_TRANSITIONS["prospect"]).not.toContain("active");
  });

  it("allows any non-terminal status to reach terminated", () => {
    for (const from of ["prospect", "onboarding", "active", "under_review", "suspended"]) {
      expect(VALID_VENDOR_TRANSITIONS[from]).toContain("terminated");
    }
  });
});

// ---------------------------------------------------------------------------
// createContractSchema
// ---------------------------------------------------------------------------

describe("createContractSchema", () => {
  it("accepts valid contract with required fields", () => {
    const result = createContractSchema.safeParse({
      title: "Cloud Infrastructure Service Agreement",
    });
    expect(result.success).toBe(true);
  });

  it("applies default values", () => {
    const result = createContractSchema.safeParse({
      title: "Test Contract",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contractType).toBe("service_agreement");
      expect(result.data.noticePeriodDays).toBe(90);
      expect(result.data.autoRenewal).toBe(false);
      expect(result.data.currency).toBe("EUR");
    }
  });

  it("accepts contract with all optional fields", () => {
    const result = createContractSchema.safeParse({
      vendorId: UUID,
      title: "Master Service Agreement",
      description: "Framework agreement for consulting",
      contractType: "master_agreement",
      contractNumber: "MSA-2026-001",
      effectiveDate: "2026-01-01",
      expirationDate: "2028-12-31",
      noticePeriodDays: 180,
      autoRenewal: true,
      renewalPeriodMonths: 12,
      totalValue: "500000.00",
      currency: "USD",
      annualValue: "166666.67",
      paymentTerms: "Net 30",
      documentId: UUID,
      ownerId: UUID,
      approverId: UUID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const result = createContractSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = createContractSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid contract types", () => {
    const types = [
      "master_agreement", "service_agreement", "nda", "dpa",
      "sla", "license", "maintenance", "consulting", "other",
    ];
    for (const contractType of types) {
      const result = createContractSchema.safeParse({ title: "Contract", contractType });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid contract type", () => {
    const result = createContractSchema.safeParse({
      title: "Contract",
      contractType: "purchase_order",
    });
    expect(result.success).toBe(false);
  });

  it("rejects currency not exactly 3 characters", () => {
    const result = createContractSchema.safeParse({
      title: "Contract",
      currency: "EU",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative noticePeriodDays", () => {
    const result = createContractSchema.safeParse({
      title: "Contract",
      noticePeriodDays: -30,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// contractStatusTransitionSchema
// ---------------------------------------------------------------------------

describe("contractStatusTransitionSchema", () => {
  it("accepts all valid contract statuses", () => {
    for (const s of ["draft", "negotiation", "pending_approval", "active", "renewal", "expired", "terminated", "archived"]) {
      const result = contractStatusTransitionSchema.safeParse({ status: s });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid contract status", () => {
    const result = contractStatusTransitionSchema.safeParse({ status: "signed" });
    expect(result.success).toBe(false);
  });

  it("rejects missing status", () => {
    const result = contractStatusTransitionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// VALID_CONTRACT_TRANSITIONS
// ---------------------------------------------------------------------------

describe("VALID_CONTRACT_TRANSITIONS", () => {
  it("allows draft -> negotiation", () => {
    expect(VALID_CONTRACT_TRANSITIONS["draft"]).toContain("negotiation");
  });

  it("allows pending_approval -> active", () => {
    expect(VALID_CONTRACT_TRANSITIONS["pending_approval"]).toContain("active");
  });

  it("allows active -> renewal", () => {
    expect(VALID_CONTRACT_TRANSITIONS["active"]).toContain("renewal");
  });

  it("allows active -> terminated", () => {
    expect(VALID_CONTRACT_TRANSITIONS["active"]).toContain("terminated");
  });

  it("allows expired -> renewal", () => {
    expect(VALID_CONTRACT_TRANSITIONS["expired"]).toContain("renewal");
  });

  it("does not allow archived to transition", () => {
    expect(VALID_CONTRACT_TRANSITIONS["archived"]).toEqual([]);
  });

  it("does not allow draft -> active directly", () => {
    expect(VALID_CONTRACT_TRANSITIONS["draft"]).not.toContain("active");
  });

  it("allows terminated -> archived", () => {
    expect(VALID_CONTRACT_TRANSITIONS["terminated"]).toContain("archived");
  });
});

// ---------------------------------------------------------------------------
// createSlaSchema
// ---------------------------------------------------------------------------

describe("createSlaSchema", () => {
  it("accepts valid SLA with required fields", () => {
    const result = createSlaSchema.safeParse({
      metricName: "Uptime",
      targetValue: "99.9",
      unit: "%",
      measurementFrequency: "monthly",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid SLA units", () => {
    for (const unit of ["%", "hours", "minutes", "days", "count"]) {
      const result = createSlaSchema.safeParse({
        metricName: "Metric",
        targetValue: "100",
        unit,
        measurementFrequency: "quarterly",
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all valid measurement frequencies", () => {
    for (const freq of ["monthly", "quarterly", "annually"]) {
      const result = createSlaSchema.safeParse({
        metricName: "Metric",
        targetValue: "95",
        unit: "%",
        measurementFrequency: freq,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects missing metricName", () => {
    const result = createSlaSchema.safeParse({
      targetValue: "99.9",
      unit: "%",
      measurementFrequency: "monthly",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty metricName", () => {
    const result = createSlaSchema.safeParse({
      metricName: "",
      targetValue: "99.9",
      unit: "%",
      measurementFrequency: "monthly",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty targetValue", () => {
    const result = createSlaSchema.safeParse({
      metricName: "Uptime",
      targetValue: "",
      unit: "%",
      measurementFrequency: "monthly",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid unit", () => {
    const result = createSlaSchema.safeParse({
      metricName: "Metric",
      targetValue: "10",
      unit: "seconds",
      measurementFrequency: "monthly",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid measurementFrequency", () => {
    const result = createSlaSchema.safeParse({
      metricName: "Metric",
      targetValue: "10",
      unit: "%",
      measurementFrequency: "weekly",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createSlaMeasurementSchema
// ---------------------------------------------------------------------------

describe("createSlaMeasurementSchema", () => {
  it("accepts valid measurement with required fields", () => {
    const result = createSlaMeasurementSchema.safeParse({
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      actualValue: "99.95",
    });
    expect(result.success).toBe(true);
  });

  it("applies default isBreach to false", () => {
    const result = createSlaMeasurementSchema.safeParse({
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      actualValue: "99.95",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isBreach).toBe(false);
    }
  });

  it("accepts measurement with optional fields", () => {
    const result = createSlaMeasurementSchema.safeParse({
      periodStart: "2026-02-01",
      periodEnd: "2026-02-28",
      actualValue: "98.5",
      isBreach: true,
      notes: "Downtime during maintenance window",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing periodStart", () => {
    const result = createSlaMeasurementSchema.safeParse({
      periodEnd: "2026-01-31",
      actualValue: "99.9",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing periodEnd", () => {
    const result = createSlaMeasurementSchema.safeParse({
      periodStart: "2026-01-01",
      actualValue: "99.9",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing actualValue", () => {
    const result = createSlaMeasurementSchema.safeParse({
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty actualValue", () => {
    const result = createSlaMeasurementSchema.safeParse({
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      actualValue: "",
    });
    expect(result.success).toBe(false);
  });
});
