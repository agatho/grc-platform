import { db, asset } from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import type { SQL } from "drizzle-orm";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

interface AssetNode {
  id: string;
  name: string;
  assetTier: string;
  codeGroup: string | null;
  defaultConfidentiality: number | null;
  defaultIntegrity: number | null;
  defaultAvailability: number | null;
  protectionGoalClass: number | null;
  visibleInModules: string[];
  parentAssetId: string | null;
  children: AssetNode[];
}

// GET /api/v1/assets/hierarchy — Full asset tree nested by parent_asset_id
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const moduleKey = url.searchParams.get("module");

  const conditions: SQL[] = [
    eq(asset.orgId, ctx.orgId),
    isNull(asset.deletedAt),
  ];

  // Filter by visible_in_modules if the `module` query param is provided
  if (moduleKey) {
    conditions.push(
      sql`${asset.visibleInModules} @> ARRAY[${moduleKey}]::text[]`,
    );
  }

  const rows = await db
    .select({
      id: asset.id,
      name: asset.name,
      assetTier: asset.assetTier,
      codeGroup: asset.codeGroup,
      defaultConfidentiality: asset.defaultConfidentiality,
      defaultIntegrity: asset.defaultIntegrity,
      defaultAvailability: asset.defaultAvailability,
      protectionGoalClass: asset.protectionGoalClass,
      visibleInModules: asset.visibleInModules,
      parentAssetId: asset.parentAssetId,
    })
    .from(asset)
    .where(and(...conditions));

  // Build tree in JS from flat query result
  const nodeMap = new Map<string, AssetNode>();
  for (const row of rows) {
    nodeMap.set(row.id, {
      ...row,
      children: [],
    });
  }

  const roots: AssetNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentAssetId && nodeMap.has(node.parentAssetId)) {
      nodeMap.get(node.parentAssetId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return Response.json({ data: roots });
});
