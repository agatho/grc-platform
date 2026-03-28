import { db, evidenceReviewGap } from "@grc/db";
import { batchAcknowledgeGapsSchema } from "@grc/shared";
import { eq, and, inArray } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/evidence-review/gaps/batch — Batch update gaps
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "control_owner", "auditor");
  if (ctx instanceof Response) return ctx;

  const body = batchAcknowledgeGapsSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const updated = await tx.update(evidenceReviewGap)
      .set({
        status: body.data.status,
        acknowledgedBy: ctx.userId,
        acknowledgedAt: new Date(),
      })
      .where(and(
        inArray(evidenceReviewGap.id, body.data.gapIds),
        eq(evidenceReviewGap.orgId, ctx.orgId),
      ))
      .returning();
    return updated;
  });

  return Response.json({ data: { updated: result.length } });
}
