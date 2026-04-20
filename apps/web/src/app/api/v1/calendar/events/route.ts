import { db, complianceCalendarEvent } from "@grc/db";
import { createCalendarEventSchema } from "@grc/shared";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import { eq, and, count, desc, isNull } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

// POST /api/v1/calendar/events — Create manual calendar event
export async function POST(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "dpo",
    "auditor",
  );
  if (ctx instanceof Response) return ctx;

  const body = createCalendarEventSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(complianceCalendarEvent)
      .values({
        orgId: ctx.orgId,
        title: body.data.title,
        description: body.data.description,
        startAt: new Date(body.data.startAt),
        endAt: body.data.endAt ? new Date(body.data.endAt) : null,
        isAllDay: body.data.isAllDay,
        eventType: body.data.eventType,
        module: body.data.module,
        recurrence: body.data.recurrence,
        recurrenceEndAt: body.data.recurrenceEndAt
          ? new Date(body.data.recurrenceEndAt)
          : null,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/calendar/events — List manual calendar events
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset } = paginate(req);

  const conditions: SQL[] = [
    eq(complianceCalendarEvent.orgId, ctx.orgId),
    isNull(complianceCalendarEvent.deletedAt),
  ];

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(complianceCalendarEvent)
      .where(where)
      .orderBy(desc(complianceCalendarEvent.startAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(complianceCalendarEvent).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
