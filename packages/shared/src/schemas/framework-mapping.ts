import { z } from "zod";

// Sprint 66: Cross-Framework Auto-Mapping Engine Zod schemas

export const frameworkKeyValues = [
  "ISO27001", "NIS2", "BSI", "NIST_CSF", "SOC2",
  "TISAX", "DORA", "GDPR", "COBIT", "CIS",
] as const;

export const mappingRelationshipTypeValues = ["equal", "subset", "superset", "intersect", "not_related"] as const;

export const mappingSourceValues = ["nist_olir", "manual", "ai_suggested"] as const;

export const mappingRuleTypeValues = ["override", "addition", "exclusion"] as const;

export const coverageStatusValues = ["covered", "partially_covered", "not_covered", "not_applicable"] as const;

export const coverageSourceValues = ["direct_assessment", "mapped", "inherited", "manual"] as const;

export const evidenceStatusValues = ["fresh", "stale", "missing", "not_required"] as const;

export const assessmentResultValues = ["effective", "partially_effective", "ineffective"] as const;

export const riskExposureValues = ["critical", "high", "medium", "low"] as const;

// ─── Framework Mapping CRUD ─────────────────────────────────

export const createFrameworkMappingSchema = z.object({
  sourceFramework: z.string().min(1).max(50),
  sourceControlId: z.string().min(1).max(100),
  sourceControlTitle: z.string().max(500).optional(),
  targetFramework: z.string().min(1).max(50),
  targetControlId: z.string().min(1).max(100),
  targetControlTitle: z.string().max(500).optional(),
  relationshipType: z.enum(mappingRelationshipTypeValues),
  confidence: z.number().min(0).max(1).default(0.8),
  mappingSource: z.enum(mappingSourceValues).default("manual"),
  rationale: z.string().max(5000).optional(),
});

export const updateFrameworkMappingSchema = z.object({
  relationshipType: z.enum(mappingRelationshipTypeValues).optional(),
  confidence: z.number().min(0).max(1).optional(),
  rationale: z.string().max(5000).optional(),
  isVerified: z.boolean().optional(),
});

// ─── Mapping Rule CRUD ──────────────────────────────────────

export const createMappingRuleSchema = z.object({
  mappingId: z.string().uuid().optional(),
  sourceFramework: z.string().min(1).max(50),
  sourceControlId: z.string().min(1).max(100),
  targetFramework: z.string().min(1).max(50),
  targetControlId: z.string().min(1).max(100),
  ruleType: z.enum(mappingRuleTypeValues),
  confidence: z.number().min(0).max(1).optional(),
  rationale: z.string().max(5000).optional(),
});

// ─── Coverage CRUD ──────────────────────────────────────────

export const upsertCoverageSchema = z.object({
  controlId: z.string().uuid(),
  framework: z.string().min(1).max(50),
  frameworkControlId: z.string().min(1).max(100),
  coverageStatus: z.enum(coverageStatusValues),
  coverageSource: z.enum(coverageSourceValues),
  evidenceStatus: z.enum(evidenceStatusValues).default("missing"),
  assessmentResult: z.enum(assessmentResultValues).optional(),
  notes: z.string().max(5000).optional(),
});

// ─── Gap Analysis ───────────────────────────────────────────

export const triggerGapAnalysisSchema = z.object({
  framework: z.string().min(1).max(50),
});

export const bulkGapAnalysisSchema = z.object({
  frameworks: z.array(z.string().min(1).max(50)).min(1).max(15),
});

// ─── Query Schemas ──────────────────────────────────────────

export const frameworkMappingQuerySchema = z.object({
  sourceFramework: z.string().max(50).optional(),
  targetFramework: z.string().max(50).optional(),
  relationshipType: z.enum(mappingRelationshipTypeValues).optional(),
  isVerified: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const coverageQuerySchema = z.object({
  controlId: z.string().uuid().optional(),
  framework: z.string().max(50).optional(),
  coverageStatus: z.enum(coverageStatusValues).optional(),
  evidenceStatus: z.enum(evidenceStatusValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const gapAnalysisQuerySchema = z.object({
  framework: z.string().max(50).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
