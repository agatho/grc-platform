import { db, auditUniverseEntry } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/audit-mgmt/plans/suggest — Auto-suggest audit plan items
// Sorted by risk_score DESC, days_since_last_audit DESC
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const limit = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("limit")) || 20),
  );

  const today = new Date().toISOString().split("T")[0];

  const entries = await db
    .select({
      id: auditUniverseEntry.id,
      name: auditUniverseEntry.name,
      entityType: auditUniverseEntry.entityType,
      riskScore: auditUniverseEntry.riskScore,
      lastAuditDate: auditUniverseEntry.lastAuditDate,
      nextAuditDue: auditUniverseEntry.nextAuditDue,
      auditCycleMonths: auditUniverseEntry.auditCycleMonths,
      priority: auditUniverseEntry.priority,
      daysSinceLastAudit: sql<number>`
        CASE
          WHEN ${auditUniverseEntry.lastAuditDate} IS NULL THEN 9999
          ELSE EXTRACT(DAY FROM (CURRENT_DATE - ${auditUniverseEntry.lastAuditDate}::date))
        END
      `.as("days_since_last_audit"),
    })
    .from(auditUniverseEntry)
    .where(
      and(
        eq(auditUniverseEntry.orgId, ctx.orgId),
        isNull(auditUniverseEntry.deletedAt),
      ),
    )
    .orderBy(
      desc(auditUniverseEntry.riskScore),
      sql`CASE WHEN ${auditUniverseEntry.lastAuditDate} IS NULL THEN 0 ELSE 1 END ASC`,
      desc(
        sql`EXTRACT(DAY FROM (CURRENT_DATE - COALESCE(${auditUniverseEntry.lastAuditDate}::date, '2000-01-01')))`,
      ),
    )
    .limit(limit);

  return Response.json({ data: entries });
}
