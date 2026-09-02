import { db, portalBranding } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { upsertPortalBrandingSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/portals/branding?portalConfigId=...
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const portalConfigId = url.searchParams.get("portalConfigId");
  if (!portalConfigId)
    return Response.json({ error: "portalConfigId required" }, { status: 400 });

  const [row] = await db
    .select()
    .from(portalBranding)
    .where(
      and(
        eq(portalBranding.portalConfigId, portalConfigId),
        eq(portalBranding.orgId, ctx.orgId),
      ),
    );

  return Response.json({ data: row ?? null });
});
// PUT /api/v1/portals/branding — upsert
export const PUT = withErrorHandler(async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = upsertPortalBrandingSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [existing] = await tx
      .select()
      .from(portalBranding)
      .where(
        and(
          eq(portalBranding.portalConfigId, body.portalConfigId),
          eq(portalBranding.orgId, ctx.orgId),
        ),
      );

    if (existing) {
      const [updated] = await tx
        .update(portalBranding)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(portalBranding.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await tx
        .insert(portalBranding)
        .values({ orgId: ctx.orgId, ...body })
        .returning();
      return created;
    }
  });

  return Response.json({ data: result });
});
