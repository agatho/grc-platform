import { z } from "zod";

// Sprint 76: Certification und Audit Prep Wizard Zod Schemas
// Extended in 2026-04 Focus Session: now covers 26 international frameworks.
// Single source of truth for the framework enum so adding a framework only
// requires touching this file (and the Drizzle column comment).

export const CERT_FRAMEWORK_VALUES = [
  // Core ISMS
  "iso_27001",
  "iso_27002",
  "bsi_grundschutz",
  "bsi_c5_2020",
  "nis2",
  "soc2_type2",
  "isae3402_soc2",
  "tisax",
  "iso_22301",
  "iso_9001",
  // ISO 27k extensions
  "iso_27017_2015",
  "iso_27018_2019",
  "iso_27019_2017",
  "iso_27701_2019",
  // Cloud / Industry
  "csa_ccm_v4",
  "iec_62443",
  "swift_cscf_v2024",
  "pci_dss_v4",
  // US Federal / DoD
  "nist_800_53_r5",
  "nist_800_171",
  "cmmc_v2",
  // Privacy / AI / Sector
  "hipaa_security",
  "iso_42001_2023",
  "eu_cra_2024",
  "eu_dora",
  "eu_ai_act",
] as const;

const certFrameworkEnum = z.enum(CERT_FRAMEWORK_VALUES);

const readinessStatusEnum = z.enum([
  "draft",
  "in_progress",
  "completed",
  "approved",
  "expired",
]);
const evidenceStatusEnum = z.enum([
  "draft",
  "generating",
  "complete",
  "submitted",
]);
const mockAuditTypeEnum = z.enum([
  "stage_1",
  "stage_2",
  "surveillance",
  "recertification",
]);
const mockAuditStatusEnum = z.enum([
  "draft",
  "in_progress",
  "completed",
  "reviewed",
]);

// ─── Readiness Assessment ───────────────────────────────────

export const createCertReadinessSchema = z.object({
  assessmentCode: z.string().min(1).max(30),
  title: z.string().min(1).max(500),
  framework: certFrameworkEnum,
  frameworkVersion: z.string().max(50).optional(),
  scope: z.string().max(5000).optional(),
  targetCertDate: z.string().optional(),
  leadAssessorId: z.string().uuid().optional(),
});

export const updateCertReadinessSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  scope: z.string().max(5000).optional(),
  targetCertDate: z.string().optional(),
  controlDetails: z
    .array(
      z.object({
        controlRef: z.string(),
        title: z.string(),
        status: z.string(),
        gaps: z.string().optional(),
        evidence: z.string().optional(),
        priority: z.string().optional(),
      }),
    )
    .max(500)
    .optional(),
  gapAnalysis: z
    .array(
      z.object({
        area: z.string(),
        gap: z.string(),
        severity: z.string(),
        recommendation: z.string(),
        effort: z.string().optional(),
      }),
    )
    .max(200)
    .optional(),
  timeline: z
    .array(
      z.object({
        phase: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        tasks: z.array(z.string()).max(50),
        status: z.string(),
      }),
    )
    .max(20)
    .optional(),
  risks: z
    .array(
      z.object({
        risk: z.string(),
        impact: z.string(),
        mitigation: z.string(),
      }),
    )
    .max(50)
    .optional(),
  status: readinessStatusEnum.optional(),
});

export const certReadinessQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  framework: certFrameworkEnum.optional(),
  status: readinessStatusEnum.optional(),
});

// ─── Evidence Package ───────────────────────────────────────

export const createCertEvidencePackageSchema = z.object({
  assessmentId: z.string().uuid().optional(),
  packageCode: z.string().min(1).max(30),
  title: z.string().min(1).max(500),
  framework: certFrameworkEnum,
  controlRefs: z.array(z.string().max(50)).max(200).optional(),
});

export const updateCertEvidencePackageSchema = z.object({
  evidenceItems: z
    .array(
      z.object({
        documentId: z.string(),
        title: z.string(),
        type: z.string(),
        controlRef: z.string(),
        uploadedAt: z.string(),
        status: z.string(),
      }),
    )
    .max(500)
    .optional(),
  exportFormat: z.enum(["pdf", "zip", "xlsx"]).optional(),
  status: evidenceStatusEnum.optional(),
});

export const certEvidenceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  framework: certFrameworkEnum.optional(),
  assessmentId: z.string().uuid().optional(),
  status: evidenceStatusEnum.optional(),
});

// ─── Mock Audit ─────────────────────────────────────────────

export const createCertMockAuditSchema = z.object({
  assessmentId: z.string().uuid().optional(),
  auditCode: z.string().min(1).max(30),
  title: z.string().min(1).max(500),
  framework: certFrameworkEnum,
  auditType: mockAuditTypeEnum,
  scope: z.string().max(5000).optional(),
});

export const updateCertMockAuditSchema = z.object({
  responses: z
    .array(
      z.object({
        questionIndex: z.number().int(),
        response: z.string(),
        aiScore: z.number().optional(),
        aiFeedback: z.string().optional(),
        evidence: z.string().optional(),
      }),
    )
    .max(200)
    .optional(),
  status: mockAuditStatusEnum.optional(),
});

export const certMockAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  framework: certFrameworkEnum.optional(),
  auditType: mockAuditTypeEnum.optional(),
  status: mockAuditStatusEnum.optional(),
});
