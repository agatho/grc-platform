import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/erm/fair/aggregate — Total org ALE exposure
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Get latest completed simulation for each risk using DISTINCT ON
  const latestSims = await db.execute<{
    risk_id: string;
    ale_p5: string;
    ale_p25: string;
    ale_p50: string;
    ale_p75: string;
    ale_p95: string;
    ale_mean: string;
    risk_category: string;
  }>(sql`
    SELECT DISTINCT ON (fsr.risk_id)
      fsr.risk_id,
      fsr.ale_p5,
      fsr.ale_p25,
      fsr.ale_p50,
      fsr.ale_p75,
      fsr.ale_p95,
      fsr.ale_mean,
      r.risk_category
    FROM fair_simulation_result fsr
    INNER JOIN risk r ON r.id = fsr.risk_id AND r.deleted_at IS NULL
    WHERE fsr.org_id = ${ctx.orgId}
      AND fsr.status = 'completed'
      AND r.org_id = ${ctx.orgId}
    ORDER BY fsr.risk_id, fsr.computed_at DESC
  `);

  const rows = latestSims as unknown as Array<{
    risk_id: string;
    ale_p5: string;
    ale_p25: string;
    ale_p50: string;
    ale_p75: string;
    ale_p95: string;
    ale_mean: string;
    risk_category: string;
  }>;

  let totalAleP50 = 0;
  let totalAleP95 = 0;
  let totalAleMean = 0;

  const categoryMap = new Map<
    string,
    { aleP50: number; aleP95: number; count: number }
  >();

  for (const row of rows) {
    const p50 = Number(row.ale_p50) || 0;
    const p95 = Number(row.ale_p95) || 0;
    const mean_ = Number(row.ale_mean) || 0;

    totalAleP50 += p50;
    totalAleP95 += p95;
    totalAleMean += mean_;

    const cat = row.risk_category;
    const existing = categoryMap.get(cat) ?? { aleP50: 0, aleP95: 0, count: 0 };
    categoryMap.set(cat, {
      aleP50: existing.aleP50 + p50,
      aleP95: existing.aleP95 + p95,
      count: existing.count + 1,
    });
  }

  const byCategory = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      aleP50: Math.round(data.aleP50 * 100) / 100,
      aleP95: Math.round(data.aleP95 * 100) / 100,
      count: data.count,
    }))
    .sort((a, b) => b.aleP50 - a.aleP50);

  return Response.json({
    data: {
      totalAleP50: Math.round(totalAleP50 * 100) / 100,
      totalAleP95: Math.round(totalAleP95 * 100) / 100,
      totalAleMean: Math.round(totalAleMean * 100) / 100,
      riskCount: rows.length,
      byCategory,
    },
  });
}
