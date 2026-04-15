import { z } from "zod";

// ─── TCFD Climate Risk Scenarios ───────────────────────────

export const createClimateRiskScenarioSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  scenario_type: z.enum(["physical", "transition"]),
  risk_category: z.string().min(1).max(50),
  temperature_pathway: z.enum(["1.5", "2.0", "3.0", "4.0"]),
  time_horizon: z.enum(["short", "medium", "long"]),
  likelihood_score: z.number().int().min(1).max(5).optional(),
  impact_score: z.number().int().min(1).max(5).optional(),
  financial_impact_min: z.number().min(0).optional(),
  financial_impact_max: z.number().min(0).optional(),
  financial_impact_currency: z.string().max(3).default("EUR"),
  affected_assets: z.string().max(5000).optional(),
  affected_business_lines: z.array(z.string()).max(50).optional(),
  geographic_scope: z.string().max(200).optional(),
  adaptation_measures: z.string().max(10000).optional(),
  mitigation_strategy: z.string().max(10000).optional(),
  residual_risk_score: z.number().int().min(1).max(5).optional(),
  tcfd_category: z.enum(["governance", "strategy", "risk_management", "metrics_targets"]).optional(),
  esrs_disclosure: z.string().max(20).optional(),
  sbti_relevance: z.boolean().default(false),
});

export const updateClimateRiskScenarioSchema = createClimateRiskScenarioSchema.partial().extend({
  status: z.enum(["draft", "identified", "assessed", "mitigated", "closed"]).optional(),
});

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

// ─── Authority Communication ───────────────────────────────

export const createAiAuthorityCommunicationSchema = z.object({
  authority_name: z.string().min(1).max(500),
  subject: z.string().min(1).max(1000),
  direction: z.enum(["inbound", "outbound"]),
  communication_date: z.string().optional(),
  response_deadline: z.string().optional(),
  content: z.string().max(10000).optional(),
  ai_system_id: z.string().uuid().optional(),
});

export const updateAiAuthorityCommunicationSchema = createAiAuthorityCommunicationSchema.partial().extend({
  status: z.enum(["open", "in_progress", "responded", "closed"]).optional(),
});

// ─── Corrective Action ─────────────────────────────────────

export const createAiCorrectiveActionSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  ai_system_id: z.string().uuid().optional(),
  action_type: z.enum(["corrective", "preventive", "recall", "withdrawal", "modification"]),
  priority: z.enum(["critical", "high", "medium", "low"]),
  due_date: z.string().optional(),
  is_recall: z.boolean().default(false),
  is_withdrawal: z.boolean().default(false),
});

export const updateAiCorrectiveActionSchema = createAiCorrectiveActionSchema.partial().extend({
  non_conformity_description: z.string().max(5000).optional(),
  recall_reason: z.string().max(5000).optional(),
  assigned_to: z.string().uuid().optional(),
  status: z.enum(["open", "in_progress", "completed", "verified", "closed"]).optional(),
  authority_notified: z.boolean().optional(),
  authority_notified_at: z.string().optional(),
  authority_reference: z.string().max(200).optional(),
  verification_notes: z.string().max(5000).optional(),
  effectiveness_rating: z.number().int().min(1).max(5).optional(),
});

// ─── GPAI Model ────────────────────────────────────────────

export const createAiGpaiModelSchema = z.object({
  name: z.string().min(1).max(500),
  provider: z.string().min(1).max(500),
  model_type: z.enum(["foundation", "fine_tuned", "general_purpose", "specialized"]).default("foundation"),
  is_systemic_risk: z.boolean().default(false),
  training_data_summary: z.string().max(10000).optional(),
  energy_consumption_kwh: z.number().min(0).optional(),
  version: z.string().max(50).default("1.0"),
});

export const updateAiGpaiModelSchema = createAiGpaiModelSchema.partial().extend({
  systemic_risk_justification: z.string().max(5000).optional(),
  status: z.enum(["draft", "registered", "active", "deprecated", "withdrawn"]).optional(),
  capabilities_summary: z.string().max(10000).optional(),
  limitations_summary: z.string().max(10000).optional(),
  intended_use: z.string().max(5000).optional(),
  computational_resources: z.string().max(5000).optional(),
  cybersecurity_measures: z.string().max(5000).optional(),
  eu_representative_name: z.string().max(500).optional(),
  eu_representative_contact: z.string().max(500).optional(),
  code_of_practice_adherence: z.boolean().optional(),
  code_of_practice_notes: z.string().max(5000).optional(),
});

// ─── AI Incident ───────────────────────────────────────────

export const createAiIncidentSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  ai_system_id: z.string().uuid().optional(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  is_serious: z.boolean().default(false),
});

export const updateAiIncidentSchema = createAiIncidentSchema.partial().extend({
  status: z.enum(["detected", "investigating", "mitigated", "resolved", "closed"]).optional(),
  affected_persons_count: z.number().int().min(0).optional(),
  root_cause: z.string().max(5000).optional(),
  root_cause_category: z.string().max(200).optional(),
  remediation_actions: z.string().max(10000).optional(),
  preventive_measures: z.string().max(10000).optional(),
  lessons_learned: z.string().max(10000).optional(),
  harm_type: z.string().max(200).optional(),
  harm_description: z.string().max(5000).optional(),
  authority_notified_at: z.string().optional(),
  authority_reference: z.string().max(200).optional(),
});

// ─── Penalty ───────────────────────────────────────────────

export const createAiPenaltySchema = z.object({
  authority: z.string().min(1).max(500),
  penalty_type: z.enum(["fine", "warning", "ban", "corrective_order", "other"]),
  fine_amount: z.number().min(0).default(0),
  fine_currency: z.string().max(3).default("EUR"),
  article_reference: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  ai_system_id: z.string().uuid().optional(),
  appeal_status: z.enum(["none", "filed", "pending", "decided"]).default("none"),
});

// ─── Prohibited Screening ──────────────────────────────────

export const createAiProhibitedScreeningSchema = z.object({
  ai_system_id: z.string().uuid(),
  social_scoring: z.boolean().default(false),
  real_time_biometric: z.boolean().default(false),
  emotion_recognition: z.boolean().default(false),
  predictive_policing: z.boolean().default(false),
  untargeted_scraping: z.boolean().default(false),
  subliminal_manipulation: z.boolean().default(false),
  exploiting_vulnerabilities: z.boolean().default(false),
  biometric_categorization: z.boolean().default(false),
});

// ─── Provider QMS ──────────────────────────────────────────

export const createAiProviderQmsSchema = z.object({
  ai_system_id: z.string().uuid(),
  risk_management_procedure: z.boolean().default(false),
  data_governance_procedure: z.boolean().default(false),
  technical_documentation_procedure: z.boolean().default(false),
  record_keeping_procedure: z.boolean().default(false),
  transparency_procedure: z.boolean().default(false),
  human_oversight_procedure: z.boolean().default(false),
  accuracy_procedure: z.boolean().default(false),
  cybersecurity_procedure: z.boolean().default(false),
  conformity_procedure: z.boolean().default(false),
  post_market_procedure: z.boolean().default(false),
  overall_maturity: z.number().int().min(0).max(5).default(0),
  next_audit_date: z.string().optional(),
});
