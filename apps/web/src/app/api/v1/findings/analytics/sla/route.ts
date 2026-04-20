import { db, finding, findingSlaConfig } from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { isWithinSla } from "@grc/shared";

// GET /api/v1/findings/analytics/sla — SLA compliance rates
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  // Fetch SLA configs
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

  // Fetch all findings (resolved and open) with timestamps
  const findings = await db
    .select({
      id: finding.id,
      severity: finding.severity,
      status: finding.status,
      createdAt: finding.createdAt,
      updatedAt: finding.updatedAt,
    })
    .from(finding)
    .where(and(eq(finding.orgId, ctx.orgId), isNull(finding.deletedAt)));

  // Compute SLA compliance per severity
  const bySeverity: Record<
    string,
    { total: number; withinSla: number; breached: number }
  > = {};

  for (const f of findings) {
    const slaDays = slaMap[f.severity];
    if (slaDays === undefined) continue;

    if (!bySeverity[f.severity]) {
      bySeverity[f.severity] = { total: 0, withinSla: 0, breached: 0 };
    }

    bySeverity[f.severity].total++;

    const resolvedAt =
      f.status === "closed" || f.status === "verified"
        ? f.updatedAt.toISOString()
        : null;

    if (isWithinSla(f.createdAt.toISOString(), resolvedAt, slaDays)) {
      bySeverity[f.severity].withinSla++;
    } else {
      bySeverity[f.severity].breached++;
    }
  }

  const data = Object.entries(bySeverity).map(([severity, stats]) => ({
    severity,
    total: stats.total,
    withinSla: stats.withinSla,
    breached: stats.breached,
    complianceRate:
      stats.total > 0 ? Math.round((stats.withinSla / stats.total) * 100) : 100,
    slaDays: slaMap[severity],
  }));

  // Overall compliance
  const totalFindings = data.reduce((s, d) => s + d.total, 0);
  const totalWithinSla = data.reduce((s, d) => s + d.withinSla, 0);
  const overallCompliance =
    totalFindings > 0
      ? Math.round((totalWithinSla / totalFindings) * 100)
      : 100;

  return Response.json({
    data: {
      overall: {
        total: totalFindings,
        withinSla: totalWithinSla,
        complianceRate: overallCompliance,
      },
      bySeverity: data,
    },
  });
}
