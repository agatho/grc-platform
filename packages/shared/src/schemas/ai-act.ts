import { z } from "zod";

// Sprint 73: EU AI Act Governance Module Zod Schemas

// ─── AI System ──────────────────────────────────────────────

export const createAiSystemSchema = z.object({
  systemCode: z.string().min(1).max(30),
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  purpose: z.string().max(5000).optional(),
  aiTechnique: z.enum(["machine_learning", "deep_learning", "nlp", "computer_vision", "expert_system", "generative_ai"]).optional(),
  riskClassification: z.enum(["unacceptable", "high", "limited", "minimal"]),
  riskJustification: z.string().max(5000).optional(),
  annexCategory: z.enum(["annex_i", "annex_ii", "annex_iii", "annex_iv", "none"]).optional(),
  providerOrDeployer: z.enum(["provider", "deployer", "both"]),
  providerName: z.string().max(500).optional(),
  providerJurisdiction: z.string().max(100).optional(),
  deploymentDate: z.string().optional(),
  humanOversightRequired: z.boolean().default(false),
  ownerId: z.string().uuid().optional(),
});

export const updateAiSystemSchema = createAiSystemSchema.partial().extend({
  status: z.enum(["draft", "registered", "under_review", "compliant", "non_compliant", "decommissioned"]).optional(),
  trainingData: z.record(z.unknown()).optional(),
  inputData: z.record(z.unknown()).optional(),
  outputData: z.record(z.unknown()).optional(),
  affectedPersons: z.array(z.object({ category: z.string(), count: z.number(), vulnerableGroup: z.boolean() })).max(50).optional(),
  technicalDocumentation: z.record(z.unknown()).optional(),
  transparencyObligations: z.array(z.string()).max(20).optional(),
});

export const aiSystemQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  riskClassification: z.enum(["unacceptable", "high", "limited", "minimal"]).optional(),
  status: z.enum(["draft", "registered", "under_review", "compliant", "non_compliant", "decommissioned"]).optional(),
  providerOrDeployer: z.enum(["provider", "deployer", "both"]).optional(),
});

// ─── Conformity Assessment ──────────────────────────────────

export const createAiConformityAssessmentSchema = z.object({
  aiSystemId: z.string().uuid(),
  assessmentCode: z.string().min(1).max(30),
  assessmentType: z.enum(["self_assessment", "third_party", "notified_body"]),
  assessorName: z.string().max(500).optional(),
  requirements: z.array(z.object({
    requirementId: z.string(), description: z.string(), status: z.string(), evidence: z.string().optional(), notes: z.string().optional(),
  })).max(100).optional(),
});

export const updateAiConformityAssessmentSchema = z.object({
  overallResult: z.enum(["pass", "fail", "conditional", "pending"]).optional(),
  findings: z.array(z.object({ severity: z.string(), description: z.string(), recommendation: z.string() })).max(100).optional(),
  certificateRef: z.string().max(200).optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  status: z.enum(["draft", "in_progress", "completed", "expired"]).optional(),
  requirements: z.array(z.object({
    requirementId: z.string(), description: z.string(), status: z.string(), evidence: z.string().optional(), notes: z.string().optional(),
  })).max(100).optional(),
});

export const aiConformityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  aiSystemId: z.string().uuid().optional(),
  overallResult: z.enum(["pass", "fail", "conditional", "pending"]).optional(),
  status: z.enum(["draft", "in_progress", "completed", "expired"]).optional(),
});

// ─── Human Oversight Log ────────────────────────────────────

export const createAiOversightLogSchema = z.object({
  aiSystemId: z.string().uuid(),
  logType: z.enum(["decision_override", "intervention", "monitoring_check", "bias_review", "performance_review"]),
  description: z.string().min(1).max(5000),
  aiDecision: z.string().max(5000).optional(),
  humanDecision: z.string().max(5000).optional(),
  overrideReason: z.string().max(5000).optional(),
  affectedCount: z.number().int().min(0).optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  reviewedAt: z.string().datetime(),
});

export const aiOversightLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  aiSystemId: z.string().uuid().optional(),
  logType: z.enum(["decision_override", "intervention", "monitoring_check", "bias_review", "performance_review"]).optional(),
  since: z.string().datetime().optional(),
});

// ─── Transparency Entry ─────────────────────────────────────

export const createAiTransparencyEntrySchema = z.object({
  aiSystemId: z.string().uuid(),
  entryType: z.enum(["eu_database_registration", "public_disclosure", "user_notification", "marking_labeling"]),
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(10000),
  publicUrl: z.string().url().max(2000).optional(),
  registrationRef: z.string().max(200).optional(),
});

export const updateAiTransparencyEntrySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(10000).optional(),
  publicUrl: z.string().url().max(2000).optional(),
  status: z.enum(["draft", "published", "updated", "withdrawn"]).optional(),
});

// ─── FRIA ───────────────────────────────────────────────────

export const createAiFriaSchema = z.object({
  aiSystemId: z.string().uuid(),
  assessmentCode: z.string().min(1).max(30),
  rightsAssessed: z.array(z.object({ right: z.string(), impact: z.string(), mitigation: z.string(), residualRisk: z.string() })).max(50).optional(),
  overallImpact: z.enum(["high", "medium", "low", "negligible"]),
  mitigationPlan: z.string().max(10000).optional(),
});

export const updateAiFriaSchema = z.object({
  rightsAssessed: z.array(z.object({ right: z.string(), impact: z.string(), mitigation: z.string(), residualRisk: z.string() })).max(50).optional(),
  discriminationRisk: z.record(z.unknown()).optional(),
  dataProtectionImpact: z.record(z.unknown()).optional(),
  accessToJustice: z.record(z.unknown()).optional(),
  overallImpact: z.enum(["high", "medium", "low", "negligible"]).optional(),
  mitigationPlan: z.string().max(10000).optional(),
  consultationResults: z.array(z.object({ stakeholder: z.string(), feedback: z.string(), incorporated: z.boolean() })).max(50).optional(),
  status: z.enum(["draft", "in_progress", "completed", "approved"]).optional(),
});

// ─── Framework Mapping ──────────────────────────────────────

export const createAiFrameworkMappingSchema = z.object({
  framework: z.enum(["iso_42001", "nist_ai_rmf", "eu_ai_act"]),
  controlRef: z.string().min(1).max(100),
  controlTitle: z.string().min(1).max(500),
  aiActArticle: z.string().max(100).optional(),
  implementationStatus: z.enum(["not_started", "in_progress", "implemented", "not_applicable"]).default("not_started"),
  evidence: z.array(z.record(z.unknown())).max(20).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateAiFrameworkMappingSchema = createAiFrameworkMappingSchema.partial();

export const aiFrameworkMappingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  framework: z.enum(["iso_42001", "nist_ai_rmf", "eu_ai_act"]).optional(),
  implementationStatus: z.enum(["not_started", "in_progress", "implemented", "not_applicable"]).optional(),
});
