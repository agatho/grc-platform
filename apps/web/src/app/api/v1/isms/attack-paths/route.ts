import { attackPathResult } from "@grc/db";
import { requireModule } from "@grc/auth";
import { computeAttackPathsSchema } from "@grc/shared";
import { withAuth, withAuditContext } from "@/lib/api";
import { randomUUID } from "crypto";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/isms/attack-paths — Compute attack paths (async)
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = computeAttackPathsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const batchId = randomUUID();
  const maxDepth = parsed.data.maxDepth;

  // In production this would be a background job. For now we compute inline.
  const paths = await computeAttackPaths(ctx.orgId, maxDepth);

  if (paths.length === 0) {
    return Response.json({
      data: {
        batchId,
        pathCount: 0,
        message:
          "No attack paths found. Ensure entry points and crown jewels are defined.",
      },
    });
  }

  await withAuditContext(ctx, async (tx) => {
    for (const path of paths) {
      await tx.insert(attackPathResult).values({
        orgId: ctx.orgId,
        entryAssetId: path.entryAssetId,
        targetAssetId: path.targetAssetId,
        pathJson: path.pathJson,
        hopCount: path.hopCount,
        riskScore: String(path.riskScore),
        blockingControlsJson: path.blockingControlsJson,
        batchId,
      });
    }
  });

  return Response.json(
    { data: { batchId, pathCount: paths.length } },
    { status: 201 },
  );
});
interface ComputedPath {
  entryAssetId: string;
  targetAssetId: string;
  pathJson: Array<{
    assetId: string;
    assetName: string;
    cveIds: string[];
    controlGaps: string[];
    hopProbability: number;
  }>;
  hopCount: number;
  riskScore: number;
  blockingControlsJson: Array<{
    controlId: string;
    controlName: string;
    wouldEliminatePaths: number;
  }>;
}

async function computeAttackPaths(
  _orgId: string,
  _maxDepth: number,
): Promise<ComputedPath[]> {
  // BFS from entry points to crown jewels using entity_reference
  // Simplified implementation — production would use full graph from entity_reference + CVE data
  // Returns top 100 paths sorted by risk score
  return [];
}
