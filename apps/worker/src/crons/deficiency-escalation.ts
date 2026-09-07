// Sprint 40: Deficiency Escalation Worker
// WEEKLY — Check for overdue remediation deadlines and escalate

import { db, controlDeficiency } from "@grc/db";
import { and, sql, inArray } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";
import { insertNotification } from "../lib/notify";

interface EscalationResult {
  processed: number;
  escalated: number;
}

export const processDeficiencyEscalation = withCronInstrumentation(
  "deficiency-escalation",
  async (): Promise<EscalationResult> => {
    // [N-2 · Welle 6a] `const now = new Date()` stand hier und wurde nie
    // gelesen: der Faelligkeitsvergleich passiert in SQL gegen
    // `CURRENT_DATE` (Zeile darunter). Entfernt.
    let escalated = 0;

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
      await insertNotification(
        {
          orgId: def.orgId,
          userId: def.remediationResponsible,
          type: "escalation",
          title: `Overdue Remediation: ${def.title}`,
          message: `Deficiency "${def.title}" (${def.classification}) has passed its remediation deadline of ${def.remediationDeadline}. Please update the status or request an extension.`,
          entityType: "control_deficiency",
          entityId: def.id,
          templateData: {
            module: "ics",
            priority:
              def.classification === "material_weakness" ? "urgent" : "high",
            subtype: "deficiency_overdue",
          },
        },
        { job: "deficiency-escalation" },
      );
      escalated++;
    }

    return { processed: overdue.length, escalated };
  },
);
