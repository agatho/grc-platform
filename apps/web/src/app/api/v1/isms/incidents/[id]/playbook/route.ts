import {
  db,
  playbookActivation,
  playbookTemplate,
  playbookPhase,
  securityIncident,
  task,
  incidentTimelineEntry,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { activatePlaybookSchema } from "@grc/shared";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { activatePlaybook } from "@/lib/playbook-engine";

// POST /api/v1/isms/incidents/[id]/playbook — Activate playbook for incident
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: incidentId } = await params;

  // Verify incident exists and belongs to this org
  const [incident] = await db
    .select()
    .from(securityIncident)
    .where(
      and(
        eq(securityIncident.id, incidentId),
        eq(securityIncident.orgId, ctx.orgId),
        isNull(securityIncident.deletedAt),
      ),
    )
    .limit(1);

  if (!incident) {
    return Response.json({ error: "Incident not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = activatePlaybookSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await activatePlaybook(
      ctx.orgId,
      incidentId,
      parsed.data.templateId,
      ctx.userId,
    );
    return Response.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith("CONFLICT")) {
      return Response.json(
        { error: "Playbook already activated for this incident" },
        { status: 409 },
      );
    }
    return Response.json({ error: message }, { status: 400 });
  }
}

// GET /api/v1/isms/incidents/[id]/playbook — Get playbook status
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: incidentId } = await params;

  const [activation] = await db
    .select()
    .from(playbookActivation)
    .where(
      and(
        eq(playbookActivation.incidentId, incidentId),
        eq(playbookActivation.orgId, ctx.orgId),
      ),
    )
    .limit(1);

  if (!activation) {
    return Response.json({ data: null });
  }

  // Get template info
  const [template] = await db
    .select({
      id: playbookTemplate.id,
      name: playbookTemplate.name,
      triggerCategory: playbookTemplate.triggerCategory,
    })
    .from(playbookTemplate)
    .where(eq(playbookTemplate.id, activation.templateId))
    .limit(1);

  // Get all phases
  const phases = await db
    .select()
    .from(playbookPhase)
    .where(eq(playbookPhase.templateId, activation.templateId))
    .orderBy(playbookPhase.sortOrder);

  // Get all playbook tasks
  const playbookTasks = await db
    .select()
    .from(task)
    .where(
      and(
        eq(task.orgId, ctx.orgId),
        eq(task.sourceEntityType, "playbook_activation"),
        eq(task.sourceEntityId, activation.id),
        isNull(task.deletedAt),
      ),
    );

  // Build phase status
  const activationTime = new Date(activation.activatedAt);
  const now = new Date();

  const phaseStatuses = phases.map((phase) => {
    const phaseTasks = playbookTasks.filter(
      (t) => {
        const meta = t.metadata as Record<string, unknown> | null;
        return meta?.phaseId === phase.id;
      },
    );
    const completed = phaseTasks.filter(
      (t) => t.status === "done" || t.status === "cancelled",
    ).length;
    const phaseDeadline = new Date(
      activationTime.getTime() + phase.deadlineHoursRelative * 60 * 60 * 1000,
    );

    let status: "completed" | "active" | "future" | "overdue" = "future";
    if (activation.currentPhaseId === phase.id) {
      status = now > phaseDeadline ? "overdue" : "active";
    } else {
      // Check if this phase is before or after current
      const currentPhase = phases.find((p) => p.id === activation.currentPhaseId);
      if (currentPhase && phase.sortOrder < currentPhase.sortOrder) {
        status = "completed";
      } else if (activation.status === "completed") {
        status = "completed";
      }
    }

    return {
      id: phase.id,
      name: phase.name,
      sortOrder: phase.sortOrder,
      status,
      tasksTotal: phaseTasks.length,
      tasksCompleted: completed,
      deadlineHoursRelative: phase.deadlineHoursRelative,
    };
  });

  // Get current phase details
  const currentPhaseData = phases.find((p) => p.id === activation.currentPhaseId);
  const currentPhaseTasks = playbookTasks.filter((t) => {
    const meta = t.metadata as Record<string, unknown> | null;
    return meta?.phaseId === activation.currentPhaseId;
  });

  // Get timeline entries
  const timeline = await db
    .select()
    .from(incidentTimelineEntry)
    .where(
      and(
        eq(incidentTimelineEntry.incidentId, incidentId),
        eq(incidentTimelineEntry.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(incidentTimelineEntry.occurredAt))
    .limit(50);

  // Compute completed count
  const completedCount = playbookTasks.filter(
    (t) => t.status === "done" || t.status === "cancelled",
  ).length;

  return Response.json({
    data: {
      activation: {
        ...activation,
        completedTasksCount: completedCount,
      },
      template: template ?? null,
      currentPhase: currentPhaseData
        ? {
            id: currentPhaseData.id,
            name: currentPhaseData.name,
            sortOrder: currentPhaseData.sortOrder,
            deadlineHoursRelative: currentPhaseData.deadlineHoursRelative,
            tasksTotal: currentPhaseTasks.length,
            tasksCompleted: currentPhaseTasks.filter(
              (t) => t.status === "done" || t.status === "cancelled",
            ).length,
          }
        : null,
      phases: phaseStatuses,
      tasks: playbookTasks,
      timeline,
    },
  });
}
