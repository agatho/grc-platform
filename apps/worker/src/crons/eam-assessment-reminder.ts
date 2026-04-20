// Sprint 48: Assessment Reminder Worker — Monthly
// Flags applications not assessed in 12+ months

import { db, applicationPortfolio, architectureElement } from "@grc/db";
import { and, lte, eq, sql, isNull, or } from "drizzle-orm";

export async function processEamAssessmentReminder(): Promise<{
  flagged: number;
  notificationsSent: number;
}> {
  console.log("[eam-assessment-reminder] Checking for unassessed applications");

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const unassessed = await db
    .select({
      elementId: applicationPortfolio.elementId,
      name: architectureElement.name,
      lastAssessedAt: applicationPortfolio.lastAssessedAt,
      owner: architectureElement.owner,
    })
    .from(applicationPortfolio)
    .innerJoin(
      architectureElement,
      eq(applicationPortfolio.elementId, architectureElement.id),
    )
    .where(
      and(
        eq(applicationPortfolio.lifecycleStatus, "active"),
        or(
          isNull(applicationPortfolio.lastAssessedAt),
          lte(applicationPortfolio.lastAssessedAt, twelveMonthsAgo),
        ),
      ),
    );

  let notificationsSent = 0;

  for (const app of unassessed) {
    const monthsSinceAssessment = app.lastAssessedAt
      ? Math.floor(
          (Date.now() - new Date(app.lastAssessedAt).getTime()) /
            (30 * 24 * 60 * 60 * 1000),
        )
      : null;

    console.log(
      `[eam-assessment-reminder] ${app.name} — ${monthsSinceAssessment ? `last assessed ${monthsSinceAssessment} months ago` : "never assessed"}`,
    );

    // In production: createNotification() for application owner
    if (app.owner) notificationsSent++;
  }

  console.log(
    `[eam-assessment-reminder] Complete: ${unassessed.length} flagged, ${notificationsSent} notifications`,
  );

  return { flagged: unassessed.length, notificationsSent };
}
