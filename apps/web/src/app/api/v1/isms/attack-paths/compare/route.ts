import { db, attackPathResult } from "@grc/db";
import { requireModule } from "@grc/auth";
import { attackPathCompareSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// POST /api/v1/isms/attack-paths/compare — Before/after comparison
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = attackPathCompareSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { beforeBatchId, afterBatchId } = parsed.data;

  const [beforePaths, afterPaths] = await Promise.all([
    db
      .select()
      .from(attackPathResult)
      .where(
        and(
          eq(attackPathResult.batchId, beforeBatchId),
          eq(attackPathResult.orgId, ctx.orgId),
        ),
      ),
    db
      .select()
      .from(attackPathResult)
      .where(
        and(
          eq(attackPathResult.batchId, afterBatchId),
          eq(attackPathResult.orgId, ctx.orgId),
        ),
      ),
  ]);

  // Compare: find eliminated, shortened, and new paths
  const beforeKeys = new Set(
    beforePaths.map((p) => `${p.entryAssetId}->${p.targetAssetId}`),
  );
  const afterKeys = new Set(
    afterPaths.map((p) => `${p.entryAssetId}->${p.targetAssetId}`),
  );

  const eliminated = beforePaths.filter(
    (p) => !afterKeys.has(`${p.entryAssetId}->${p.targetAssetId}`),
  ).length;

  const newPaths = afterPaths.filter(
    (p) => !beforeKeys.has(`${p.entryAssetId}->${p.targetAssetId}`),
  ).length;

  let shortened = 0;
  for (const beforePath of beforePaths) {
    const key = `${beforePath.entryAssetId}->${beforePath.targetAssetId}`;
    if (afterKeys.has(key)) {
      const afterPath = afterPaths.find(
        (p) => `${p.entryAssetId}->${p.targetAssetId}` === key,
      );
      if (afterPath && afterPath.hopCount < beforePath.hopCount) {
        shortened++;
      }
    }
  }

  return Response.json({
    data: {
      before: beforePaths,
      after: afterPaths,
      eliminated,
      shortened,
      newPaths,
    },
  });
}
