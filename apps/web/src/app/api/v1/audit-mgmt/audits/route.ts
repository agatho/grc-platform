import {
  db,
  audit,
  workItem,
  user,
} from "@grc/db";
import { createAuditSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import {
  eq,
  and,
  isNull,
  count,
  desc,
  asc,
  inArray,
  ilike,
  or,
} from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/audit-mgmt/audits — Create audit (with work_item auto-creation)
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createAuditSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    // Create work item.
    // workItemStatusGenericEnum has no "planned" value — using "draft" for a
    // newly created audit (maps to audit.status="planned" in the typed table).
    const [wi] = await tx
      .insert(workItem)
      .values({
        orgId: ctx.orgId,
        typeKey: "audit",
        name: body.data.title,
        status: "draft",
        responsibleId: body.data.leadAuditorId,
        grcPerspective: ["audit"],
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    // Create audit
    const [row] = await tx
      .insert(audit)
      .values({
        orgId: ctx.orgId,
        workItemId: wi.id,
        auditPlanItemId: body.data.auditPlanItemId,
        title: body.data.title,
        description: body.data.description,
        auditType: body.data.auditType,
        scopeDescription: body.data.scopeDescription,
        scopeProcesses: body.data.scopeProcesses,
        scopeDepartments: body.data.scopeDepartments,
        scopeFrameworks: body.data.scopeFrameworks,
        leadAuditorId: body.data.leadAuditorId,
        auditorIds: body.data.auditorIds,
        auditeeId: body.data.auditeeId,
        plannedStart: body.data.plannedStart,
        plannedEnd: body.data.plannedEnd,
        createdBy: ctx.userId,
      })
      .returning();

    return { ...row, workItemId: wi.id };
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/audit-mgmt/audits — List audits with filters
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(audit.orgId, ctx.orgId),
    isNull(audit.deletedAt),
  ];

  // Status filter
  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<
      "planned" | "preparation" | "fieldwork" | "reporting" | "review" | "completed" | "cancelled"
    >;
    conditions.push(inArray(audit.status, statuses));
  }

  // Type filter
  const typeParam = searchParams.get("auditType");
  if (typeParam) {
    const types = typeParam.split(",") as Array<
      "internal" | "external" | "certification" | "surveillance" | "follow_up"
    >;
    conditions.push(inArray(audit.auditType, types));
  }

  // Lead auditor filter
  const leadAuditorId = searchParams.get("leadAuditorId");
  if (leadAuditorId) {
    conditions.push(eq(audit.leadAuditorId, leadAuditorId));
  }

  // Search
  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(audit.title, pattern),
        ilike(audit.description, pattern),
      )!,
    );
  }

  const where = and(...conditions);

  const sortParam = searchParams.get("sort");
  const sortDir = searchParams.get("sortDir") === "asc" ? asc : desc;
  let orderBy;
  switch (sortParam) {
    case "title":
      orderBy = sortDir(audit.title);
      break;
    case "status":
      orderBy = sortDir(audit.status);
      break;
    case "plannedStart":
      orderBy = sortDir(audit.plannedStart);
      break;
    default:
      orderBy = desc(audit.createdAt);
  }

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: audit.id,
        orgId: audit.orgId,
        workItemId: audit.workItemId,
        auditPlanItemId: audit.auditPlanItemId,
        title: audit.title,
        description: audit.description,
        auditType: audit.auditType,
        status: audit.status,
        scopeDescription: audit.scopeDescription,
        leadAuditorId: audit.leadAuditorId,
        leadAuditorName: user.name,
        auditorIds: audit.auditorIds,
        auditeeId: audit.auditeeId,
        plannedStart: audit.plannedStart,
        plannedEnd: audit.plannedEnd,
        actualStart: audit.actualStart,
        actualEnd: audit.actualEnd,
        findingCount: audit.findingCount,
        conclusion: audit.conclusion,
        createdAt: audit.createdAt,
        updatedAt: audit.updatedAt,
      })
      .from(audit)
      .leftJoin(user, eq(audit.leadAuditorId, user.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(audit).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
