// Cron Job: Playbook Phase Escalation (HOURLY)
// Checks all active playbook activations for:
// 1. Overdue phase deadlines → escalation notification
// 2. All tasks in phase complete → auto-advance to next phase
// 3. All phases complete → mark activation as completed

import {
  db,
  playbookActivation,
  playbookPhase,
  task,
  incidentTimelineEntry,
  notification,
} from "@grc/db";
import { and, eq, isNull, sql } from "drizzle-orm";

interface PhaseEscalationResult {
  processed: number;
  escalated: number;
  advanced: number;
  completed: number;
}

export async function processPlaybookPhaseEscalation(): Promise<PhaseEscalationResult> {
  const now = new Date();
  let escalated = 0;
  let advanced = 0;
  let completed = 0;

  console.log(
    `[cron:playbook-phase-escalation] Starting at ${now.toISOString()}`,
  );

  // Find all active playbook activations
  const activeActivations = await db
    .select()
    .from(playbookActivation)
    .where(eq(playbookActivation.status, "active"));

  if (activeActivations.length === 0) {
    console.log(
      "[cron:playbook-phase-escalation] No active playbook activations",
    );
    return { processed: 0, escalated: 0, advanced: 0, completed: 0 };
  }

  for (const activation of activeActivations) {
    try {
      if (!activation.currentPhaseId) continue;

      const orgId = activation.orgId;

      // Get current phase info
      const [currentPhase] = await db
        .select()
        .from(playbookPhase)
        .where(eq(playbookPhase.id, activation.currentPhaseId))
        .limit(1);

      if (!currentPhase) continue;

      // Get tasks for current phase
      const phaseTasks = await db
        .select()
        .from(task)
        .where(
          and(
            eq(task.orgId, orgId),
            eq(task.sourceEntityType, "playbook_activation"),
            eq(task.sourceEntityId, activation.id),
            sql`${task.metadata}->>'phaseId' = ${currentPhase.id}`,
            isNull(task.deletedAt),
          ),
        );

      // Check if all tasks in current phase are complete
      const allComplete =
        phaseTasks.length > 0 &&
        phaseTasks.every(
          (t) => t.status === "done" || t.status === "cancelled",
        );

      if (allComplete) {
        // Get all phases for this template
        const allPhases = await db
          .select()
          .from(playbookPhase)
          .where(eq(playbookPhase.templateId, activation.templateId))
          .orderBy(playbookPhase.sortOrder);

        const currentIdx = allPhases.findIndex((p) => p.id === currentPhase.id);
        const nextPhase =
          currentIdx >= 0 && currentIdx < allPhases.length - 1
            ? allPhases[currentIdx + 1]
            : null;

        // Count all completed tasks
        const allTasks = await db
          .select()
          .from(task)
          .where(
            and(
              eq(task.orgId, orgId),
              eq(task.sourceEntityType, "playbook_activation"),
              eq(task.sourceEntityId, activation.id),
              isNull(task.deletedAt),
            ),
          );

        const completedCount = allTasks.filter(
          (t) => t.status === "done" || t.status === "cancelled",
        ).length;

        if (nextPhase) {
          // Auto-advance to next phase
          await db
            .update(playbookActivation)
            .set({
              currentPhaseId: nextPhase.id,
              completedTasksCount: completedCount,
            })
            .where(eq(playbookActivation.id, activation.id));

          await db.insert(incidentTimelineEntry).values({
            incidentId: activation.incidentId,
            orgId,
            actionType: "phase_advanced",
            description: `Auto-advanced to phase "${nextPhase.name}" (all tasks in "${currentPhase.name}" completed)`,
            addedBy: activation.activatedBy,
          });

          advanced++;
          console.log(
            `[cron:playbook-phase-escalation] Auto-advanced activation ${activation.id} to phase "${nextPhase.name}"`,
          );
        } else {
          // All phases complete — mark activation as completed
          await db
            .update(playbookActivation)
            .set({
              status: "completed",
              completedAt: now,
              completedTasksCount: completedCount,
            })
            .where(eq(playbookActivation.id, activation.id));

          await db.insert(incidentTimelineEntry).values({
            incidentId: activation.incidentId,
            orgId,
            actionType: "playbook_completed",
            description: `Playbook completed automatically. All ${allTasks.length} tasks finished.`,
            addedBy: activation.activatedBy,
          });

          completed++;
          console.log(
            `[cron:playbook-phase-escalation] Completed activation ${activation.id}`,
          );
        }
      } else {
        // Check for overdue phase deadline
        const activationTime = new Date(activation.activatedAt);
        const phaseDeadline = new Date(
          activationTime.getTime() +
            currentPhase.deadlineHoursRelative * 60 * 60 * 1000,
        );

        if (now > phaseDeadline && currentPhase.escalationRoleOnOverdue) {
          // Find user with escalation role
          const escalationUser = await db.execute(sql`
            SELECT u.id FROM "user" u
            INNER JOIN user_organization_role uor ON u.id = uor.user_id
            WHERE uor.org_id = ${orgId}
              AND uor.role IN ('admin', 'risk_manager')
              AND u.deleted_at IS NULL
            LIMIT 1
          `);

          const userRow = escalationUser[0] as { id: string } | undefined;
          if (userRow) {
            const userId = userRow.id;

            // Check if we already sent an escalation notification recently (within last 2 hours)
            const recentNotification = await db.execute(sql`
              SELECT id FROM notification
              WHERE user_id = ${userId}
                AND org_id = ${orgId}
                AND type = 'escalation'
                AND title LIKE '%Phase overdue%'
                AND entity_id = ${activation.incidentId}::uuid
                AND created_at > ${new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()}
              LIMIT 1
            `);

            if (recentNotification.length === 0) {
              const hoursOverdue = Math.floor(
                (now.getTime() - phaseDeadline.getTime()) / (1000 * 60 * 60),
              );

              await db.insert(notification).values({
                orgId,
                userId,
                type: "escalation",
                title: `Phase overdue: "${currentPhase.name}"`,
                message: `Phase "${currentPhase.name}" is ${hoursOverdue}h overdue. ${phaseTasks.filter((t) => t.status === "open" || t.status === "in_progress").length} tasks remaining.`,
                channel: "both",
                entityType: "security_incident",
                entityId: activation.incidentId,
              });

              escalated++;
              console.log(
                `[cron:playbook-phase-escalation] Escalated phase "${currentPhase.name}" for activation ${activation.id}`,
              );
            }
          }
        }
      }
    } catch (err) {
      console.error(
        `[cron:playbook-phase-escalation] Error processing activation ${activation.id}:`,
        err,
      );
    }
  }

  console.log(
    `[cron:playbook-phase-escalation] Done. Processed: ${activeActivations.length}, Escalated: ${escalated}, Advanced: ${advanced}, Completed: ${completed}`,
  );

  return {
    processed: activeActivations.length,
    escalated,
    advanced,
    completed,
  };
}
