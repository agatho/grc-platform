// Sprint 29: Graph statistics — node counts, edge counts, orphans, hubs
import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import type {
  GraphStats,
  OrphanEntity,
  HubEntity,
  DependencyMatrixEntry,
} from "./types";
import { HUB_CONNECTION_THRESHOLD } from "./types";

/**
 * Get overall graph statistics for an organization.
 */
export async function getGraphStats(orgId: string): Promise<GraphStats> {
  // Node counts by type (union of source and target types)
  const nodeCountRows = await db.execute(sql`
    WITH all_nodes AS (
      SELECT source_type as entity_type, source_id as entity_id FROM entity_reference WHERE org_id = ${orgId}::uuid
      UNION
      SELECT target_type as entity_type, target_id as entity_id FROM entity_reference WHERE org_id = ${orgId}::uuid
    )
    SELECT entity_type, COUNT(DISTINCT entity_id)::int as count
    FROM all_nodes
    GROUP BY entity_type
    ORDER BY count DESC
  `);

  // Edge counts by relationship
  const edgeCountRows = await db.execute(sql`
    SELECT relationship, COUNT(*)::int as count
    FROM entity_reference
    WHERE org_id = ${orgId}::uuid
    GROUP BY relationship
    ORDER BY count DESC
  `);

  // Total counts
  const [totals] = await db.execute(sql`
    WITH all_nodes AS (
      SELECT source_type as entity_type, source_id as entity_id FROM entity_reference WHERE org_id = ${orgId}::uuid
      UNION
      SELECT target_type as entity_type, target_id as entity_id FROM entity_reference WHERE org_id = ${orgId}::uuid
    )
    SELECT
      (SELECT COUNT(DISTINCT entity_id) FROM all_nodes)::int as total_nodes,
      (SELECT COUNT(*) FROM entity_reference WHERE org_id = ${orgId}::uuid)::int as total_edges
  `) as unknown as [{ total_nodes: number; total_edges: number }];

  // Orphan count: entities in only one direction with no return references
  const [orphanResult] = await db.execute(sql`
    WITH all_entities AS (
      SELECT source_type as entity_type, source_id as entity_id FROM entity_reference WHERE org_id = ${orgId}::uuid
      UNION
      SELECT target_type as entity_type, target_id as entity_id FROM entity_reference WHERE org_id = ${orgId}::uuid
    ),
    connection_counts AS (
      SELECT entity_id, COUNT(*) as conn_count
      FROM (
        SELECT source_id as entity_id FROM entity_reference WHERE org_id = ${orgId}::uuid
        UNION ALL
        SELECT target_id as entity_id FROM entity_reference WHERE org_id = ${orgId}::uuid
      ) edges
      GROUP BY entity_id
    )
    SELECT COUNT(*)::int as orphan_count
    FROM connection_counts
    WHERE conn_count = 1
  `) as unknown as [{ orphan_count: number }];

  // Hub count
  const [hubResult] = await db.execute(sql`
    WITH connection_counts AS (
      SELECT entity_id, COUNT(*) as conn_count
      FROM (
        SELECT source_id as entity_id FROM entity_reference WHERE org_id = ${orgId}::uuid
        UNION ALL
        SELECT target_id as entity_id FROM entity_reference WHERE org_id = ${orgId}::uuid
      ) edges
      GROUP BY entity_id
    )
    SELECT COUNT(*)::int as hub_count
    FROM connection_counts
    WHERE conn_count >= ${HUB_CONNECTION_THRESHOLD}
  `) as unknown as [{ hub_count: number }];

  const totalNodes = totals?.total_nodes ?? 0;
  const totalEdges = totals?.total_edges ?? 0;

  const nodesByType: Record<string, number> = {};
  for (const row of nodeCountRows as unknown as Array<{ entity_type: string; count: number }>) {
    nodesByType[row.entity_type] = row.count;
  }

  const edgesByRelationship: Record<string, number> = {};
  for (const row of edgeCountRows as unknown as Array<{ relationship: string; count: number }>) {
    edgesByRelationship[row.relationship] = row.count;
  }

  return {
    totalNodes,
    totalEdges,
    nodesByType,
    edgesByRelationship,
    orphanCount: orphanResult?.orphan_count ?? 0,
    hubCount: hubResult?.hub_count ?? 0,
    avgConnections: totalNodes > 0 ? Math.round((totalEdges * 2 / totalNodes) * 10) / 10 : 0,
  };
}

