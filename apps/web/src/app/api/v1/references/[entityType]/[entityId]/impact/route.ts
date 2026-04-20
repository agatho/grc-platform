import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/references/:entityType/:entityId/impact
// Recursive CTE cascade tree (max depth 3) — shows what would be affected
export async function GET(
  req: Request,
  { params }: { params: Promise<{ entityType: string; entityId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { entityType, entityId } = await params;
  const url = new URL(req.url);
  const maxDepth = Math.min(
    5,
    Math.max(1, Number(url.searchParams.get("maxDepth")) || 3),
  );

  // Recursive CTE with visited-set to prevent circular references
  const result = await db.execute<{
    entity_type: string;
    entity_id: string;
    relationship: string;
    depth: number;
  }>(sql`
    WITH RECURSIVE impact_tree AS (
      -- Base case: direct references where this entity is the target
      SELECT
        er.source_type AS entity_type,
        er.source_id AS entity_id,
        er.relationship,
        1 AS depth,
        ARRAY[er.source_type || ':' || er.source_id::text] AS visited
      FROM entity_reference er
      WHERE er.org_id = ${ctx.orgId}
        AND er.target_type = ${entityType}
        AND er.target_id = ${entityId}

      UNION ALL

      -- Also include where this entity is the source
      SELECT
        er.target_type AS entity_type,
        er.target_id AS entity_id,
        er.relationship,
        1 AS depth,
        ARRAY[er.target_type || ':' || er.target_id::text] AS visited
      FROM entity_reference er
      WHERE er.org_id = ${ctx.orgId}
        AND er.source_type = ${entityType}
        AND er.source_id = ${entityId}

      UNION ALL

      -- Recursive case: follow references from discovered entities
      SELECT
        er.source_type AS entity_type,
        er.source_id AS entity_id,
        er.relationship,
        it.depth + 1,
        it.visited || (er.source_type || ':' || er.source_id::text)
      FROM entity_reference er
      JOIN impact_tree it
        ON er.target_type = it.entity_type
        AND er.target_id = it.entity_id
        AND er.org_id = ${ctx.orgId}
      WHERE it.depth < ${maxDepth}
        AND NOT (er.source_type || ':' || er.source_id::text) = ANY(it.visited)
        AND NOT (er.source_type = ${entityType} AND er.source_id = ${entityId})
    )
    SELECT DISTINCT ON (entity_type, entity_id)
      entity_type,
      entity_id,
      relationship,
      depth
    FROM impact_tree
    ORDER BY entity_type, entity_id, depth ASC
  `);

  const rows = result as unknown as Array<{
    entity_type: string;
    entity_id: string;
    relationship: string;
    depth: number;
  }>;

  // Group by depth for the response
  const byDepth: Record<
    number,
    Array<{ entityType: string; entityId: string; relationship: string }>
  > = {};
  for (const row of rows) {
    const d = row.depth;
    if (!byDepth[d]) byDepth[d] = [];
    byDepth[d].push({
      entityType: row.entity_type,
      entityId: row.entity_id,
      relationship: row.relationship,
    });
  }

  return Response.json({
    data: {
      rootEntityType: entityType,
      rootEntityId: entityId,
      maxDepth,
      totalAffected: rows.length,
      byDepth,
    },
  });
}
