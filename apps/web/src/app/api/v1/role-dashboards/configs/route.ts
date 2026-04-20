import { db, roleDashboardConfig } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  createRoleDashboardConfigSchema,
  listRoleDashboardConfigsQuerySchema,
} from "@grc/shared";

// GET /api/v1/role-dashboards/configs
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = listRoleDashboardConfigsQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );
  const conditions = [eq(roleDashboardConfig.orgId, ctx.orgId)];
  if (query.dashboardType)
    conditions.push(eq(roleDashboardConfig.dashboardType, query.dashboardType));
  if (query.isActive !== undefined)
    conditions.push(eq(roleDashboardConfig.isActive, query.isActive));

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(roleDashboardConfig)
      .where(and(...conditions))
      .orderBy(desc(roleDashboardConfig.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(roleDashboardConfig)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
}

// POST /api/v1/role-dashboards/configs
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = createRoleDashboardConfigSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(roleDashboardConfig)
      .values({
        orgId: ctx.orgId,
        ...body,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
