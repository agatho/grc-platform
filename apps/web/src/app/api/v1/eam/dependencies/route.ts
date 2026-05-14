// GET /api/v1/eam/dependencies — architecture-element dependency rollup.
//
// #WAVE14-CROSS-05: an EAM dashboard wants to know "where do my critical
// dependencies cluster" without traversing the whole graph in the
// browser. Sister endpoint to /eam/dependency-chain (which returns the
// raw graph for a given root). This one is a flat aggregate.
//
// Per source-element, count outgoing relationships and bucket them by
// criticality. Then top-level totals across the org. The shape is
// designed to drop directly into a "top-N most-depended-on systems"
// table and a stacked-bar by criticality.
//
// Note: criticality lives on the relationship row (not the element), so
// the same element can have a "critical" link to one peer and "normal"
// link to another. We aggregate per-relationship, not per-element pair.

import { db, architectureElement, architectureRelationship } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Per-source rollup. INNER JOIN architectureElement so we get human-
  // readable names for the top-N table, and so deleted elements (cascade
  // FK) drop out naturally.
  const perSource = await db
    .select({
      sourceId: architectureRelationship.sourceId,
      sourceName: architectureElement.name,
      sourceLayer: architectureElement.layer,
      total: sql<number>`count(*)::int`,
      critical: sql<number>`count(*) filter (where ${architectureRelationship.criticality} = 'critical')::int`,
      high: sql<number>`count(*) filter (where ${architectureRelationship.criticality} = 'high')::int`,
      normal: sql<number>`count(*) filter (where ${architectureRelationship.criticality} = 'normal')::int`,
    })
    .from(architectureRelationship)
    .innerJoin(
      architectureElement,
      eq(architectureRelationship.sourceId, architectureElement.id),
    )
    .where(eq(architectureRelationship.orgId, ctx.orgId))
    .groupBy(
      architectureRelationship.sourceId,
      architectureElement.name,
      architectureElement.layer,
    )
    .orderBy(sql`count(*) DESC`)
    .limit(50);

  // Org-wide totals — independent query so the top-N limit doesn't skew
  // the headline numbers.
  const [totals] = await db
    .select({
      totalRelationships: sql<number>`count(*)::int`,
      criticalCount: sql<number>`count(*) filter (where ${architectureRelationship.criticality} = 'critical')::int`,
      highCount: sql<number>`count(*) filter (where ${architectureRelationship.criticality} = 'high')::int`,
      normalCount: sql<number>`count(*) filter (where ${architectureRelationship.criticality} = 'normal')::int`,
      uniqueSources: sql<number>`count(distinct ${architectureRelationship.sourceId})::int`,
      uniqueTargets: sql<number>`count(distinct ${architectureRelationship.targetId})::int`,
    })
    .from(architectureRelationship)
    .where(eq(architectureRelationship.orgId, ctx.orgId));

  return Response.json({
    data: {
      summary: {
        totalRelationships: totals?.totalRelationships ?? 0,
        criticalCount: totals?.criticalCount ?? 0,
        highCount: totals?.highCount ?? 0,
        normalCount: totals?.normalCount ?? 0,
        uniqueSources: totals?.uniqueSources ?? 0,
        uniqueTargets: totals?.uniqueTargets ?? 0,
      },
      topDependents: perSource,
      asOf: new Date().toISOString(),
    },
  });
});
