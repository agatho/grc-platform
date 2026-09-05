import { agentRecommendation } from "@grc/db";
import { updateRecommendationSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// PUT /api/v1/agents/recommendations/:id — Accept/dismiss recommendation
export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const body = updateRecommendationSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(agentRecommendation)
      .set({
        status: body.data.status,
        dismissReason: body.data.dismissReason,
        acceptedBy: body.data.status === "accepted" ? ctx.userId : undefined,
        acceptedAt: body.data.status === "accepted" ? new Date() : undefined,
      })
      .where(
        and(
          eq(agentRecommendation.id, id),
          eq(agentRecommendation.orgId, ctx.orgId),
        ),
      )
      .returning();
    return updated;
  });

  if (!result) {
    return Response.json(
      { error: "Recommendation not found" },
      { status: 404 },
    );
  }

  return Response.json({ data: result });
});
