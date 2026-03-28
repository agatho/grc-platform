import { db, architectureChangeRequest } from "@grc/db";
import { acrDecisionSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/eam/change-requests/:id/decide — Approve/reject (board chair)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = acrDecisionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const [acr] = await db
    .select()
    .from(architectureChangeRequest)
    .where(and(eq(architectureChangeRequest.id, id), eq(architectureChangeRequest.orgId, ctx.orgId)));

  if (!acr) {
    return Response.json({ error: "Change request not found" }, { status: 404 });
  }

  if (!["submitted", "under_review"].includes(acr.status)) {
    return Response.json({ error: `Cannot decide from status '${acr.status}'` }, { status: 409 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(architectureChangeRequest)
      .set({
        status: body.data.status,
        decisionRationale: body.data.rationale,
        conditions: body.data.conditions,
        reviewedBy: ctx.userId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(architectureChangeRequest.id, id))
      .returning();
    return updated;
  });

  return Response.json({ data: result });
}
