import { db, userDashboardLayout } from "@grc/db";
import { updateDashboardLayoutSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// System default layout when no personal or org default is configured
const SYSTEM_DEFAULT_LAYOUT = [
  { widgetId: "risk-heatmap", x: 0, y: 0, w: 2, h: 2, visible: true },
  { widgetId: "task-list", x: 2, y: 0, w: 2, h: 1, visible: true },
  { widgetId: "compliance-status", x: 2, y: 1, w: 1, h: 1, visible: true },
  { widgetId: "control-health", x: 3, y: 1, w: 1, h: 1, visible: true },
  { widgetId: "audit-timeline", x: 0, y: 2, w: 2, h: 1, visible: true },
  { widgetId: "incident-feed", x: 2, y: 2, w: 2, h: 1, visible: true },
  { widgetId: "kpi-summary", x: 0, y: 3, w: 2, h: 1, visible: true },
  { widgetId: "notifications", x: 2, y: 3, w: 1, h: 1, visible: true },
  { widgetId: "document-recent", x: 3, y: 3, w: 1, h: 1, visible: true },
];

// GET /api/v1/users/me/dashboard-layout -- Get personal layout (or org default)
export async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  // 1. Try personal layout
  const personalLayouts = await db
    .select()
    .from(userDashboardLayout)
    .where(
      and(
        eq(userDashboardLayout.orgId, ctx.orgId),
        eq(userDashboardLayout.userId, ctx.userId),
      ),
    )
    .limit(1);

  if (personalLayouts[0]) {
    return Response.json({
      data: {
        ...personalLayouts[0],
        layoutJson: personalLayouts[0].layoutJson,
        isDefault: false,
        isSystem: false,
      },
    });
  }

  // 2. Fall back to org default
  const orgDefaults = await db
    .select()
    .from(userDashboardLayout)
    .where(
      and(
        eq(userDashboardLayout.orgId, ctx.orgId),
        isNull(userDashboardLayout.userId),
        eq(userDashboardLayout.isDefault, true),
      ),
    )
    .limit(1);

  if (orgDefaults[0]) {
    return Response.json({
      data: {
        ...orgDefaults[0],
        layoutJson: orgDefaults[0].layoutJson,
        isDefault: true,
        isSystem: false,
      },
    });
  }

  // 3. Fall back to system default
  return Response.json({
    data: {
      layoutJson: SYSTEM_DEFAULT_LAYOUT,
      isDefault: true,
      isSystem: true,
    },
  });
}

// PUT /api/v1/users/me/dashboard-layout -- Save personal layout
export async function PUT(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const rawBody = await req.json();
  const result = updateDashboardLayoutSchema.safeParse(rawBody);
  if (!result.success) {
    return Response.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 422 },
    );
  }

  const body = result.data;

  const saved = await withAuditContext(ctx, async (tx) => {
    const existing = await tx
      .select()
      .from(userDashboardLayout)
      .where(
        and(
          eq(userDashboardLayout.orgId, ctx.orgId),
          eq(userDashboardLayout.userId, ctx.userId),
        ),
      )
      .limit(1);

    if (existing[0]) {
      const [updated] = await tx
        .update(userDashboardLayout)
        .set({ layoutJson: body.layoutJson, updatedAt: new Date() })
        .where(eq(userDashboardLayout.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await tx
      .insert(userDashboardLayout)
      .values({
        orgId: ctx.orgId,
        userId: ctx.userId,
        layoutJson: body.layoutJson,
        isDefault: false,
      })
      .returning();
    return created;
  });

  return Response.json({ data: saved });
}
