import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

/**
 * POST /api/v1/bcms/erm-sync
 * Synchronizes high-risk crisis scenarios into the ERM risk register.
 * - Reads threshold from erm_sync_config (module_key = 'bcms')
 * - Creates risk entries for crisis_scenarios where risk_score >= threshold and erm_risk_id IS NULL
 * - Updates crisis_scenario.erm_risk_id and erm_synced_at
 */
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const synced = await withAuditContext(ctx, async (tx) => {
    // 1. Read threshold from erm_sync_config
    const configResult = await tx.execute(
      sql`SELECT score_threshold FROM erm_sync_config
          WHERE org_id = ${ctx.orgId} AND module_key = 'bcms'
          LIMIT 1`,
    );
    const threshold = configResult.rows?.[0]?.score_threshold ?? 12;

    // 2. Find crisis scenarios eligible for sync
    const candidates = await tx.execute(
      sql`SELECT id, name, risk_score, likelihood, severity_level
          FROM crisis_scenario
          WHERE org_id = ${ctx.orgId}
            AND risk_score IS NOT NULL
            AND risk_score >= ${threshold}
            AND erm_risk_id IS NULL
            AND deleted_at IS NULL`,
    );

    if (!candidates.rows?.length) {
      return [];
    }

    const results: Array<{ crisisId: string; riskId: string; title: string }> =
      [];

    // 3. For each candidate, create a risk entry and link back
    for (const row of candidates.rows) {
      const title = `BC-Risiko: ${row.name}`;
      const riskResult = await tx.execute(
        sql`INSERT INTO risk (
              id, org_id, title, description,
              risk_source, risk_category, status,
              inherent_likelihood, inherent_impact, inherent_score,
              created_by, created_at, updated_at
            ) VALUES (
              gen_random_uuid(), ${ctx.orgId}, ${title},
              ${"Automatisch aus BCMS-Krisenszenario synchronisiert."},
              'bcm', 'operational', 'identified',
              ${row.likelihood ?? 3}, ${row.severity_level ?? 3}, ${row.risk_score},
              ${ctx.userId}, NOW(), NOW()
            )
            RETURNING id`,
      );

      const riskId = riskResult.rows?.[0]?.id as string;

      // 4. Update crisis_scenario with erm_risk_id
      await tx.execute(
        sql`UPDATE crisis_scenario
            SET erm_risk_id = ${riskId},
                erm_synced_at = NOW(),
                updated_at = NOW()
            WHERE id = ${row.id} AND org_id = ${ctx.orgId}`,
      );

      results.push({
        crisisId: row.id as string,
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
