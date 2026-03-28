import { z } from "zod";

// Sprint 44: TPRM Advanced — Zod Schemas

// ─── Scorecard Weights ──────────────────────────────────────
export const DEFAULT_SCORECARD_WEIGHTS = {
  due_diligence: 0.20,
  sla_compliance: 0.15,
  incident_history: 0.15,
  financial_stability: 0.10,
  esg_rating: 0.10,
  contract_compliance: 0.15,
  security_posture: 0.15,
};

export const updateScorecardWeightsSchema = z.object({
  weights: z.record(z.number().min(0).max(1)).refine(
    (w) => {
      const sum = Object.values(w).reduce((a, b) => a + b, 0);
      return Math.abs(sum - 1.0) < 0.001;
    },
    { message: "Weights must sum to 1.0" },
  ),
});

// ─── Scorecard Tier Classification ──────────────────────────
export function classifyVendorTier(score: number): string {
  if (score >= 85) return "strategic";
  if (score >= 70) return "preferred";
  if (score >= 50) return "approved";
  if (score >= 30) return "under_review";
  return "exit_candidate";
}

// ─── HHI Computation ────────────────────────────────────────
export function computeHHI(vendorSpend: Array<{ vendorId: string; spend: number }>): number {
  const totalSpend = vendorSpend.reduce((sum, v) => sum + v.spend, 0);
  if (totalSpend === 0) return 0;
  const hhi = vendorSpend.reduce((sum, v) => {
    const share = (v.spend / totalSpend) * 100;
    return sum + share * share;
  }, 0);
  return Math.round(hhi);
}

export function classifyHHI(hhi: number): string {
  if (hhi < 1500) return "low";
  if (hhi <= 2500) return "moderate";
  return "high";
}

// ─── Exit Readiness Score ───────────────────────────────────
export function computeExitReadiness(data: {
  hasExitPlan: boolean;
  exitPlanCurrent: boolean;
  alternativeIdentified: boolean;
  dataPortabilityConfirmed: boolean;
  exitClauseAdequate: boolean;
}): number {
  let score = 0;
  if (data.hasExitPlan) score += 20;
  if (data.exitPlanCurrent) score += 20;
  if (data.alternativeIdentified) score += 20;
  if (data.dataPortabilityConfirmed) score += 20;
  if (data.exitClauseAdequate) score += 20;
  return score;
}

// ─── SLA Definition ─────────────────────────────────────────
export const createSlaDefinitionSchema = z.object({
  vendorId: z.string().uuid(),
  contractId: z.string().uuid().optional(),
  metricName: z.string().min(1).max(200),
  metricType: z.enum(["availability", "response_time", "resolution_time", "delivery_time", "quality", "custom"]),
  targetValue: z.number(),
  unit: z.enum(["percent", "hours", "minutes", "days", "count"]),
  measurementPeriod: z.enum(["monthly", "quarterly", "annually"]),
  penaltyClause: z.string().max(5000).optional(),
  evidenceSource: z.string().max(2000).optional(),
});

export const updateSlaDefinitionSchema = createSlaDefinitionSchema.partial();

// ─── SLA Measurement ────────────────────────────────────────
export const createSlaMeasurementSchema = z.object({
  slaDefinitionId: z.string().uuid(),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  actualValue: z.number(),
  evidence: z.string().max(5000).optional(),
  notes: z.string().max(2000).optional(),
});

// ─── SLA Met Computation ────────────────────────────────────
export function computeSlaMet(
  metricType: string,
  actualValue: number,
  targetValue: number,
): boolean {
  // Availability, quality: higher-is-better
  if (["availability", "quality"].includes(metricType)) {
    return actualValue >= targetValue;
  }
  // Response time, resolution time, delivery time: lower-is-better
  return actualValue <= targetValue;
}

export function computeBreachSeverity(
  actualValue: number,
  targetValue: number,
  isMet: boolean,
): string | null {
  if (isMet) return null;
  const deviation = Math.abs(actualValue - targetValue) / targetValue;
  if (deviation <= 0.05) return "minor";
  if (deviation <= 0.15) return "major";
  return "critical";
}

// ─── Exit Plan ──────────────────────────────────────────────
export const createExitPlanSchema = z.object({
  transitionApproach: z.enum(["in_house", "alternative_vendor", "hybrid", "decommission"]),
  dataMigrationPlan: z.string().max(10000).optional(),
  knowledgeTransferRequirements: z.string().max(10000).optional(),
  terminationNoticeDays: z.number().int().min(0).max(730).optional(),
  estimatedTimelineMonths: z.number().int().min(1).max(60).optional(),
  estimatedCost: z.number().min(0).optional(),
  alternativeVendorIds: z.array(z.string().uuid()).max(10).optional(),
  keyRisks: z.string().max(10000).optional(),
  reviewCycleMonths: z.number().int().min(3).max(24).default(12),
});

export const updateExitPlanSchema = createExitPlanSchema.partial();

// ─── Sub-Processor ──────────────────────────────────────────
export const createSubProcessorSchema = z.object({
  name: z.string().min(1).max(500),
  serviceDescription: z.string().max(5000).optional(),
  dataCategories: z.array(z.string().max(100)).max(20).optional(),
  hostingCountry: z.string().max(5).optional(),
  dateAdded: z.string().date().optional(),
});

export const updateSubProcessorSchema = createSubProcessorSchema.partial();

// ─── Sub-Processor Notification ─────────────────────────────
export const createSubProcessorNotificationSchema = z.object({
  vendorId: z.string().uuid(),
  notificationType: z.enum(["add", "remove", "change"]),
  subProcessorName: z.string().min(1).max(500),
  changeDescription: z.string().max(5000).optional(),
  receivedAt: z.string().date(),
  reviewDeadline: z.string().date().optional(),
});

export const reviewSubProcessorNotificationSchema = z.object({
  reviewStatus: z.enum(["approved", "rejected", "escalated"]),
  rejectionReason: z.string().max(5000).optional(),
});
