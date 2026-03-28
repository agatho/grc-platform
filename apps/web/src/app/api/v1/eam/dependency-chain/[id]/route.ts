import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/dependency-chain/:id — Full dependency chain (recursive CTE)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Recursive CTE traversal - upward and downward
  const chain = await db.execute(sql`
    WITH RECURSIVE upward AS (
      SELECT ar.source_id, ar.target_id, ar.relationship_type, 1 AS depth, 'up' AS direction
      FROM architecture_relationship ar
      WHERE ar.target_id = ${id} AND ar.org_id = ${ctx.orgId}
      UNION ALL
      SELECT ar.source_id, ar.target_id, ar.relationship_type, u.depth + 1, 'up'
      FROM architecture_relationship ar
      JOIN upward u ON ar.target_id = u.source_id
      WHERE u.depth < 10 AND ar.org_id = ${ctx.orgId}
    ),
    downward AS (
      SELECT ar.source_id, ar.target_id, ar.relationship_type, 1 AS depth, 'down' AS direction
      FROM architecture_relationship ar
      WHERE ar.source_id = ${id} AND ar.org_id = ${ctx.orgId}
      UNION ALL
      SELECT ar.source_id, ar.target_id, ar.relationship_type, d.depth + 1, 'down'
      FROM architecture_relationship ar
      JOIN downward d ON ar.source_id = d.target_id
      WHERE d.depth < 10 AND ar.org_id = ${ctx.orgId}
    )
    SELECT DISTINCT
      ae.id, ae.name, ae.layer, ae.type, ae.criticality,
      chain.relationship_type, chain.depth, chain.direction
    FROM (
      SELECT source_id AS element_id, relationship_type, depth, direction FROM upward
      UNION ALL
      SELECT target_id AS element_id, relationship_type, depth, direction FROM downward
    ) chain
    JOIN architecture_element ae ON ae.id = chain.element_id
    ORDER BY chain.direction, chain.depth
  `);

  return Response.json({ data: chain ?? [] });
}
