import { db, evidenceReviewGap } from "@grc/db";
import { updateEvidenceReviewGapSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// PATCH /api/v1/evidence-review/gaps/:id — Update gap status
export const PATCH = withErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "control_owner", "auditor");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("ics", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const body = updateEvidenceReviewGapSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(evidenceReviewGap)
      .set({
        status: body.data.status,
        acknowledgedBy: ctx.userId,
        acknowledgedAt: new Date(),
      })
      .where(
        and(
          eq(evidenceReviewGap.id, id),
          eq(evidenceReviewGap.orgId, ctx.orgId),
        ),
      )
      .returning();
    return updated;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
});
