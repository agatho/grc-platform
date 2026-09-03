import { portalQuestionnaireResponse } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { reviewQuestionnaireSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/portals/questionnaires/:id/review
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = reviewQuestionnaireSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(portalQuestionnaireResponse)
      .set({
        status: body.status,
        reviewedBy: ctx.userId,
        reviewedAt: new Date(),
        reviewNotes: body.reviewNotes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(portalQuestionnaireResponse.id, id),
          eq(portalQuestionnaireResponse.orgId, ctx.orgId),
        ),
      )
      .returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
});
