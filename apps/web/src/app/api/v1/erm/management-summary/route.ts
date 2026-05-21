import { managementSummaryRequestSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// Shared aggregation used by GET (default period) and POST (custom period).
// No mutations, no side-effects — pure read aggregation across risk +
// risk_treatment scoped to ctx.orgId, safe for the broader read RBAC the
// GET handler exposes (CISO quarterly review, etc.).
async function buildSummary(
  orgId: string,
  periodStart: string,
  periodEnd: string,
  language: "de" | "en",
  generatedBy: string,
) {
  const totalResult = await db.execute(
    sql`SELECT COUNT(*) as count FROM risk
        WHERE org_id = ${orgId} AND deleted_at IS NULL`,
  );

  const newResult = await db.execute(
    sql`SELECT COUNT(*) as count FROM risk
        WHERE org_id = ${orgId} AND deleted_at IS NULL
          AND created_at >= ${periodStart}::timestamptz
          AND created_at <= ${periodEnd}::timestamptz`,
  );

  const categoryResult = await db.execute(
    sql`SELECT risk_category as category, COUNT(*) as count
        FROM risk
        WHERE org_id = ${orgId} AND deleted_at IS NULL
        GROUP BY risk_category`,
  );

  const valueResult = await db.execute(
    sql`SELECT
          CASE
            WHEN risk_value >= 81 THEN 'critical'
            WHEN risk_value >= 61 THEN 'high'
            WHEN risk_value >= 41 THEN 'medium'
            WHEN risk_value >= 21 THEN 'low'
            WHEN risk_value >= 1 THEN 'minimal'
            ELSE 'not_evaluated'
          END as range,
          COUNT(*) as count
        FROM risk
        WHERE org_id = ${orgId} AND deleted_at IS NULL
        GROUP BY 1 ORDER BY 1`,
  );

  const topRisksResult = await db.execute(
    sql`SELECT id, title, risk_category, risk_score_inherent, risk_score_residual, risk_value
        FROM risk
        WHERE org_id = ${orgId} AND deleted_at IS NULL
        ORDER BY risk_value DESC NULLS LAST
        LIMIT 10`,
  );

  const treatmentResult = await db.execute(
    sql`SELECT status, COUNT(*) as count
        FROM risk_treatment
        WHERE org_id = ${orgId} AND deleted_at IS NULL
        GROUP BY status`,
  );

  // #WAVE24-B3: findings + controls roll-up so the GET response carries
  // the "risks/controls/findings summary" the quarterly review expects.
  const findingsResult = await db.execute(
    sql`SELECT status, COUNT(*) as count
        FROM finding
        WHERE org_id = ${orgId} AND deleted_at IS NULL
        GROUP BY status`,
  );

  const controlsResult = await db.execute(
    sql`SELECT status, COUNT(*) as count
        FROM control
        WHERE org_id = ${orgId} AND deleted_at IS NULL
        GROUP BY status`,
  );

  const rows = (r: unknown): Record<string, unknown>[] =>
    Array.isArray(r) ? (r as Record<string, unknown>[]) : [];

  return {
    language,
    period: { start: periodStart, end: periodEnd },
    generatedAt: new Date().toISOString(),
    generatedBy,
    summary: {
      totalRisks: Number(rows(totalResult)[0]?.count ?? 0),
      newRisksInPeriod: Number(rows(newResult)[0]?.count ?? 0),
    },
    risksSummary: {
      total: Number(rows(totalResult)[0]?.count ?? 0),
      newInPeriod: Number(rows(newResult)[0]?.count ?? 0),
      byCategory: rows(categoryResult),
      byValueRange: rows(valueResult),
      top: rows(topRisksResult),
    },
    controlsSummary: {
      byStatus: rows(controlsResult),
    },
    findingsSummary: {
      byStatus: rows(findingsResult),
    },
    treatmentSummary: rows(treatmentResult),
    // Legacy fields kept for callers of the POST shape.
    categoryDistribution: categoryResult,
    valueDistribution: valueResult,
    topRisks: topRisksResult,
  };
}

// GET /api/v1/erm/management-summary — Read-only summary for the
// current quarter (or ?periodStart / ?periodEnd overrides). Broader
// RBAC than POST since this never mutates anything.
//
// #WAVE24-B3: was 405 because only POST was wired. CISO/compliance
// officers need a read-only snapshot for quarterly governance reviews
// without triggering the POST PDF-generation path.
export async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "auditor",
    "ciso",
    "compliance_officer",
    "process_owner",
    "control_owner",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const now = new Date();
  const quarterStart = new Date(
    now.getUTCFullYear(),
    Math.floor(now.getUTCMonth() / 3) * 3,
    1,
  );
  const periodStart =
    url.searchParams.get("periodStart") ?? quarterStart.toISOString();
  const periodEnd = url.searchParams.get("periodEnd") ?? now.toISOString();
  const language =
    (url.searchParams.get("language") as "de" | "en" | null) ?? "de";

  const data = await buildSummary(
    ctx.orgId,
    periodStart,
    periodEnd,
    language,
    ctx.session.user.name ?? ctx.userId,
  );
  return Response.json({ data });
}

// POST /api/v1/erm/management-summary — Generate Management Summary PDF data
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = managementSummaryRequestSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const { period_start, period_end, language } = body.data;

  const data = await buildSummary(
    ctx.orgId,
    period_start,
    period_end,
    language,
    ctx.session.user.name ?? ctx.userId,
  );
  return Response.json({ data });
}
