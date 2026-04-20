// Sprint 40: Deficiency Escalation Worker
// WEEKLY — Check for overdue remediation deadlines and escalate

import { db, controlDeficiency, notification } from "@grc/db";
import { and, sql, inArray } from "drizzle-orm";

interface EscalationResult {
  processed: number;
  escalated: number;
}

export async function processDeficiencyEscalation(): Promise<EscalationResult> {
  const now = new Date();
  let escalated = 0;

  console.log(`[cron:deficiency-escalation] Starting at ${now.toISOString()}`);

  // Find deficiencies with overdue remediation deadlines
  const overdue = await db
    .select({
      id: controlDeficiency.id,
      orgId: controlDeficiency.orgId,
      title: controlDeficiency.title,
      classification: controlDeficiency.classification,
      remediationResponsible: controlDeficiency.remediationResponsible,
      remediationDeadline: controlDeficiency.remediationDeadline,
    })
    .from(controlDeficiency)
    .where(
      and(
        inArray(controlDeficiency.remediationStatus, ["open", "in_progress"]),
        sql`${controlDeficiency.remediationDeadline}::date < CURRENT_DATE`,
      ),
    );

  for (const def of overdue) {
    if (!def.remediationResponsible) continue;
    await db.insert(notification).values({
      orgId: def.orgId,
      userId: def.remediationResponsible,
      type: "escalation",
      title: `Overdue Remediation: ${def.title}`,
      message: `Deficiency "${def.title}" (${def.classification}) has passed its remediation deadline of ${def.remediationDeadline}. Please update the status or request an extension.`,
      entityType: "control_deficiency",
      entityId: def.id,
      templateData: {
        module: "ics",
        priority: def.classification === "material_weakness" ? "urgent" : "high",
        subtype: "deficiency_overdue",
      },
    });
    escalated++;
  }

  console.log(`[cron:deficiency-escalation] Completed: ${overdue.length} overdue, ${escalated} escalated`);
  return { processed: overdue.length, escalated };
}
