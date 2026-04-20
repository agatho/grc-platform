import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  withAuth,
  withAuditContext,
  withReadContext,
  paginate,
} from "@/lib/api";
import { sql } from "drizzle-orm";
import { createClimateRiskScenarioSchema } from "@grc/shared";

export async function GET(req: Request) {
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

  const { limit, offset, searchParams } = paginate(req);
  const scenarioType = searchParams.get("scenario_type");
  const temperaturePathway = searchParams.get("temperature_pathway");
  const timeHorizon = searchParams.get("time_horizon");
  const status = searchParams.get("status");

  let query = sql`SELECT * FROM climate_risk_scenario WHERE org_id = ${ctx.orgId}`;
  let countQuery = sql`SELECT count(*)::int AS count FROM climate_risk_scenario WHERE org_id = ${ctx.orgId}`;

  if (scenarioType) {
    query = sql`${query} AND scenario_type = ${scenarioType}`;
    countQuery = sql`${countQuery} AND scenario_type = ${scenarioType}`;
  }
  if (temperaturePathway) {
    query = sql`${query} AND temperature_pathway = ${temperaturePathway}`;
    countQuery = sql`${countQuery} AND temperature_pathway = ${temperaturePathway}`;
  }
  if (timeHorizon) {
    query = sql`${query} AND time_horizon = ${timeHorizon}`;
    countQuery = sql`${countQuery} AND time_horizon = ${timeHorizon}`;
  }
  if (status) {
    query = sql`${query} AND status = ${status}`;
    countQuery = sql`${countQuery} AND status = ${status}`;
  }

  query = sql`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const result = await withReadContext(ctx, async (tx) => {
    const [r, c] = await Promise.all([
      tx.execute(query),
      tx.execute(countQuery),
    ]);
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    const countArr = Array.isArray(c) ? c : (c?.rows ?? []);
    return {
      rows,
      count: Number((countArr[0] as Record<string, unknown>)?.count ?? 0),
    };
  });
  return Response.json({
    data: result.rows,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      limit,
      total: result.count,
    },
  });
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "esg_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const parsed = createClimateRiskScenarioSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const d = parsed.data;
  const result = await withAuditContext(ctx, async (tx) => {
    const res = await tx.execute(sql`
      INSERT INTO climate_risk_scenario (
        org_id, name, description, scenario_type, risk_category, temperature_pathway, time_horizon,
        likelihood_score, impact_score, financial_impact_min, financial_impact_max, financial_impact_currency,
        affected_assets, affected_business_lines, geographic_scope,
        adaptation_measures, mitigation_strategy, residual_risk_score,
        tcfd_category, esrs_disclosure, sbti_relevance,
        status, created_by
      ) VALUES (
        ${ctx.orgId}, ${d.name}, ${d.description ?? null}, ${d.scenario_type}, ${d.risk_category}, ${d.temperature_pathway}, ${d.time_horizon},
        ${d.likelihood_score ?? null}, ${d.impact_score ?? null}, ${d.financial_impact_min ?? null}, ${d.financial_impact_max ?? null}, ${d.financial_impact_currency},
        ${d.affected_assets ?? null}, ${JSON.stringify(d.affected_business_lines ?? [])}, ${d.geographic_scope ?? null},
        ${d.adaptation_measures ?? null}, ${d.mitigation_strategy ?? null}, ${d.residual_risk_score ?? null},
        ${d.tcfd_category ?? null}, ${d.esrs_disclosure ?? null}, ${d.sbti_relevance},
        'draft', ${ctx.userId}
      ) RETURNING *
    `);
    return res.rows[0];
  });

  return Response.json({ data: result }, { status: 201 });
}
