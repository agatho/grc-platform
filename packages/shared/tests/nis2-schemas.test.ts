// Unit tests for Sprint 24: NIS2 Zod validation schemas

import { describe, it, expect } from "vitest";
import {
  createNis2IncidentReportSchema,
  updateNis2IncidentReportSchema,
  createCertSnapshotSchema,
  certSnapshotQuerySchema,
  nis2ReportQuerySchema,
  nis2ReportType,
  nis2ReportStatus,
  nis2RequirementStatus,
  NIS2_NOTIFICATION_DEADLINES,
  NIS2_CHAPTERS,
  CERT_READINESS_CHECKS,
} from "../src/schemas/nis2-certification";

// ──────────────────────────────────────────────────────────────
// createNis2IncidentReportSchema
// ──────────────────────────────────────────────────────────────

describe("createNis2IncidentReportSchema", () => {
  it("accepts valid data", () => {
    const result = createNis2IncidentReportSchema.safeParse({
      incidentId: "a0b1c2d3-e4f5-6789-abcd-ef0123456789",
      reportType: "early_warning",
      deadlineAt: "2026-03-28T10:00:00.000Z",
      contactPerson: "Max Mustermann",
      contactEmail: "max@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid report type", () => {
    const result = createNis2IncidentReportSchema.safeParse({
      incidentId: "a0b1c2d3-e4f5-6789-abcd-ef0123456789",
      reportType: "invalid_type",
      deadlineAt: "2026-03-28T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = createNis2IncidentReportSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID for incidentId", () => {
    const result = createNis2IncidentReportSchema.safeParse({
      incidentId: "not-a-uuid",
      reportType: "early_warning",
      deadlineAt: "2026-03-28T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = createNis2IncidentReportSchema.safeParse({
      incidentId: "a0b1c2d3-e4f5-6789-abcd-ef0123456789",
      reportType: "early_warning",
      deadlineAt: "2026-03-28T10:00:00.000Z",
      contactEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid report types", () => {
    const types = ["early_warning", "full_notification", "intermediate_report", "final_report"];
    for (const reportType of types) {
      const result = createNis2IncidentReportSchema.safeParse({
        incidentId: "a0b1c2d3-e4f5-6789-abcd-ef0123456789",
        reportType,
        deadlineAt: "2026-03-28T10:00:00.000Z",
      });
      expect(result.success).toBe(true);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// updateNis2IncidentReportSchema
// ──────────────────────────────────────────────────────────────

describe("updateNis2IncidentReportSchema", () => {
  it("accepts partial update", () => {
    const result = updateNis2IncidentReportSchema.safeParse({
      status: "submitted",
      bsiReference: "BSI-2026-001",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = updateNis2IncidentReportSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = updateNis2IncidentReportSchema.safeParse({
      status: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// createCertSnapshotSchema
// ──────────────────────────────────────────────────────────────

describe("createCertSnapshotSchema", () => {
  it("accepts valid framework", () => {
    const result = createCertSnapshotSchema.safeParse({
      framework: "iso27001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty framework", () => {
    const result = createCertSnapshotSchema.safeParse({
      framework: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing framework", () => {
    const result = createCertSnapshotSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// Enum schemas
// ──────────────────────────────────────────────────────────────

describe("nis2ReportType", () => {
  it("validates all report types", () => {
    expect(nis2ReportType.safeParse("early_warning").success).toBe(true);
    expect(nis2ReportType.safeParse("full_notification").success).toBe(true);
    expect(nis2ReportType.safeParse("intermediate_report").success).toBe(true);
    expect(nis2ReportType.safeParse("final_report").success).toBe(true);
  });

  it("rejects invalid type", () => {
    expect(nis2ReportType.safeParse("invalid").success).toBe(false);
  });
});

describe("nis2ReportStatus", () => {
  it("validates all statuses", () => {
    expect(nis2ReportStatus.safeParse("draft").success).toBe(true);
    expect(nis2ReportStatus.safeParse("submitted").success).toBe(true);
    expect(nis2ReportStatus.safeParse("acknowledged").success).toBe(true);
    expect(nis2ReportStatus.safeParse("rejected").success).toBe(true);
  });
});

describe("nis2RequirementStatus", () => {
  it("validates all statuses", () => {
    expect(nis2RequirementStatus.safeParse("compliant").success).toBe(true);
    expect(nis2RequirementStatus.safeParse("partially_compliant").success).toBe(true);
    expect(nis2RequirementStatus.safeParse("non_compliant").success).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────

describe("NIS2_NOTIFICATION_DEADLINES", () => {
  it("has correct deadline hours", () => {
    expect(NIS2_NOTIFICATION_DEADLINES.early_warning).toBe(24);
    expect(NIS2_NOTIFICATION_DEADLINES.full_notification).toBe(72);
    expect(NIS2_NOTIFICATION_DEADLINES.final_report).toBe(720);
  });
});

describe("NIS2_CHAPTERS", () => {
  it("has 10 chapters", () => {
    expect(Object.keys(NIS2_CHAPTERS)).toHaveLength(10);
  });

  it("each chapter has DE and EN labels", () => {
    for (const [key, value] of Object.entries(NIS2_CHAPTERS)) {
      expect(value.de).toBeTruthy();
      expect(value.en).toBeTruthy();
    }
  });
});

describe("CERT_READINESS_CHECKS", () => {
  it("has 10 checks", () => {
    expect(CERT_READINESS_CHECKS).toHaveLength(10);
  });

  it("each check has required fields", () => {
    for (const check of CERT_READINESS_CHECKS) {
      expect(check.id).toBeTruthy();
      expect(check.labelDE).toBeTruthy();
      expect(check.labelEN).toBeTruthy();
      expect(check.category).toBeTruthy();
    }
  });

  it("check IDs are unique", () => {
    const ids = CERT_READINESS_CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ──────────────────────────────────────────────────────────────
// Query schemas
// ──────────────────────────────────────────────────────────────

describe("certSnapshotQuerySchema", () => {
  it("applies defaults", () => {
    const result = certSnapshotQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(25);
    }
  });

  it("accepts framework filter", () => {
    const result = certSnapshotQuerySchema.safeParse({
      framework: "iso27001",
      page: "2",
      pageSize: "10",
    });
    expect(result.success).toBe(true);
  });
});

describe("nis2ReportQuerySchema", () => {
  it("applies defaults", () => {
    const result = nis2ReportQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(25);
    }
  });

  it("accepts all filters", () => {
    const result = nis2ReportQuerySchema.safeParse({
      incidentId: "a0b1c2d3-e4f5-6789-abcd-ef0123456789",
      reportType: "early_warning",
      status: "draft",
    });
    expect(result.success).toBe(true);
  });
});
