import { db, dpia } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/dpms/dpia/:id/sign-off — DPO sign-off on a DPIA
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(dpia)
    .where(
      and(eq(dpia.id, id), eq(dpia.orgId, ctx.orgId), isNull(dpia.deletedAt)),
    );

  if (!existing) {
    return Response.json({ error: "DPIA not found" }, { status: 404 });
  }

  if (existing.status !== "pending_dpo_review") {
    return Response.json(
      { error: "DPIA must be in pending_dpo_review status for sign-off" },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(dpia)
      .set({
        status: "approved",
        residualRiskSignOffId: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(dpia.id, id))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}
