// Cron Job: Executive KPI Snapshot (Weekly Monday 06:00)
// Captures cross-module KPIs to executiveKpiSnapshot for trend charts.

import {
  db,
  executiveKpiSnapshot,
  controlEffectivenessScore,
  risk,
  finding,
  findingSlaConfig,
  organization,
} from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { isWithinSla } from "@grc/shared";

interface SnapshotResult {
  processed: number;
  errors: number;
}

export async function processExecutiveKpiSnapshot(): Promise<SnapshotResult> {
  const now = new Date();
  const snapshotDate = now.toISOString().slice(0, 10);
  console.log(
    `[cron:executive-kpi-snapshot] Starting at ${now.toISOString()} for ${snapshotDate}`,
  );

  let processed = 0;
  let errors = 0;

  const orgs = await db
    .select({ id: organization.id })
    .from(organization)
    .where(isNull(organization.deletedAt));

  for (const org of orgs) {
    try {
      // 1. CES metrics
      const [cesRow] = await db
        .select({
          avgCes: sql<number>`COALESCE(ROUND(AVG(${controlEffectivenessScore.score})), 0)`,
          total: sql<number>`COUNT(*)`,
          below: sql<number>`SUM(CASE WHEN ${controlEffectivenessScore.score} < 50 THEN 1 ELSE 0 END)`,
        })
        .from(controlEffectivenessScore)
        .where(eq(controlEffectivenessScore.orgId, org.id));

      // 2. Risk metrics
      const [riskRow] = await db
        .select({
          avgResidual: sql<number>`COALESCE(ROUND(AVG(${risk.riskScoreResidual})), 0)`,
          above: sql<number>`SUM(CASE WHEN ${risk.riskAppetiteExceeded} THEN 1 ELSE 0 END)`,
        })
        .from(risk)
        .where(and(eq(risk.orgId, org.id), isNull(risk.deletedAt)));

      // 3. Finding metrics
      const [findingRow] = await db
        .select({
          open: sql<number>`COUNT(*)`,
        })
        .from(finding)
        .where(
          and(
            eq(finding.orgId, org.id),
            isNull(finding.deletedAt),
            sql`${finding.status} NOT IN ('closed', 'verified')`,
          ),
        );

      // 4. SLA compliance
      const slaConfigs = await db
        .select({
          severity: findingSlaConfig.severity,
          slaDays: findingSlaConfig.slaDays,
        })
        .from(findingSlaConfig)
        .where(eq(findingSlaConfig.orgId, org.id));

      const slaMap: Record<string, number> = {};
      for (const s of slaConfigs) {
        slaMap[s.severity] = s.slaDays;
      }

      const allFindings = await db
        .select({
          severity: finding.severity,
          status: finding.status,
          createdAt: finding.createdAt,
          updatedAt: finding.updatedAt,
        })
        .from(finding)
        .where(and(eq(finding.orgId, org.id), isNull(finding.deletedAt)));

      let slaTotal = 0;
      let slaCompliant = 0;
      for (const f of allFindings) {
        const slaDays = slaMap[f.severity];
        if (slaDays === undefined) continue;
        slaTotal++;
        const resolvedAt =
          f.status === "closed" || f.status === "verified"
            ? f.updatedAt.toISOString()
            : null;
        if (isWithinSla(f.createdAt.toISOString(), resolvedAt, slaDays)) {
          slaCompliant++;
        }
      }

      const kpis = {
        avgCES: Number(cesRow?.avgCes ?? 0),
        totalControls: Number(cesRow?.total ?? 0),
        controlsBelowThreshold: Number(cesRow?.below ?? 0),
        openFindings: Number(findingRow?.open ?? 0),
        findingSlaCompliance:
          slaTotal > 0 ? Math.round((slaCompliant / slaTotal) * 100) : 100,
        riskScoreAvg: Number(riskRow?.avgResidual ?? 0),
        risksAboveAppetite: Number(riskRow?.above ?? 0),
        auditSlaCompliance: 0, // Placeholder for audit module
        dsrSlaCompliance: 0, // Placeholder for DPMS module
        esgCompleteness: 0, // Placeholder for ESG module
      };

      // Upsert snapshot
      await db
        .insert(executiveKpiSnapshot)
        .values({
          orgId: org.id,
          snapshotDate,
          kpis,
        })
        .onConflictDoUpdate({
          target: [
            executiveKpiSnapshot.orgId,
            executiveKpiSnapshot.snapshotDate,
          ],
          set: {
            kpis,
            createdAt: new Date(),
          },
        });

      processed++;
    } catch (err) {
      errors++;
      console.error(
        `[cron:executive-kpi-snapshot] Error for org ${org.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[cron:executive-kpi-snapshot] Done. Processed: ${processed}, Errors: ${errors}`,
  );

  return { processed, errors };
}
