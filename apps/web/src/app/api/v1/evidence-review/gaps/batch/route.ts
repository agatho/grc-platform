import { evidenceReviewGap } from "@grc/db";
import { batchAcknowledgeGapsSchema } from "@grc/shared";
import { eq, and, inArray } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/evidence-review/gaps/batch — Batch update gaps
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "control_owner", "auditor");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("ics", ctx.orgId, req.method);
  if (m) return m;

  const body = batchAcknowledgeGapsSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const updated = await tx
      .update(evidenceReviewGap)
      .set({
        status: body.data.status,
        acknowledgedBy: ctx.userId,
        acknowledgedAt: new Date(),
      })
      .where(
        and(
          inArray(evidenceReviewGap.id, body.data.gapIds),
          eq(evidenceReviewGap.orgId, ctx.orgId),
        ),
      )
      .returning();
    return updated;
  });

  return Response.json({ data: { updated: result.length } });
});
