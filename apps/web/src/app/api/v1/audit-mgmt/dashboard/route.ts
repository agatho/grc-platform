import { db, audit, auditUniverseEntry, finding } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, count, sql, lte, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/audit-mgmt/dashboard — KPIs
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const today = new Date().toISOString().split("T")[0];

  const auditBase = and(eq(audit.orgId, ctx.orgId), isNull(audit.deletedAt));

  const universeBase = and(
    eq(auditUniverseEntry.orgId, ctx.orgId),
    isNull(auditUniverseEntry.deletedAt),
  );

  const [
    [{ value: totalAudits }],
    [{ value: plannedAudits }],
    [{ value: inProgressAudits }],
    [{ value: completedAudits }],
    [{ value: overdueAudits }],
    [{ value: universeTotal }],
    [{ value: universeNeverAudited }],
    [{ value: universeOverdue }],
    findingsBySeverity,
  ] = await Promise.all([
    // Total audits
    db.select({ value: count() }).from(audit).where(auditBase),
    // Planned
    db
      .select({ value: count() })
      .from(audit)
      .where(and(auditBase, eq(audit.status, "planned"))),
    // In progress (preparation + fieldwork + reporting + review)
    db
      .select({ value: count() })
      .from(audit)
      .where(
        and(
          auditBase,
          inArray(audit.status, [
            "preparation",
            "fieldwork",
            "reporting",
            "review",
          ]),
        ),
      ),
    // Completed
    db
      .select({ value: count() })
      .from(audit)
      .where(and(auditBase, eq(audit.status, "completed"))),
    // Overdue (planned end < today and status not completed/cancelled)
    db
      .select({ value: count() })
      .from(audit)
      .where(
        and(
          auditBase,
          lte(audit.plannedEnd, today),
          sql`${audit.status} NOT IN ('completed', 'cancelled')`,
        ),
      ),
    // Universe total
    db.select({ value: count() }).from(auditUniverseEntry).where(universeBase),
    // Universe never audited
    db
      .select({ value: count() })
      .from(auditUniverseEntry)
      .where(and(universeBase, isNull(auditUniverseEntry.lastAuditDate))),
    // Universe overdue
    db
      .select({ value: count() })
      .from(auditUniverseEntry)
      .where(and(universeBase, lte(auditUniverseEntry.nextAuditDue, today))),
    // Findings by severity (for audits)
    db
      .select({
        severity: finding.severity,
        count: count(),
      })
      .from(finding)
      .where(
        and(
          eq(finding.orgId, ctx.orgId),
          eq(finding.source, "audit"),
          isNull(finding.deletedAt),
        ),
      )
      .groupBy(finding.severity),
  ]);

  const universeCoverage =
    universeTotal > 0
      ? Math.round(
          ((universeTotal - universeNeverAudited) / universeTotal) * 100,
        )
      : 0;

  return Response.json({
    data: {
      totalAudits,
      plannedAudits,
      inProgressAudits,
      completedAudits,
      overdueAudits,
      universe: {
        total: universeTotal,
        neverAudited: universeNeverAudited,
        overdue: universeOverdue,
        coveragePercent: universeCoverage,
      },
      findingsBySeverity: findingsBySeverity.reduce(
        (acc, row) => {
          acc[row.severity] = row.count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    },
  });
}
