import { db, regionTenantConfig } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { upsertRegionTenantConfigSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/data-sovereignty/tenant-config
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const [row] = await db
    .select()
    .from(regionTenantConfig)
    .where(eq(regionTenantConfig.orgId, ctx.orgId));
  return Response.json({ data: row ?? null });
});
// PUT /api/v1/data-sovereignty/tenant-config — Upsert
export const PUT = withErrorHandler(async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = upsertRegionTenantConfigSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [existing] = await tx
      .select({ id: regionTenantConfig.id })
      .from(regionTenantConfig)
      .where(eq(regionTenantConfig.orgId, ctx.orgId));
    if (existing) {
      const [updated] = await tx
        .update(regionTenantConfig)
        .set({
          ...body,
          approvedBy: ctx.userId,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(regionTenantConfig.orgId, ctx.orgId))
        .returning();
      return updated;
    }
    const [created] = await tx
      .insert(regionTenantConfig)
      .values({
        orgId: ctx.orgId,
        ...body,
        approvedBy: ctx.userId,
        approvedAt: new Date(),
      })
      .returning();
    return created;
  });

  return Response.json({ data: result });
});
