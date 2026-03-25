// Cron Job: Treatment Overdue Reminders
// Finds risk_treatments where due_date has passed and status is not
// completed or cancelled, then creates notifications for the responsible person.

import { db, riskTreatment, risk, notification } from "@grc/db";
import { and, isNull, isNotNull, notInArray, lt, sql, eq } from "drizzle-orm";

interface TreatmentOverdueResult {
  processed: number;
  notified: number;
}

export async function processTreatmentOverdueReminders(): Promise<TreatmentOverdueResult> {
  const now = new Date();
  let notified = 0;

  console.log(`[cron:treatment-overdue-reminders] Starting at ${now.toISOString()}`);

  // Find risk_treatments where due_date < NOW(), status not in ('completed', 'cancelled'),
  // and not soft-deleted. Join risk table for the risk title in notifications.
  const overdueTreatments = await db
    .select({
      id: riskTreatment.id,
      orgId: riskTreatment.orgId,
      riskId: riskTreatment.riskId,
      description: riskTreatment.description,
      responsibleId: riskTreatment.responsibleId,
      dueDate: riskTreatment.dueDate,
      status: riskTreatment.status,
      riskTitle: risk.title,
    })
    .from(riskTreatment)
    .leftJoin(risk, eq(riskTreatment.riskId, risk.id))
    .where(
      and(
        lt(sql`${riskTreatment.dueDate}::date`, sql`CURRENT_DATE`),
        notInArray(riskTreatment.status, ["completed", "cancelled"]),
        isNull(riskTreatment.deletedAt),
        isNotNull(riskTreatment.responsibleId),
      ),
    );

  if (overdueTreatments.length === 0) {
    console.log("[cron:treatment-overdue-reminders] No overdue treatments found");
    return { processed: 0, notified: 0 };
  }

  for (const treatment of overdueTreatments) {
    try {
      const daysOverdue = treatment.dueDate
        ? Math.floor(
            (now.getTime() - new Date(treatment.dueDate).getTime()) / (1000 * 60 * 60 * 24),
          )
        : 0;

      const treatmentLabel = treatment.description
        ? treatment.description.substring(0, 80) + (treatment.description.length > 80 ? "..." : "")
        : "Unnamed treatment";

      await db.insert(notification).values({
        userId: treatment.responsibleId!,
        orgId: treatment.orgId,
        type: "deadline_approaching" as const,
        entityType: "risk_treatment",
        entityId: treatment.id,
        title: `Treatment overdue: ${treatmentLabel}`,
        message: `Treatment action for risk "${treatment.riskTitle ?? "Unknown"}" is ${daysOverdue} day(s) overdue (due: ${treatment.dueDate}).`,
        channel: "both" as const,
        templateKey: "treatment_overdue_reminder",
        templateData: {
          treatmentDescription: treatment.description,
          riskTitle: treatment.riskTitle,
          dueDate: treatment.dueDate,
          daysOverdue,
          status: treatment.status,
        },
        createdAt: now,
        updatedAt: now,
      });

      notified++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron:treatment-overdue-reminders] Failed for treatment ${treatment.id}:`,
        message,
      );
    }
  }

  console.log(
    `[cron:treatment-overdue-reminders] Processed ${overdueTreatments.length} treatments, ${notified} notifications created`,
  );

  return { processed: overdueTreatments.length, notified };
}
