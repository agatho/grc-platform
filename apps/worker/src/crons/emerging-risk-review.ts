// Sprint 39: Emerging Risk Review Reminder Worker
// WEEKLY — Check emerging risks where next_review_date is within 14 days

import { db, emergingRisk, notification } from "@grc/db";
import { and, isNotNull, sql, isNull } from "drizzle-orm";

interface ReviewResult {
  processed: number;
  notified: number;
}

export async function processEmergingRiskReviews(): Promise<ReviewResult> {
  const now = new Date();
  let notified = 0;

  console.log(`[cron:emerging-risk-review] Starting at ${now.toISOString()}`);

  const upcomingReviews = await db
    .select({
      id: emergingRisk.id,
      orgId: emergingRisk.orgId,
      title: emergingRisk.title,
      responsibleId: emergingRisk.responsibleId,
      nextReviewDate: emergingRisk.nextReviewDate,
    })
    .from(emergingRisk)
    .where(
      and(
        sql`${emergingRisk.nextReviewDate}::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'`,
        isNotNull(emergingRisk.responsibleId),
        sql`${emergingRisk.status} NOT IN ('promoted', 'archived')`,
      ),
    );

  for (const risk of upcomingReviews) {
    if (!risk.responsibleId) continue;
    await db.insert(notification).values({
      orgId: risk.orgId,
      userId: risk.responsibleId,
      type: "emerging_risk_review",
      title: `Emerging Risk Review Due: ${risk.title}`,
      body: `The emerging risk "${risk.title}" is due for review by ${risk.nextReviewDate}.`,
      entityType: "emerging_risk",
      entityId: risk.id,
      module: "erm",
      priority: "normal",
      expiresAt: sql`now() + interval '90 days'`,
    });
    notified++;
  }

  console.log(`[cron:emerging-risk-review] Completed: ${upcomingReviews.length} found, ${notified} notified`);
  return { processed: upcomingReviews.length, notified };
}
