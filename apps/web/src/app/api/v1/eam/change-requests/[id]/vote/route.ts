import { db, architectureChangeVote, architectureChangeRequest } from "@grc/db";
import { acrVoteSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/eam/change-requests/:id/vote — Cast vote
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = acrVoteSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Check ACR is under review
  const [acr] = await db
    .select()
    .from(architectureChangeRequest)
    .where(
      and(
        eq(architectureChangeRequest.id, id),
        eq(architectureChangeRequest.orgId, ctx.orgId),
      ),
    );

  if (!acr) {
    return Response.json(
      { error: "Change request not found" },
      { status: 404 },
    );
  }

  if (acr.status === "approved" || acr.status === "rejected") {
    return Response.json(
      { error: "Voting closed after decision" },
      { status: 409 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // Upsert: one vote per user per ACR
    const [existing] = await tx
      .select()
      .from(architectureChangeVote)
      .where(
        and(
          eq(architectureChangeVote.changeRequestId, id),
          eq(architectureChangeVote.userId, ctx.userId),
        ),
      );

    if (existing) {
      const [updated] = await tx
        .update(architectureChangeVote)
        .set({
          vote: body.data.vote,
          comment: body.data.comment,
          votedAt: new Date(),
        })
        .where(eq(architectureChangeVote.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await tx
      .insert(architectureChangeVote)
      .values({ changeRequestId: id, userId: ctx.userId, ...body.data })
      .returning();
    return created;
  });

  return Response.json({ data: result });
}
