import { db, marketplaceReview } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { respondToReviewSchema } from "@grc/shared";

// POST /api/v1/marketplace/reviews/:id/respond
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = respondToReviewSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(marketplaceReview)
      .set({
        publisherResponse: body.publisherResponse,
        respondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(marketplaceReview.id, id),
          eq(marketplaceReview.orgId, ctx.orgId),
        ),
      )
      .returning();
    return updated;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}
