import { db, dsr, dsrActivity } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/dpms/dsr/:id/verify — Mark identity as verified
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
    .from(dsr)
    .where(and(eq(dsr.id, id), eq(dsr.orgId, ctx.orgId)));

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.status !== "received") {
    return Response.json(
      { error: "DSR must be in received status to verify" },
      { status: 422 },
    );
  }

  const now = new Date();

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(dsr)
      .set({
        status: "verified",
        verifiedAt: now,
        updatedAt: now,
      })
      .where(eq(dsr.id, id))
      .returning();

    await tx.insert(dsrActivity).values({
      orgId: ctx.orgId,
      dsrId: id,
      activityType: "identity_verification",
      details: "Identity verified",
      createdBy: ctx.userId,
    });

    return row;
  });

  return Response.json({ data: updated });
}
