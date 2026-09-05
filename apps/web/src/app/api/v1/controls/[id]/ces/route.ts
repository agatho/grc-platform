import { db, controlEffectivenessScore, control } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/controls/:id/ces — Get CES for a single control
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("ics", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;

  // Verify control belongs to org
  const [ctrl] = await db
    .select({ id: control.id })
    .from(control)
    .where(and(eq(control.id, id), eq(control.orgId, ctx.orgId)))
    .limit(1);

  if (!ctrl) {
    return Response.json({ error: "Control not found" }, { status: 404 });
  }

  const [ces] = await db
    .select()
    .from(controlEffectivenessScore)
    .where(
      and(
        eq(controlEffectivenessScore.controlId, id),
        eq(controlEffectivenessScore.orgId, ctx.orgId),
      ),
    )
    .limit(1);

  if (!ces) {
    return Response.json({
      data: null,
      message: "CES not yet computed for this control",
    });
  }

  return Response.json({ data: ces });
});
