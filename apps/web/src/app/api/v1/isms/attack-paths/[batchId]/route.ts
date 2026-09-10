import { db, attackPathResult } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/isms/attack-paths/:batchId — Get computed paths by batch
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { batchId } = await params;

  const rows = await db
    .select()
    .from(attackPathResult)
    .where(
      and(
        eq(attackPathResult.batchId, batchId),
        eq(attackPathResult.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(attackPathResult.riskScore));

  if (rows.length === 0) {
    return Response.json(
      { error: "No paths found for this batch" },
      { status: 404 },
    );
  }

  return Response.json({
    data: rows,
    meta: {
      batchId,
      pathCount: rows.length,
      computedAt: rows[0].computedAt,
    },
  });
});
