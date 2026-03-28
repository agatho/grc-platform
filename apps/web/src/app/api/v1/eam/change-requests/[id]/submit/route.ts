import { db, architectureChangeRequest } from "@grc/db";
import { ACR_STATUS_TRANSITIONS } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/eam/change-requests/:id/submit — Submit for review
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [acr] = await db
    .select()
    .from(architectureChangeRequest)
    .where(and(eq(architectureChangeRequest.id, id), eq(architectureChangeRequest.orgId, ctx.orgId)));

  if (!acr) {
    return Response.json({ error: "Change request not found" }, { status: 404 });
  }

  const validTransitions = ACR_STATUS_TRANSITIONS[acr.status] ?? [];
  if (!validTransitions.includes("submitted")) {
    return Response.json({ error: `Cannot submit from status '${acr.status}'` }, { status: 409 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(architectureChangeRequest)
      .set({
        status: "submitted",
        submittedBy: ctx.userId,
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(architectureChangeRequest.id, id))
      .returning();
    return updated;
  });

  return Response.json({ data: result });
}
