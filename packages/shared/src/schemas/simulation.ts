import { z } from "zod";

// Sprint 85: Simulation und Scenario Engine — Zod schemas

export const simulationTypeValues = [
  "what_if",
  "bpm_cost_time",
  "business_impact",
  "monte_carlo",
  "supplier_cascade",
  "custom",
] as const;

export const simulationStatusValues = [
  "draft",
  "configuring",
  "running",
  "completed",
  "failed",
  "archived",
] as const;

export const simulationScenarioTagValues = [
  "as_is",
  "to_be_a",
  "to_be_b",
  "to_be_c",
  "best_case",
  "worst_case",
  "most_likely",
] as const;

// ──────────────────────────────────────────────────────────────
// Scenario CRUD
// ──────────────────────────────────────────────────────────────

export const createSimulationScenarioSchema = z.object({
  simulationType: z.enum(simulationTypeValues),
  name: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  tag: z.enum(simulationScenarioTagValues).default("as_is"),
  inputParametersJson: z.record(z.unknown()).default({}),
  assumptionsJson: z.array(z.string().max(2000)).max(50).default([]),
  sourceEntityType: z.string().max(100).optional(),
  sourceEntityId: z.string().uuid().optional(),
});

export const updateSimulationScenarioSchema =
  createSimulationScenarioSchema.partial();

export const listSimulationScenariosQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  simulationType: z.enum(simulationTypeValues).optional(),
  tag: z.enum(simulationScenarioTagValues).optional(),
  status: z.enum(simulationStatusValues).optional(),
});

// ──────────────────────────────────────────────────────────────
// Run Simulation
// ──────────────────────────────────────────────────────────────

export const startSimulationRunSchema = z.object({
  scenarioId: z.string().uuid(),
  iterations: z.number().int().min(100).max(1000000).default(10000),
  confidenceLevel: z.number().min(50).max(99.99).default(95),
});

// ──────────────────────────────────────────────────────────────
// Parameters
// ──────────────────────────────────────────────────────────────

export const createSimulationParameterSchema = z.object({
  scenarioId: z.string().uuid(),
  parameterKey: z.string().min(1).max(200),
  displayName: z.string().min(1).max(300),
  parameterType: z
    .enum(["number", "percentage", "currency", "duration"])
    .default("number"),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  defaultValue: z.number().optional(),
  distribution: z
    .enum(["normal", "uniform", "triangular", "lognormal", "pert"])
    .default("normal"),
  unit: z.string().max(50).optional(),
});

export const bulkCreateParametersSchema = z.object({
  scenarioId: z.string().uuid(),
  parameters: z
    .array(createSimulationParameterSchema.omit({ scenarioId: true }))
    .max(100),
});

// ──────────────────────────────────────────────────────────────
// Comparison
// ──────────────────────────────────────────────────────────────

export const createSimulationComparisonSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  scenarioIds: z.array(z.string().uuid()).min(2).max(10),
  comparisonMetrics: z.array(z.string().max(200)).max(20).default([]),
});

export const updateSimulationComparisonSchema =
  createSimulationComparisonSchema.partial();

// ──────────────────────────────────────────────────────────────
// Type exports
// ──────────────────────────────────────────────────────────────

export type CreateSimulationScenarioInput = z.infer<
  typeof createSimulationScenarioSchema
>;
export type StartSimulationRunInput = z.infer<typeof startSimulationRunSchema>;
export type CreateSimulationParameterInput = z.infer<
  typeof createSimulationParameterSchema
>;
export type CreateSimulationComparisonInput = z.infer<
  typeof createSimulationComparisonSchema
>;
