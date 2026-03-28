import { z } from "zod";

// Sprint 54: ERM UX & Evaluation Enhancement schemas

// ─── Risk Object Type ─────────────────────────────────────────

export const riskObjectTypeValues = ["risk", "mixed_case", "chance"] as const;
export const riskObjectTypeSchema = z.enum(riskObjectTypeValues);
export type RiskObjectType = z.infer<typeof riskObjectTypeSchema>;

// ─── Evaluation Phase ─────────────────────────────────────────

export const evaluationPhaseValues = [
  "assignment",
  "gross_evaluation",
  "net_evaluation",
  "approval",
  "active",
] as const;
export const evaluationPhaseSchema = z.enum(evaluationPhaseValues);
export type EvaluationPhase = z.infer<typeof evaluationPhaseSchema>;

// ─── Evaluation Cycle ─────────────────────────────────────────

export const evaluationCycleValues = [
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
] as const;
export const evaluationCycleSchema = z.enum(evaluationCycleValues);
export type EvaluationCycle = z.infer<typeof evaluationCycleSchema>;

// ─── Evaluation Type ──────────────────────────────────────────

export const evaluationTypeValues = ["qualitative", "quantitative"] as const;
export const evaluationTypeSchema = z.enum(evaluationTypeValues);
export type EvaluationType = z.infer<typeof evaluationTypeSchema>;

// ─── Phase Transition ─────────────────────────────────────────

export const phaseTransitionSchema = z.object({
  newPhase: evaluationPhaseSchema,
  justification: z.string().max(5000).optional(),
});
export type PhaseTransition = z.infer<typeof phaseTransitionSchema>;

// ─── Extended Risk Create ─────────────────────────────────────

export const moduleRelevanceSchema = z.object({
  ics: z.boolean().default(false),
  isms: z.boolean().default(false),
  esg: z.boolean().default(false),
  compliance: z.boolean().default(false),
  bcm: z.boolean().default(false),
});
export type ModuleRelevance = z.infer<typeof moduleRelevanceSchema>;

export const riskCreateExtendedSchema = z.object({
  risk_object_type: riskObjectTypeSchema.default("risk"),
  evaluation_type: evaluationTypeSchema.default("qualitative"),
  evaluation_cycle: evaluationCycleSchema.default("quarterly"),
  is_esg_relevant: z.boolean().default(false),
  module_relevance: moduleRelevanceSchema.default({}),
});
export type RiskCreateExtended = z.infer<typeof riskCreateExtendedSchema>;

// ─── Role Comment ─────────────────────────────────────────────

export const roleCommentFieldValues = [
  "comment_risk_owner",
  "comment_risk_manager",
  "comment_management",
] as const;

export const roleCommentSchema = z.object({
  field: z.enum(roleCommentFieldValues),
  value: z.string().max(5000),
});
export type RoleComment = z.infer<typeof roleCommentSchema>;

// ─── Management Summary ───────────────────────────────────────

export const managementSummaryRequestSchema = z.object({
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  language: z.enum(["de", "en"]).default("de"),
});
export type ManagementSummaryRequest = z.infer<typeof managementSummaryRequestSchema>;

// ─── Risk Treatment Link ──────────────────────────────────────

export const createRiskTreatmentLinkSchema = z.object({
  riskId: z.string().uuid(),
  treatmentId: z.string().uuid(),
});
export type CreateRiskTreatmentLink = z.infer<typeof createRiskTreatmentLinkSchema>;

// ─── Risk Value Colors ────────────────────────────────────────

export type RiskValueRange = "critical" | "high" | "medium" | "low" | "minimal" | "none";

export function getRiskValueRange(value: number | null | undefined): RiskValueRange {
  if (value == null || value === 0) return "none";
  if (value >= 81) return "critical";
  if (value >= 61) return "high";
  if (value >= 41) return "medium";
  if (value >= 21) return "low";
  return "minimal";
}

export function computeRiskValue(
  probabilityIndex: number | null | undefined,
  impactIndex: number | null | undefined,
): number | null {
  if (probabilityIndex == null || impactIndex == null) return null;
  return Math.min(100, probabilityIndex * impactIndex * 4);
}
