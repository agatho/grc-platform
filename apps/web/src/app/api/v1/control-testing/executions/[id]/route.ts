import { db, controlTestExecution } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/control-testing/executions/:id
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "control_owner",
    "auditor",
    "risk_manager",
  );
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const [execution] = await db
    .select()
    .from(controlTestExecution)
    .where(
      and(
        eq(controlTestExecution.id, id),
        eq(controlTestExecution.orgId, ctx.orgId),
      ),
    );

  if (!execution) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: execution });
});
