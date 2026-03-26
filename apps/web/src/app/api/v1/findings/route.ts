import {
  db,
  finding,
  workItem,
  user,
  userOrganizationRole,
  notification,
} from "@grc/db";
import { createFindingSchema } from "@grc/shared";
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

// POST /api/v1/findings — Create finding
export async function POST(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "auditor",
    "control_owner",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createFindingSchema.safeParse(await req.json());
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
    // Create work item for the finding
    const [wi] = await tx
      .insert(workItem)
      .values({
        orgId: ctx.orgId,
        typeKey: "finding",
        name: body.data.title,
        status: "draft",
        responsibleId: body.data.ownerId,
        grcPerspective: ["ics"],
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    // Create the finding
    const [row] = await tx
      .insert(finding)
      .values({
        orgId: ctx.orgId,
        workItemId: wi.id,
        title: body.data.title,
        description: body.data.description,
        severity: body.data.severity,
        source: body.data.source,
        controlId: body.data.controlId,
        controlTestId: body.data.controlTestId,
        riskId: body.data.riskId,
        ownerId: body.data.ownerId,
        remediationPlan: body.data.remediationPlan,
        remediationDueDate: body.data.remediationDueDate,
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
        entityType: "finding",
        entityId: row.id,
        title: `Finding assigned to you: ${body.data.title}`,
        message: body.data.description ?? null,
        channel: "both",
        templateKey: "finding_owner_assigned",
        templateData: {
          findingId: row.id,
          findingTitle: body.data.title,
          assignedBy: ctx.userId,
        },
        createdBy: ctx.userId,
      });
    }

    return { ...row, elementId: wi.elementId };
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/findings — List findings with filters
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(finding.orgId, ctx.orgId),
    isNull(finding.deletedAt),
  ];

  // Status filter
  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<
      "identified" | "in_remediation" | "remediated" | "verified" | "accepted" | "closed"
    >;
    conditions.push(inArray(finding.status, statuses));
  }

  // Severity filter
  const severityParam = searchParams.get("severity");
  if (severityParam) {
    const severities = severityParam.split(",") as Array<
      "observation" | "recommendation" | "improvement_requirement" | "insignificant_nonconformity" | "significant_nonconformity"
    >;
    conditions.push(inArray(finding.severity, severities));
  }

  // Source filter
  const sourceParam = searchParams.get("source");
  if (sourceParam) {
    const sources = sourceParam.split(",") as Array<
      "control_test" | "audit" | "incident" | "self_assessment" | "external"
    >;
    conditions.push(inArray(finding.source, sources));
  }

  // Control filter
  const controlId = searchParams.get("controlId");
  if (controlId) {
    conditions.push(eq(finding.controlId, controlId));
  }

  // Owner filter
  const ownerId = searchParams.get("ownerId");
  if (ownerId) {
    conditions.push(eq(finding.ownerId, ownerId));
  }

  // Search
  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(finding.title, pattern),
        ilike(finding.description, pattern),
      )!,
    );
  }

  const where = and(...conditions);

  const sortParam = searchParams.get("sort");
  const sortDir = searchParams.get("sortDir") === "asc" ? asc : desc;
  let orderBy;
  switch (sortParam) {
    case "title":
      orderBy = sortDir(finding.title);
      break;
    case "status":
      orderBy = sortDir(finding.status);
      break;
    case "severity":
      orderBy = sortDir(finding.severity);
      break;
    case "createdAt":
      orderBy = sortDir(finding.createdAt);
      break;
    default:
      orderBy = desc(finding.updatedAt);
  }

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: finding.id,
        orgId: finding.orgId,
        workItemId: finding.workItemId,
        elementId: workItem.elementId,
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        status: finding.status,
        source: finding.source,
        controlId: finding.controlId,
        controlTestId: finding.controlTestId,
        riskId: finding.riskId,
        ownerId: finding.ownerId,
        ownerName: user.name,
        ownerEmail: user.email,
        remediationDueDate: finding.remediationDueDate,
        remediatedAt: finding.remediatedAt,
        verifiedAt: finding.verifiedAt,
        createdAt: finding.createdAt,
        updatedAt: finding.updatedAt,
      })
      .from(finding)
      .leftJoin(workItem, eq(finding.workItemId, workItem.id))
      .leftJoin(user, eq(finding.ownerId, user.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(finding).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
