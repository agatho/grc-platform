import { db, dmnDecision } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNotNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/processes/:id/dmn-links — DMN decisions linked to process steps
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: processId } = await params;

  // Find DMN decisions linked to steps of this process
  const decisions = await db
    .select()
    .from(dmnDecision)
    .where(
      and(
        eq(dmnDecision.orgId, ctx.orgId),
        isNotNull(dmnDecision.linkedProcessStepId),
      ),
    );

  return Response.json({ data: decisions });
});