/**
 * Detect orphan entities: risks without controls, controls without tests, assets without protection requirements.
 */
export async function findOrphans(orgId: string): Promise<{
  risksWithoutControls: OrphanEntity[];
  controlsWithoutTests: OrphanEntity[];
  assetsWithoutProtection: OrphanEntity[];
  processesWithoutControls: OrphanEntity[];
}> {
  // Risks that have no 'mitigates' edge pointing to them
  const risksWithoutControls = await db.execute(sql`
    SELECT r.id::text as entity_id, 'risk' as entity_type, r.title as entity_name, r.element_id
    FROM risk r
    WHERE r.org_id = ${orgId}::uuid
      AND NOT EXISTS (
        SELECT 1 FROM entity_reference er
        WHERE er.org_id = ${orgId}::uuid
          AND er.target_id = r.id
          AND er.target_type = 'risk'
          AND er.relationship = 'mitigates'
      )
    ORDER BY r.title
    LIMIT 100
  `);

  // Controls that have no 'tested_by' edge
  const controlsWithoutTests = await db.execute(sql`
    SELECT c.id::text as entity_id, 'control' as entity_type, c.title as entity_name, c.element_id
    FROM control c
    WHERE c.org_id = ${orgId}::uuid
      AND NOT EXISTS (
        SELECT 1 FROM entity_reference er
        WHERE er.org_id = ${orgId}::uuid
          AND er.source_id = c.id
          AND er.source_type = 'control'
          AND er.relationship = 'tested_by'
      )
    ORDER BY c.title
    LIMIT 100
  `);

  // Assets without protection requirements (no incoming edges at all)
  const assetsWithoutProtection = await db.execute(sql`
    SELECT a.id::text as entity_id, 'asset' as entity_type, a.name as entity_name, a.element_id
    FROM asset a
    WHERE a.org_id = ${orgId}::uuid
      AND NOT EXISTS (
        SELECT 1 FROM entity_reference er
        WHERE er.org_id = ${orgId}::uuid
          AND (
            (er.source_id = a.id AND er.source_type = 'asset')
            OR (er.target_id = a.id AND er.target_type = 'asset')
          )
      )
    ORDER BY a.name
    LIMIT 100
  `);

  // Processes without controls
  const processesWithoutControls = await db.execute(sql`
    SELECT p.id::text as entity_id, 'process' as entity_type, p.name as entity_name, p.element_id
    FROM process p
    WHERE p.org_id = ${orgId}::uuid
      AND NOT EXISTS (
        SELECT 1 FROM entity_reference er
        WHERE er.org_id = ${orgId}::uuid
          AND er.source_id = p.id
          AND er.source_type = 'process'
          AND er.relationship IN ('owned_by', 'implemented_in')
      )
    ORDER BY p.name
    LIMIT 100
  `);

  const mapOrphans = (rows: unknown[], entityType: string, missingRel: string, fixPath: string): OrphanEntity[] =>
    (rows as Array<{ entity_id: string; entity_type: string; entity_name: string; element_id?: string }>).map((r) => ({
      entityId: r.entity_id,
      entityType: r.entity_type ?? entityType,
      entityName: r.entity_name ?? r.entity_id,
      elementId: r.element_id,
      missingRelationship: missingRel,
      fixUrl: `/${fixPath}/${r.entity_id}`,
    }));

  return {
    risksWithoutControls: mapOrphans(risksWithoutControls as unknown as unknown[], "risk", "mitigates", "risks"),
    controlsWithoutTests: mapOrphans(controlsWithoutTests as unknown as unknown[], "control", "tested_by", "controls"),
    assetsWithoutProtection: mapOrphans(assetsWithoutProtection as unknown as unknown[], "asset", "any", "assets"),
    processesWithoutControls: mapOrphans(processesWithoutControls as unknown as unknown[], "process", "owned_by", "processes"),
  };
}

/**
 * Hub detection: entities with the most connections (SPOF = single point of failure).
 */
