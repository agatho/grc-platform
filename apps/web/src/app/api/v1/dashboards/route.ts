import { db, customDashboard, customDashboardWidget } from "@grc/db";
import { createDashboardSchema, dashboardListQuerySchema } from "@grc/shared";
import { eq, and, or, ilike, sql, desc, isNull } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

// GET /api/v1/dashboards — List dashboards (personal + team + defaults)
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);
  const visibility = searchParams.get("visibility") as
    | "personal"
    | "team"
    | "org"
    | null;
  const isDefault = searchParams.get("isDefault");
  const isFavorite = searchParams.get("isFavorite");
  const search = searchParams.get("search");

  // Build conditions: personal (own) + team (org-visible) + defaults
  const baseConditions = [
    eq(customDashboard.orgId, ctx.orgId),
    isNull(customDashboard.deletedAt),
  ];

  if (visibility === "personal") {
    baseConditions.push(eq(customDashboard.userId, ctx.userId));
    baseConditions.push(eq(customDashboard.visibility, "personal"));
  } else if (visibility === "team") {
    baseConditions.push(eq(customDashboard.visibility, "team"));
  } else if (visibility === "org") {
    baseConditions.push(eq(customDashboard.visibility, "org"));
  } else {
    // Default: show personal + team + org dashboards the user can see
    baseConditions.push(
      or(
        eq(customDashboard.userId, ctx.userId),
        eq(customDashboard.visibility, "team"),
        eq(customDashboard.visibility, "org"),
      )!,
    );
  }

  if (isDefault === "true") {
    baseConditions.push(eq(customDashboard.isDefault, true));
  }
  if (isFavorite === "true") {
    baseConditions.push(eq(customDashboard.isFavorite, true));
  }
  if (search) {
    baseConditions.push(ilike(customDashboard.name, `%${search}%`));
  }

  const where = and(...baseConditions);

  const rows = await db
    .select()
    .from(customDashboard)
    .where(where)
    .orderBy(desc(customDashboard.updatedAt))
    .limit(limit)
    .offset(offset);

  // Enrich with widget counts
  const enriched = await Promise.all(
    rows.map(async (dash) => {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(customDashboardWidget)
        .where(eq(customDashboardWidget.dashboardId, dash.id));

      return {
        ...dash,
        widgetCount: countResult?.count ?? 0,
      };
    }),
  );

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customDashboard)
    .where(where);

  return Response.json({
    data: enriched,
    pagination: {
      page,
      limit,
      total: totalResult?.count ?? 0,
      totalPages: Math.ceil((totalResult?.count ?? 0) / limit),
    },
  });
}

// POST /api/v1/dashboards — Create dashboard
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const body = await req.json();
  const parsed = createDashboardSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Only admin can set isDefault
  if (data.isDefault) {
    const roleCtx = await withAuth("admin");
    if (roleCtx instanceof Response) return roleCtx;
  }

  // Only admin can create org-visibility dashboards
  if (data.visibility === "org") {
    const roleCtx = await withAuth("admin");
    if (roleCtx instanceof Response) return roleCtx;
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(customDashboard)
      .values({
        orgId: ctx.orgId,
        userId: data.visibility === "personal" ? ctx.userId : null,
        name: data.name,
        description: data.description ?? null,
        visibility: data.visibility,
        layoutJson: data.layoutJson,
        isDefault: data.isDefault,
        createdBy: ctx.userId,
      })
      .returning();

    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
