import { db, entityReference } from "@grc/db";
import { eq, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/references/stats — Reference counts per entity type
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  // Count references grouped by source_type and target_type
  const sourceStats = await db
    .select({
      entityType: entityReference.sourceType,
      count: sql<number>`count(*)::int`,
    })
    .from(entityReference)
    .where(eq(entityReference.orgId, ctx.orgId))
    .groupBy(entityReference.sourceType);

  const targetStats = await db
    .select({
      entityType: entityReference.targetType,
      count: sql<number>`count(*)::int`,
    })
    .from(entityReference)
    .where(eq(entityReference.orgId, ctx.orgId))
    .groupBy(entityReference.targetType);

  // Merge counts: an entity can appear as both source and target
  const merged: Record<string, { asSource: number; asTarget: number; total: number }> = {};

  for (const s of sourceStats) {
    if (!merged[s.entityType]) merged[s.entityType] = { asSource: 0, asTarget: 0, total: 0 };
    merged[s.entityType].asSource = s.count;
    merged[s.entityType].total += s.count;
  }

  for (const t of targetStats) {
    if (!merged[t.entityType]) merged[t.entityType] = { asSource: 0, asTarget: 0, total: 0 };
    merged[t.entityType].asTarget = t.count;
    merged[t.entityType].total += t.count;
  }

  const totalReferences = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(entityReference)
    .where(eq(entityReference.orgId, ctx.orgId));

  return Response.json({
    data: {
      byEntityType: merged,
      totalReferences: totalReferences[0]?.count ?? 0,
    },
  });
}
