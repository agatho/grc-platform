import { z } from "zod";

// Sprint 45: ESG Advanced — Zod Schemas

// ─── Materiality Assessment ─────────────────────────────────
export const createMaterialityAssessmentSchema = z.object({
  reportingPeriodYear: z.number().int().min(2020).max(2100),
  financialThreshold: z.object({
    scoreThreshold: z.number().int().min(0).max(100).default(50),
  }).optional(),
  impactThreshold: z.object({
    scoreThreshold: z.number().int().min(0).max(100).default(50),
  }).optional(),
});

export const updateMaterialityAssessmentSchema = createMaterialityAssessmentSchema.partial();

// ─── Materiality IRO ────────────────────────────────────────
export const ESRS_TOPICS = ["E1", "E2", "E3", "E4", "E5", "S1", "S2", "S3", "S4", "G1", "G2"] as const;

export const createIroSchema = z.object({
  esrsTopic: z.enum(ESRS_TOPICS),
  iroType: z.enum(["impact", "risk", "opportunity"]),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  affectedStakeholders: z.array(z.string().max(100)).max(10).optional(),
  valueChainStage: z.enum(["own_operations", "upstream", "downstream"]).optional(),
  timeHorizon: z.enum(["short_term", "medium_term", "long_term"]).optional(),
  financialMagnitude: z.enum(["low", "medium", "high", "very_high"]).optional(),
  financialLikelihood: z.enum(["remote", "possible", "likely", "very_likely"]).optional(),
  impactScale: z.enum(["limited", "moderate", "significant", "widespread"]).optional(),
  impactScope: z.enum(["limited", "moderate", "deep", "fundamental"]).optional(),
  impactIrremediable: z.enum(["reversible", "partially_reversible", "irremediable"]).optional(),
  isPositiveImpact: z.boolean().default(false),
  financialMaterialityScore: z.number().int().min(0).max(100).optional(),
  impactMaterialityScore: z.number().int().min(0).max(100).optional(),
});

export const updateIroSchema = createIroSchema.partial();

// ─── Stakeholder Engagement ─────────────────────────────────
export const createStakeholderEngagementSchema = z.object({
  stakeholderGroup: z.enum(["employees", "customers", "suppliers", "communities", "investors", "regulators", "ngos"]),
  engagementMethod: z.enum(["survey", "interview", "workshop", "panel", "written_consultation"]),
  keyConcerns: z.string().max(5000).optional(),
  participantCount: z.number().int().min(0).optional(),
  engagementDate: z.string().date().optional(),
  linkedIroIds: z.array(z.string().uuid()).max(50).optional(),
  evidenceDocumentId: z.string().uuid().optional(),
});

// ─── Emission Source ────────────────────────────────────────
export const createEmissionSourceSchema = z.object({
  scope: z.number().int().min(1).max(3),
  scope3Category: z.number().int().min(1).max(15).optional(),
  sourceName: z.string().min(1).max(500),
  sourceType: z.string().min(1).max(50),
  fuelType: z.string().max(100).optional(),
  facilityName: z.string().max(200).optional(),
});

export const updateEmissionSourceSchema = createEmissionSourceSchema.partial();

// ─── Emission Activity Data ─────────────────────────────────
export const createActivityDataSchema = z.object({
  sourceId: z.string().uuid(),
  reportingPeriodStart: z.string().date(),
  reportingPeriodEnd: z.string().date(),
  quantity: z.number().min(0),
  unit: z.enum(["kWh", "liters", "km", "kg", "EUR", "m3", "MWh", "GJ", "tonnes"]),
  dataQuality: z.enum(["measured", "calculated", "estimated"]),
  evidenceReference: z.string().max(2000).optional(),
  emissionFactorId: z.string().uuid().optional(),
  computationMethod: z.enum(["location_based", "market_based"]).optional(),
});

