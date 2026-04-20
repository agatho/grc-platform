import {
  db,
  contract,
  contractObligation,
  contractSla,
  contractSlaMeasurement,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, count, sql, sum } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/contracts/dashboard — Contract KPIs
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("contract", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const baseWhere = and(
    eq(contract.orgId, ctx.orgId),
    isNull(contract.deletedAt),
  );

  const [
    [{ value: totalContracts }],
    statusDistribution,
    typeDistribution,
    portfolioValue,
    upcomingExpirations,
    overdueObligations,
    recentBreaches,
  ] = await Promise.all([
    // Total
    db.select({ value: count() }).from(contract).where(baseWhere),

    // By status
    db
      .select({ status: contract.status, count: count() })
      .from(contract)
      .where(baseWhere)
      .groupBy(contract.status),

    // By type
    db
      .select({ contractType: contract.contractType, count: count() })
      .from(contract)
      .where(baseWhere)
      .groupBy(contract.contractType),

    // Portfolio annual value
    db
      .select({ total: sum(contract.annualValue) })
      .from(contract)
      .where(and(baseWhere, eq(contract.status, "active"))),

    // Expiring within 90 days
    db
      .select({
        id: contract.id,
        title: contract.title,
        expirationDate: contract.expirationDate,
        autoRenewal: contract.autoRenewal,
        vendorId: contract.vendorId,
      })
      .from(contract)
      .where(
        and(
          baseWhere,
          sql`${contract.expirationDate}::date BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '90 days'`,
          sql`${contract.status} IN ('active', 'renewal')`,
        ),
      )
      .limit(20),

    // Overdue obligations
    db
      .select({
        id: contractObligation.id,
        contractId: contractObligation.contractId,
        title: contractObligation.title,
        dueDate: contractObligation.dueDate,
        status: contractObligation.status,
      })
      .from(contractObligation)
      .where(
        and(
          eq(contractObligation.orgId, ctx.orgId),
          eq(contractObligation.status, "overdue"),
        ),
      )
      .limit(20),

    // Recent SLA breaches
    db
      .select({
        id: contractSlaMeasurement.id,
        slaId: contractSlaMeasurement.slaId,
        metricName: contractSla.metricName,
        actualValue: contractSlaMeasurement.actualValue,
        periodEnd: contractSlaMeasurement.periodEnd,
      })
      .from(contractSlaMeasurement)
      .innerJoin(contractSla, eq(contractSlaMeasurement.slaId, contractSla.id))
      .where(
        and(
          eq(contractSlaMeasurement.orgId, ctx.orgId),
          eq(contractSlaMeasurement.isBreach, true),
        ),
      )
      .orderBy(sql`${contractSlaMeasurement.periodEnd} DESC`)
      .limit(10),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of statusDistribution) {
    byStatus[row.status] = row.count;
  }

  const byType: Record<string, number> = {};
  for (const row of typeDistribution) {
    byType[row.contractType] = row.count;
  }

  return Response.json({
    data: {
      totalContracts,
      byStatus,
      byType,
      portfolioAnnualValue: portfolioValue[0]?.total ?? "0",
      upcomingExpirations,
      overdueObligations,
      recentBreaches,
    },
  });
}
