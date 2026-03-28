import { z } from "zod";

// Sprint 72: DORA Compliance Module Zod Schemas

// ─── ICT Risk ───────────────────────────────────────────────

export const createDoraIctRiskSchema = z.object({
  riskCode: z.string().min(1).max(30),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  doraArticleRef: z.string().max(50).optional(),
  ictAssetType: z.enum(["network", "hardware", "software", "data", "cloud_service", "third_party"]),
  threatCategory: z.enum(["cyber_attack", "system_failure", "human_error", "natural_disaster", "third_party_failure"]).optional(),
  vulnerabilityDescription: z.string().max(5000).optional(),
  likelihood: z.enum(["very_low", "low", "medium", "high", "very_high"]),
  impact: z.enum(["very_low", "low", "medium", "high", "very_high"]),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  residualRiskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  treatmentStrategy: z.enum(["mitigate", "accept", "transfer", "avoid"]).optional(),
  treatmentPlan: z.string().max(5000).optional(),
  existingControls: z.array(z.object({ controlId: z.string(), controlName: z.string(), effectiveness: z.string() })).max(50).optional(),
  affectedServices: z.array(z.object({ serviceId: z.string(), serviceName: z.string(), criticality: z.string() })).max(50).optional(),
  ownerId: z.string().uuid().optional(),
  reviewDate: z.string().optional(),
  status: z.enum(["identified", "assessed", "treated", "accepted", "closed"]).default("identified"),
});

export const updateDoraIctRiskSchema = createDoraIctRiskSchema.partial();

export const doraIctRiskQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["identified", "assessed", "treated", "accepted", "closed"]).optional(),
  ictAssetType: z.string().max(50).optional(),
});

// ─── TLPT Plan ──────────────────────────────────────────────

export const createDoraTlptPlanSchema = z.object({
  planCode: z.string().min(1).max(30),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  testType: z.enum(["red_team", "purple_team", "scenario_based", "full_tlpt"]),
  scope: z.string().max(5000).optional(),
  targetSystems: z.array(z.object({ systemId: z.string(), systemName: z.string(), criticality: z.string() })).max(50).optional(),
  threatScenarios: z.array(z.object({ scenario: z.string(), threatActor: z.string(), technique: z.string() })).max(50).optional(),
  testProvider: z.string().max(200).optional(),
  leaderId: z.string().uuid().optional(),
  plannedStartDate: z.string().optional(),
  plannedEndDate: z.string().optional(),
});

export const updateDoraTlptPlanSchema = createDoraTlptPlanSchema.partial().extend({
  status: z.enum(["draft", "planned", "in_progress", "completed", "remediation"]).optional(),
  findings: z.array(z.object({ severity: z.string(), description: z.string(), recommendation: z.string() })).max(100).optional(),
  findingsSummary: z.string().max(10000).optional(),
  regulatoryNotified: z.boolean().optional(),
});

export const doraTlptQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["draft", "planned", "in_progress", "completed", "remediation"]).optional(),
  testType: z.string().max(50).optional(),
});

// ─── ICT Incident ───────────────────────────────────────────

export const createDoraIctIncidentSchema = z.object({
  incidentCode: z.string().min(1).max(30),
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(10000),
  incidentType: z.enum(["cyber_attack", "system_outage", "data_breach", "third_party_failure", "operational_disruption"]),
  classification: z.enum(["major", "significant", "minor"]),
  affectedServices: z.array(z.record(z.unknown())).max(50).optional(),
  affectedClients: z.number().int().min(0).optional(),
  financialImpact: z.number().min(0).optional(),
  geographicScope: z.array(z.string().max(100)).max(50).optional(),
  detectedAt: z.string().datetime(),
  reportingAuthority: z.string().max(200).optional(),
  handlerId: z.string().uuid().optional(),
});

export const updateDoraIctIncidentSchema = z.object({
  status: z.enum(["detected", "investigating", "contained", "resolved", "closed"]).optional(),
  rootCause: z.string().max(5000).optional(),
  resolvedAt: z.string().datetime().optional(),
  initialReportSent: z.string().datetime().optional(),
  intermediateReportSent: z.string().datetime().optional(),
  finalReportSent: z.string().datetime().optional(),
  remediationActions: z.array(z.object({ action: z.string(), assignee: z.string(), deadline: z.string(), status: z.string() })).max(50).optional(),
  lessonsLearned: z.string().max(10000).optional(),
});

export const doraIctIncidentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  classification: z.enum(["major", "significant", "minor"]).optional(),
  status: z.enum(["detected", "investigating", "contained", "resolved", "closed"]).optional(),
  since: z.string().datetime().optional(),
});

// ─── ICT Provider ───────────────────────────────────────────

export const createDoraIctProviderSchema = z.object({
  providerCode: z.string().min(1).max(30),
  name: z.string().min(1).max(500),
  legalEntity: z.string().max(500).optional(),
  jurisdiction: z.string().max(100).optional(),
  serviceDescription: z.string().max(5000).optional(),
  serviceType: z.enum(["cloud", "software", "infrastructure", "network", "data_processing", "consulting"]),
  criticality: z.enum(["critical", "important", "standard"]),
  contractRef: z.string().max(200).optional(),
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  exitStrategy: z.string().max(5000).optional(),
  ownerId: z.string().uuid().optional(),
});

export const updateDoraIctProviderSchema = createDoraIctProviderSchema.partial().extend({
  complianceStatus: z.enum(["compliant", "partially_compliant", "non_compliant", "pending"]).optional(),
  status: z.enum(["active", "under_review", "terminated", "pending"]).optional(),
});

export const doraIctProviderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  criticality: z.enum(["critical", "important", "standard"]).optional(),
  status: z.enum(["active", "under_review", "terminated", "pending"]).optional(),
  complianceStatus: z.string().max(20).optional(),
});

// ─── Information Sharing ────────────────────────────────────

export const createDoraInfoSharingSchema = z.object({
  title: z.string().min(1).max(500),
  sharingType: z.enum(["threat_intelligence", "vulnerability", "incident_info", "best_practice"]),
  content: z.string().min(1).max(10000),
  classification: z.enum(["tlp_white", "tlp_green", "tlp_amber", "tlp_red"]),
  recipientGroups: z.array(z.object({ groupName: z.string(), contactEmails: z.array(z.string()) })).max(20).optional(),
  sourceIncidentId: z.string().uuid().optional(),
  anonymized: z.boolean().default(true),
});

export const updateDoraInfoSharingSchema = z.object({
  status: z.enum(["draft", "approved", "shared", "revoked"]),
});

// ─── NIS2 Cross-Reference ───────────────────────────────────

export const createDoraNis2CrossRefSchema = z.object({
  doraArticle: z.string().min(1).max(50),
  doraRequirement: z.string().min(1).max(5000),
  nis2Article: z.string().max(50).optional(),
  nis2Requirement: z.string().max(5000).optional(),
  overlapType: z.enum(["full_overlap", "partial_overlap", "dora_only", "nis2_only"]),
  complianceStatus: z.enum(["compliant", "partially_compliant", "non_compliant", "not_assessed"]).default("not_assessed"),
  notes: z.string().max(5000).optional(),
});

export const updateDoraNis2CrossRefSchema = createDoraNis2CrossRefSchema.partial();

export const doraNis2QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  overlapType: z.enum(["full_overlap", "partial_overlap", "dora_only", "nis2_only"]).optional(),
  complianceStatus: z.string().max(20).optional(),
});
