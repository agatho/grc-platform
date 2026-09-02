import { db, eamHomepageLayout } from "@grc/db";
import { requireModule } from "@grc/auth";
import { updateHomepageLayoutSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

const DEFAULT_WIDGETS = [
  {
    widgetType: "donut_category",
    position: { x: 0, y: 0, w: 4, h: 3 },
    config: {},
  },
  {
    widgetType: "donut_lifecycle",
    position: { x: 4, y: 0, w: 4, h: 3 },
    config: {},
  },
  {
    widgetType: "health_score",
    position: { x: 8, y: 0, w: 4, h: 3 },
    config: {},
  },
  {
    widgetType: "recent_changes",
    position: { x: 0, y: 3, w: 6, h: 4 },
    config: {},
  },
  {
    widgetType: "capability_map",
    position: { x: 6, y: 3, w: 6, h: 4 },
    config: {},
  },
];

// GET /api/v1/eam/homepage — Current user's homepage layout
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const layout = await db
    .select()
    .from(eamHomepageLayout)
    .where(
      and(
        eq(eamHomepageLayout.userId, ctx.userId),
        eq(eamHomepageLayout.orgId, ctx.orgId),
      ),
    )
    .limit(1);

  if (layout.length) {
    return Response.json({ data: layout[0] });
  }

  // Return default layout
  return Response.json({ data: { widgetConfig: DEFAULT_WIDGETS } });
});
// PUT /api/v1/eam/homepage — Save homepage layout
export const PUT = withErrorHandler(async function PUT(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = updateHomepageLayoutSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });

  const existing = await db
    .select()
    .from(eamHomepageLayout)
    .where(
      and(
        eq(eamHomepageLayout.userId, ctx.userId),
        eq(eamHomepageLayout.orgId, ctx.orgId),
      ),
    )
    .limit(1);

  let result;
  if (existing.length) {
    result = await db
      .update(eamHomepageLayout)
      .set({ widgetConfig: parsed.data.widgetConfig, updatedAt: new Date() })
      .where(eq(eamHomepageLayout.id, existing[0].id))
      .returning();
  } else {
    result = await db
      .insert(eamHomepageLayout)
      .values({
        userId: ctx.userId,
        orgId: ctx.orgId,
        widgetConfig: parsed.data.widgetConfig,
      })
      .returning();
  }

  return Response.json({ data: result[0] });
});
