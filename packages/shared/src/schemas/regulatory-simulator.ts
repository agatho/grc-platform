import { z } from "zod";

// Sprint 31: Regulatory Simulator + Attack Path Visualization Zod schemas

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const simulationScenarioTypeValues = [
  "add_requirement",
  "tighten",
  "shorten_deadline",
  "add_reporting",
] as const;

// ──────────────────────────────────────────────────────────────
// Simulation Schemas
// ──────────────────────────────────────────────────────────────

export const runRegulatorySimulationSchema = z.object({
  regulationName: z.string().min(1).max(200),
  scenarioType: z.enum(simulationScenarioTypeValues),
  parameters: z.record(z.unknown()),
});

export const simulationGapSchema = z.object({
  requirement: z.string().max(1000),
  missingControl: z.string().max(500),
  effort: z.enum(["S", "M", "L", "XL"]),
  estimatedCost: z.number().min(0),
});

export const timelineMilestoneSchema = z.object({
  milestone: z.string().max(500),
  deadline: z.string().max(50),
  status: z.enum(["pending", "in_progress", "completed"]),
});

export const simulationCompareSchema = z.object({
  ids: z.array(z.string().uuid()).length(2),
});

// ──────────────────────────────────────────────────────────────
// Attack Path Schemas
// ──────────────────────────────────────────────────────────────

export const computeAttackPathsSchema = z.object({
  maxDepth: z.number().int().min(1).max(20).optional().default(10),
  minRiskScore: z.number().min(0).max(100).optional(),
});

export const attackPathCompareSchema = z.object({
  beforeBatchId: z.string().uuid(),
  afterBatchId: z.string().uuid(),
});
