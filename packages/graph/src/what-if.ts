// Sprint 29: What-If Scenario Engine — read-only projection, no actual mutations
import { getSubgraph } from "./traversal";
import { enrichGraphNodes } from "./enrichment";
import { analyzeImpact } from "./impact-analyzer";
import type {
  WhatIfResult,
  DeltaResult,
  AffectedEntity,
  GraphEdge,
  ImpactResult,
  ScenarioType,
} from "./types";
import { DEFAULT_GRAPH_DEPTH } from "./types";

/**
 * Scenario multipliers: how much removal/failure of entity amplifies impact.
 */
const SCENARIO_MULTIPLIERS: Record<ScenarioType, number> = {
  control_disabled: 1.5, // losing a control amplifies risk
  vendor_terminated: 1.3, // losing vendor affects assets
  asset_compromised: 2.0, // compromised asset = high ripple
  process_stopped: 1.4, // stopped process affects controls
};

/**
 * Run a what-if scenario simulation.
 * READ-ONLY: no actual changes to data. Pure projection.
 *
 * Simulates removing an entity and computes the cascading impact.
 */
export async function runWhatIf(
  orgId: string,
  entityId: string,
  entityType: string,
  scenario: ScenarioType,
  maxDepth: number = DEFAULT_GRAPH_DEPTH,
): Promise<WhatIfResult> {
  // 1. Get current impact (before scenario)
  const before = await analyzeImpact(orgId, entityId, entityType, { maxDepth });

  // 2. Apply scenario multiplier to simulate amplified impact
  const multiplier = SCENARIO_MULTIPLIERS[scenario];
  const after = applyScenarioMultiplier(before, multiplier);

  // 3. Compute the delta
  const delta = computeDelta(
    before,
    after,
    orgId,
    entityId,
    entityType,
    maxDepth,
  );

  return {
    scenario,
    entityId,
    before,
    after,
    delta: await delta,
  };
}

/**
 * Apply scenario multiplier to all impact scores (simulation, not mutation).
 */
function applyScenarioMultiplier(
  impact: ImpactResult,
  multiplier: number,
): ImpactResult {
  const amplifiedEntities: AffectedEntity[] = impact.affectedEntities.map(
    (entity) => ({
      ...entity,
      impactScore: Math.min(100, Math.round(entity.impactScore * multiplier)),
    }),
  );

  // Sort by new score
  amplifiedEntities.sort((a, b) => b.impactScore - a.impactScore);

  return {
    ...impact,
    affectedEntities: amplifiedEntities,
    totalImpactScore: amplifiedEntities.reduce(
      (sum, e) => sum + e.impactScore,
      0,
    ),
  };
}

/**
 * Compute delta between before and after scenarios.
 */
async function computeDelta(
  before: ImpactResult,
  after: ImpactResult,
  orgId: string,
  entityId: string,
  entityType: string,
  maxDepth: number,
): Promise<DeltaResult> {
  const beforeMap = new Map(
    before.affectedEntities.map((e) => [e.entityId, e]),
  );
  const afterMap = new Map(after.affectedEntities.map((e) => [e.entityId, e]));

  // Entities newly affected (above threshold after scenario)
  const newlyAffected: AffectedEntity[] = [];
  for (const [id, entity] of afterMap) {
    if (!beforeMap.has(id)) {
      newlyAffected.push(entity);
    }
  }

  // Entities with increased impact
  const increasedImpact: Array<{
    entityId: string;
    entityType: string;
    beforeScore: number;
    afterScore: number;
    delta: number;
  }> = [];

  for (const [id, afterEntity] of afterMap) {
    const beforeEntity = beforeMap.get(id);
    if (beforeEntity && afterEntity.impactScore > beforeEntity.impactScore) {
      increasedImpact.push({
        entityId: id,
        entityType: afterEntity.entityType,
        beforeScore: beforeEntity.impactScore,
        afterScore: afterEntity.impactScore,
        delta: afterEntity.impactScore - beforeEntity.impactScore,
      });
    }
  }

  // Compute severed edges: edges connected to the scenario entity
  const rawGraph = await getSubgraph(orgId, entityId, entityType, 1);
  const severedEdges: GraphEdge[] = rawGraph.edges.filter(
    (e) => e.sourceId === entityId || e.targetId === entityId,
  );

  return {
    newlyAffected,
    increasedImpact,
    severedEdges,
  };
}
