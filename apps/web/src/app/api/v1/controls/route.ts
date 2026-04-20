import {
  db,
  control,
  workItem,
  user,
  userOrganizationRole,
  notification,
} from "@grc/db";
import { createControlSchema } from "@grc/shared";
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
  sql,
} from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/controls — Create control
export async function POST(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "auditor",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createControlSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Validate owner is in same org
  if (body.data.ownerId) {
    const [ownerRole] = await db
      .select({ id: userOrganizationRole.userId })
      .from(userOrganizationRole)
      .where(
        and(
          eq(userOrganizationRole.userId, body.data.ownerId),
          eq(userOrganizationRole.orgId, ctx.orgId),
          isNull(userOrganizationRole.deletedAt),
        ),
      );
    if (!ownerRole) {
      return Response.json(
        { error: "Owner not found in this organization" },
        { status: 422 },
      );
    }
  }

  const created = await withAuditContext(ctx, async (tx) => {
    // Create work item for the control
    const [wi] = await tx
      .insert(workItem)
      .values({
        orgId: ctx.orgId,
        typeKey: "control",
        name: body.data.title,
        status: "draft",
        responsibleId: body.data.ownerId,
        grcPerspective: ["ics"],
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    // Create the control
    const [row] = await tx
      .insert(control)
      .values({
        orgId: ctx.orgId,
        workItemId: wi.id,
        title: body.data.title,
        description: body.data.description,
        controlType: body.data.controlType,
        frequency: body.data.frequency,
        automationLevel: body.data.automationLevel,
        assertions: body.data.assertions,
        ownerId: body.data.ownerId,
        department: body.data.department,
        objective: body.data.objective,
        testInstructions: body.data.testInstructions,
        reviewDate: body.data.reviewDate,
        costOnetime: body.data.costOnetime?.toString(),
        costAnnual: body.data.costAnnual?.toString(),
        effortHours: body.data.effortHours?.toString(),
        budgetId: body.data.budgetId,
        costNote: body.data.costNote,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    // Notify owner
    if (body.data.ownerId && body.data.ownerId !== ctx.userId) {
      await tx.insert(notification).values({
        userId: body.data.ownerId,
        orgId: ctx.orgId,
        type: "task_assigned",
        entityType: "control",
        entityId: row.id,
        title: `Control assigned to you: ${body.data.title}`,
        message: body.data.description ?? null,
        channel: "both",
        templateKey: "control_owner_assigned",
        templateData: {
          controlId: row.id,
          controlTitle: body.data.title,
          assignedBy: ctx.userId,
        },
        createdBy: ctx.userId,
      });
    }

    return { ...row, elementId: wi.elementId };
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/controls — List controls with filters
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(control.orgId, ctx.orgId),
    isNull(control.deletedAt),
  ];

  // Status filter (multi-value)
  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<
      "designed" | "implemented" | "effective" | "ineffective" | "retired"
    >;
    conditions.push(inArray(control.status, statuses));
  }

  // Type filter
  const typeParam = searchParams.get("type");
  if (typeParam) {
    const types = typeParam.split(",") as Array<
      "preventive" | "detective" | "corrective"
    >;
    conditions.push(inArray(control.controlType, types));
  }

  // Frequency filter
  const freqParam = searchParams.get("frequency");
  if (freqParam) {
    const freqs = freqParam.split(",") as Array<
      | "event_driven"
      | "continuous"
      | "daily"
      | "weekly"
      | "monthly"
      | "quarterly"
      | "annually"
      | "ad_hoc"
    >;
    conditions.push(inArray(control.frequency, freqs));
  }

  // Automation level filter
  const automationParam = searchParams.get("automationLevel");
  if (automationParam) {
    const levels = automationParam.split(",") as Array<
      "manual" | "semi_automated" | "fully_automated"
    >;
    conditions.push(inArray(control.automationLevel, levels));
  }

  // Owner filter
  const ownerId = searchParams.get("ownerId");
  if (ownerId) {
    conditions.push(eq(control.ownerId, ownerId));
  }

  // Department filter
  const department = searchParams.get("department");
  if (department) {
    conditions.push(eq(control.department, department));
  }

  // Assertion filter
  const assertionParam = searchParams.get("assertion");
  if (assertionParam) {
    conditions.push(
      sql`${control.assertions} @> ARRAY[${assertionParam}]::text[]`,
    );
  }

  // Search (ILIKE on title + description)
  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(ilike(control.title, pattern), ilike(control.description, pattern))!,
    );
  }

  const where = and(...conditions);

  // Sort
  const sortParam = searchParams.get("sort");
  const sortDir = searchParams.get("sortDir") === "asc" ? asc : desc;
  let orderBy;
  switch (sortParam) {
    case "title":
      orderBy = sortDir(control.title);
      break;
    case "status":
      orderBy = sortDir(control.status);
      break;
    case "type":
      orderBy = sortDir(control.controlType);
      break;
    case "createdAt":
      orderBy = sortDir(control.createdAt);
      break;
    default:
      orderBy = desc(control.updatedAt);
  }

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: control.id,
        orgId: control.orgId,
        workItemId: control.workItemId,
        elementId: workItem.elementId,
        title: control.title,
        description: control.description,
        controlType: control.controlType,
        frequency: control.frequency,
        automationLevel: control.automationLevel,
        status: control.status,
        assertions: control.assertions,
        ownerId: control.ownerId,
        ownerName: user.name,
        ownerEmail: user.email,
        department: control.department,
        objective: control.objective,
        reviewDate: control.reviewDate,
        createdAt: control.createdAt,
        updatedAt: control.updatedAt,
      })
      .from(control)
      .leftJoin(workItem, eq(control.workItemId, workItem.id))
      .leftJoin(user, eq(control.ownerId, user.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(control).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
