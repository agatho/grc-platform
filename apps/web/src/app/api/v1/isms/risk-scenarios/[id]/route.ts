import { db, riskScenario } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/isms/risk-scenarios/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Raw SQL to include all columns from migration 0087 (ALTER TABLE additions)
  const result = await db.execute(sql`
    SELECT
      rs.*,
      t.title as threat_title,
      t.threat_category,
      v.title as vulnerability_title,
      v.severity as vulnerability_severity,
      a.name as asset_name,
      a.tier as asset_tier,
      ou.name as owner_name
    FROM risk_scenario rs
    LEFT JOIN threat t ON t.id = rs.threat_id
    LEFT JOIN vulnerability v ON v.id = rs.vulnerability_id
    LEFT JOIN asset a ON a.id = rs.asset_id
    LEFT JOIN "user" ou ON ou.id = rs.owner_id
    WHERE rs.id = ${id} AND rs.org_id = ${ctx.orgId}
    LIMIT 1
  `);

  const arr = result as unknown as Record<string, unknown>[];
  if (arr.length === 0) {
    return Response.json({ error: "Risk scenario not found" }, { status: 404 });
  }

  return Response.json({ data: arr[0] });
}

// DELETE /api/v1/isms/risk-scenarios/[id]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  await withAuditContext(ctx, async (tx) => {
    await tx
      .delete(riskScenario)
      .where(and(eq(riskScenario.id, id), eq(riskScenario.orgId, ctx.orgId)));
  });

  return Response.json({ success: true });
}
