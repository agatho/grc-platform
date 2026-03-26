import { db, riskScenario, threat, vulnerability, asset } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
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

  const rows = await db
    .select({
      id: riskScenario.id,
      orgId: riskScenario.orgId,
      riskId: riskScenario.riskId,
      threatId: riskScenario.threatId,
      vulnerabilityId: riskScenario.vulnerabilityId,
      assetId: riskScenario.assetId,
      description: riskScenario.description,
      createdAt: riskScenario.createdAt,
      threatTitle: threat.title,
      threatCategory: threat.threatCategory,
      vulnerabilityTitle: vulnerability.title,
      assetName: asset.name,
    })
    .from(riskScenario)
    .leftJoin(threat, eq(riskScenario.threatId, threat.id))
    .leftJoin(vulnerability, eq(riskScenario.vulnerabilityId, vulnerability.id))
    .leftJoin(asset, eq(riskScenario.assetId, asset.id))
    .where(and(eq(riskScenario.id, id), eq(riskScenario.orgId, ctx.orgId)))
    .limit(1);

  if (rows.length === 0) {
    return Response.json({ error: "Risk scenario not found" }, { status: 404 });
  }

  return Response.json({ data: rows[0] });
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
