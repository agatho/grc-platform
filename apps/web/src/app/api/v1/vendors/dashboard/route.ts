import { db, vendor, vendorDueDiligence, vendorRiskAssessment } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, count, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/vendors/dashboard — Vendor TPRM KPIs
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const baseWhere = and(eq(vendor.orgId, ctx.orgId), isNull(vendor.deletedAt));

  const [
    [{ value: totalVendors }],
    tierDistribution,
    statusDistribution,
    [{ value: lksgRelevantCount }],
    overdueAssessments,
    pendingDD,
  ] = await Promise.all([
    // Total vendors
    db.select({ value: count() }).from(vendor).where(baseWhere),

    // By tier
    db
      .select({
        tier: vendor.tier,
        count: count(),
      })
      .from(vendor)
      .where(baseWhere)
      .groupBy(vendor.tier),

    // By status
    db
      .select({
        status: vendor.status,
        count: count(),
      })
      .from(vendor)
      .where(baseWhere)
      .groupBy(vendor.status),

    // LkSG relevant
    db
      .select({ value: count() })
      .from(vendor)
      .where(and(baseWhere, eq(vendor.isLksgRelevant, true))),

    // Overdue assessments (nextAssessmentDate < today)
    db
      .select({
        id: vendor.id,
        name: vendor.name,
        tier: vendor.tier,
        nextAssessmentDate: vendor.nextAssessmentDate,
      })
      .from(vendor)
      .where(
        and(baseWhere, sql`${vendor.nextAssessmentDate}::date < CURRENT_DATE`),
      )
      .limit(20),

    // Pending DD questionnaires
    db
      .select({
        id: vendorDueDiligence.id,
        vendorId: vendorDueDiligence.vendorId,
        status: vendorDueDiligence.status,
        sentAt: vendorDueDiligence.sentAt,
      })
      .from(vendorDueDiligence)
      .where(
        and(
          eq(vendorDueDiligence.orgId, ctx.orgId),
          sql`${vendorDueDiligence.status} IN ('pending', 'in_progress')`,
        ),
      )
      .limit(20),
  ]);

  const byTier: Record<string, number> = {};
  for (const row of tierDistribution) {
    byTier[row.tier] = row.count;
  }

  const byStatus: Record<string, number> = {};
  for (const row of statusDistribution) {
    byStatus[row.status] = row.count;
  }

  return Response.json({
    data: {
      totalVendors,
      byTier,
      byStatus,
      lksgRelevantCount,
      overdueAssessments,
      pendingDueDiligence: pendingDD,
    },
  });
}
