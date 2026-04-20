import { db, attackPathResult } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/isms/attack-paths/:batchId/recommendations — Blocking control recommendations
export async function GET(
  req: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { batchId } = await params;

  const paths = await db
    .select()
    .from(attackPathResult)
    .where(
      and(
        eq(attackPathResult.batchId, batchId),
        eq(attackPathResult.orgId, ctx.orgId),
      ),
    );

  if (paths.length === 0) {
    return Response.json(
      { error: "No paths found for this batch" },
      { status: 404 },
    );
  }

  // Aggregate blocking controls across all paths
  const controlImpact = new Map<
    string,
    { controlId: string; controlName: string; eliminatedPaths: number }
  >();

  for (const path of paths) {
    const blockingControls = (path.blockingControlsJson ?? []) as Array<{
      controlId: string;
      controlName: string;
      wouldEliminatePaths: number;
    }>;

    for (const ctrl of blockingControls) {
      const existing = controlImpact.get(ctrl.controlId);
      if (existing) {
        existing.eliminatedPaths += ctrl.wouldEliminatePaths;
      } else {
        controlImpact.set(ctrl.controlId, {
          controlId: ctrl.controlId,
          controlName: ctrl.controlName,
          eliminatedPaths: ctrl.wouldEliminatePaths,
        });
      }
    }
  }

  const recommendations = Array.from(controlImpact.values())
    .sort((a, b) => b.eliminatedPaths - a.eliminatedPaths)
    .slice(0, 10);

  return Response.json({
    data: recommendations,
    meta: { batchId, totalPaths: paths.length },
  });
}