export async function getHubs(
  orgId: string,
  limit: number = 20,
): Promise<HubEntity[]> {
  const rows = await db.execute(sql`
    WITH connection_counts AS (
      SELECT
        entity_id,
        entity_type,
        SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END)::int as outbound,
        SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END)::int as inbound,
        COUNT(*)::int as total
      FROM (
        SELECT source_id::text as entity_id, source_type as entity_type, 'outbound' as direction
        FROM entity_reference WHERE org_id = ${orgId}::uuid
        UNION ALL
        SELECT target_id::text as entity_id, target_type as entity_type, 'inbound' as direction
        FROM entity_reference WHERE org_id = ${orgId}::uuid
      ) edges
      GROUP BY entity_id, entity_type
    )
    SELECT entity_id, entity_type, total as connection_count, inbound, outbound
    FROM connection_counts
    ORDER BY total DESC
    LIMIT ${limit}
  `);

  const hubs = (rows as unknown as Array<{
    entity_id: string;
    entity_type: string;
    connection_count: number;
    inbound: number;
    outbound: number;
  }>).map((r) => ({
    entityId: r.entity_id,
    entityType: r.entity_type,
    entityName: r.entity_id, // enriched below
    connectionCount: r.connection_count,
    inbound: r.inbound,
    outbound: r.outbound,
    isSinglePointOfFailure: r.connection_count >= HUB_CONNECTION_THRESHOLD,
  }));

  // Enrich names
  const { enrichGraphNodes } = await import("./enrichment");
  const fakeGraph = {
    nodes: hubs.map((h) => ({
      id: h.entityId,
      type: h.entityType,
      name: h.entityId,
      connectionCount: h.connectionCount,
    })),
    edges: [],
    meta: { rootId: "", rootType: "", depth: 0, nodeCount: hubs.length, edgeCount: 0 },
  };
  const enriched = await enrichGraphNodes(fakeGraph);
  const nameMap = new Map(enriched.nodes.map((n) => [n.id, n.name]));

  return hubs.map((h) => ({
    ...h,
    entityName: nameMap.get(h.entityId) ?? h.entityId,
  }));
}

/**
 * Dependency matrix: count of edges between each pair of entity types.
 */
export async function getDependencyMatrix(orgId: string): Promise<DependencyMatrixEntry[]> {
  const rows = await db.execute(sql`
    SELECT
      source_type,
      target_type,
      COUNT(*)::int as count,
      ROUND(AVG(weight))::int as avg_weight
    FROM entity_reference
    WHERE org_id = ${orgId}::uuid
    GROUP BY source_type, target_type
    ORDER BY count DESC
  `);

  return (rows as unknown as Array<{
    source_type: string;
    target_type: string;
    count: number;
    avg_weight: number;
  }>).map((r) => ({
    sourceType: r.source_type,
    targetType: r.target_type,
    count: r.count,
    avgWeight: r.avg_weight,
  }));
}

/**
 * Search entities across all types for graph display.
 */
export async function searchEntities(
  orgId: string,
  query: string,
  limit: number = 20,
): Promise<Array<{ entityId: string; entityType: string; name: string; elementId?: string }>> {
  const searchTerm = `%${query}%`;

  const rows = await db.execute(sql`
    SELECT id::text as entity_id, 'risk' as entity_type, title as name, element_id
    FROM risk WHERE org_id = ${orgId}::uuid AND (title ILIKE ${searchTerm} OR element_id ILIKE ${searchTerm})
    UNION ALL
    SELECT id::text, 'control', title, element_id
    FROM control WHERE org_id = ${orgId}::uuid AND (title ILIKE ${searchTerm} OR element_id ILIKE ${searchTerm})
    UNION ALL
    SELECT id::text, 'asset', name, element_id
    FROM asset WHERE org_id = ${orgId}::uuid AND (name ILIKE ${searchTerm} OR element_id ILIKE ${searchTerm})
    UNION ALL
    SELECT id::text, 'process', name, element_id
    FROM process WHERE org_id = ${orgId}::uuid AND (name ILIKE ${searchTerm} OR element_id ILIKE ${searchTerm})
    UNION ALL
    SELECT id::text, 'vendor', name, element_id
    FROM vendor WHERE org_id = ${orgId}::uuid AND (name ILIKE ${searchTerm} OR element_id ILIKE ${searchTerm})
    UNION ALL
    SELECT id::text, 'document', title, element_id
    FROM document WHERE org_id = ${orgId}::uuid AND (title ILIKE ${searchTerm} OR element_id ILIKE ${searchTerm})
    ORDER BY name
    LIMIT ${limit}
  `);

  return (rows as unknown as Array<{ entity_id: string; entity_type: string; name: string; element_id?: string }>).map((r) => ({
    entityId: r.entity_id,
    entityType: r.entity_type,
    name: r.name,
    elementId: r.element_id,
  }));
}
