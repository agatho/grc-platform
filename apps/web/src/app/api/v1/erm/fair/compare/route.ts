import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { fairCompareQuerySchema } from "@grc/shared";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/erm/fair/compare?riskIds=id1,id2,id3 — Compare up to 5 risks
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const parsed = fairCompareQuerySchema.safeParse({
    riskIds: url.searchParams.get("riskIds") ?? "",
  });

  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const riskIds = parsed.data.riskIds.slice(0, 5); // Max 5 risks

  if (riskIds.length === 0) {
    return Response.json({ data: [] });
  }

  // Get latest completed simulation for each requested risk
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (fsr.risk_id)
      fsr.risk_id,
      fsr.ale_p5,
      fsr.ale_p25,
      fsr.ale_p50,
      fsr.ale_p75,
      fsr.ale_p95,
      fsr.ale_mean,
      fsr.ale_std_dev,
      fsr.histogram,
      fsr.loss_exceedance,
      fsr.iterations,
      fsr.computed_at,
      r.title as risk_title,
      r.risk_category,
      r.status as risk_status
    FROM fair_simulation_result fsr
    INNER JOIN risk r ON r.id = fsr.risk_id AND r.deleted_at IS NULL
    WHERE fsr.org_id = ${ctx.orgId}
      AND fsr.status = 'completed'
      AND fsr.risk_id = ANY(${riskIds})
      AND r.org_id = ${ctx.orgId}
    ORDER BY fsr.risk_id, fsr.computed_at DESC
  `);

  const compareData = (rows as unknown as Array<Record<string, unknown>>).map((row) => ({
    riskId: row.risk_id,
    riskTitle: row.risk_title,
    riskCategory: row.risk_category,
    riskStatus: row.risk_status,
    aleP5: Number(row.ale_p5),
    aleP25: Number(row.ale_p25),
    aleP50: Number(row.ale_p50),
    aleP75: Number(row.ale_p75),
    aleP95: Number(row.ale_p95),
    aleMean: Number(row.ale_mean),
    aleStdDev: Number(row.ale_std_dev),
    iterations: row.iterations,
    computedAt: row.computed_at,
  }));

  return Response.json({ data: compareData });
}
