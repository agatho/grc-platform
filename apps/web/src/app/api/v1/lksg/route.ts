import { db, vendor, lksgAssessment } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, count, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/lksg — LkSG dashboard
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const [
    [{ value: totalVendors }],
    [{ value: lksgRelevant }],
    lksgVendors,
    assessmentsByStatus,
    assessmentsByRiskLevel,
  ] = await Promise.all([
    // Total vendors
    db
      .select({ value: count() })
      .from(vendor)
      .where(and(eq(vendor.orgId, ctx.orgId), isNull(vendor.deletedAt))),

    // LkSG-relevant count
    db
      .select({ value: count() })
      .from(vendor)
      .where(
        and(eq(vendor.orgId, ctx.orgId), isNull(vendor.deletedAt), eq(vendor.isLksgRelevant, true)),
      ),

    // LkSG-relevant vendors with latest assessment
    db
      .select({
        id: vendor.id,
        name: vendor.name,
        country: vendor.country,
        lksgTier: vendor.lksgTier,
        tier: vendor.tier,
      })
      .from(vendor)
      .where(
        and(eq(vendor.orgId, ctx.orgId), isNull(vendor.deletedAt), eq(vendor.isLksgRelevant, true)),
      ),

    // Assessments by status
    db
      .select({ status: lksgAssessment.status, count: count() })
      .from(lksgAssessment)
      .where(eq(lksgAssessment.orgId, ctx.orgId))
      .groupBy(lksgAssessment.status),

    // By risk level
    db
      .select({ level: lksgAssessment.overallRiskLevel, count: count() })
      .from(lksgAssessment)
      .where(eq(lksgAssessment.orgId, ctx.orgId))
      .groupBy(lksgAssessment.overallRiskLevel),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of assessmentsByStatus) {
    byStatus[row.status] = row.count;
  }

  const byRiskLevel: Record<string, number> = {};
  for (const row of assessmentsByRiskLevel) {
    if (row.level) byRiskLevel[row.level] = row.count;
  }

  return Response.json({
    data: {
      totalVendors,
      lksgRelevant,
      lksgVendors,
      byStatus,
      byRiskLevel,
    },
  });
}
