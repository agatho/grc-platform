import { db, complianceCalendarEvent } from "@grc/db";
import { updateCalendarEventSchema } from "@grc/shared";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and, isNull } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/v1/calendar/events/:id — Update manual calendar event
export async function PUT(req: Request, { params }: RouteParams) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner", "process_owner", "dpo", "auditor");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const body = updateCalendarEventSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: ctx.userId,
    };

    if (body.data.title !== undefined) updateData.title = body.data.title;
    if (body.data.description !== undefined) updateData.description = body.data.description;
    if (body.data.startAt !== undefined) updateData.startAt = new Date(body.data.startAt);
    if (body.data.endAt !== undefined) updateData.endAt = body.data.endAt ? new Date(body.data.endAt) : null;
    if (body.data.isAllDay !== undefined) updateData.isAllDay = body.data.isAllDay;
    if (body.data.eventType !== undefined) updateData.eventType = body.data.eventType;
    if (body.data.module !== undefined) updateData.module = body.data.module;
    if (body.data.recurrence !== undefined) updateData.recurrence = body.data.recurrence;
    if (body.data.recurrenceEndAt !== undefined) {
      updateData.recurrenceEndAt = body.data.recurrenceEndAt ? new Date(body.data.recurrenceEndAt) : null;
    }

    const [row] = await tx
      .update(complianceCalendarEvent)
      .set(updateData)
      .where(
        and(
          eq(complianceCalendarEvent.id, id),
          eq(complianceCalendarEvent.orgId, ctx.orgId),
          isNull(complianceCalendarEvent.deletedAt),
        ),
      )
      .returning();
    return row;
  });

  if (!updated) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}

// DELETE /api/v1/calendar/events/:id — Soft-delete manual calendar event
export async function DELETE(req: Request, { params }: RouteParams) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner", "process_owner", "dpo", "auditor");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(complianceCalendarEvent)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.userId,
      })
      .where(
        and(
          eq(complianceCalendarEvent.id, id),
          eq(complianceCalendarEvent.orgId, ctx.orgId),
          isNull(complianceCalendarEvent.deletedAt),
        ),
      )
      .returning();
    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  return Response.json({ data: { deleted: true } });
}

// GET /api/v1/calendar/events/:id — Get a single manual event
export async function GET(req: Request, { params }: RouteParams) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [event] = await db
    .select()
    .from(complianceCalendarEvent)
    .where(
      and(
        eq(complianceCalendarEvent.id, id),
        eq(complianceCalendarEvent.orgId, ctx.orgId),
        isNull(complianceCalendarEvent.deletedAt),
      ),
    );

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  return Response.json({ data: event });
}
