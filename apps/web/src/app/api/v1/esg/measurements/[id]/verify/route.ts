import { db, esgMeasurement } from "@grc/db";
import { verifyMeasurementSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// PUT /api/v1/esg/measurements/[id]/verify — Verify a measurement
export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "esg_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = verifyMeasurementSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [existing] = await db
    .select()
    .from(esgMeasurement)
    .where(and(eq(esgMeasurement.id, id), eq(esgMeasurement.orgId, ctx.orgId)));

  if (!existing) {
    return Response.json({ error: "Measurement not found" }, { status: 404 });
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(esgMeasurement)
      .set({
        verifiedBy: body.data.verified ? ctx.userId : null,
        verifiedAt: body.data.verified ? new Date() : null,
        notes: body.data.notes ?? existing.notes,
      })
      .where(eq(esgMeasurement.id, id))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
});
