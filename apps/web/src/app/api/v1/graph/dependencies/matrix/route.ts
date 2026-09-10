import { withAuth } from "@/lib/api";
import { getDependencyMatrix } from "@grc/graph";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";
import { log } from "@/lib/logger";

// GET /api/v1/graph/dependencies/matrix
// Returns dependency matrix (entity type x entity type counts).
// Access: admin, risk_manager
export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  try {
    const matrix = await getDependencyMatrix(ctx.orgId);

    return Response.json(
      { data: matrix },
      {
        headers: { "Cache-Control": "private, max-age=60" },
      },
    );
  } catch (err) {
    log.error("[graph/matrix] request failed", { err });
    return Response.json(
      { error: "Failed to retrieve dependency matrix" },
      { status: 500 },
    );
  }
});
