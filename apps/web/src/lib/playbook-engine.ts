// Sprint 16: Playbook Engine — Core logic for activation, phase progression, role resolution

import {
  db,
  playbookTemplate,
  playbookPhase,
  playbookTaskTemplate,
  playbookActivation,
  task,
  securityIncident,
  incidentTimelineEntry,
  notification,
} from "@grc/db";
import {
  computeAbsoluteDeadline,
  countTotalTasks,
  isPhaseComplete,
  getNextPhase,
  matchesSeverityThreshold,
} from "@grc/shared";
import { eq, and, sql, isNull, inArray } from "drizzle-orm";

// ─── Role Resolution ────────────────────────────────────────────

interface ResolvedUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

/**
 * Resolve a role string to an actual user in the organization.
 * Maps playbook roles to ARCTOS RBAC roles and finds a user.
 * Returns null if no matching user found.
 */
export async function resolveRoleToUser(
  orgId: string,
  roleName: string,
): Promise<ResolvedUser | null> {
  // Map playbook roles to ARCTOS roles
  const roleMapping: Record<string, string[]> = {
    ciso: ["admin", "risk_manager"],
    it_lead: ["admin", "control_owner"],
    communications: ["admin", "risk_manager"],
    dpo: ["admin", "risk_manager"],
    legal: ["admin", "risk_manager"],
    hr: ["admin", "risk_manager"],
    admin: ["admin"],
    risk_manager: ["risk_manager", "admin"],
    control_owner: ["control_owner", "admin"],
    process_owner: ["process_owner", "admin"],
    auditor: ["auditor", "admin"],
  };

  const mappedRoles = roleMapping[roleName] ?? ["admin"];

  const result = await db.execute(sql`
    SELECT u.id, u.first_name as "firstName", u.last_name as "lastName"
    FROM "user" u
    INNER JOIN user_organization_role uor ON u.id = uor.user_id
    WHERE uor.org_id = ${orgId}
      AND uor.role = ANY(${mappedRoles})
      AND u.deleted_at IS NULL
    LIMIT 1
  `);

  const row = result[0] as { id: string; firstName: string | null; lastName: string | null } | undefined;
  if (row) {
    return row;
  }

  return null;
}

// ─── Template Fetching ──────────────────────────────────────────

export async function getTemplateWithPhasesAndTasks(templateId: string, orgId: string) {
  const template = await db
    .select()
    .from(playbookTemplate)
    .where(
      and(
        eq(playbookTemplate.id, templateId),
        eq(playbookTemplate.orgId, orgId),
      ),
    )
    .limit(1);

  if (template.length === 0) return null;

  const phases = await db
    .select()
    .from(playbookPhase)
    .where(eq(playbookPhase.templateId, templateId))
    .orderBy(playbookPhase.sortOrder);

  const phaseIds = phases.map((p) => p.id);
  const tasks =
    phaseIds.length > 0
      ? await db
          .select()
          .from(playbookTaskTemplate)
          .where(inArray(playbookTaskTemplate.phaseId, phaseIds))
          .orderBy(playbookTaskTemplate.sortOrder)
      : [];

  const phasesWithTasks = phases.map((phase) => ({
    ...phase,
    tasks: tasks.filter((t) => t.phaseId === phase.id),
  }));

  return { ...template[0], phases: phasesWithTasks };
}

// ─── Playbook Activation ────────────────────────────────────────

export interface ActivationResult {
  activation: typeof playbookActivation.$inferSelect;
  tasksCreated: number;
  unassignedTasks: string[];
}

export async function activatePlaybook(
  orgId: string,
  incidentId: string,
  templateId: string,
  userId: string,
): Promise<ActivationResult> {
  const tmpl = await getTemplateWithPhasesAndTasks(templateId, orgId);
  if (!tmpl) throw new Error("Template not found");
  if (!tmpl.isActive) throw new Error("Template is not active");

  // Check for existing activation on this incident
  const existing = await db
    .select()
    .from(playbookActivation)
    .where(eq(playbookActivation.incidentId, incidentId))
    .limit(1);

  if (existing.length > 0) {
    throw new Error("CONFLICT: Playbook already activated for this incident");
  }

  const activationTime = new Date();
  const totalTasks = countTotalTasks(tmpl);
  const firstPhase = tmpl.phases[0];
  const unassignedTasks: string[] = [];

  // Create activation record
  const [activation] = await db
    .insert(playbookActivation)
    .values({
      orgId,
      templateId,
      incidentId,
      activatedBy: userId,
      activatedAt: activationTime,
      currentPhaseId: firstPhase?.id ?? null,
      totalTasksCount: totalTasks,
      completedTasksCount: 0,
      status: "active",
    })
    .returning();

  // Generate REAL tasks for ALL phases
  for (const phase of tmpl.phases) {
    for (const taskTmpl of phase.tasks) {
      const deadline = computeAbsoluteDeadline(activationTime, taskTmpl.deadlineHoursRelative);
      const assignee = await resolveRoleToUser(orgId, taskTmpl.assignedRole);

      if (!assignee) {
        unassignedTasks.push(taskTmpl.title);
      }

      await db.insert(task).values({
        orgId,
        title: taskTmpl.title,
        description: taskTmpl.description,
        assigneeId: assignee?.id ?? null,
        assigneeRole: taskTmpl.assignedRole,
        dueDate: deadline,
        status: "open",
        priority: taskTmpl.isCriticalPath ? "critical" : "medium",
        sourceEntityType: "playbook_activation",
        sourceEntityId: activation.id,
        metadata: {
          playbookActivationId: activation.id,
          phaseId: phase.id,
          taskTemplateId: taskTmpl.id,
          phaseName: phase.name,
          isCriticalPath: taskTmpl.isCriticalPath,
          checklistItems: taskTmpl.checklistItems ?? [],
        },
        createdBy: userId,
      });
    }
  }

  // Add timeline entry for playbook activation
  await db.insert(incidentTimelineEntry).values({
    incidentId,
    orgId,
    actionType: "playbook_activated",
    description: `Playbook "${tmpl.name}" activated. ${totalTasks} tasks generated across ${tmpl.phases.length} phases.`,
    addedBy: userId,
  });

  // Create notification for unassigned tasks
  if (unassignedTasks.length > 0) {
    const admin = await resolveRoleToUser(orgId, "admin");
    if (admin) {
      await db.insert(notification).values({
        orgId,
        userId: admin.id,
        type: "escalation",
        title: `Playbook: ${unassignedTasks.length} tasks could not be assigned`,
        message: `Tasks could not be auto-assigned due to missing roles: ${unassignedTasks.slice(0, 3).join(", ")}${unassignedTasks.length > 3 ? "..." : ""}`,
        channel: "both",
        entityType: "security_incident",
        entityId: incidentId,
      });
    }
  }

  return { activation, tasksCreated: totalTasks, unassignedTasks };
}

