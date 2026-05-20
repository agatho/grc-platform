// Audit Overhaul Phase 1: discovery — what gates block the next transition?

import { withAuth, withReadContext } from "@/lib/api";
import { requireModule } from "@grc/auth";
import { evaluateAuditGates, type AuditStatus } from "@/lib/audit-gates";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("audit", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const url = new URL(req.url);
  const target = url.searchParams.get("target") as AuditStatus | null;
  if (!target) {
    return Response.json(
      { error: "Query parameter `target` is required" },
      { status: 400 },
    );
  }

  const blockers = await withReadContext(ctx, async (tx) =>
    evaluateAuditGates({ tx, auditId: id, orgId: ctx.orgId, target }),
  );

  return Response.json({
    data: {
      auditId: id,
      targetStatus: target,
      blockers,
      canTransition:
        blockers.filter((b) => b.severity === "error").length === 0,
    },
  });
}
