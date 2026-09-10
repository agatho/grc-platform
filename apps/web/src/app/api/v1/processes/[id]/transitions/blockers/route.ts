// BPM Overhaul Phase 3: Discovery — what gates block the next transition?

import { withAuth, withReadContext } from "@/lib/api";
import { requireModule } from "@grc/auth";
import {
  evaluateTransitionGates,
  type ProcessStatus,
} from "@/lib/process-gates";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("bpm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const url = new URL(req.url);
  const target = url.searchParams.get("target") as ProcessStatus | null;
  if (!target) {
    return Response.json(
      {
        error:
          "Query parameter `target` is required (in_review|approved|published)",
      },
      { status: 400 },
    );
  }

  const blockers = await withReadContext(ctx, async (tx) =>
    evaluateTransitionGates({ tx, processId: id, orgId: ctx.orgId, target }),
  );

  return Response.json({
    data: {
      processId: id,
      targetStatus: target,
      blockers,
      canTransition:
        blockers.filter((b) => b.severity === "error").length === 0,
    },
  });
});
