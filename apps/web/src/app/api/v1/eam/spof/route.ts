import { db, architectureElement, architectureRelationship } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/spof — Single Points of Failure detection
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Find technology elements that support critical business capabilities with no redundancy
  const spofs = await db.execute(sql`
    WITH tech_deps AS (
      SELECT
        ae.id AS tech_id,
        ae.name AS tech_name,
        ae.criticality,
        count(DISTINCT bc.id) AS critical_cap_count,
        count(DISTINCT app.id) AS app_count
      FROM architecture_element ae
      JOIN architecture_relationship ar ON ar.target_id = ae.id
      JOIN architecture_element app ON app.id = ar.source_id AND app.type = 'application'
      LEFT JOIN architecture_relationship ar2 ON ar2.source_id = app.id AND ar2.relationship_type = 'realizes'
      LEFT JOIN architecture_element cap ON cap.id = ar2.target_id AND cap.type = 'business_capability'
      LEFT JOIN business_capability bc ON bc.element_id = cap.id
      WHERE ae.org_id = ${ctx.orgId}
        AND ae.layer = 'technology'
      GROUP BY ae.id, ae.name, ae.criticality
      HAVING count(DISTINCT bc.id) > 1
    )
    SELECT * FROM tech_deps
    ORDER BY critical_cap_count DESC
  `);

  return Response.json({ data: spofs ?? [] });
}
