import {
  db,
  playbookTemplate,
  playbookPhase,
  playbookTaskTemplate,
  playbookActivation,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { updatePlaybookTemplateSchema } from "@grc/shared";
import { eq, and, inArray } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { getTemplateWithPhasesAndTasks } from "@/lib/playbook-engine";

// GET /api/v1/playbooks/[id] — Get playbook template with phases + tasks
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const template = await getTemplateWithPhasesAndTasks(id, ctx.orgId);

  if (!template) {
    return Response.json({ error: "Playbook template not found" }, { status: 404 });
  }

  return Response.json({ data: template });
}

// PUT /api/v1/playbooks/[id] — Update playbook template
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = await req.json();

  const parsed = updatePlaybookTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const existing = await db
    .select()
    .from(playbookTemplate)
    .where(and(eq(playbookTemplate.id, id), eq(playbookTemplate.orgId, ctx.orgId)))
    .limit(1);

  if (existing.length === 0) {
    return Response.json({ error: "Playbook template not found" }, { status: 404 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // Update template fields
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateFields.name = data.name;
    if (data.description !== undefined) updateFields.description = data.description;
    if (data.triggerCategory !== undefined) updateFields.triggerCategory = data.triggerCategory;
    if (data.triggerMinSeverity !== undefined) updateFields.triggerMinSeverity = data.triggerMinSeverity;
    if (data.estimatedDurationHours !== undefined) updateFields.estimatedDurationHours = data.estimatedDurationHours;
    if (data.isActive !== undefined) updateFields.isActive = data.isActive;

    const [updated] = await tx
      .update(playbookTemplate)
      .set(updateFields)
      .where(eq(playbookTemplate.id, id))
      .returning();

    // If phases are provided, replace all phases and tasks
    if (data.phases) {
      // Delete existing phases (cascades to task templates)
      await tx
        .delete(playbookPhase)
        .where(eq(playbookPhase.templateId, id));

      // Insert new phases and tasks
      for (let phaseIdx = 0; phaseIdx < data.phases.length; phaseIdx++) {
        const phaseData = data.phases[phaseIdx];

        const [phase] = await tx
          .insert(playbookPhase)
          .values({
            templateId: id,
            name: phaseData.name,
            description: phaseData.description ?? null,
            sortOrder: phaseIdx + 1,
            deadlineHoursRelative: phaseData.deadlineHoursRelative,
            escalationRoleOnOverdue: phaseData.escalationRoleOnOverdue ?? null,
            communicationTemplateKey: phaseData.communicationTemplateKey ?? null,
          })
          .returning();

        for (let taskIdx = 0; taskIdx < phaseData.tasks.length; taskIdx++) {
          const taskData = phaseData.tasks[taskIdx];

          await tx.insert(playbookTaskTemplate).values({
            phaseId: phase.id,
            title: taskData.title,
            description: taskData.description ?? null,
            assignedRole: taskData.assignedRole,
            deadlineHoursRelative: taskData.deadlineHoursRelative,
            isCriticalPath: taskData.isCriticalPath,
            sortOrder: taskIdx + 1,
            checklistItems: taskData.checklistItems ?? [],
          });
        }
      }
    }

    return updated;
  });

  return Response.json({ data: result });
}

// DELETE /api/v1/playbooks/[id] — Delete playbook template
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const existing = await db
    .select()
    .from(playbookTemplate)
    .where(and(eq(playbookTemplate.id, id), eq(playbookTemplate.orgId, ctx.orgId)))
    .limit(1);

  if (existing.length === 0) {
    return Response.json({ error: "Playbook template not found" }, { status: 404 });
  }

  // Check for active activations
  const activeActivations = await db
    .select({ id: playbookActivation.id })
    .from(playbookActivation)
    .where(
      and(
        eq(playbookActivation.templateId, id),
        eq(playbookActivation.status, "active"),
      ),
    )
    .limit(1);

  if (activeActivations.length > 0) {
    return Response.json(
      { error: "Cannot delete template with active playbook activations" },
      { status: 400 },
    );
  }

  await withAuditContext(ctx, async (tx) => {
    // Cascade deletes phases and task templates
    await tx.delete(playbookTemplate).where(eq(playbookTemplate.id, id));
  });

  return Response.json({ success: true }, { status: 200 });
}
