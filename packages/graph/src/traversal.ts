// Sprint 29: Recursive CTE graph traversal with cycle detection
import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import type { GraphResult, GraphEdge, GraphNode, RawTraversalRow } from "./types";
import { MAX_GRAPH_DEPTH, DEFAULT_GRAPH_DEPTH } from "./types";

/**
 * Get a subgraph around a starting entity using PostgreSQL recursive CTE.
 * Cycle detection via path array prevents infinite loops.
 * Max depth enforced server-side (capped at 5).
 */
export async function getSubgraph(
  orgId: string,
  startEntityId: string,
  startEntityType: string,
  maxDepth: number = DEFAULT_GRAPH_DEPTH,
  options: {
    entityTypes?: string[];
    relationshipTypes?: string[];
    minWeight?: number;
  } = {},
): Promise<GraphResult> {
  const effectiveDepth = Math.min(Math.max(1, maxDepth), MAX_GRAPH_DEPTH);

  const rows = await db.execute(sql`
    WITH RECURSIVE graph AS (
      -- Base case: all edges connected to start entity
      SELECT
        er.id::text as edge_id,
        er.source_id::text as source_id,
        er.source_type,
        er.target_id::text as target_id,
        er.target_type,
        er.relationship,
        er.weight,
        1 as depth,
        ARRAY[er.source_id::text || ':' || er.target_id::text] as path
      FROM entity_reference er
      WHERE er.org_id = ${orgId}::uuid
        AND (
          (er.source_id = ${startEntityId}::uuid AND er.source_type = ${startEntityType})
          OR
          (er.target_id = ${startEntityId}::uuid AND er.target_type = ${startEntityType})
        )

      UNION ALL

      -- Recursive case: traverse outward from discovered nodes
      SELECT
        er.id::text as edge_id,
        er.source_id::text as source_id,
        er.source_type,
        er.target_id::text as target_id,
        er.target_type,
        er.relationship,
        er.weight,
        g.depth + 1,
        g.path || (er.source_id::text || ':' || er.target_id::text)
      FROM entity_reference er
      JOIN graph g ON (
        (er.source_id::text = g.target_id AND er.source_id::text != ${startEntityId})
        OR (er.target_id::text = g.source_id AND er.target_id::text != ${startEntityId})
        OR (er.source_id::text = g.source_id AND er.source_id::text != ${startEntityId} AND g.depth = 1)
        OR (er.target_id::text = g.target_id AND er.target_id::text != ${startEntityId} AND g.depth = 1)
      )
      WHERE er.org_id = ${orgId}::uuid
        AND g.depth < ${effectiveDepth}
        -- Cycle detection: skip if this edge already in path
        AND NOT (er.source_id::text || ':' || er.target_id::text) = ANY(g.path)
    )
    SELECT DISTINCT ON (edge_id)
      edge_id, source_id, source_type, target_id, target_type,
      relationship, weight, depth, path
    FROM graph
    ORDER BY edge_id, depth ASC
  `);

  return buildGraphResult(rows as unknown as RawTraversalRow[], startEntityId, startEntityType, effectiveDepth, options);

}

/**
 * Get all edges in an org (for full graph stats). Limited to 5000.
 */
