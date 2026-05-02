// PATCH  /api/v1/programmes/journeys/[id]/steps/[stepId]/subtasks/[subtaskId]
// DELETE /api/v1/programmes/journeys/[id]/steps/[stepId]/subtasks/[subtaskId]

import {
  db,
  programmeJourneySubtask,
  programmeJourneyEvent,
  PROGRAMME_SUBTASK_STATUS_VALUES,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const patchSubtaskSchema = z
  .object({
    title: z.string().min(2).max(300).optional(),
    description: z.string().max(5000).nullable().optional(),
    status: z.enum(PROGRAMME_SUBTASK_STATUS_VALUES).optional(),
    ownerId: z.string().uuid().nullable().optional(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    completionNotes: z.string().max(5000).nullable().optional(),
    deliverableType: z.string().max(80).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Empty body" });

export async function PATCH(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; stepId: string; subtaskId: string }>;
  },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId, subtaskId } = await params;

  const [existing] = await db
    .select()
    .from(programmeJourneySubtask)
    .where(
      and(
        eq(programmeJourneySubtask.id, subtaskId),
        eq(programmeJourneySubtask.journeyStepId, stepId),
        eq(programmeJourneySubtask.orgId, ctx.orgId),
      ),
    )
    .limit(1);
  if (!existing) {
    return Response.json({ error: "Subtask not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSubtaskSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const update: Record<string, unknown> = { ...parsed.data };
  // Status-Übergänge: setze startedAt / completedAt automatisch
  if (parsed.data.status === "in_progress" && !existing.startedAt) {
    update.startedAt = new Date();
  }
  if (parsed.data.status === "completed") {
    update.completedAt = new Date();
    if (!existing.startedAt) update.startedAt = new Date();
  }
  if (parsed.data.status && parsed.data.status !== "completed") {
    update.completedAt = null;
  }
  update.updatedAt = new Date();
  update.updatedBy = ctx.userId;

  const [updated] = await withAuditContext(ctx, async () =>
    db
      .update(programmeJourneySubtask)
      .set(update)
      .where(eq(programmeJourneySubtask.id, subtaskId))
      .returning(),
  );

  await db.insert(programmeJourneyEvent).values({
    orgId: ctx.orgId,
    journeyId: id,
    stepId,
    eventType: "subtask.updated",
    actorId: ctx.userId,
    payload: { subtaskId, fields: Object.keys(parsed.data) },
  });

  return Response.json({ data: updated });
}

export async function DELETE(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; stepId: string; subtaskId: string }>;
  },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId, subtaskId } = await params;

  const [existing] = await db
    .select({ id: programmeJourneySubtask.id })
    .from(programmeJourneySubtask)
    .where(
      and(
        eq(programmeJourneySubtask.id, subtaskId),
        eq(programmeJourneySubtask.journeyStepId, stepId),
        eq(programmeJourneySubtask.orgId, ctx.orgId),
      ),
    )
    .limit(1);
  if (!existing) {
    return Response.json({ error: "Subtask not found" }, { status: 404 });
  }

  await withAuditContext(ctx, async () =>
    db
      .delete(programmeJourneySubtask)
      .where(eq(programmeJourneySubtask.id, subtaskId)),
  );

  await db.insert(programmeJourneyEvent).values({
    orgId: ctx.orgId,
    journeyId: id,
    stepId,
    eventType: "subtask.deleted",
    actorId: ctx.userId,
    payload: { subtaskId },
  });

  return Response.json({ data: { ok: true } });
}
