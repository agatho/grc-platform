import { db, catalogLifecyclePhase } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const updatePhaseSchema = z.object({
  phaseName: z.string().min(1).max(100).optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// PUT /api/v1/catalogs/objects/[id]/lifecycle-phases/[phaseId] — Update phase
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner", "process_owner");
  if (ctx instanceof Response) return ctx;

  const { phaseId } = await params;

  const body = updatePhaseSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(catalogLifecyclePhase)
      .set(body.data)
      .where(
        and(
          eq(catalogLifecyclePhase.id, phaseId),
          eq(catalogLifecyclePhase.orgId, ctx.orgId),
        ),
      )
      .returning();
    return row;
  });

  if (!updated) {
    return Response.json({ error: "Phase not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}

// DELETE /api/v1/catalogs/objects/[id]/lifecycle-phases/[phaseId] — Delete phase
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { phaseId } = await params;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .delete(catalogLifecyclePhase)
      .where(
        and(
          eq(catalogLifecyclePhase.id, phaseId),
          eq(catalogLifecyclePhase.orgId, ctx.orgId),
        ),
      )
      .returning();
    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Phase not found" }, { status: 404 });
  }

  return Response.json({ data: { id: deleted.id, deleted: true } });
}
