// Cron Job: Playbook Suggestion (runs every 15 minutes)
// Checks for recently created incidents (last 15 minutes) that don't have
// a playbook activation yet, and creates notification suggestions.

import {
  db,
  securityIncident,
  playbookActivation,
  playbookTemplate,
  notification,
} from "@grc/db";
import { and, eq, isNull, sql, gte } from "drizzle-orm";
import { matchesSeverityThreshold } from "@grc/shared";

interface PlaybookSuggestionResult {
  processed: number;
  suggested: number;
}

export async function processPlaybookSuggestion(): Promise<PlaybookSuggestionResult> {
  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
  let suggested = 0;

  console.log(`[cron:playbook-suggestion] Starting at ${now.toISOString()}`);

  // Find recent incidents without playbook activations
  const recentIncidents = await db
    .select()
    .from(securityIncident)
    .where(
      and(
        isNull(securityIncident.deletedAt),
        gte(securityIncident.createdAt, fifteenMinutesAgo),
        sql`${securityIncident.status} NOT IN ('closed', 'lessons_learned')`,
      ),
    );

  if (recentIncidents.length === 0) {
    console.log("[cron:playbook-suggestion] No recent incidents found");
    return { processed: 0, suggested: 0 };
  }

  for (const incident of recentIncidents) {
    try {
      // Check if incident already has a playbook activation
      const existingActivation = await db
        .select({ id: playbookActivation.id })
        .from(playbookActivation)
        .where(eq(playbookActivation.incidentId, incident.id))
        .limit(1);

      if (existingActivation.length > 0) continue;

      // Check if we already suggested a playbook for this incident
      const existingSuggestion = await db.execute(sql`
        SELECT id FROM notification
        WHERE org_id = ${incident.orgId}
          AND type = 'status_change'
          AND title LIKE '%Playbook recommended%'
          AND entity_id = ${incident.id}::uuid
        LIMIT 1
      `);

      if (existingSuggestion.length > 0) continue;

      // Find matching playbook templates
      const templates = await db
        .select()
        .from(playbookTemplate)
        .where(
          and(
            eq(playbookTemplate.orgId, incident.orgId),
            eq(playbookTemplate.isActive, true),
          ),
        );

      const incidentCategory = (incident.incidentType ?? "other").toLowerCase();

      const matches = templates.filter((tmpl) => {
        // Category match
        const categoryMatch =
          tmpl.triggerCategory === incidentCategory ||
          incidentCategory.includes(tmpl.triggerCategory) ||
          tmpl.triggerCategory.includes(incidentCategory);

        // Special: data breach match
        const breachMatch = incident.isDataBreach && tmpl.triggerCategory === "data_breach";

        // Severity match
        const severityMatch = matchesSeverityThreshold(
          incident.severity,
          tmpl.triggerMinSeverity,
        );

        return (categoryMatch || breachMatch) && severityMatch;
      });

      if (matches.length > 0) {
        const bestMatch = matches[0];

        // Find admin/risk_manager to notify
        const adminUsers = await db.execute(sql`
          SELECT u.id FROM "user" u
          INNER JOIN user_organization_role uor ON u.id = uor.user_id
          WHERE uor.org_id = ${incident.orgId}
            AND uor.role IN ('admin', 'risk_manager')
            AND u.deleted_at IS NULL
        `);

        for (const row of adminUsers) {
          const userId = (row as { id: string }).id;
          await db.insert(notification).values({
            orgId: incident.orgId,
            userId,
            type: "status_change",
            title: `Playbook recommended: "${bestMatch.name}"`,
            message: `Incident "${incident.title}" matches the "${bestMatch.name}" playbook. Consider activating it to guide the response.`,
            channel: "both",
            entityType: "security_incident",
            entityId: incident.id,
          });
        }

        suggested++;
        console.log(`[cron:playbook-suggestion] Suggested "${bestMatch.name}" for incident "${incident.title}"`);
      }
    } catch (err) {
      console.error(`[cron:playbook-suggestion] Error processing incident ${incident.id}:`, err);
    }
  }

  console.log(`[cron:playbook-suggestion] Done. Processed: ${recentIncidents.length}, Suggested: ${suggested}`);

  return { processed: recentIncidents.length, suggested };
}
