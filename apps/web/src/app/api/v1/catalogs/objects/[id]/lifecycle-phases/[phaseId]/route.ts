import { db, catalogLifecyclePhase } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

const updatePhaseSchema = z.object({
  phaseName: z.string().min(1).max(100).optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// PUT /api/v1/catalogs/objects/[id]/lifecycle-phases/[phaseId] — Update phase
export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; phaseId: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
  );
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
});
// DELETE /api/v1/catalogs/objects/[id]/lifecycle-phases/[phaseId] — Delete phase
export const DELETE = withErrorHandler(async function DELETE(
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
});
