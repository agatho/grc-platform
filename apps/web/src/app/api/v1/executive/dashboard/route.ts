import {
  db,
  controlEffectivenessScore,
  control,
  risk,
  finding,
  findingSlaConfig,
} from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { isWithinSla } from "@grc/shared";

// GET /api/v1/executive/dashboard — Cross-module KPI summary
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  // 1. Average CES
  const [cesRow] = await db
    .select({
      avgCes: sql<number>`ROUND(AVG(${controlEffectivenessScore.score}))`.as("avg_ces"),
      totalControls: sql<number>`COUNT(*)`.as("total"),
      belowThreshold: sql<number>`SUM(CASE WHEN ${controlEffectivenessScore.score} < 50 THEN 1 ELSE 0 END)`.as("below"),
    })
    .from(controlEffectivenessScore)
    .where(eq(controlEffectivenessScore.orgId, ctx.orgId));

  // 2. Risk score average
  const [riskRow] = await db
    .select({
      avgResidual: sql<number>`ROUND(AVG(${risk.riskScoreResidual}))`.as("avg_residual"),
      aboveAppetite: sql<number>`SUM(CASE WHEN ${risk.riskAppetiteExceeded} THEN 1 ELSE 0 END)`.as("above"),
    })
    .from(risk)
    .where(and(eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)));

  // 3. Open findings count
  const [findingRow] = await db
    .select({
      openFindings: sql<number>`COUNT(*)`.as("open"),
    })
    .from(finding)
    .where(
      and(
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
        sql`${finding.status} NOT IN ('closed', 'verified')`,
      ),
    );

  // 4. Finding SLA compliance
  const slaConfigs = await db
    .select({
      severity: findingSlaConfig.severity,
      slaDays: findingSlaConfig.slaDays,
    })
    .from(findingSlaConfig)
    .where(eq(findingSlaConfig.orgId, ctx.orgId));

  const slaMap: Record<string, number> = {};
  for (const s of slaConfigs) {
    slaMap[s.severity] = s.slaDays;
  }

  const allFindings = await db
    .select({
      severity: finding.severity,
      status: finding.status,
      createdAt: finding.createdAt,
      updatedAt: finding.updatedAt,
    })
    .from(finding)
    .where(
      and(eq(finding.orgId, ctx.orgId), isNull(finding.deletedAt)),
    );

  let slaTotal = 0;
  let slaCompliant = 0;
  for (const f of allFindings) {
    const slaDays = slaMap[f.severity];
    if (slaDays === undefined) continue;
    slaTotal++;
    const resolvedAt =
      f.status === "closed" || f.status === "verified"
        ? f.updatedAt.toISOString()
        : null;
    if (isWithinSla(f.createdAt.toISOString(), resolvedAt, slaDays)) {
      slaCompliant++;
    }
  }

  const findingSlaCompliance = slaTotal > 0 ? Math.round((slaCompliant / slaTotal) * 100) : 100;

  return Response.json({
    data: {
      avgCES: Number(cesRow?.avgCes ?? 0),
      totalControls: Number(cesRow?.totalControls ?? 0),
      controlsBelowThreshold: Number(cesRow?.belowThreshold ?? 0),
      riskScoreAvg: Number(riskRow?.avgResidual ?? 0),
      risksAboveAppetite: Number(riskRow?.aboveAppetite ?? 0),
      openFindings: Number(findingRow?.openFindings ?? 0),
      findingSlaCompliance,
      // Placeholders for modules not yet fully integrated
      auditSlaCompliance: 0,
      dsrSlaCompliance: 0,
      esgCompleteness: 0,
    },
  });
}
