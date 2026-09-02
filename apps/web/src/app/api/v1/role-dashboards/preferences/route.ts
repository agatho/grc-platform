import { db, roleDashboardWidgetPreference } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  upsertWidgetPreferenceSchema,
  bulkUpsertWidgetPreferencesSchema,
} from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/role-dashboards/preferences?dashboardConfigId=...
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const dashboardConfigId = url.searchParams.get("dashboardConfigId");
  const conditions = [
    eq(roleDashboardWidgetPreference.orgId, ctx.orgId),
    eq(roleDashboardWidgetPreference.userId, ctx.userId),
  ];
  if (dashboardConfigId)
    conditions.push(
      eq(roleDashboardWidgetPreference.dashboardConfigId, dashboardConfigId),
    );

  const rows = await db
    .select()
    .from(roleDashboardWidgetPreference)
    .where(and(...conditions));
  return Response.json({ data: rows });
});
// PUT /api/v1/role-dashboards/preferences — Upsert single preference
export const PUT = withErrorHandler(async function PUT(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const body = upsertWidgetPreferenceSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [existing] = await tx
      .select({ id: roleDashboardWidgetPreference.id })
      .from(roleDashboardWidgetPreference)
      .where(
        and(
          eq(roleDashboardWidgetPreference.userId, ctx.userId),
          eq(
            roleDashboardWidgetPreference.dashboardConfigId,
            body.dashboardConfigId,
          ),
          eq(roleDashboardWidgetPreference.widgetKey, body.widgetKey),
        ),
      );

    if (existing) {
      const [updated] = await tx
        .update(roleDashboardWidgetPreference)
        .set({
          isVisible: body.isVisible,
          positionOverride: body.positionOverride,
          configOverride: body.configOverride,
          updatedAt: new Date(),
        })
        .where(eq(roleDashboardWidgetPreference.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await tx
      .insert(roleDashboardWidgetPreference)
      .values({
        orgId: ctx.orgId,
        userId: ctx.userId,
        ...body,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result });
});
// POST /api/v1/role-dashboards/preferences — Bulk upsert
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const body = bulkUpsertWidgetPreferencesSchema.parse(await req.json());

  const results = await withAuditContext(ctx, async (tx) => {
    const upserted = [];
    for (const pref of body.preferences) {
      const [existing] = await tx
        .select({ id: roleDashboardWidgetPreference.id })
        .from(roleDashboardWidgetPreference)
        .where(
          and(
            eq(roleDashboardWidgetPreference.userId, ctx.userId),
            eq(
              roleDashboardWidgetPreference.dashboardConfigId,
              body.dashboardConfigId,
            ),
            eq(roleDashboardWidgetPreference.widgetKey, pref.widgetKey),
          ),
        );

      if (existing) {
        const [updated] = await tx
          .update(roleDashboardWidgetPreference)
          .set({
            isVisible: pref.isVisible,
            positionOverride: pref.positionOverride,
            configOverride: pref.configOverride,
            updatedAt: new Date(),
          })
          .where(eq(roleDashboardWidgetPreference.id, existing.id))
          .returning();
        upserted.push(updated);
      } else {
        const [created] = await tx
          .insert(roleDashboardWidgetPreference)
          .values({
            orgId: ctx.orgId,
            userId: ctx.userId,
            dashboardConfigId: body.dashboardConfigId,
            ...pref,
          })
          .returning();
        upserted.push(created);
      }
    }
    return upserted;
  });

  return Response.json({ data: results });
});
