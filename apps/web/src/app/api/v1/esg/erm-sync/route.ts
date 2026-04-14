import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

/**
 * POST /api/v1/esg/erm-sync
 * Synchronizes material ESG risk IROs into the ERM risk register.
 * - Reads threshold from erm_sync_config (module_key = 'esg')
 * - Creates risk entries for materiality_iro where is_material = true,
 *   iro_type = 'risk', financial_materiality_score >= threshold, erm_risk_id IS NULL
 * - Updates materiality_iro.erm_risk_id and erm_synced_at
 */
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const synced = await withAuditContext(ctx, async (tx) => {
    // 1. Read threshold from erm_sync_config
    const configResult = await tx.execute(
      sql`SELECT score_threshold FROM erm_sync_config
          WHERE org_id = ${ctx.orgId} AND module_key = 'esg'
          LIMIT 1`,
    );
    const threshold = configResult.rows?.[0]?.score_threshold ?? 15;

    // 2. Find material risk IROs eligible for sync
    const candidates = await tx.execute(
      sql`SELECT mi.id, mi.title, mi.esrs_topic,
                 mi.financial_materiality_score, mi.impact_materiality_score
          FROM materiality_iro mi
          WHERE mi.org_id = ${ctx.orgId}
            AND mi.is_material = true
            AND mi.iro_type = 'risk'
            AND mi.financial_materiality_score IS NOT NULL
            AND mi.financial_materiality_score >= ${threshold}
            AND mi.erm_risk_id IS NULL`,
    );

    if (!candidates.rows?.length) {
      return [];
    }

    const results: Array<{ iroId: string; riskId: string; title: string }> = [];

    // 3. For each candidate, create a risk entry and link back
    for (const row of candidates.rows) {
      const title = `ESG-Risiko: ${row.title}`;
      const description = `ESRS ${row.esrs_topic} — Automatisch aus ESG-Wesentlichkeitsanalyse synchronisiert. Finanzielle Wesentlichkeit: ${row.financial_materiality_score}, Impact: ${row.impact_materiality_score ?? "k.A."}`;

      const riskResult = await tx.execute(
        sql`INSERT INTO risk (
              id, org_id, title, description,
              risk_source, risk_category, status,
              inherent_likelihood, inherent_impact, inherent_score,
              created_by, created_at, updated_at
            ) VALUES (
              gen_random_uuid(), ${ctx.orgId}, ${title},
              ${description},
              'esg', 'esg', 'identified',
              3, ${Math.min(5, Math.ceil((row.financial_materiality_score as number) / 5))},
              ${row.financial_materiality_score},
              ${ctx.userId}, NOW(), NOW()
            )
            RETURNING id`,
      );

      const riskId = riskResult.rows?.[0]?.id as string;

      // 4. Update materiality_iro with erm_risk_id
      await tx.execute(
        sql`UPDATE materiality_iro
            SET erm_risk_id = ${riskId},
                erm_synced_at = NOW(),
                updated_at = NOW()
            WHERE id = ${row.id} AND org_id = ${ctx.orgId}`,
      );

      results.push({
        iroId: row.id as string,
        riskId,
        title,
      });
    }

    return results;
  });

  return Response.json({
    data: {
      syncedCount: synced.length,
      items: synced,
    },
  });
}
