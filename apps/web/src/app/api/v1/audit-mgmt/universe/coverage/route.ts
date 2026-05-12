// #WAVE6-CROSS-03: GET /api/v1/audit-mgmt/universe/coverage was 500
// because the path landed on /universe/[id]/route.ts with id="coverage"
// → uuid parse crash. Same pattern as /bcms/crisis/dashboard, etc.
//
// Real implementation: aggregate the audit_universe_entry table by
// time-since-last-audit and overdue status. Useful for dashboards
// that show "X% of universe is covered, Y entries are overdue".

import { db, auditUniverseEntry } from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const today = new Date().toISOString().slice(0, 10);

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      withLastAudit: sql<number>`count(*) filter (where ${auditUniverseEntry.lastAuditDate} is not null)::int`,
      neverAudited: sql<number>`count(*) filter (where ${auditUniverseEntry.lastAuditDate} is null)::int`,
      overdue: sql<number>`count(*) filter (where ${auditUniverseEntry.nextAuditDue} is not null and ${auditUniverseEntry.nextAuditDue} < ${today})::int`,
      dueSoon: sql<number>`count(*) filter (where ${auditUniverseEntry.nextAuditDue} is not null and ${auditUniverseEntry.nextAuditDue} >= ${today} and ${auditUniverseEntry.nextAuditDue} < (current_date + interval '90 days'))::int`,
    })
    .from(auditUniverseEntry)
    .where(
      and(
        eq(auditUniverseEntry.orgId, ctx.orgId),
        isNull(auditUniverseEntry.deletedAt),
      ),
    );

  const total = stats?.total ?? 0;
  const withLast = stats?.withLastAudit ?? 0;
  const coveragePct = total > 0 ? Math.round((withLast / total) * 100) : 0;

  return Response.json({
    data: {
      total,
      withLastAudit: withLast,
      neverAudited: stats?.neverAudited ?? 0,
      overdue: stats?.overdue ?? 0,
      dueSoon: stats?.dueSoon ?? 0,
      coveragePercent: coveragePct,
      asOf: today,
    },
  });
});
