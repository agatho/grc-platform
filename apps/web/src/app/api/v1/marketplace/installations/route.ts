import { db, marketplaceInstallation, marketplaceListing } from "@grc/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { installListingSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/marketplace/installations
export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const rows = await db
    .select()
    .from(marketplaceInstallation)
    .where(
      and(
        eq(marketplaceInstallation.orgId, ctx.orgId),
        eq(marketplaceInstallation.status, "active"),
      ),
    )
    .orderBy(desc(marketplaceInstallation.installedAt));

  return Response.json({ data: rows });
});
// POST /api/v1/marketplace/installations
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = installListingSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(marketplaceInstallation)
      .values({
        orgId: ctx.orgId,
        installedBy: ctx.userId,
        ...body,
      })
      .returning();

    // Increment install_count
    await tx
      .update(marketplaceListing)
      .set({
        installCount: sql`${marketplaceListing.installCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceListing.id, body.listingId));

    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
