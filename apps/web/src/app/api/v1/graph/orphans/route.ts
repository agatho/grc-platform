import { withAuth } from "@/lib/api";
import { findOrphans } from "@grc/graph";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";
import { log } from "@/lib/logger";

// GET /api/v1/graph/orphans
// Returns unlinked entities: risks without controls, controls without tests, etc.
// Access: admin, risk_manager
export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  try {
    const orphans = await findOrphans(ctx.orgId);

    return Response.json(orphans, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (err) {
    log.error("[graph/orphans] request failed", { err });
    return Response.json(
      { error: "Failed to detect orphan entities" },
      { status: 500 },
    );
  }
});