// ─── Custom Emission Factor ─────────────────────────────────
export const createCustomEmissionFactorSchema = z.object({
  activityType: z.string().min(1).max(100),
  fuelType: z.string().max(100).optional(),
  unit: z.string().min(1).max(50),
  co2eFactor: z.number().min(0),
  co2Factor: z.number().min(0).optional(),
  ch4Factor: z.number().min(0).optional(),
  n2oFactor: z.number().min(0).optional(),
  validYear: z.number().int().min(2000).max(2100),
  country: z.string().max(5).optional(),
});

// ─── Collection Campaign ────────────────────────────────────
export const createCollectionCampaignSchema = z.object({
  title: z.string().min(1).max(500),
  reportingPeriodStart: z.string().date(),
  reportingPeriodEnd: z.string().date(),
  deadline: z.string().date(),
});

export const updateCollectionCampaignSchema = createCollectionCampaignSchema.partial();

// ─── Collection Assignment ──────────────────────────────────
export const createCollectionAssignmentSchema = z.object({
  metricId: z.string().uuid(),
  assigneeId: z.string().uuid(),
  reviewerId: z.string().uuid().optional(),
  previousPeriodValue: z.number().optional(),
});

export const submitCollectionAssignmentSchema = z.object({
  submittedValue: z.number(),
  submittedUnit: z.string().max(50),
  submittedEvidence: z.string().max(5000).optional(),
  submittedNotes: z.string().max(2000).optional(),
});

export const reviewCollectionAssignmentSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().max(2000).optional(),
});

// ─── Supplier ESG Assessment ────────────────────────────────
export const createSupplierEsgAssessmentSchema = z.object({
  vendorId: z.string().uuid(),
  assessmentDate: z.string().date(),
  responses: z.record(z.unknown()).optional(),
});

export const classifySupplierRiskSchema = z.object({
  industryRiskFactor: z.number().min(0.1).max(5.0),
  geographicRiskFactor: z.number().min(0.1).max(5.0),
});

// ─── Supplier ESG Risk Classification ───────────────────────
export function classifySupplierEsgRisk(
  industryRisk: number,
  geographicRisk: number,
  overallScore: number,
): string {
  const riskScore = industryRisk * geographicRisk * (100 - overallScore);
  if (riskScore >= 500) return "critical";
  if (riskScore >= 200) return "high";
  if (riskScore >= 50) return "medium";
  return "low";
}

// ─── Corrective Action ──────────────────────────────────────
export const createCorrectiveActionSchema = z.object({
  assessmentId: z.string().uuid(),
  vendorId: z.string().uuid(),
  finding: z.string().min(1).max(5000),
  correctiveAction: z.string().min(1).max(5000),
  responsibleId: z.string().uuid().optional(),
  deadline: z.string().date().optional(),
  followUpDate: z.string().date().optional(),
});

export const updateCorrectiveActionSchema = z.object({
  status: z.enum(["open", "in_progress", "verified", "closed"]).optional(),
  verificationNotes: z.string().max(5000).optional(),
});

// ─── LkSG Due Diligence ────────────────────────────────────
export const createLksgDueDiligenceSchema = z.object({
  vendorId: z.string().uuid(),
  reportingYear: z.number().int().min(2020).max(2100),
});

export const updateLksgDueDiligenceSchema = z.object({
  riskAnalysisStatus: z.enum(["not_started", "in_progress", "completed"]).optional(),
  riskAnalysisDocumentId: z.string().uuid().optional(),
  preventiveMeasures: z.string().max(10000).optional(),
  remedialMeasures: z.string().max(10000).optional(),
  complaintsProcedureStatus: z.enum(["not_started", "in_progress", "completed"]).optional(),
  documentationStatus: z.enum(["complete", "incomplete"]).optional(),
});

// ─── ESRS Disclosure ────────────────────────────────────────
export const updateEsrsDisclosureSchema = z.object({
  content: z.string().max(100000).optional(),
  status: z.enum(["not_started", "in_progress", "draft", "reviewed", "final"]).optional(),
});
