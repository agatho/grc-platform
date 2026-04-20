import { z } from "zod";

// Sprint 39: ERM Advanced — Bow-Tie, Treatment Tracking, Interconnections, Emerging Risks, Risk Events

// ─── Bow-Tie ────────────────────────────────────────────────
export const bowtieElementSchema = z.object({
  type: z.enum(["cause", "consequence", "barrier"]),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  controlId: z.string().uuid().optional(),
  effectiveness: z.enum(["effective", "degraded", "failed"]).optional(),
  likelihood: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const bowtiePathSchema = z.object({
  sourceElementId: z.string().uuid(),
  targetElementId: z.string().uuid(),
  barrierIds: z.array(z.string().uuid()).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const saveBowtieSchema = z.object({
  elements: z.array(bowtieElementSchema).max(50),
  paths: z.array(bowtiePathSchema).max(100),
});

// ─── Treatment Milestones ───────────────────────────────────
export const createMilestoneSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  deadline: z.string().date(),
  responsibleId: z.string().uuid().optional(),
  plannedEffortHours: z.number().min(0).optional(),
  dependsOnMilestoneId: z.string().uuid().optional(),
});

export const updateMilestoneSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  deadline: z.string().date().optional(),
  responsibleId: z.string().uuid().optional(),
  status: z
    .enum(["planned", "in_progress", "completed", "overdue", "cancelled"])
    .optional(),
  percentComplete: z.number().int().min(0).max(100).optional(),
  actualEffortHours: z.number().min(0).optional(),
});

// ─── Risk Interconnections ──────────────────────────────────
export const createInterconnectionSchema = z.object({
  sourceRiskId: z.string().uuid(),
  targetRiskId: z.string().uuid(),
  correlationType: z.enum([
    "amplifies",
    "triggers",
    "shares_cause",
    "shares_consequence",
  ]),
  strength: z.enum(["weak", "moderate", "strong"]),
  direction: z
    .enum(["unidirectional", "bidirectional"])
    .default("unidirectional"),
  description: z.string().max(5000).optional(),
});

export const cascadeSimulationSchema = z.object({
  riskId: z.string().uuid(),
  depth: z.number().int().min(1).max(5).default(3),
});

// ─── Emerging Risks ─────────────────────────────────────────
export const createEmergingRiskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  category: z.string().min(1).max(50),
  timeHorizon: z.enum(["1y", "3y", "5y", "10y"]),
  potentialImpact: z.enum([
    "low",
    "moderate",
    "significant",
    "critical",
    "catastrophic",
  ]),
  probabilityTrend: z.enum(["increasing", "stable", "decreasing"]),
  monitoringTriggers: z.string().max(5000).optional(),
  responsibleId: z.string().uuid().optional(),
  nextReviewDate: z.string().date().optional(),
});

export const updateEmergingRiskSchema = createEmergingRiskSchema
  .partial()
  .extend({
    status: z
      .enum([
        "monitoring",
        "escalating",
        "materializing",
        "promoted",
        "archived",
      ])
      .optional(),
  });

// ─── Risk Events ────────────────────────────────────────────
export const createRiskEventSchema = z.object({
  riskId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  eventDate: z.string().date(),
  eventType: z.enum(["materialized", "near_miss"]),
  actualImpactEur: z.number().min(0).optional(),
  actualImpactQualitative: z
    .enum(["low", "moderate", "significant", "critical", "catastrophic"])
    .optional(),
  affectedEntities: z
    .array(
      z.object({
        type: z.string(),
        id: z.string().uuid(),
        name: z.string(),
      }),
    )
    .optional(),
  rootCause: z.string().max(5000).optional(),
  responseActions: z.string().max(5000).optional(),
  durationDays: z.number().int().min(0).optional(),
  category: z.string().max(50).optional(),
});

export const createRiskEventLessonSchema = z.object({
  lesson: z.string().min(1).max(5000),
  category: z.string().max(50).optional(),
  linkedRiskIds: z.array(z.string().uuid()).optional(),
  linkedControlIds: z.array(z.string().uuid()).optional(),
});
