// GET /api/v1/asset-classification-overrides?status=pending_approval
//
// #WAVE21-MAR-P2-03: approver-inbox. Default status filter is
// `pending_approval` so the dashboard tile lights up only when there's
// something to act on. Pass `?status=all` to see the full history.

import { db, asset, assetClassificationOverride, user } from "@grc/db";
import { and, eq, inArray, desc, count } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

const VALID_STATUSES = [
  "active",
  "pending_approval",
  "approved",
  "rejected",
  "revoked",
] as const;
type OverrideStatus = (typeof VALID_STATUSES)[number];

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req, {
    allowedParams: ["status", "assetId", "createdBy"],
  });

  const statusParam = searchParams.get("status");
  const requestedStatuses: OverrideStatus[] | null = (() => {
    if (!statusParam) return ["pending_approval"];
    if (statusParam === "all") return null; // no filter
    const parsed = statusParam
      .split(",")
      .filter((s) =>
        (VALID_STATUSES as readonly string[]).includes(s),
      ) as OverrideStatus[];
    return parsed.length > 0 ? parsed : ["pending_approval"];
  })();

  const conditions = [eq(assetClassificationOverride.orgId, ctx.orgId)];
  if (requestedStatuses) {
    conditions.push(
      inArray(assetClassificationOverride.status, requestedStatuses),
    );
  }
  const assetIdParam = searchParams.get("assetId");
  if (assetIdParam) {
    conditions.push(eq(assetClassificationOverride.assetId, assetIdParam));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: assetClassificationOverride.id,
        assetId: assetClassificationOverride.assetId,
        assetName: asset.name,
        fieldName: assetClassificationOverride.fieldName,
        derivedValue: assetClassificationOverride.derivedValue,
        overrideValue: assetClassificationOverride.overrideValue,
        reason: assetClassificationOverride.reason,
        requestApproval: assetClassificationOverride.requestApproval,
        status: assetClassificationOverride.status,
        createdBy: assetClassificationOverride.createdBy,
        createdByName: user.name,
        createdAt: assetClassificationOverride.createdAt,
        approvedBy: assetClassificationOverride.approvedBy,
        approvedAt: assetClassificationOverride.approvedAt,
      })
      .from(assetClassificationOverride)
      .leftJoin(asset, eq(assetClassificationOverride.assetId, asset.id))
      .leftJoin(user, eq(assetClassificationOverride.createdBy, user.id))
      .where(where)
      .orderBy(desc(assetClassificationOverride.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(assetClassificationOverride)
      .where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
});
