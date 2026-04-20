// Sprint 48: Portfolio Health Check Worker — Weekly
// Computes health indicators and alerts if thresholds exceeded

import { db } from "@grc/db";
import { sql } from "drizzle-orm";

export async function processEamPortfolioHealthCheck(): Promise<{
  totalApplications: number;
  alertsGenerated: number;
}> {
  console.log(
    "[eam-portfolio-health-check] Computing portfolio health indicators",
  );

  const result = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE ap.functional_fit = 'insufficient')::int AS insufficient_fit,
      COUNT(*) FILTER (WHERE ap.planned_eol IS NOT NULL AND ap.planned_eol <= CURRENT_DATE + INTERVAL '12 months')::int AS approaching_eol,
      COUNT(*) FILTER (WHERE ap.last_assessed_at IS NULL OR ap.last_assessed_at < NOW() - INTERVAL '12 months')::int AS unassessed,
      COUNT(*) FILTER (WHERE ap.six_r_strategy IS NULL)::int AS no_six_r
    FROM application_portfolio ap
    JOIN architecture_element ae ON ap.element_id = ae.id
    WHERE ae.status != 'retired'
  `);

  const row = (result as unknown as Array<Record<string, number>>)[0] ?? {
    total: 0,
  };
  const total = row.total || 1;

  const indicators = {
    insufficientFitPct: Math.round((row.insufficient_fit / total) * 100),
    approachingEolPct: Math.round((row.approaching_eol / total) * 100),
    unassessedPct: Math.round((row.unassessed / total) * 100),
    noSixRPct: Math.round((row.no_six_r / total) * 100),
  };

  let alertsGenerated = 0;

  // Default thresholds (configurable per org in production)
  if (indicators.insufficientFitPct > 20) {
    console.log(
      `[eam-portfolio-health-check] ALERT: ${indicators.insufficientFitPct}% insufficient functional fit (threshold: 20%)`,
    );
    alertsGenerated++;
  }
  if (indicators.approachingEolPct > 15) {
    console.log(
      `[eam-portfolio-health-check] ALERT: ${indicators.approachingEolPct}% approaching EOL`,
    );
    alertsGenerated++;
  }
  if (indicators.unassessedPct > 30) {
    console.log(
      `[eam-portfolio-health-check] ALERT: ${indicators.unassessedPct}% unassessed`,
    );
    alertsGenerated++;
  }

  console.log(
    `[eam-portfolio-health-check] Complete: ${total} apps, ${alertsGenerated} alerts`,
  );

  return { totalApplications: total, alertsGenerated };
}