export async function getAllEdges(
  orgId: string,
  limit: number = 5000,
): Promise<{ sourceId: string; sourceType: string; targetId: string; targetType: string; relationship: string; weight: number }[]> {
  const rows = await db.execute(sql`
    SELECT
      source_id::text as source_id,
      source_type,
      target_id::text as target_id,
      target_type,
      relationship,
      weight
    FROM entity_reference
    WHERE org_id = ${orgId}::uuid
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
  return rows as unknown as { sourceId: string; sourceType: string; targetId: string; targetType: string; relationship: string; weight: number }[];
}

/**
 * Find shortest path between two entities using BFS on the subgraph.
 */
export function findShortestPath(
  graph: GraphResult,
  fromId: string,
  toId: string,
): string[] {
  if (fromId === toId) return [fromId];

  const adjacency = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.sourceId)) adjacency.set(edge.sourceId, new Set());
    if (!adjacency.has(edge.targetId)) adjacency.set(edge.targetId, new Set());
    adjacency.get(edge.sourceId)!.add(edge.targetId);
    adjacency.get(edge.targetId)!.add(edge.sourceId);
  }

  const visited = new Set<string>([fromId]);
  const queue: Array<{ nodeId: string; path: string[] }> = [
    { nodeId: fromId, path: [fromId] },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current.nodeId) ?? new Set();

    for (const neighbor of neighbors) {
      if (neighbor === toId) {
        return [...current.path, neighbor];
      }
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ nodeId: neighbor, path: [...current.path, neighbor] });
      }
    }
  }

  return []; // No path found
}

/**
 * Find critical paths: nodes whose removal would disconnect graph segments.
 * Uses articulation point detection (simplified).
 */
export function findCriticalPaths(
  graph: GraphResult,
  rootId: string,
): string[][] {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.sourceId)) adjacency.set(edge.sourceId, new Set());
    if (!adjacency.has(edge.targetId)) adjacency.set(edge.targetId, new Set());
    adjacency.get(edge.sourceId)!.add(edge.targetId);
    adjacency.get(edge.targetId)!.add(edge.sourceId);
  }

  const articulationPoints: string[] = [];
  const visited = new Set<string>();
  const disc = new Map<string, number>();
  const low = new Map<string, number>();
  const parent = new Map<string, string | null>();
  let timer = 0;

  function dfs(u: string): void {
    visited.add(u);
    disc.set(u, timer);
    low.set(u, timer);
    timer++;
    let children = 0;

    const neighbors = adjacency.get(u) ?? new Set();
    for (const v of neighbors) {
      if (!visited.has(v)) {
        children++;
        parent.set(v, u);
        dfs(v);
        low.set(u, Math.min(low.get(u)!, low.get(v)!));

        // u is an articulation point if:
        if (parent.get(u) === null && children > 1) {
          articulationPoints.push(u);
        }
        if (parent.get(u) !== null && low.get(v)! >= disc.get(u)!) {
          articulationPoints.push(u);
        }
      } else if (v !== parent.get(u)) {
        low.set(u, Math.min(low.get(u)!, disc.get(v)!));
      }
    }
  }

  parent.set(rootId, null);
  dfs(rootId);

  // Return paths from root through each articulation point
  const paths: string[][] = [];
  for (const ap of articulationPoints) {
    const path = findShortestPath(graph, rootId, ap);
    if (path.length > 0) {
      paths.push(path);
    }
  }

  return paths;
}

// ── Internal helpers ──────────────────────────────────────

function buildGraphResult(
  rows: RawTraversalRow[],
  rootId: string,
  rootType: string,
  depth: number,
  options: {
    entityTypes?: string[];
    relationshipTypes?: string[];
    minWeight?: number;
  } = {},
): GraphResult {
  const edgeMap = new Map<string, GraphEdge>();
  const nodeIds = new Map<string, string>(); // id -> type

  // Always include root node
  nodeIds.set(rootId, rootType);

  for (const row of rows) {
    // Apply filters
    if (options.relationshipTypes?.length && !options.relationshipTypes.includes(row.relationship)) {
      continue;
    }
    if (options.minWeight != null && row.weight < options.minWeight) {
      continue;
    }

    const edgeKey = `${row.source_id}:${row.target_id}:${row.relationship}`;
    if (!edgeMap.has(edgeKey)) {
      edgeMap.set(edgeKey, {
        id: edgeKey,
        sourceId: row.source_id,
        sourceType: row.source_type,
        targetId: row.target_id,
        targetType: row.target_type,
        relationship: row.relationship,
        weight: row.weight,
      });
    }

    // Collect node IDs
    if (!nodeIds.has(row.source_id)) nodeIds.set(row.source_id, row.source_type);
    if (!nodeIds.has(row.target_id)) nodeIds.set(row.target_id, row.target_type);
  }

  // Apply entity type filter (always keep root)
  const edges = Array.from(edgeMap.values());
  let filteredEdges = edges;
  if (options.entityTypes?.length) {
    const allowedTypes = new Set([...options.entityTypes, rootType]);
    filteredEdges = edges.filter(
      (e) => allowedTypes.has(e.sourceType) && allowedTypes.has(e.targetType),
    );
  }

  // Build nodes (names will be enriched later)
  const filteredNodeIds = new Map<string, string>();
  filteredNodeIds.set(rootId, rootType);
  for (const edge of filteredEdges) {
    filteredNodeIds.set(edge.sourceId, edge.sourceType);
    filteredNodeIds.set(edge.targetId, edge.targetType);
  }

  // Count connections per node
  const connectionCounts = new Map<string, number>();
  for (const edge of filteredEdges) {
    connectionCounts.set(edge.sourceId, (connectionCounts.get(edge.sourceId) ?? 0) + 1);
    connectionCounts.set(edge.targetId, (connectionCounts.get(edge.targetId) ?? 0) + 1);
  }

  const nodes: GraphNode[] = Array.from(filteredNodeIds.entries()).map(([id, type]) => ({
    id,
    type,
    name: id, // placeholder, enriched later
    connectionCount: connectionCounts.get(id) ?? 0,
  }));

  return {
    nodes,
    edges: filteredEdges,
    meta: {
      rootId,
      rootType,
      depth,
      nodeCount: nodes.length,
      edgeCount: filteredEdges.length,
    },
  };
}
