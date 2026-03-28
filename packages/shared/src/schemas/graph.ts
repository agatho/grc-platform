import { z } from "zod";

// Sprint 29: Knowledge Graph + Impact Analysis Zod schemas

const graphEntityTypeValues = [
  "risk", "control", "process", "process_step", "asset", "vendor",
  "contract", "document", "finding", "incident", "audit", "kri",
  "bcp", "ropa_entry", "dpia",
] as const;

const graphRelationshipValues = [
  "mitigates", "linked_to", "depends_on", "owned_by", "documented_in",
  "tested_by", "assessed_in", "affects", "implemented_in", "found_in",
  "bound_by", "affected",
] as const;

const graphScenarioValues = [
  "control_disabled", "vendor_terminated", "asset_compromised", "process_stopped",
] as const;

const graphLayoutValues = [
  "force", "hierarchical", "radial", "circular",
] as const;

// ─── Subgraph Query ────────────────────────────────────────

export const graphSubgraphQuerySchema = z.object({
  entityId: z.string().uuid(),
  entityType: z.enum(graphEntityTypeValues),
  depth: z.coerce.number().int().min(1).max(5).default(3),
  entityTypes: z.string().optional().transform((val) =>
    val ? val.split(",").filter((t) => graphEntityTypeValues.includes(t as typeof graphEntityTypeValues[number])) : undefined
  ),
  relationshipTypes: z.string().optional().transform((val) =>
    val ? val.split(",").filter((t) => graphRelationshipValues.includes(t as typeof graphRelationshipValues[number])) : undefined
  ),
  minWeight: z.coerce.number().int().min(0).max(100).optional(),
});

// ─── Impact Analysis ───────────────────────────────────────

export const graphImpactBodySchema = z.object({
  entityId: z.string().uuid(),
  entityType: z.enum(graphEntityTypeValues),
  maxDepth: z.number().int().min(1).max(5).default(3),
});

// ─── What-If Scenario ──────────────────────────────────────

export const graphWhatIfBodySchema = z.object({
  entityId: z.string().uuid(),
  entityType: z.enum(graphEntityTypeValues),
  scenario: z.enum(graphScenarioValues),
  maxDepth: z.number().int().min(1).max(5).default(3),
});

// ─── Stats ─────────────────────────────────────────────────

export const graphStatsQuerySchema = z.object({}).optional();

// ─── Hubs ──────────────────────────────────────────────────

export const graphHubsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Dependency Matrix ─────────────────────────────────────

export const graphDependencyMatrixQuerySchema = z.object({}).optional();

// ─── Search ────────────────────────────────────────────────

export const graphSearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Re-export enums for UI consumption
export {
  graphEntityTypeValues,
  graphRelationshipValues,
  graphScenarioValues,
  graphLayoutValues,
};
