import {
  db,
  risk,
  workItem,
  user,
  userOrganizationRole,
  riskAppetite,
  notification,
} from "@grc/db";
import { createRiskSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import {
  eq,
  and,
  isNull,
  count,
  desc,
  asc,
  inArray,
  sql,
  ilike,
  gte,
  lte,
  or,
} from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/risks — Create risk
export async function POST(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createRiskSchema.safeParse(await req.json());
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
    // Create work item for the risk
    const [wi] = await tx
      .insert(workItem)
      .values({
        orgId: ctx.orgId,
        typeKey: "risk",
        name: body.data.title,
        status: "draft",
        responsibleId: body.data.ownerId,
        grcPerspective: ["erm"],
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    // Create the risk
    const [row] = await tx
      .insert(risk)
      .values({
        orgId: ctx.orgId,
        workItemId: wi.id,
        title: body.data.title,
        description: body.data.description,
        riskCategory: body.data.riskCategory,
        riskSource: body.data.riskSource,
        ownerId: body.data.ownerId,
        department: body.data.department,
        reviewDate: body.data.reviewDate,
        financialImpactMin: body.data.financialImpactMin?.toString(),
        financialImpactMax: body.data.financialImpactMax?.toString(),
        financialImpactExpected: body.data.financialImpactExpected?.toString(),
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    // Send notification to owner
    if (body.data.ownerId && body.data.ownerId !== ctx.userId) {
      await tx.insert(notification).values({
        userId: body.data.ownerId,
        orgId: ctx.orgId,
        type: "task_assigned",
        entityType: "risk",
        entityId: row.id,
        title: `Risk assigned to you: ${body.data.title}`,
        message: body.data.description ?? null,
        channel: "both",
        templateKey: "risk_owner_assigned",
        templateData: {
          riskId: row.id,
          riskTitle: body.data.title,
          assignedBy: ctx.userId,
        },
        createdBy: ctx.userId,
      });
    }

    return { ...row, elementId: wi.elementId };
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/risks — List risks with filters
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)];

  // Status filter (multi-value)
  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<
      "identified" | "assessed" | "treated" | "accepted" | "closed"
    >;
    conditions.push(inArray(risk.status, statuses));
  }

  // Category filter (multi-value)
  const categoryParam = searchParams.get("category");
  if (categoryParam) {
    const categories = categoryParam.split(",") as Array<
      | "strategic"
      | "operational"
      | "financial"
      | "compliance"
      | "cyber"
      | "reputational"
      | "esg"
    >;
    conditions.push(inArray(risk.riskCategory, categories));
  }

  // Owner filter
  const ownerId = searchParams.get("ownerId");
  if (ownerId) {
    conditions.push(eq(risk.ownerId, ownerId));
  }

  // Department filter
  const department = searchParams.get("department");
  if (department) {
    conditions.push(eq(risk.department, department));
  }

  // Appetite exceeded filter
  const appetiteExceeded = searchParams.get("appetiteExceeded");
  if (appetiteExceeded === "true") {
    conditions.push(eq(risk.riskAppetiteExceeded, true));
  } else if (appetiteExceeded === "false") {
    conditions.push(eq(risk.riskAppetiteExceeded, false));
  }

  // Score range filters
  const scoreMin = searchParams.get("scoreMin");
  if (scoreMin) {
    conditions.push(gte(risk.riskScoreResidual, Number(scoreMin)));
  }

  const scoreMax = searchParams.get("scoreMax");
  if (scoreMax) {
    conditions.push(lte(risk.riskScoreResidual, Number(scoreMax)));
  }

  // Search (ILIKE on title + description)
  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(ilike(risk.title, pattern), ilike(risk.description, pattern))!,
    );
  }

  const where = and(...conditions);

  // Sort
  const sortParam = searchParams.get("sort");
  const sortDir = searchParams.get("sortDir") === "asc" ? asc : desc;
  let orderBy;
  switch (sortParam) {
    case "title":
      orderBy = sortDir(risk.title);
      break;
    case "status":
      orderBy = sortDir(risk.status);
      break;
    case "category":
      orderBy = sortDir(risk.riskCategory);
      break;
    case "riskScoreInherent":
      orderBy = sortDir(risk.riskScoreInherent);
      break;
    case "createdAt":
      orderBy = sortDir(risk.createdAt);
      break;
    default:
      orderBy = desc(risk.riskScoreResidual);
  }

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: risk.id,
        orgId: risk.orgId,
        workItemId: risk.workItemId,
        elementId: workItem.elementId,
        title: risk.title,
        description: risk.description,
        riskCategory: risk.riskCategory,
        riskSource: risk.riskSource,
        status: risk.status,
        ownerId: risk.ownerId,
        ownerName: user.name,
        ownerEmail: user.email,
        department: risk.department,
        inherentLikelihood: risk.inherentLikelihood,
        inherentImpact: risk.inherentImpact,
        residualLikelihood: risk.residualLikelihood,
        residualImpact: risk.residualImpact,
        riskScoreInherent: risk.riskScoreInherent,
        riskScoreResidual: risk.riskScoreResidual,
        treatmentStrategy: risk.treatmentStrategy,
        riskAppetiteExceeded: risk.riskAppetiteExceeded,
        reviewDate: risk.reviewDate,
        createdAt: risk.createdAt,
        updatedAt: risk.updatedAt,
      })
      .from(risk)
      .leftJoin(workItem, eq(risk.workItemId, workItem.id))
      .leftJoin(user, eq(risk.ownerId, user.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(risk).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
