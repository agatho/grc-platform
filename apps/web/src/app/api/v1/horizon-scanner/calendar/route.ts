import { db, horizonCalendarEvent } from "@grc/db";
import {
  createHorizonCalendarEventSchema,
  horizonCalendarQuerySchema,
} from "@grc/shared";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "dpo", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const body = createHorizonCalendarEventSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(horizonCalendarEvent)
      .values({ ...body.data, orgId: ctx.orgId })
      .returning();
    return created;
  });
  return Response.json({ data: result }, { status: 201 });
}

export async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "dpo",
    "risk_manager",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const query = horizonCalendarQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success)
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  const { page, limit, from, to, priority, isCompleted } = query.data;
  const offset = (page - 1) * limit;
  const conditions = [eq(horizonCalendarEvent.orgId, ctx.orgId)];
  if (from) conditions.push(gte(horizonCalendarEvent.eventDate, from));
  if (to) conditions.push(lte(horizonCalendarEvent.eventDate, to));
  if (priority) conditions.push(eq(horizonCalendarEvent.priority, priority));
  if (isCompleted !== undefined)
    conditions.push(eq(horizonCalendarEvent.isCompleted, isCompleted));

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(horizonCalendarEvent)
      .where(and(...conditions))
      .orderBy(desc(horizonCalendarEvent.eventDate))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(horizonCalendarEvent)
      .where(and(...conditions)),
  ]);
  return Response.json({
    data: rows,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
