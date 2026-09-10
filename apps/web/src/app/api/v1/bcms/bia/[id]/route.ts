import { db, biaAssessment } from "@grc/db";
import { updateBiaAssessmentSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/bcms/bia/[id]
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [row] = await db
    .select()
    .from(biaAssessment)
    .where(and(eq(biaAssessment.id, id), eq(biaAssessment.orgId, ctx.orgId)));

  if (!row) {
    return Response.json(
      { error: "BIA assessment not found" },
      { status: 404 },
    );
  }

  return Response.json({ data: row });
});
// PUT /api/v1/bcms/bia/[id]
export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // #WAVE6-BIA-01: status changes used to be silently dropped — Zod
  // stripped the field, the UPDATE only touched updated_at, and the
  // audit log made it look like the transition succeeded. Reject
  // explicitly with the canonical state-machine endpoint as a hint.
  //
  // #WAVE14D-P1-04: hint now mentions /start as well — Wave-14 QA hit
  // a dead end because the old hint pointed only at /finalize, which
  // handles in_progress→review and not draft→in_progress.
  const rawBody = (await req.json()) as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(rawBody, "status")) {
    return Response.json(
      {
        error:
          "BIA status changes must go through the state-machine endpoint, not this generic update path.",
        hint: `Use POST /api/v1/bcms/bia/${id}/start for draft→in_progress, POST /api/v1/bcms/bia/${id}/finalize for in_progress→review, or GET /api/v1/bcms/bia/${id}/transitions for the full discovery payload.`,
      },
      { status: 422 },
    );
  }

  const body = updateBiaAssessmentSchema.safeParse(rawBody);
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(biaAssessment)
      .set({ ...body.data, updatedAt: new Date() })
      .where(and(eq(biaAssessment.id, id), eq(biaAssessment.orgId, ctx.orgId)))
      .returning();
    return row;
  });

  if (!updated) {
    return Response.json(
      { error: "BIA assessment not found" },
      { status: 404 },
    );
  }

  return Response.json({ data: updated });
});
