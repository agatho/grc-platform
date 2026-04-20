import { db, dsr, dsrActivity, workItem, notification, user } from "@grc/db";
import { createDsrSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import {
  eq,
  and,
  count,
  desc,
  asc,
  inArray,
  ilike,
  or,
  sql,
} from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/dpms/dsr — Create DSR with auto 30-day deadline + auto work item
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createDsrSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const now = new Date();
  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + 30); // GDPR 30-day deadline

  const created = await withAuditContext(ctx, async (tx) => {
    const [wi] = await tx
      .insert(workItem)
      .values({
        orgId: ctx.orgId,
        typeKey: "dsr",
        name: `DSR: ${body.data.requestType} - ${body.data.subjectName}`,
        status: "open",
        dueDate: deadline,
        grcPerspective: ["dpms"],
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    const [row] = await tx
      .insert(dsr)
      .values({
        orgId: ctx.orgId,
        workItemId: wi.id,
        requestType: body.data.requestType,
        subjectName: body.data.subjectName,
        subjectEmail: body.data.subjectEmail,
        notes: body.data.notes,
        receivedAt: now,
        deadline,
        createdBy: ctx.userId,
      })
      .returning();

    // Create initial activity entry
    await tx.insert(dsrActivity).values({
      orgId: ctx.orgId,
      dsrId: row.id,
      activityType: "note",
      details: "Data subject request received",
      createdBy: ctx.userId,
    });

    return { ...row, elementId: wi.elementId };
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/dpms/dsr — List DSRs
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(dsr.orgId, ctx.orgId)];

  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<
      | "received"
      | "verified"
      | "processing"
      | "response_sent"
      | "closed"
      | "rejected"
    >;
    conditions.push(inArray(dsr.status, statuses));
  }

  const typeParam = searchParams.get("requestType");
  if (typeParam) {
    const types = typeParam.split(",") as Array<
      "access" | "erasure" | "restriction" | "portability" | "objection"
    >;
    conditions.push(inArray(dsr.requestType, types));
  }

  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(ilike(dsr.subjectName, pattern), ilike(dsr.subjectEmail, pattern))!,
    );
  }

  // SLA filter: overdue, at_risk, on_track
  const slaParam = searchParams.get("sla");
  if (slaParam === "overdue") {
    conditions.push(sql`${dsr.deadline} < NOW()`);
    conditions.push(sql`${dsr.status} NOT IN ('closed', 'rejected')`);
  } else if (slaParam === "at_risk") {
    conditions.push(
      sql`${dsr.deadline} BETWEEN NOW() AND NOW() + INTERVAL '5 days'`,
    );
    conditions.push(sql`${dsr.status} NOT IN ('closed', 'rejected')`);
  }

  const where = and(...conditions);

  const sortDir = searchParams.get("sortDir") === "asc" ? asc : desc;
  const sortParam = searchParams.get("sort");
  let orderBy;
  switch (sortParam) {
    case "subjectName":
      orderBy = sortDir(dsr.subjectName);
      break;
    case "requestType":
      orderBy = sortDir(dsr.requestType);
      break;
    case "status":
      orderBy = sortDir(dsr.status);
      break;
    default:
      orderBy = asc(dsr.deadline); // Most urgent first
  }

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: dsr.id,
        orgId: dsr.orgId,
        workItemId: dsr.workItemId,
        requestType: dsr.requestType,
        status: dsr.status,
        subjectName: dsr.subjectName,
        subjectEmail: dsr.subjectEmail,
        receivedAt: dsr.receivedAt,
        deadline: dsr.deadline,
        verifiedAt: dsr.verifiedAt,
        respondedAt: dsr.respondedAt,
        closedAt: dsr.closedAt,
        handlerId: dsr.handlerId,
        handlerName: user.name,
        notes: dsr.notes,
        createdAt: dsr.createdAt,
        updatedAt: dsr.updatedAt,
      })
      .from(dsr)
      .leftJoin(user, eq(dsr.handlerId, user.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(dsr).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
