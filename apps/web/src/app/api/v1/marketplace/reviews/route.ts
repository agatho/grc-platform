import { db, marketplaceReview, marketplaceListing } from "@grc/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createMarketplaceReviewSchema } from "@grc/shared";

// GET /api/v1/marketplace/reviews?listingId=...
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const listingId = url.searchParams.get("listingId");
  if (!listingId)
    return Response.json({ error: "listingId is required" }, { status: 400 });

  const rows = await db
    .select()
    .from(marketplaceReview)
    .where(
      and(
        eq(marketplaceReview.listingId, listingId),
        eq(marketplaceReview.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(marketplaceReview.createdAt));

  return Response.json({ data: rows });
}

// POST /api/v1/marketplace/reviews
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const body = createMarketplaceReviewSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(marketplaceReview)
      .values({
        orgId: ctx.orgId,
        userId: ctx.userId,
        ...body,
      })
      .returning();

    // Update listing avg_rating and review_count
    const [stats] = await tx
      .select({
        avgRating: sql<number>`round(avg(rating)::numeric, 2)`,
        reviewCount: sql<number>`count(*)::int`,
      })
      .from(marketplaceReview)
      .where(eq(marketplaceReview.listingId, body.listingId));

    await tx
      .update(marketplaceListing)
      .set({
        avgRating: String(stats.avgRating),
        reviewCount: stats.reviewCount,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceListing.id, body.listingId));

    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
