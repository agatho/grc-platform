import { db, workItem, workItemType } from "@grc/db";
import { createWorkItemSchema } from "@grc/shared";
import {
  eq,
  and,
  isNull,
  count,
  desc,
  inArray,
  lte,
  gte,
  lt,
  sql,
} from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";
import type { WorkItemStatus } from "@grc/shared";

// GET /api/v1/work-items — Unified work items list (paginated, filterable)
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { page, limit: rawLimit, offset: rawOffset, searchParams } = paginate(req);

  // Override default page size to 25
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get("limit")) || 25),
  );
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [
    eq(workItem.orgId, ctx.orgId),
    isNull(workItem.deletedAt),
  ];

  // Filter by type_key (multi-value)
  const typeKeys = searchParams.getAll("type_key");
  if (typeKeys.length > 0) {
    conditions.push(inArray(workItem.typeKey, typeKeys));
  }

  // Filter by status (multi-value)
  const statuses = searchParams.getAll("status");
  if (statuses.length > 0) {
    conditions.push(inArray(workItem.status, statuses as WorkItemStatus[]));
  }

  // Filter by responsible_id
  const responsibleId = searchParams.get("responsible_id");
  if (responsibleId) {
    conditions.push(eq(workItem.responsibleId, responsibleId));
  }

  // Full-text search on name
  const search = searchParams.get("search");
  if (search) {
    conditions.push(sql`${workItem.name} ILIKE ${"%" + search + "%"}`);
  }

  // Overdue filter: has due_date in the past and not in terminal state
  const overdue = searchParams.get("overdue");
  if (overdue === "true") {
    conditions.push(lt(workItem.dueDate, new Date()));
    conditions.push(
      sql`${workItem.status} NOT IN ('completed', 'obsolete', 'cancelled')`,
    );
  }

  // Created date range filters
  const createdFrom = searchParams.get("created_from");
  if (createdFrom) {
    conditions.push(gte(workItem.createdAt, new Date(createdFrom)));
  }

  const createdTo = searchParams.get("created_to");
  if (createdTo) {
    conditions.push(lte(workItem.createdAt, new Date(createdTo)));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: workItem.id,
        orgId: workItem.orgId,
        typeKey: workItem.typeKey,
        elementId: workItem.elementId,
        name: workItem.name,
        status: workItem.status,
        responsibleId: workItem.responsibleId,
        reviewerId: workItem.reviewerId,
        dueDate: workItem.dueDate,
        completedAt: workItem.completedAt,
        completedBy: workItem.completedBy,
        grcPerspective: workItem.grcPerspective,
        createdAt: workItem.createdAt,
        updatedAt: workItem.updatedAt,
        createdBy: workItem.createdBy,
        updatedBy: workItem.updatedBy,
        // Joined type info
        displayNameDe: workItemType.displayNameDe,
        displayNameEn: workItemType.displayNameEn,
        icon: workItemType.icon,
        colorClass: workItemType.colorClass,
        primaryModule: workItemType.primaryModule,
      })
      .from(workItem)
      .leftJoin(workItemType, eq(workItem.typeKey, workItemType.typeKey))
      .where(where)
      .orderBy(desc(workItem.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(workItem).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}

// POST /api/v1/work-items — Create work item (all roles)
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const body = createWorkItemSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Validate that the type_key exists
  const [type] = await db
    .select({ typeKey: workItemType.typeKey })
    .from(workItemType)
    .where(eq(workItemType.typeKey, body.data.typeKey));

  if (!type) {
    return Response.json(
      { error: `Unknown work item type: '${body.data.typeKey}'` },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(workItem)
      .values({
        orgId: ctx.orgId,
        typeKey: body.data.typeKey,
        name: body.data.name,
        status: body.data.status,
        responsibleId: body.data.responsibleId,
        reviewerId: body.data.reviewerId,
        dueDate: body.data.dueDate ? new Date(body.data.dueDate) : undefined,
        grcPerspective: body.data.grcPerspective,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}
