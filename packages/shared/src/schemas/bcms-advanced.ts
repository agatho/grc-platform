import { z } from "zod";

// Sprint 41: BCMS Advanced — Crisis Communication, Exercise Management,
// Recovery Procedures, Resilience Score

// ─── Contact Trees ──────────────────────────────────────────
export const createContactTreeSchema = z.object({
  name: z.string().min(1).max(500),
  crisisType: z.enum(["it_crisis", "natural_disaster", "pandemic", "key_person", "supplier_failure", "generic"]),
  reviewCycleMonths: z.number().int().min(1).max(24).default(6),
});

export const createContactNodeSchema = z.object({
  treeId: z.string().uuid(),
  parentNodeId: z.string().uuid().optional(),
  roleTitle: z.string().min(1).max(200),
  userId: z.string().uuid().optional(),
  name: z.string().max(300).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  escalationMinutes: z.number().int().min(1).max(120).default(15),
  deputyUserId: z.string().uuid().optional(),
  deputyName: z.string().max(300).optional(),
  deputyPhone: z.string().max(50).optional(),
  deputyEmail: z.string().email().optional(),
});

// ─── Crisis Communication ───────────────────────────────────
export const triggerNotificationSchema = z.object({
  crisisId: z.string().uuid(),
  treeId: z.string().uuid(),
  messageTemplateKey: z.string().max(100).optional(),
  customMessage: z.string().max(5000).optional(),
  channels: z.array(z.enum(["email", "sms", "in_app"])).min(1),
});

// ─── Exercises ──────────────────────────────────────────────
export const createExerciseSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  exerciseType: z.enum(["tabletop", "walkthrough", "functional", "full_scale"]),
  scenarioId: z.string().uuid().optional(),
  customScenarioDescription: z.string().max(10000).optional(),
  scopeBcpIds: z.array(z.string().uuid()).optional(),
  participantIds: z.array(z.string().uuid()).optional(),
  scheduledDate: z.string().date(),
  objectives: z.array(z.object({
    objective: z.string().min(1).max(500),
    successCriteria: z.string().min(1).max(1000),
  })).min(1).max(10),
  facilitatorId: z.string().uuid().optional(),
});

export const logInjectResponseSchema = z.object({
  injectIndex: z.number().int().min(0),
  teamResponse: z.string().max(5000).optional(),
  observerNotes: z.string().max(5000).optional(),
  scores: z.object({
    timeliness: z.number().int().min(1).max(5),
    completeness: z.number().int().min(1).max(5),
    communication: z.number().int().min(1).max(5),
    decision: z.number().int().min(1).max(5),
  }).optional(),
});

export const createExerciseLessonSchema = z.object({
  lesson: z.string().min(1).max(5000),
  category: z.enum(["communication", "decision_making", "procedures", "technology", "coordination"]).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  improvementAction: z.string().max(5000).optional(),
  actionOwnerId: z.string().uuid().optional(),
  actionDeadline: z.string().date().optional(),
});

// ─── Recovery Procedures ────────────────────────────────────
export const createRecoveryProcedureSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  entityType: z.enum(["process", "asset", "architecture_element"]),
  entityId: z.string().uuid(),
  reviewCycleMonths: z.number().int().min(1).max(24).default(6),
  steps: z.array(z.object({
    title: z.string().min(1).max(500),
    description: z.string().max(10000).optional(),
    responsibleRole: z.string().max(100).optional(),
    estimatedDurationMinutes: z.number().int().min(1).optional(),
    requiredResources: z.string().max(2000).optional(),
    dependsOnStepIndex: z.number().int().optional(),
  })).min(1).max(50),
});

export const completeStepSchema = z.object({
  actualDurationMinutes: z.number().int().min(0).optional(),
  executionNotes: z.string().max(5000).optional(),
});

// ─── Resilience Score ───────────────────────────────────────
export interface ResilienceScoreFactors {
  biaCompleteness: number;
  bcpCurrency: number;
  exerciseCompletion: number;
  recoverCapability: number;
  communicationReadiness: number;
  procedureCompleteness: number;
  supplyChainResilience: number;
}

export const DEFAULT_RESILIENCE_WEIGHTS = {
  biaCompleteness: 20,
  bcpCurrency: 15,
  exerciseCompletion: 15,
  recoverCapability: 20,
  communicationReadiness: 10,
  procedureCompleteness: 10,
  supplyChainResilience: 10,
};

export function computeResilienceScore(
  factors: ResilienceScoreFactors,
  weights = DEFAULT_RESILIENCE_WEIGHTS,
): number {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const weighted =
    factors.biaCompleteness * weights.biaCompleteness +
    factors.bcpCurrency * weights.bcpCurrency +
    factors.exerciseCompletion * weights.exerciseCompletion +
    factors.recoverCapability * weights.recoverCapability +
    factors.communicationReadiness * weights.communicationReadiness +
    factors.procedureCompleteness * weights.procedureCompleteness +
    factors.supplyChainResilience * weights.supplyChainResilience;
  return Math.round(weighted / totalWeight);
}

// ─── Exercise Score ─────────────────────────────────────────
export function computeExerciseScore(
  scores: Array<{ timeliness: number; completeness: number; communication: number; decision: number }>,
): number {
  if (scores.length === 0) return 0;
  const avg = scores.reduce(
    (acc, s) => acc + (s.timeliness + s.completeness + s.communication + s.decision) / 4,
    0,
  ) / scores.length;
  return Math.round(avg * 20); // Scale 1-5 -> 0-100
}

// ─── BIA Scenario Simulation ────────────────────────────────
export const simulateScenarioSchema = z.object({
  elementId: z.string().uuid(),
  elementType: z.string().min(1).max(50),
});
