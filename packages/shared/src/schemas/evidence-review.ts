import { z } from "zod";

// Sprint 68: AI Evidence Review Agent Zod Schemas

// ─── Evidence Review Job ─────────────────────────────────────

export const createEvidenceReviewJobSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  scope: z.enum(["all", "control", "framework", "custom"]).default("all"),
  scopeFilter: z
    .object({
      controlIds: z.array(z.string().uuid()).max(100).optional(),
      frameworkIds: z.array(z.string().uuid()).max(50).optional(),
      evidenceIds: z.array(z.string().uuid()).max(100).optional(),
    })
    .optional(),
});

export const evidenceReviewJobQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(["pending", "running", "completed", "failed", "cancelled"])
    .optional(),
});

// ─── Evidence Review Result ──────────────────────────────────

export const evidenceReviewResultQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  classification: z
    .enum(["compliant", "partially_compliant", "non_compliant", "inconclusive"])
    .optional(),
  controlId: z.string().uuid().optional(),
  minConfidence: z.coerce.number().min(0).max(100).optional(),
});

// ─── Evidence Review Gap ─────────────────────────────────────

export const evidenceReviewGapQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  status: z
    .enum(["open", "acknowledged", "remediated", "false_positive"])
    .optional(),
  gapType: z
    .enum(["missing_evidence", "outdated", "incomplete", "quality_issue"])
    .optional(),
});

export const updateEvidenceReviewGapSchema = z.object({
  status: z.enum(["acknowledged", "remediated", "false_positive"]),
});

// ─── Batch Operations ────────────────────────────────────────

export const batchAcknowledgeGapsSchema = z.object({
  gapIds: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(["acknowledged", "false_positive"]),
});
