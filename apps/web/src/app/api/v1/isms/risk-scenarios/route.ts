import { db, riskScenario, threat, vulnerability, asset } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createRiskScenarioSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/isms/risk-scenarios
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset } = paginate(req);

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
      vulnerabilitySeverity: vulnerability.severity,
      assetName: asset.name,
    })
    .from(riskScenario)
    .leftJoin(threat, eq(riskScenario.threatId, threat.id))
    .leftJoin(vulnerability, eq(riskScenario.vulnerabilityId, vulnerability.id))
    .leftJoin(asset, eq(riskScenario.assetId, asset.id))
    .where(eq(riskScenario.orgId, ctx.orgId))
    .orderBy(riskScenario.createdAt)
    .limit(limit)
    .offset(offset);

  const allRows = await db
    .select({ id: riskScenario.id })
    .from(riskScenario)
    .where(eq(riskScenario.orgId, ctx.orgId));

  return paginatedResponse(rows, allRows.length, page, limit);
}

// POST /api/v1/isms/risk-scenarios
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createRiskScenarioSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(riskScenario)
      .values({
        orgId: ctx.orgId,
        threatId: data.threatId,
        vulnerabilityId: data.vulnerabilityId ?? null,
        assetId: data.assetId,
        riskId: data.riskId ?? null,
        description: data.description ?? null,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
