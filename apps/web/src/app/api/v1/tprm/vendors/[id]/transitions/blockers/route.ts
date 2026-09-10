// TPRM Overhaul: discovery — what blocks the next vendor transition?

import { withAuth, withReadContext } from "@/lib/api";
import { requireModule } from "@grc/auth";
import { evaluateVendorGates, type VendorStatus } from "@/lib/vendor-gates";
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
  const m = await requireModule("tprm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const url = new URL(req.url);
  const target = url.searchParams.get("target") as VendorStatus | null;
  if (!target) {
    return Response.json(
      { error: "target query param required" },
      { status: 400 },
    );
  }

  const blockers = await withReadContext(ctx, async (tx) =>
    evaluateVendorGates({ tx, vendorId: id, orgId: ctx.orgId, target }),
  );

  return Response.json({
    data: {
      vendorId: id,
      targetStatus: target,
      blockers,
      canTransition:
        blockers.filter((b) => b.severity === "error").length === 0,
    },
  });
});
