import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

/**
 * GET /api/v1/dpms/erm-sync?check=true
 * Returns privacy risk aggregation: total, by severity bucket, synced count.
 *
 * POST /api/v1/dpms/erm-sync
 * Synchronises high-score DPIA risks into the central ERM risk register.
 * Uses raw SQL because numeric_likelihood, numeric_impact, risk_score,
 * erm_risk_id, erm_synced_at are migration-only columns.
 */

// ── GET: risk aggregation + sync status ───────────────────────
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "dpo", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const result = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE risk_score >= 20)::int AS critical,
      COUNT(*) FILTER (WHERE risk_score BETWEEN 12 AND 19)::int AS high,
      COUNT(*) FILTER (WHERE risk_score BETWEEN 6 AND 11)::int AS medium,
      COUNT(*) FILTER (WHERE risk_score BETWEEN 1 AND 5)::int AS low,
      COUNT(*) FILTER (WHERE erm_risk_id IS NOT NULL)::int AS synced_to_erm,
      COUNT(*) FILTER (
        WHERE erm_risk_id IS NULL
        AND risk_score >= COALESCE(
          (SELECT score_threshold FROM erm_sync_config
           WHERE org_id = ${ctx.orgId} AND module_key = 'dpms' LIMIT 1),
          12
        )
      )::int AS unsynced_high_count
    FROM dpia_risk
    WHERE org_id = ${ctx.orgId}
      AND risk_score IS NOT NULL
      AND risk_score > 0
  `);

  const row = (result as unknown as Record<string, unknown>[])[0] ?? {};

  return Response.json({
    data: {
      total: Number(row.total ?? 0),
      critical: Number(row.critical ?? 0),
      high: Number(row.high ?? 0),
      medium: Number(row.medium ?? 0),
      low: Number(row.low ?? 0),
      syncedToErm: Number(row.synced_to_erm ?? 0),
      unsyncedHighCount: Number(row.unsynced_high_count ?? 0),
    },
  });
}

// ── POST: sync to ERM ─────────────────────────────────────────
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "dpo", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // 1. Read sync config
  const configResult = await db.execute(sql`
    SELECT score_threshold, default_risk_category, default_treatment_strategy, sync_enabled
    FROM erm_sync_config
    WHERE org_id = ${ctx.orgId} AND module_key = 'dpms'
    LIMIT 1
  `);

  const config = (configResult as unknown as Record<string, unknown>[])[0];
  const threshold = Number(config?.score_threshold ?? 12);
  const riskCategory = String(config?.default_risk_category ?? "compliance");
  const treatmentStrategy = String(
    config?.default_treatment_strategy ?? "mitigate",
  );

  if (config && config.sync_enabled === false) {
    return Response.json(
      { error: "ERM-Synchronisation ist fuer DPMS deaktiviert" },
      { status: 400 },
    );
  }

  // 2. Find unsynced DPIA risks above threshold
  const unsyncedRows = await db.execute(sql`
    SELECT
      dr.id AS risk_id,
      dr.dpia_id,
      dr.risk_description,
      dr.numeric_likelihood,
      dr.numeric_impact,
      dr.risk_score,
      d.title AS dpia_title
    FROM dpia_risk dr
    JOIN dpia d ON d.id = dr.dpia_id AND d.org_id = ${ctx.orgId}
    WHERE dr.org_id = ${ctx.orgId}
      AND dr.erm_risk_id IS NULL
      AND dr.risk_score IS NOT NULL
      AND dr.risk_score >= ${threshold}
    ORDER BY dr.risk_score DESC
  `);

  const rows = (unsyncedRows as unknown as Record<string, unknown>[]) ?? [];

  if (rows.length === 0) {
    return Response.json({
      data: {
        syncedCount: 0,
        message: "Keine unzugeordneten Hochrisiko-DSFA-Risiken gefunden",
      },
    });
  }

  // 3. Create risk entries + update dpia_risk
  const syncedCount = await withAuditContext(ctx, async (tx) => {
    let count = 0;

    for (const row of rows) {
      const likelihood = Number(row.numeric_likelihood ?? 3);
      const impact = Number(row.numeric_impact ?? 3);
      const score = Number(row.risk_score ?? likelihood * impact);
      const desc = String(row.risk_description ?? "");
      const dpiaTitle = String(row.dpia_title ?? "");

      const riskInsert = await tx.execute(sql`
        INSERT INTO risk (
          org_id, title, description, risk_category, risk_source, status,
          inherent_likelihood, inherent_impact, risk_score_inherent,
          treatment_strategy, created_by, updated_by
        ) VALUES (
          ${ctx.orgId},
          ${"DPMS: " + dpiaTitle + " - " + desc.slice(0, 100)},
          ${"Automatisch synchronisiertes Datenschutzrisiko aus DSFA: " + dpiaTitle},
          ${riskCategory}::risk_category,
          'dpms'::risk_source,
          'identified'::risk_status,
          ${likelihood}, ${impact}, ${score},
          ${treatmentStrategy}::treatment_strategy,
          ${ctx.userId}, ${ctx.userId}
        )
        RETURNING id
      `);

      const riskId = riskInsert.rows?.[0]?.id;
      if (!riskId) continue;

      await tx.execute(sql`
        UPDATE dpia_risk
        SET erm_risk_id = ${riskId}::uuid, erm_synced_at = now()
        WHERE id = ${String(row.risk_id)}::uuid
      `);

      count++;
    }

    return count;
  });

  return Response.json({
    data: {
      syncedCount,
      message: `${syncedCount} Datenschutzrisiken ins ERM synchronisiert`,
    },
  });
}
