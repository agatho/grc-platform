import {
  db,
  controlTestCampaign,
  user,
  userOrganizationRole,
} from "@grc/db";
import { createCampaignSchema } from "@grc/shared";
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

// POST /api/v1/control-test-campaigns — Create campaign
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createCampaignSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Validate responsible is in same org
  if (body.data.responsibleId) {
    const [ownerRole] = await db
      .select({ id: userOrganizationRole.userId })
      .from(userOrganizationRole)
      .where(
        and(
          eq(userOrganizationRole.userId, body.data.responsibleId),
          eq(userOrganizationRole.orgId, ctx.orgId),
          isNull(userOrganizationRole.deletedAt),
        ),
      );
    if (!ownerRole) {
      return Response.json(
        { error: "Responsible user not found in this organization" },
        { status: 422 },
      );
    }
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(controlTestCampaign)
      .values({
        orgId: ctx.orgId,
        name: body.data.name,
        description: body.data.description,
        periodStart: body.data.periodStart,
        periodEnd: body.data.periodEnd,
        responsibleId: body.data.responsibleId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/control-test-campaigns — List campaigns
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(controlTestCampaign.orgId, ctx.orgId),
    isNull(controlTestCampaign.deletedAt),
  ];

  // Status filter
  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<
      "draft" | "active" | "completed" | "cancelled"
    >;
    conditions.push(inArray(controlTestCampaign.status, statuses));
  }

  // Search
  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(controlTestCampaign.name, pattern),
        ilike(controlTestCampaign.description, pattern),
      )!,
    );
  }

  const where = and(...conditions);

  const sortDir = searchParams.get("sortDir") === "asc" ? asc : desc;

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: controlTestCampaign.id,
        orgId: controlTestCampaign.orgId,
        name: controlTestCampaign.name,
        description: controlTestCampaign.description,
        status: controlTestCampaign.status,
        periodStart: controlTestCampaign.periodStart,
        periodEnd: controlTestCampaign.periodEnd,
        responsibleId: controlTestCampaign.responsibleId,
        responsibleName: user.name,
        createdAt: controlTestCampaign.createdAt,
        updatedAt: controlTestCampaign.updatedAt,
      })
      .from(controlTestCampaign)
      .leftJoin(user, eq(controlTestCampaign.responsibleId, user.id))
      .where(where)
      .orderBy(sortDir(controlTestCampaign.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(controlTestCampaign).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
