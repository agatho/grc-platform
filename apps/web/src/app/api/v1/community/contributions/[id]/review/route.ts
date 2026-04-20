import { db, communityContribution } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { reviewContributionSchema } from "@grc/shared";

// POST /api/v1/community/contributions/:id/review
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = reviewContributionSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(communityContribution)
      .set({
        status: body.status,
        reviewNotes: body.reviewNotes,
        reviewedBy: ctx.userId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(communityContribution.id, id),
          eq(communityContribution.orgId, ctx.orgId),
        ),
      )
      .returning();
    return updated;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}
