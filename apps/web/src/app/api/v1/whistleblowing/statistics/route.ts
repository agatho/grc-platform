// GET /api/v1/whistleblowing/statistics — Anonymized KPIs (HinSchG officers)
//
// #WAVE13-RBAC-03: was `[admin, risk_manager]` — risk_manager has no role in
// HinSchG handling and shouldn't see even anonymized whistleblowing KPIs
// (cross-domain conflict-of-interest). Moved to the same officer set as the
// cases routes; admins retain access for platform-level oversight.

import { db, wbCase } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, gte, lt, count } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-076]
//
// Sieben Aggregatabfragen ueber `db.execute(sql`…`)`. Bis Welle 4b stand
// hier siebenmal `as any[]` bzw. `(x as any)[0]`.
//
// Wichtig an dieser Datei: `COUNT(*)` ist in Postgres `bigint`, und der
// Treiber `postgres` liefert `bigint` und `numeric` als ZEICHENKETTE. Der
// Code rechnete an drei Stellen bereits mit `Number(...)`, an zwei aber
// nicht (`sla7dRow.compliant / sla7dRow.total`) — das ging nur gut, weil
// JavaScript beim `/` selbst umwandelt und weil `any` die Frage gar nicht
// erst stellte. Die Zeilenformen nennen den Treibertyp deshalb ehrlich als
// `string | number`; die beiden Divisionen wandeln jetzt sichtbar um.

/** `COUNT(*)`/`AVG(...)` — vom Treiber als Zeichenkette geliefert. */
type NumericCell = string | number;

type AvgDaysRow = { avg_days: NumericCell | null };
type SlaRow = { compliant: NumericCell | null; total: NumericCell | null };
type CategoryRow = { category: string; cnt: NumericCell };
type MonthRow = { month: string; cnt: NumericCell };
type ResolutionRow = { resolution_category: string; cnt: NumericCell };
type StatusRow = { status: string; cnt: NumericCell };

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "whistleblowing_officer", "ombudsperson");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule(
    "whistleblowing",
    ctx.orgId,
    req.method,
  );
  if (moduleCheck) return moduleCheck;

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfPrevYear = new Date(now.getFullYear() - 1, 0, 1);
  const endOfPrevYear = new Date(now.getFullYear(), 0, 1);

  // Total YTD
  const [ytdResult] = await db
    .select({ total: count() })
    .from(wbCase)
    .where(
      and(eq(wbCase.orgId, ctx.orgId), gte(wbCase.createdAt, startOfYear)),
    );

  // Total previous year
  const [prevYearResult] = await db
    .select({ total: count() })
    .from(wbCase)
    .where(
      and(
        eq(wbCase.orgId, ctx.orgId),
        gte(wbCase.createdAt, startOfPrevYear),
        lt(wbCase.createdAt, endOfPrevYear),
      ),
    );

  // Average resolution time (days) for resolved cases
  const avgResResult = await db.execute(
    sql`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400), 0) as avg_days
        FROM wb_case WHERE org_id = ${ctx.orgId} AND resolved_at IS NOT NULL`,
  );
  const avgResolutionDays = Math.round(
    Number((avgResResult as unknown as AvgDaysRow[])[0]?.avg_days ?? 0),
  );

  // 7-day SLA compliance (acknowledged within 7 days)
  const sla7dResult = await db.execute(
    sql`SELECT
          COUNT(*) FILTER (WHERE acknowledged_at IS NOT NULL AND acknowledged_at <= acknowledge_deadline) as compliant,
          COUNT(*) FILTER (WHERE acknowledged_at IS NOT NULL OR (acknowledge_deadline < NOW() AND acknowledged_at IS NULL)) as total
        FROM wb_case WHERE org_id = ${ctx.orgId}`,
  );
  const sla7dRow = (sla7dResult as unknown as SlaRow[])[0];
  const sla7dTotal = Number(sla7dRow?.total ?? 0);
  const sla7dCompliance =
    sla7dTotal > 0
      ? Math.round((Number(sla7dRow?.compliant ?? 0) / sla7dTotal) * 100)
      : 100;

  // 3-month SLA compliance (resolved within 3 months)
  const sla3mResult = await db.execute(
    sql`SELECT
          COUNT(*) FILTER (WHERE resolved_at IS NOT NULL AND resolved_at <= response_deadline) as compliant,
          COUNT(*) FILTER (WHERE resolved_at IS NOT NULL OR (response_deadline < NOW() AND resolved_at IS NULL)) as total
        FROM wb_case WHERE org_id = ${ctx.orgId}`,
  );
  const sla3mRow = (sla3mResult as unknown as SlaRow[])[0];
  const sla3mTotal = Number(sla3mRow?.total ?? 0);
  const sla3mCompliance =
    sla3mTotal > 0
      ? Math.round((Number(sla3mRow?.compliant ?? 0) / sla3mTotal) * 100)
      : 100;

  // Category distribution (YTD)
  const categoryResult = await db.execute(
    sql`SELECT r.category, COUNT(*) as cnt
        FROM wb_case c
        JOIN wb_report r ON r.id = c.report_id
        WHERE c.org_id = ${ctx.orgId} AND c.created_at >= ${startOfYear}
        GROUP BY r.category`,
  );
  const byCategory: Record<string, number> = {};
  for (const row of categoryResult as unknown as CategoryRow[]) {
    byCategory[row.category] = Number(row.cnt);
  }

  // Monthly trend (last 12 months)
  const monthlyResult = await db.execute(
    sql`SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as cnt
        FROM wb_case
        WHERE org_id = ${ctx.orgId}
          AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month`,
  );
  const byMonth = (monthlyResult as unknown as MonthRow[]).map((r) => ({
    month: r.month,
    count: Number(r.cnt),
  }));

  // Resolution distribution
  const resolutionResult = await db.execute(
    sql`SELECT resolution_category, COUNT(*) as cnt
        FROM wb_case
        WHERE org_id = ${ctx.orgId} AND resolution_category IS NOT NULL
        GROUP BY resolution_category`,
  );
  const byResolution: Record<string, number> = {};
  for (const row of resolutionResult as unknown as ResolutionRow[]) {
    byResolution[row.resolution_category] = Number(row.cnt);
  }

  // Status distribution
  const statusResult = await db.execute(
    sql`SELECT status, COUNT(*) as cnt
        FROM wb_case WHERE org_id = ${ctx.orgId}
        GROUP BY status`,
  );
  const byStatus: Record<string, number> = {};
  for (const row of statusResult as unknown as StatusRow[]) {
    byStatus[row.status] = Number(row.cnt);
  }

  return Response.json({
    data: {
      totalYtd: ytdResult.total,
      totalPreviousYear: prevYearResult.total,
      avgResolutionDays,
      sla7dCompliance,
      sla3mCompliance,
      byCategory,
      byMonth,
      byResolution,
      byStatus,
    },
  });
});
