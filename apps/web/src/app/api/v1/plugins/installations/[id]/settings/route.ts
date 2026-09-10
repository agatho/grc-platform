import { db, pluginSetting } from "@grc/db";
import { bulkUpdatePluginSettingsSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/plugins/installations/:id/settings
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const rows = await db
    .select({
      id: pluginSetting.id,
      key: pluginSetting.key,
      value: pluginSetting.value,
      isSecret: pluginSetting.isSecret,
      updatedAt: pluginSetting.updatedAt,
    })
    .from(pluginSetting)
    .where(
      and(
        eq(pluginSetting.installationId, id),
        eq(pluginSetting.orgId, ctx.orgId),
      ),
    );

  // Mask secret values
  const masked = rows.map((r) => ({
    ...r,
    value: r.isSecret ? "********" : r.value,
  }));

  return Response.json({ data: masked });
});
// PUT /api/v1/plugins/installations/:id/settings
export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const body = bulkUpdatePluginSettingsSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const results = [];
  for (const setting of body.data.settings) {
    const [upserted] = await db
      .insert(pluginSetting)
      .values({
        orgId: ctx.orgId,
        installationId: id,
        key: setting.key,
        value: setting.value as Record<string, unknown>,
        isSecret: setting.isSecret,
        updatedBy: ctx.userId,
      })
      .onConflictDoUpdate({
        target: [pluginSetting.installationId, pluginSetting.key],
        set: {
          value: setting.value as Record<string, unknown>,
          isSecret: setting.isSecret,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        },
      })
      .returning();
    results.push(upserted);
  }

  return Response.json({ data: results });
});
