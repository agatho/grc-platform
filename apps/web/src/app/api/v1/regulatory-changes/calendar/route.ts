import { db, regulatoryCalendarEvent } from "@grc/db";
// [ARCTOS-FULL-2026-08-31 / Restarbeiten] Die Route validierte gegen das
// GENERISCHE Kalender-Schema (startAt/endAt/isAllDay/recurrence). Die Tabelle
// `regulatory_calendar_event` verlangt `event_date` NOT NULL und kennt keines
// dieser Felder — jeder POST lief in eine Constraint-Verletzung. Das passende
// Schema liegt seit jeher daneben in schemas/regulatory-change.ts.
import {
  createRegulatoryCalendarEventSchema,
  calendarEventQuerySchema,
} from "@grc/shared";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/regulatory-changes/calendar — Create calendar event
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "dpo", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const body = createRegulatoryCalendarEventSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(regulatoryCalendarEvent)
      .values({ ...body.data, orgId: ctx.orgId })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
// GET /api/v1/regulatory-changes/calendar — List calendar events
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "dpo",
    "risk_manager",
    "auditor",
    "control_owner",
  );
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = calendarEventQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const { page, limit, from, to, priority, eventType, isCompleted } =
    query.data;
  const offset = (page - 1) * limit;

  const conditions = [eq(regulatoryCalendarEvent.orgId, ctx.orgId)];
  if (from) conditions.push(gte(regulatoryCalendarEvent.eventDate, from));
  if (to) conditions.push(lte(regulatoryCalendarEvent.eventDate, to));
  if (priority) conditions.push(eq(regulatoryCalendarEvent.priority, priority));
  if (eventType)
    conditions.push(eq(regulatoryCalendarEvent.eventType, eventType));
  if (isCompleted !== undefined)
    conditions.push(eq(regulatoryCalendarEvent.isCompleted, isCompleted));

  const [events, countResult] = await Promise.all([
    db
      .select()
      .from(regulatoryCalendarEvent)
      .where(and(...conditions))
      .orderBy(regulatoryCalendarEvent.eventDate)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(regulatoryCalendarEvent)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: events,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
});
