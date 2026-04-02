import { z } from "zod";

// Sprint 34: ABAC + Simulation + DMN Zod Schemas

// ──────────────────────────────────────────────────────────────
// ABAC
// ──────────────────────────────────────────────────────────────

export const abacConditionSchema = z.object({
  attribute: z.string().min(1).max(100),
  operator: z.enum(["=", "!=", "contains", "not_contains", "in", "not_in", "starts_with", "gt", "lt"]),
  value: z.union([z.string(), z.array(z.string()), z.number()]),
});

export const createAbacPolicySchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  entityType: z.string().min(1).max(50),
  subjectCondition: abacConditionSchema,
  objectCondition: abacConditionSchema,
  accessLevel: z.enum(["read", "write", "none"]),
  priority: z.number().int().min(1).max(9999).default(100),
  isActive: z.boolean().default(true),
});

export const updateAbacPolicySchema = createAbacPolicySchema.partial();

export const abacTestSchema = z.object({
  userId: z.string().uuid(),
  entityType: z.string().min(1).max(50),
  entityId: z.string().uuid().optional(),
  accessLevel: z.enum(["read", "write"]),
});

// ──────────────────────────────────────────────────────────────
// Simulation
// ──────────────────────────────────────────────────────────────

export const simulationResourceSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  capacity: z.number().int().min(1).max(1000),
  costPerHour: z.number().min(0),
});

export const createAbacSimulationScenarioSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  caseCount: z.number().int().min(10).max(100000).default(1000),
  timePeriodDays: z.number().int().min(1).max(365).default(30),
  resourceConfig: z.array(simulationResourceSchema).max(50).default([]),
});

export const updateAbacSimulationScenarioSchema = createAbacSimulationScenarioSchema.partial();

export const simulationActivityParamSchema = z.object({
  activityId: z.string().min(1).max(200),
  activityName: z.string().max(500).optional(),
  durationMin: z.number().min(0),
  durationMostLikely: z.number().min(0),
  durationMax: z.number().min(0),
  costPerExecution: z.number().min(0).default(0),
  resourceId: z.string().max(200).optional(),
  gatewayProbabilities: z.record(z.number().min(0).max(1)).optional(),
}).refine(
  (d) => d.durationMin <= d.durationMostLikely && d.durationMostLikely <= d.durationMax,
  { message: "Duration must satisfy: min <= most_likely <= max" },
);

export const bulkActivityParamsSchema = z.object({
  params: z.array(simulationActivityParamSchema).min(1).max(100),
});

// ──────────────────────────────────────────────────────────────
// DMN
// ──────────────────────────────────────────────────────────────

export const dmnColumnSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  type: z.enum(["string", "number", "boolean", "date"]),
  description: z.string().max(500).optional(),
});

export const createDmnDecisionSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  dmnXml: z.string().min(1).max(500000),
  linkedProcessStepId: z.string().uuid().optional(),
  status: z.enum(["draft", "active", "deprecated"]).default("draft"),
  inputSchema: z.array(dmnColumnSchema).max(50).default([]),
  outputSchema: z.array(dmnColumnSchema).max(50).default([]),
  hitPolicy: z.enum(["UNIQUE", "FIRST", "COLLECT", "RULE_ORDER", "ANY"]).default("UNIQUE"),
});

export const updateDmnDecisionSchema = createDmnDecisionSchema.partial();

export const dmnEvaluateSchema = z.object({
  inputs: z.record(z.unknown()),
});

export const dmnBatchTestSchema = z.object({
  testCases: z.array(z.object({
    inputs: z.record(z.unknown()),
    expectedOutputs: z.record(z.unknown()).optional(),
  })).min(1).max(100),
});