// ─── Phase Progression ──────────────────────────────────────────

export async function checkAndAdvancePhase(
  activationId: string,
  orgId: string,
  userId: string,
): Promise<{ advanced: boolean; newPhaseId: string | null; completed: boolean }> {
  const [activation] = await db
    .select()
    .from(playbookActivation)
    .where(
      and(
        eq(playbookActivation.id, activationId),
        eq(playbookActivation.orgId, orgId),
        eq(playbookActivation.status, "active"),
      ),
    )
    .limit(1);

  if (!activation || !activation.currentPhaseId) {
    return { advanced: false, newPhaseId: null, completed: false };
  }

  // Get all tasks for current phase
  const phaseTasks = await db
    .select()
    .from(task)
    .where(
      and(
        eq(task.orgId, orgId),
        eq(task.sourceEntityType, "playbook_activation"),
        eq(task.sourceEntityId, activationId),
        sql`${task.metadata}->>'phaseId' = ${activation.currentPhaseId}`,
        isNull(task.deletedAt),
      ),
    );

  if (!isPhaseComplete(phaseTasks)) {
    return { advanced: false, newPhaseId: activation.currentPhaseId, completed: false };
  }

  // Get all phases for this template
  const phases = await db
    .select()
    .from(playbookPhase)
    .where(eq(playbookPhase.templateId, activation.templateId))
    .orderBy(playbookPhase.sortOrder);

  const nextPhase = getNextPhase(activation.currentPhaseId, phases);

  // Count completed tasks
  const allTasks = await db
    .select()
    .from(task)
    .where(
      and(
        eq(task.orgId, orgId),
        eq(task.sourceEntityType, "playbook_activation"),
        eq(task.sourceEntityId, activationId),
        isNull(task.deletedAt),
      ),
    );

  const completedCount = allTasks.filter(
    (t) => t.status === "done" || t.status === "cancelled",
  ).length;

  if (nextPhase) {
    // Advance to next phase
    await db
      .update(playbookActivation)
      .set({
        currentPhaseId: nextPhase.id,
        completedTasksCount: completedCount,
      })
      .where(eq(playbookActivation.id, activationId));

    // Add timeline entry
    await db.insert(incidentTimelineEntry).values({
      incidentId: activation.incidentId,
      orgId,
      actionType: "phase_advanced",
      description: `Advanced to phase "${nextPhase.name}"`,
      addedBy: userId,
    });

    return { advanced: true, newPhaseId: nextPhase.id, completed: false };
  } else {
    // All phases complete — mark activation as completed
    await db
      .update(playbookActivation)
      .set({
        status: "completed",
        completedAt: new Date(),
        completedTasksCount: completedCount,
      })
      .where(eq(playbookActivation.id, activationId));

    // Add timeline entry
    await db.insert(incidentTimelineEntry).values({
      incidentId: activation.incidentId,
      orgId,
      actionType: "playbook_completed",
      description: `Playbook completed. All ${allTasks.length} tasks finished.`,
      addedBy: userId,
    });

    return { advanced: true, newPhaseId: null, completed: true };
  }
}

// ─── Suggestion Matching ────────────────────────────────────────

export async function getPlaybookSuggestions(
  orgId: string,
  incidentId: string,
): Promise<Array<typeof playbookTemplate.$inferSelect & { matchScore: number }>> {
  const [incident] = await db
    .select()
    .from(securityIncident)
    .where(
      and(
        eq(securityIncident.id, incidentId),
        eq(securityIncident.orgId, orgId),
        isNull(securityIncident.deletedAt),
      ),
    )
    .limit(1);

  if (!incident) return [];

  const templates = await db
    .select()
    .from(playbookTemplate)
    .where(
      and(
        eq(playbookTemplate.orgId, orgId),
        eq(playbookTemplate.isActive, true),
      ),
    );

  const incidentCategory = (incident.incidentType ?? "other").toLowerCase();

  const suggestions = templates
    .map((tmpl) => {
      let matchScore = 0;

      // Category match
      if (tmpl.triggerCategory === incidentCategory) {
        matchScore += 50;
      } else if (incidentCategory.includes(tmpl.triggerCategory) || tmpl.triggerCategory.includes(incidentCategory)) {
        matchScore += 25;
      }

      // Severity match
      if (matchesSeverityThreshold(incident.severity, tmpl.triggerMinSeverity)) {
        matchScore += 30;
      }

      // Data breach match
      if (incident.isDataBreach && tmpl.triggerCategory === "data_breach") {
        matchScore += 20;
      }

      return { ...tmpl, matchScore };
    })
    .filter((s) => s.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);

  return suggestions;
}
