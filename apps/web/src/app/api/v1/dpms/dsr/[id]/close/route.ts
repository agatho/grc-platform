import { db, dsr, dsrActivity } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/dpms/dsr/:id/close — Close DSR
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

  if (existing.status !== "response_sent" && existing.status !== "rejected") {
    return Response.json(
      { error: "DSR must be in response_sent or rejected status to close" },
      { status: 422 },
    );
  }

  const now = new Date();

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(dsr)
      .set({
        status: "closed",
        closedAt: now,
        updatedAt: now,
      })
      .where(eq(dsr.id, id))
      .returning();

    await tx.insert(dsrActivity).values({
      orgId: ctx.orgId,
      dsrId: id,
      activityType: "note",
      details: "Data subject request closed",
      createdBy: ctx.userId,
    });

    return row;
  });

  return Response.json({ data: updated });
}
