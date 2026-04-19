// Cron Job: AI-Act Art. 73 Incident Deadline Monitor (HOURLY)
// Serious incidents: 15-day deadline. Death/widespread: 2-day immediate.
// Warns at 48h, 24h, 0h remaining, then daily when overdue.

import { db, aiIncident, notification } from "@grc/db";
import { and, isNull, sql } from "drizzle-orm";

interface AiIncidentMonitorResult {
  processed: number;
  notified: number;
}

export async function processAiActIncidentDeadlineMonitor(): Promise<AiIncidentMonitorResult> {
  const now = new Date();
  let notified = 0;

  console.log(`[cron:ai-act-incident-deadline] Starting at ${now.toISOString()}`);

  // Find incidents that are not resolved/closed and not yet notified.
  const activeIncidents = await db
    .select({
      id: aiIncident.id,
      orgId: aiIncident.orgId,
      aiSystemId: aiIncident.aiSystemId,
      title: aiIncident.title,
      severity: aiIncident.severity,
      isSerious: aiIncident.isSerious,
      detectedAt: aiIncident.detectedAt,
      authorityDeadline: aiIncident.authorityDeadline,
      authorityNotifiedAt: aiIncident.authorityNotifiedAt,
      createdBy: aiIncident.createdBy,
    })
    .from(aiIncident)
    .where(
      and(
        sql`${aiIncident.status} not in ('resolved', 'closed')`,
        isNull(aiIncident.authorityNotifiedAt),
      ),
    );

  if (activeIncidents.length === 0) {
    console.log("[cron:ai-act-incident-deadline] No active incidents pending notification");
    return { processed: 0, notified: 0 };
  }

  for (const incident of activeIncidents) {
    try {
      // Compute deadline: prefer persisted, fall back to 15 days for serious, 2 for immediate.
      let deadline: Date;
      if (incident.authorityDeadline) {
        deadline = new Date(incident.authorityDeadline);
      } else {
        const detected = new Date(incident.detectedAt);
        const days = incident.isSerious ? 2 : 15;
        deadline = new Date(detected.getTime() + days * 24 * 60 * 60 * 1000);
      }

      const hoursRemaining = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60));

      // Fire at 48h, 24h, 12h, at-deadline, then once per 24h while overdue.
      const shouldWarn =
        (hoursRemaining <= 0 && hoursRemaining % 24 > -1) || // fires once per hourly run while overdue
        (hoursRemaining > 0 && hoursRemaining <= 1) ||
        (hoursRemaining > 11 && hoursRemaining <= 12) ||
        (hoursRemaining > 23 && hoursRemaining <= 24) ||
        (hoursRemaining > 47 && hoursRemaining <= 48);

      if (!shouldWarn) continue;

      const recipientId = incident.createdBy;
      if (!recipientId) continue;

      const urgencyLevel =
        hoursRemaining <= -48
          ? "CRITICAL_OVERDUE"
          : hoursRemaining <= 0
            ? "OVERDUE"
            : hoursRemaining <= 24
              ? "CRITICAL"
              : "WARNING";

      await db.insert(notification).values({
        userId: recipientId,
        orgId: incident.orgId,
        type: "deadline_approaching" as const,
        entityType: "ai_incident",
        entityId: incident.id,
        title: `[${urgencyLevel}] AI-Act Art. 73: ${incident.title}`,
        message:
          hoursRemaining <= 0
            ? `OVERDUE by ${Math.abs(hoursRemaining)}h: Market-Surveillance-Authority notification for AI incident "${incident.title}" is past deadline (Art. 73).`
            : `AI incident "${incident.title}" has ${hoursRemaining}h remaining until the Art. 73 authority notification deadline.`,
        channel: "both" as const,
        templateKey: "ai_act_incident_deadline",
        templateData: {
          incidentId: incident.id,
          incidentTitle: incident.title,
          severity: incident.severity,
          isSerious: incident.isSerious,
          hoursRemaining: Math.max(0, hoursRemaining),
          hoursOverdue: hoursRemaining < 0 ? Math.abs(hoursRemaining) : 0,
          deadline: deadline.toISOString(),
          urgencyLevel,
        },
        createdAt: now,
        updatedAt: now,
      });

      notified++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron:ai-act-incident-deadline] Failed for incident ${incident.id}:`,
        message,
      );
    }
  }

  console.log(
    `[cron:ai-act-incident-deadline] Processed ${activeIncidents.length} incidents, ${notified} notifications created`,
  );

  return { processed: activeIncidents.length, notified };
}
