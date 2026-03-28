import { z } from "zod";

// Sprint 76: Certification und Audit Prep Wizard Zod Schemas

// ─── Readiness Assessment ───────────────────────────────────

export const createCertReadinessSchema = z.object({
  assessmentCode: z.string().min(1).max(30),
  title: z.string().min(1).max(500),
  framework: z.enum(["iso_27001", "bsi_grundschutz", "nis2", "soc2_type2", "tisax", "iso_22301", "iso_9001"]),
  frameworkVersion: z.string().max(50).optional(),
  scope: z.string().max(5000).optional(),
  targetCertDate: z.string().optional(),
  leadAssessorId: z.string().uuid().optional(),
});

export const updateCertReadinessSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  scope: z.string().max(5000).optional(),
  targetCertDate: z.string().optional(),
  controlDetails: z.array(z.object({
    controlRef: z.string(), title: z.string(), status: z.string(), gaps: z.string().optional(), evidence: z.string().optional(), priority: z.string().optional(),
  })).max(500).optional(),
  gapAnalysis: z.array(z.object({
    area: z.string(), gap: z.string(), severity: z.string(), recommendation: z.string(), effort: z.string().optional(),
  })).max(200).optional(),
  timeline: z.array(z.object({
    phase: z.string(), startDate: z.string(), endDate: z.string(), tasks: z.array(z.string()).max(50), status: z.string(),
  })).max(20).optional(),
  risks: z.array(z.object({ risk: z.string(), impact: z.string(), mitigation: z.string() })).max(50).optional(),
  status: z.enum(["draft", "in_progress", "completed", "approved", "expired"]).optional(),
});

export const certReadinessQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  framework: z.enum(["iso_27001", "bsi_grundschutz", "nis2", "soc2_type2", "tisax", "iso_22301", "iso_9001"]).optional(),
  status: z.enum(["draft", "in_progress", "completed", "approved", "expired"]).optional(),
});

// ─── Evidence Package ───────────────────────────────────────

export const createCertEvidencePackageSchema = z.object({
  assessmentId: z.string().uuid().optional(),
  packageCode: z.string().min(1).max(30),
  title: z.string().min(1).max(500),
  framework: z.enum(["iso_27001", "bsi_grundschutz", "nis2", "soc2_type2", "tisax", "iso_22301", "iso_9001"]),
  controlRefs: z.array(z.string().max(50)).max(200).optional(),
});

export const updateCertEvidencePackageSchema = z.object({
  evidenceItems: z.array(z.object({
    documentId: z.string(), title: z.string(), type: z.string(), controlRef: z.string(), uploadedAt: z.string(), status: z.string(),
  })).max(500).optional(),
  exportFormat: z.enum(["pdf", "zip", "xlsx"]).optional(),
  status: z.enum(["draft", "generating", "complete", "submitted"]).optional(),
});

export const certEvidenceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  framework: z.enum(["iso_27001", "bsi_grundschutz", "nis2", "soc2_type2", "tisax", "iso_22301", "iso_9001"]).optional(),
  assessmentId: z.string().uuid().optional(),
  status: z.enum(["draft", "generating", "complete", "submitted"]).optional(),
});

// ─── Mock Audit ─────────────────────────────────────────────

export const createCertMockAuditSchema = z.object({
  assessmentId: z.string().uuid().optional(),
  auditCode: z.string().min(1).max(30),
  title: z.string().min(1).max(500),
  framework: z.enum(["iso_27001", "bsi_grundschutz", "nis2", "soc2_type2", "tisax", "iso_22301", "iso_9001"]),
  auditType: z.enum(["stage_1", "stage_2", "surveillance", "recertification"]),
  scope: z.string().max(5000).optional(),
});

export const updateCertMockAuditSchema = z.object({
  responses: z.array(z.object({
    questionIndex: z.number().int(), response: z.string(), aiScore: z.number().optional(), aiFeedback: z.string().optional(), evidence: z.string().optional(),
  })).max(200).optional(),
  status: z.enum(["draft", "in_progress", "completed", "reviewed"]).optional(),
});

export const certMockAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  framework: z.enum(["iso_27001", "bsi_grundschutz", "nis2", "soc2_type2", "tisax", "iso_22301", "iso_9001"]).optional(),
  auditType: z.enum(["stage_1", "stage_2", "surveillance", "recertification"]).optional(),
  status: z.enum(["draft", "in_progress", "completed", "reviewed"]).optional(),
});
