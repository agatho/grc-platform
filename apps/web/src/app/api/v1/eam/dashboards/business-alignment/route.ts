import { db, businessCapability, architectureRelationship } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/dashboards/business-alignment — Capability coverage heatmap
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const result = await db.execute(sql`
    SELECT bc.id AS capability_id, ae_cap.name AS capability_name,
           COUNT(DISTINCT ar.source_id)::int AS application_count
    FROM business_capability bc
    JOIN architecture_element ae_cap ON bc.element_id = ae_cap.id
    LEFT JOIN architecture_relationship ar ON ar.target_id = ae_cap.id AND ar.relationship_type = 'realizes'
    WHERE bc.org_id = ${ctx.orgId}
    GROUP BY bc.id, ae_cap.name
    ORDER BY ae_cap.name
  `);

  const rows = result as unknown as Array<{
    capability_id: string;
    capability_name: string;
    application_count: number;
  }>;
  const total = rows.length || 1;
  const covered = rows.filter((r) => r.application_count > 0).length;

  return Response.json({
    data: {
      capabilities: rows.map((r) => ({
        capabilityId: r.capability_id,
        capabilityName: r.capability_name,
        applicationCount: r.application_count,
        status:
          r.application_count >= 2
            ? "full"
            : r.application_count === 1
              ? "partial"
              : "none",
      })),
      coverageScorePct: Math.round((covered / total) * 100),
    },
  });
}
