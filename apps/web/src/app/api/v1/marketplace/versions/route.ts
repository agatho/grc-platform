import { db, marketplaceVersion } from "@grc/db";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createMarketplaceVersionSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/marketplace/versions?listingId=...
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const listingId = url.searchParams.get("listingId");
  if (!listingId)
    return Response.json({ error: "listingId is required" }, { status: 400 });

  const rows = await db
    .select()
    .from(marketplaceVersion)
    .where(
      and(
        eq(marketplaceVersion.listingId, listingId),
        eq(marketplaceVersion.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(marketplaceVersion.createdAt));

  return Response.json({ data: rows });
});
// POST /api/v1/marketplace/versions
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = createMarketplaceVersionSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(marketplaceVersion)
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
