// Cron Job: FAIR ALE Appetite Breach Check (Daily)
// When FAIR methodology is active, checks if any risk's ALE P50 exceeds
// the max_residual_ale threshold from risk_appetite_threshold

import {
  db,
  riskAppetiteThreshold,
  fairSimulationResult,
  risk,
  organization,
  notification,
  userOrganizationRole,
} from "@grc/db";
import { eq, and, isNull, isNotNull, sql } from "drizzle-orm";

interface FAIRAppetiteCheckResult {
  orgsProcessed: number;
  breachesDetected: number;
  notificationsCreated: number;
  errors: number;
}

export async function processFairAppetiteCheck(): Promise<FAIRAppetiteCheckResult> {
  const now = new Date();
  console.log(`[cron:fair-appetite-check] Starting at ${now.toISOString()}`);

  let orgsProcessed = 0;
  let breachesDetected = 0;
  let notificationsCreated = 0;
  let errors = 0;

  try {
    // Fetch orgs with FAIR or hybrid methodology
    const orgs = await db
      .select({
        id: organization.id,
        settings: organization.settings,
      })
      .from(organization)
      .where(isNull(organization.deletedAt));

    for (const org of orgs) {
      try {
        const settings = (org.settings ?? {}) as Record<string, unknown>;
        const methodology = settings.riskMethodology as string | undefined;

        // Skip orgs not using FAIR
        if (!methodology || methodology === "qualitative") continue;

        orgsProcessed++;

        // Get active ALE thresholds per category
        const thresholds = await db
          .select()
          .from(riskAppetiteThreshold)
          .where(
            and(
              eq(riskAppetiteThreshold.orgId, org.id),
              eq(riskAppetiteThreshold.isActive, true),
              isNull(riskAppetiteThreshold.deletedAt),
              isNotNull(riskAppetiteThreshold.maxResidualAle),
            ),
          );

        if (thresholds.length === 0) continue;

        // Get latest completed simulations for all risks in this org
        const latestSims = await db.execute(sql`
          SELECT DISTINCT ON (fsr.risk_id)
            fsr.risk_id,
            fsr.ale_p50,
            r.risk_category,
            r.title as risk_title,
            r.owner_id
          FROM fair_simulation_result fsr
          INNER JOIN risk r ON r.id = fsr.risk_id AND r.deleted_at IS NULL
          WHERE fsr.org_id = ${org.id}
            AND fsr.status = 'completed'
            AND r.org_id = ${org.id}
          ORDER BY fsr.risk_id, fsr.computed_at DESC
        `);

        const rows = latestSims.rows as Array<{
          risk_id: string;
          ale_p50: string;
          risk_category: string;
          risk_title: string;
          owner_id: string | null;
        }>;

        // Check each simulated risk against its category threshold
        for (const row of rows) {
          const threshold = thresholds.find(
            (t) => t.riskCategory === row.risk_category,
          );
          if (!threshold || !threshold.maxResidualAle) continue;

          const aleP50 = Number(row.ale_p50);
          const maxAle = Number(threshold.maxResidualAle);

          if (aleP50 > maxAle) {
            breachesDetected++;

            // Create notification for risk owner or admin
            const recipientId = row.owner_id;
            if (recipientId) {
              await db.insert(notification).values({
                userId: recipientId,
                orgId: org.id,
                type: "escalation",
                title: `FAIR ALE Breach: ${row.risk_title}`,
                message: `ALE P50 of ${formatEUR(aleP50)} exceeds threshold of ${formatEUR(maxAle)} for category ${row.risk_category}.`,
                channel: "in_app",
                link: `/erm/risks/${row.risk_id}/fair/results`,
              });
              notificationsCreated++;
            }
          }
        }
      } catch (err) {
        errors++;
        console.error(
          `[cron:fair-appetite-check] Error processing org ${org.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  } catch (err) {
    errors++;
    console.error(
      "[cron:fair-appetite-check] Fatal error:",
      err instanceof Error ? err.message : err,
    );
  }

  console.log(
    `[cron:fair-appetite-check] Done. Orgs: ${orgsProcessed}, Breaches: ${breachesDetected}, Notifications: ${notificationsCreated}, Errors: ${errors}`,
  );

  return { orgsProcessed, breachesDetected, notificationsCreated, errors };
}

function formatEUR(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}
