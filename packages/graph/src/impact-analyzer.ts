// Sprint 29: Impact Analysis Engine — distance-based impact decay
import { getSubgraph, findShortestPath, findCriticalPaths } from "./traversal";
import { enrichGraphNodes, getEntityName } from "./enrichment";
import type { ImpactResult, AffectedEntity, GraphResult } from "./types";
import {
  RELATIONSHIP_WEIGHTS,
  DEFAULT_GRAPH_DEPTH,
  MAX_GRAPH_DEPTH,
  IMPACT_DECAY_FACTOR,
  IMPACT_NOISE_THRESHOLD,
} from "./types";

/**
 * Run impact analysis for an entity.
 * Computes all transitively affected entities with exponential impact decay.
 *
 * Formula: impactScore = baseImpact * couplingWeight * 0.6^(hopDistance - 1)
 */
export async function analyzeImpact(
  orgId: string,
  entityId: string,
  entityType: string,
  options: { maxDepth?: number } = {},
): Promise<ImpactResult> {
  const maxDepth = Math.min(
    options.maxDepth ?? DEFAULT_GRAPH_DEPTH,
    MAX_GRAPH_DEPTH,
  );

  // 1. Get subgraph around entity
  const rawGraph = await getSubgraph(orgId, entityId, entityType, maxDepth);
  const graph = await enrichGraphNodes(rawGraph);

  // 2. Compute impact for each reachable node
  const affected: AffectedEntity[] = [];

  for (const node of graph.nodes) {
    if (node.id === entityId) continue;

    const shortestPath = findShortestPath(graph, entityId, node.id);
    if (shortestPath.length < 2) continue; // unreachable

    const hopDistance = shortestPath.length - 1;

    // Compute base impact from relationship weights along the path
    const baseImpact = computePathWeight(graph, shortestPath);

    // Exponential decay per hop: 60% retention
    const decayFactor = Math.pow(IMPACT_DECAY_FACTOR, hopDistance - 1);
    const impactScore = Math.round(baseImpact * decayFactor);

    if (impactScore > IMPACT_NOISE_THRESHOLD) {
      affected.push({
        entityId: node.id,
        entityType: node.type,
        entityName: node.name,
        hopDistance,
        impactScore,
        path: shortestPath,
      });
    }
  }

  // Sort by impact score descending
  affected.sort((a, b) => b.impactScore - a.impactScore);

  // 3. Find critical paths (articulation points)
  const criticalPaths = findCriticalPaths(graph, entityId);

  // 4. Get source entity name
  const sourceName =
    graph.nodes.find((n) => n.id === entityId)?.name ??
    (await getEntityName(entityType, entityId));

  return {
    sourceEntity: { id: entityId, type: entityType, name: sourceName },
    affectedEntities: affected,
    totalImpactScore: affected.reduce((sum, e) => sum + e.impactScore, 0),
    criticalPaths,
    maxDepth,
  };
}

/**
 * Compute the maximum relationship weight along a path.
 */
function computePathWeight(graph: GraphResult, path: string[]): number {
  let maxWeight = 40; // fallback

  for (let i = 0; i < path.length - 1; i++) {
    const fromId = path[i];
    const toId = path[i + 1];

    // Find the edge between these two nodes
    const edge = graph.edges.find(
      (e) =>
        (e.sourceId === fromId && e.targetId === toId) ||
        (e.sourceId === toId && e.targetId === fromId),
    );

    if (edge) {
      const weight =
        edge.weight || RELATIONSHIP_WEIGHTS[edge.relationship] || 40;
      maxWeight = Math.max(maxWeight, weight);
    }
  }

  return maxWeight;
}
