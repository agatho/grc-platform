import { db, asset, workItem, workItemType } from "@grc/db";
import { eq, and, isNull, count, desc, inArray, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import type { SQL } from "drizzle-orm";
import type { WorkItemStatus } from "@grc/shared";

// GET /api/v1/assets/:id/work-items — Work items linked to this asset
// For Sprint 1.4: uses grc_perspective array containing the asset ID as link mechanism.
// Future sprints will use dedicated join tables.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Verify asset exists in this org
  const [assetRow] = await db
    .select({ id: asset.id })
    .from(asset)
    .where(
      and(
        eq(asset.id, id),
        eq(asset.orgId, ctx.orgId),
        isNull(asset.deletedAt),
      ),
    );

  if (!assetRow) {
    return Response.json({ error: "Asset not found" }, { status: 404 });
  }

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(workItem.orgId, ctx.orgId),
    isNull(workItem.deletedAt),
    // Link: work items that reference this asset via grc_perspective
    sql`${workItem.grcPerspective} @> ARRAY[${id}]::text[]`,
  ];

  // Filter by type_key
  const typeKey = searchParams.get("type_key");
  if (typeKey) {
    conditions.push(eq(workItem.typeKey, typeKey));
  }

  // Filter by status (multi-value)
  const statuses = searchParams.getAll("status");
  if (statuses.length > 0) {
    conditions.push(inArray(workItem.status, statuses as WorkItemStatus[]));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: workItem.id,
        orgId: workItem.orgId,
        typeKey: workItem.typeKey,
        elementId: workItem.elementId,
        name: workItem.name,
        status: workItem.status,
        responsibleId: workItem.responsibleId,
        dueDate: workItem.dueDate,
        createdAt: workItem.createdAt,
        updatedAt: workItem.updatedAt,
        displayNameDe: workItemType.displayNameDe,
        displayNameEn: workItemType.displayNameEn,
        icon: workItemType.icon,
        colorClass: workItemType.colorClass,
      })
      .from(workItem)
      .leftJoin(workItemType, eq(workItem.typeKey, workItemType.typeKey))
      .where(where)
      .orderBy(desc(workItem.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(workItem).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
