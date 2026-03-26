import { db, ropaEntry, dpia, dsr, dataBreach, tia } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/dpms/dashboard — DPMS Dashboard KPIs
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const orgId = ctx.orgId;

  const [
    ropaTotal,
    ropaDraft,
    ropaActive,
    ropaUnderReview,
    ropaArchived,
    activeDpias,
    openDsrs,
    dsrOverdue,
    activeBreaches,
    breachesNeedingNotification,
    tiaTotal,
    tiaHighRisk,
  ] = await Promise.all([
    db.select({ value: count() }).from(ropaEntry).where(and(eq(ropaEntry.orgId, orgId), isNull(ropaEntry.deletedAt))),
    db.select({ value: count() }).from(ropaEntry).where(and(eq(ropaEntry.orgId, orgId), isNull(ropaEntry.deletedAt), eq(ropaEntry.status, "draft"))),
    db.select({ value: count() }).from(ropaEntry).where(and(eq(ropaEntry.orgId, orgId), isNull(ropaEntry.deletedAt), eq(ropaEntry.status, "active"))),
    db.select({ value: count() }).from(ropaEntry).where(and(eq(ropaEntry.orgId, orgId), isNull(ropaEntry.deletedAt), eq(ropaEntry.status, "under_review"))),
    db.select({ value: count() }).from(ropaEntry).where(and(eq(ropaEntry.orgId, orgId), isNull(ropaEntry.deletedAt), eq(ropaEntry.status, "archived"))),
    db.select({ value: count() }).from(dpia).where(and(eq(dpia.orgId, orgId), isNull(dpia.deletedAt), sql`${dpia.status} NOT IN ('approved', 'rejected')`)),
    db.select({ value: count() }).from(dsr).where(and(eq(dsr.orgId, orgId), sql`${dsr.status} NOT IN ('closed', 'rejected')`)),
    db.select({ value: count() }).from(dsr).where(and(eq(dsr.orgId, orgId), sql`${dsr.status} NOT IN ('closed', 'rejected')`, sql`${dsr.deadline} < NOW()`)),
    db.select({ value: count() }).from(dataBreach).where(and(eq(dataBreach.orgId, orgId), isNull(dataBreach.deletedAt), sql`${dataBreach.status} != 'closed'`)),
    db.select({ value: count() }).from(dataBreach).where(and(eq(dataBreach.orgId, orgId), isNull(dataBreach.deletedAt), eq(dataBreach.isDpaNotificationRequired, true), isNull(dataBreach.dpaNotifiedAt), sql`${dataBreach.status} != 'closed'`)),
    db.select({ value: count() }).from(tia).where(and(eq(tia.orgId, orgId), isNull(tia.deletedAt))),
    db.select({ value: count() }).from(tia).where(and(eq(tia.orgId, orgId), isNull(tia.deletedAt), eq(tia.riskRating, "high"))),
  ]);

  const dashboard = {
    ropaEntryCount: ropaTotal[0].value,
    ropaByStatus: {
      draft: ropaDraft[0].value,
      active: ropaActive[0].value,
      under_review: ropaUnderReview[0].value,
      archived: ropaArchived[0].value,
    },
    activeDpiaCount: activeDpias[0].value,
    openDsrCount: openDsrs[0].value,
    dsrOverdueCount: dsrOverdue[0].value,
    activeBreachCount: activeBreaches[0].value,
    breachesRequiringNotification: breachesNeedingNotification[0].value,
    tiaCount: tiaTotal[0].value,
    tiaHighRiskCount: tiaHighRisk[0].value,
  };

  return Response.json({ data: dashboard });
}
