import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

/**
 * GET /api/v1/tprm/erm-sync?check=true
 * Returns sync status counts (synced / unsynced high-risk).
 *
 * POST /api/v1/tprm/erm-sync
 * Synchronises high-risk vendor assessments into the central ERM risk register.
 * Uses raw SQL because erm_risk_id / erm_synced_at are migration-only columns
 * not present in the Drizzle schema.
 */

// ── GET: sync status ──────────────────────────────────────────
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Count synced + unsynced high-risk vendor assessments
  const result = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE vra.erm_risk_id IS NOT NULL) AS synced_count,
      COUNT(*) FILTER (
        WHERE vra.erm_risk_id IS NULL
        AND vra.residual_risk_score >= COALESCE(
          (SELECT score_threshold FROM erm_sync_config
           WHERE org_id = ${ctx.orgId} AND module_key = 'tprm' LIMIT 1),
          15
        )
      ) AS unsynced_high_count
    FROM vendor_risk_assessment vra
    JOIN vendor v ON v.id = vra.vendor_id AND v.org_id = ${ctx.orgId}
    WHERE vra.org_id = ${ctx.orgId}
  `);

  const row = result.rows?.[0] ?? {};

  return Response.json({
    data: {
      syncedCount: Number(row.synced_count ?? 0),
      unsyncedHighCount: Number(row.unsynced_high_count ?? 0),
    },
  });
}

// ── POST: sync to ERM ─────────────────────────────────────────
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // 1. Read sync config
  const configResult = await db.execute(sql`
    SELECT score_threshold, default_risk_category, default_treatment_strategy, sync_enabled
    FROM erm_sync_config
    WHERE org_id = ${ctx.orgId} AND module_key = 'tprm'
    LIMIT 1
  `);

  const config = configResult.rows?.[0];
  const threshold = Number(config?.score_threshold ?? 15);
  const riskCategory = String(config?.default_risk_category ?? "operational");
  const treatmentStrategy = String(config?.default_treatment_strategy ?? "mitigate");

  if (config && config.sync_enabled === false) {
    return Response.json(
      { error: "ERM-Synchronisation ist fuer TPRM deaktiviert" },
      { status: 400 },
    );
  }

  // 2. Find unsynced assessments above threshold
  const unsyncedRows = await db.execute(sql`
    SELECT
      vra.id AS assessment_id,
      vra.vendor_id,
      v.name AS vendor_name,
      vra.inherent_risk_score,
      vra.residual_risk_score
    FROM vendor_risk_assessment vra
    JOIN vendor v ON v.id = vra.vendor_id AND v.org_id = ${ctx.orgId}
    WHERE vra.org_id = ${ctx.orgId}
      AND vra.erm_risk_id IS NULL
      AND vra.residual_risk_score >= ${threshold}
    ORDER BY vra.residual_risk_score DESC
  `);

  const rows = unsyncedRows.rows ?? [];

  if (rows.length === 0) {
    return Response.json({
      data: { syncedCount: 0, message: "Keine unzugeordneten Hochrisiko-Bewertungen gefunden" },
    });
  }

  // 3. Create risk entries in the central register + update vendor_risk_assessment
  const syncedCount = await withAuditContext(ctx, async (tx) => {
    let count = 0;

    for (const row of rows) {
      const inherentScore = Number(row.inherent_risk_score ?? 0);
      const residualScore = Number(row.residual_risk_score ?? 0);

      // Derive 1-5 likelihood/impact from the composite score
      const inherentLikelihood = Math.min(5, Math.max(1, Math.ceil(inherentScore / 5)));
      const inherentImpact = Math.min(5, Math.max(1, Math.ceil(inherentScore / inherentLikelihood)));
      const residualLikelihood = Math.min(5, Math.max(1, Math.ceil(residualScore / 5)));
      const residualImpact = Math.min(5, Math.max(1, Math.ceil(residualScore / residualLikelihood)));

      // Insert into central risk table
      const riskInsert = await tx.execute(sql`
        INSERT INTO risk (
          org_id, title, description, risk_category, risk_source, status,
          inherent_likelihood, inherent_impact, risk_score_inherent,
          residual_likelihood, residual_impact, risk_score_residual,
          treatment_strategy, created_by, updated_by
        ) VALUES (
          ${ctx.orgId},
          ${"TPRM: " + String(row.vendor_name)},
          ${"Automatisch synchronisiertes Lieferantenrisiko aus TPRM-Modul (Vendor: " + String(row.vendor_name) + ")"},
          ${riskCategory}::risk_category,
          'tprm'::risk_source,
          'identified'::risk_status,
          ${inherentLikelihood}, ${inherentImpact}, ${inherentScore},
          ${residualLikelihood}, ${residualImpact}, ${residualScore},
          ${treatmentStrategy}::treatment_strategy,
          ${ctx.userId}, ${ctx.userId}
        )
        RETURNING id
      `);

      const riskId = riskInsert.rows?.[0]?.id;
      if (!riskId) continue;

      // Update vendor_risk_assessment with ERM link
      await tx.execute(sql`
        UPDATE vendor_risk_assessment
        SET erm_risk_id = ${riskId}::uuid, erm_synced_at = now()
        WHERE id = ${String(row.assessment_id)}::uuid
      `);

      count++;
    }

    return count;
  });

  return Response.json({
    data: {
      syncedCount,
      message: `${syncedCount} Lieferantenrisiken ins ERM synchronisiert`,
    },
  });
}
