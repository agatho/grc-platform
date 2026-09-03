import { db, communityEditionConfig } from "@grc/db";
import { eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { upsertCommunityEditionConfigSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/community/edition-config
export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const [row] = await db
    .select()
    .from(communityEditionConfig)
    .where(eq(communityEditionConfig.orgId, ctx.orgId));

  return Response.json({ data: row ?? null });
});
// PUT /api/v1/community/edition-config — upsert
export const PUT = withErrorHandler(async function PUT(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = upsertCommunityEditionConfigSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [existing] = await tx
      .select()
      .from(communityEditionConfig)
      .where(eq(communityEditionConfig.orgId, ctx.orgId));

    if (existing) {
      const [updated] = await tx
        .update(communityEditionConfig)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(communityEditionConfig.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await tx
        .insert(communityEditionConfig)
        .values({ orgId: ctx.orgId, ...body })
        .returning();
      return created;
    }
  });

  return Response.json({ data: result });
});
