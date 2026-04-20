import { db, bcp } from "@grc/db";
import { bcpStatusTransitions, bcpStatusTransitionSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PUT /api/v1/bcms/plans/[id]/status — Status transition
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = bcpStatusTransitionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Fetch current BCP
  const [current] = await db
    .select()
    .from(bcp)
    .where(
      and(eq(bcp.id, id), eq(bcp.orgId, ctx.orgId), isNull(bcp.deletedAt)),
    );

  if (!current) {
    return Response.json({ error: "BCP not found" }, { status: 404 });
  }

  // Check valid transition
  const allowedNext = bcpStatusTransitions[current.status] ?? [];
  if (!allowedNext.includes(body.data.status)) {
    return Response.json(
      {
        error: `Invalid status transition from '${current.status}' to '${body.data.status}'. Allowed: ${allowedNext.join(", ")}`,
      },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const setData: Record<string, unknown> = {
      status: body.data.status,
      updatedAt: new Date(),
    };

    if (body.data.status === "approved") {
      setData.approvedBy = ctx.userId;
      setData.approvedAt = new Date();
    }

    if (body.data.status === "published") {
      setData.publishedAt = new Date();
    }

    const [row] = await tx
      .update(bcp)
      .set(setData)
      .where(eq(bcp.id, id))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}
