import { toRows, firstRow } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext, withReadContext } from "@/lib/api";
import { sql } from "drizzle-orm";
import { updateClimateRiskScenarioSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "esg_manager",
    "esg_contributor",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;

  const row = await withReadContext(ctx, async (tx) => {
    const res = await tx.execute(
      sql`SELECT * FROM climate_risk_scenario WHERE id = ${id} AND org_id = ${ctx.orgId}`,
    );
    const rows = toRows(res);
    return rows[0];
  });
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
});
export const PATCH = withErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "esg_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;

  const parsed = updateClimateRiskScenarioSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const d = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    const res = await tx.execute(sql`
      UPDATE climate_risk_scenario SET
        name = COALESCE(${d.name ?? null}, name),
        description = COALESCE(${d.description ?? null}, description),
        scenario_type = COALESCE(${d.scenario_type ?? null}, scenario_type),
        risk_category = COALESCE(${d.risk_category ?? null}, risk_category),
        temperature_pathway = COALESCE(${d.temperature_pathway ?? null}, temperature_pathway),
        time_horizon = COALESCE(${d.time_horizon ?? null}, time_horizon),
        likelihood_score = COALESCE(${d.likelihood_score ?? null}, likelihood_score),
        impact_score = COALESCE(${d.impact_score ?? null}, impact_score),
        financial_impact_min = COALESCE(${d.financial_impact_min ?? null}, financial_impact_min),
        financial_impact_max = COALESCE(${d.financial_impact_max ?? null}, financial_impact_max),
        financial_impact_currency = COALESCE(${d.financial_impact_currency ?? null}, financial_impact_currency),
        affected_assets = COALESCE(${d.affected_assets ?? null}, affected_assets),
        geographic_scope = COALESCE(${d.geographic_scope ?? null}, geographic_scope),
        adaptation_measures = COALESCE(${d.adaptation_measures ?? null}, adaptation_measures),
        mitigation_strategy = COALESCE(${d.mitigation_strategy ?? null}, mitigation_strategy),
        residual_risk_score = COALESCE(${d.residual_risk_score ?? null}, residual_risk_score),
        tcfd_category = COALESCE(${d.tcfd_category ?? null}, tcfd_category),
        esrs_disclosure = COALESCE(${d.esrs_disclosure ?? null}, esrs_disclosure),
        sbti_relevance = COALESCE(${d.sbti_relevance ?? null}, sbti_relevance),
        status = COALESCE(${d.status ?? null}, status),
        updated_at = now()
      WHERE id = ${id} AND org_id = ${ctx.orgId}
      RETURNING *
    `);
    return firstRow(res);
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
});
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "esg_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;

  const result = await withAuditContext(ctx, async (tx) => {
    const res = await tx.execute(sql`
      DELETE FROM climate_risk_scenario WHERE id = ${id} AND org_id = ${ctx.orgId} RETURNING id
    `);
    return firstRow(res);
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: { deleted: true } });
});
