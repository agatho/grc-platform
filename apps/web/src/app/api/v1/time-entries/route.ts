import { db, grcTimeEntry, user } from "@grc/db";
import { createTimeEntrySchema } from "@grc/shared";
import { eq, and, count, desc, gte, lte } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/time-entries — Record time entry
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const body = createTimeEntrySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(grcTimeEntry)
      .values({
        orgId: ctx.orgId,
        userId: ctx.userId,
        taskId: body.data.taskId,
        entityType: body.data.entityType,
        entityId: body.data.entityId,
        grcArea: body.data.grcArea,
        department: body.data.department,
        hours: body.data.hours.toString(),
        date: body.data.date,
        description: body.data.description,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/time-entries — List time entries
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(grcTimeEntry.orgId, ctx.orgId)];

  const userId = searchParams.get("user_id");
  if (userId) {
    conditions.push(eq(grcTimeEntry.userId, userId));
  }

  const grcArea = searchParams.get("grc_area");
  if (grcArea) {
    conditions.push(eq(grcTimeEntry.grcArea, grcArea as "erm" | "isms" | "ics" | "dpms" | "audit" | "tprm" | "bcms" | "esg" | "general"));
  }

  const dateFrom = searchParams.get("date_from");
  if (dateFrom) {
    conditions.push(gte(grcTimeEntry.date, dateFrom));
  }

  const dateTo = searchParams.get("date_to");
  if (dateTo) {
    conditions.push(lte(grcTimeEntry.date, dateTo));
  }

  const department = searchParams.get("department");
  if (department) {
    conditions.push(eq(grcTimeEntry.department, department));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: grcTimeEntry.id,
        orgId: grcTimeEntry.orgId,
        userId: grcTimeEntry.userId,
        userName: user.name,
        userEmail: user.email,
        taskId: grcTimeEntry.taskId,
        entityType: grcTimeEntry.entityType,
        entityId: grcTimeEntry.entityId,
        grcArea: grcTimeEntry.grcArea,
        department: grcTimeEntry.department,
        hours: grcTimeEntry.hours,
        date: grcTimeEntry.date,
        description: grcTimeEntry.description,
        createdAt: grcTimeEntry.createdAt,
      })
      .from(grcTimeEntry)
      .leftJoin(user, eq(grcTimeEntry.userId, user.id))
      .where(where)
      .orderBy(desc(grcTimeEntry.date))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(grcTimeEntry).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
