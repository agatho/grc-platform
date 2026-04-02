import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/dashboards/technical-alignment — Technology standards compliance
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const result = await db.execute(sql`
    SELECT te.ring,
           COUNT(DISTINCT tal.element_id)::int AS app_count,
           te.name AS technology_name, te.id AS technology_id
    FROM technology_entry te
    JOIN technology_application_link tal ON tal.technology_id = te.id
    WHERE te.org_id = ${ctx.orgId}
    GROUP BY te.id, te.ring, te.name
    ORDER BY app_count DESC
  `);

  const rows = result as unknown as Array<{
    ring: string; app_count: number; technology_name: string; technology_id: string;
  }>;

  const standard = rows.filter((r) => ["adopt", "trial"].includes(r.ring));
  const nonStandard = rows.filter((r) => ["hold", "assess"].includes(r.ring));
  const standardCount = standard.reduce((s, r) => s + r.app_count, 0);
  const nonStandardCount = nonStandard.reduce((s, r) => s + r.app_count, 0);
  const total = standardCount + nonStandardCount || 1;

  return Response.json({
    data: {
      standardPct: Math.round((standardCount / total) * 100),
      standardCount,
      nonStandardCount,
      nonStandardTechnologies: nonStandard.map((r) => ({
        technologyId: r.technology_id,
        technologyName: r.technology_name,
        ring: r.ring,
        applicationCount: r.app_count,
        recommendedAction: r.ring === "hold" ? "Plan migration" : "Evaluate alternatives",
      })),
    },
  });
}
