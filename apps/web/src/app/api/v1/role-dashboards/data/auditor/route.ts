import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { auditorDashboardQuerySchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/role-dashboards/data/auditor — Auditor Dashboard data
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  // [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-077 → OP-176] Das Ergebnis der
  // Pruefung wird bewusst NICHT gebunden: die Route wertet die validierten
  // Parameter nicht aus. Der `parse`-Aufruf bleibt stehen, weil er die
  // EINGABEPRUEFUNG ist (ungueltige Werte werden weiterhin abgewiesen); dass
  // die Werte danach nirgends wirken, ist ein eigener Befund und steht als
  // OP-176 im Register.
  auditorDashboardQuerySchema.parse(Object.fromEntries(url.searchParams));

  // Findings overview
  const findingsOverview = await db.execute(sql`
    SELECT
      severity,
      status,
      count(*)::int as count
    FROM finding WHERE org_id = ${ctx.orgId}
    GROUP BY severity, status
    ORDER BY severity, status
  `);

  // Evidence quality metrics
  const [evidenceQuality] = await db.execute(sql`
    SELECT
      count(*)::int as total_evidence,
      count(*) FILTER (WHERE file_path IS NOT NULL)::int as with_attachment,
      count(*) FILTER (WHERE created_at > now() - interval '90 days')::int as recent_evidence
    FROM evidence WHERE org_id = ${ctx.orgId}
  `);

  // Open audit findings by age
  const findingsByAge = await db.execute(sql`
    SELECT
      CASE
        WHEN created_at > now() - interval '30 days' THEN 'under_30d'
        WHEN created_at > now() - interval '90 days' THEN '30_90d'
        ELSE 'over_90d'
      END as age_bucket,
      count(*)::int as count
    FROM finding
    WHERE org_id = ${ctx.orgId} AND status = 'open'
    GROUP BY 1
  `);

  return Response.json({
    data: {
      findingsOverview,
      evidenceQuality,
      findingsByAge,
      generatedAt: new Date().toISOString(),
    },
  });
});
