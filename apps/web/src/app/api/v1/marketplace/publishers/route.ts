import { db, marketplacePublisher } from "@grc/db";
import { eq, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createMarketplacePublisherSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/marketplace/publishers
export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const rows = await db
    .select()
    .from(marketplacePublisher)
    .where(eq(marketplacePublisher.orgId, ctx.orgId))
    .orderBy(desc(marketplacePublisher.createdAt));

  return Response.json({ data: rows });
});
// POST /api/v1/marketplace/publishers
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = createMarketplacePublisherSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(marketplacePublisher)
      .values({
        orgId: ctx.orgId,
        ...body,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
