// DPMS Overhaul: discovery — what gates block the next DPIA transition?

import { withAuth, withReadContext } from "@/lib/api";
import { requireModule } from "@grc/auth";
import { evaluateDpiaGates, type DpiaStatus } from "@/lib/dpia-gates";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("dpms", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const url = new URL(req.url);
  const target = url.searchParams.get("target") as DpiaStatus | null;
  if (!target) {
    return Response.json({ error: "target query param required" }, { status: 400 });
  }

  const blockers = await withReadContext(ctx, async (tx) =>
    evaluateDpiaGates({ tx, dpiaId: id, orgId: ctx.orgId, target }),
  );

  return Response.json({
    data: {
      dpiaId: id,
      targetStatus: target,
      blockers,
      canTransition: blockers.filter((b) => b.severity === "error").length === 0,
    },
  });
}
