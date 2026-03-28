import { db, architectureElement, architectureRelationship } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, or, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/elements/:id/context-diagram — Application/Capability context diagram data
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const elementId = url.searchParams.get("elementId");
  if (!elementId) return Response.json({ error: "elementId required" }, { status: 400 });

  // Get central element
  const element = await db.select().from(architectureElement)
    .where(and(eq(architectureElement.id, elementId), eq(architectureElement.orgId, ctx.orgId)))
    .limit(1);
  if (!element.length) return Response.json({ error: "Element not found" }, { status: 404 });

  // Get all relationships involving this element
  const relationships = await db.select()
    .from(architectureRelationship)
    .where(and(
      eq(architectureRelationship.orgId, ctx.orgId),
      or(
        eq(architectureRelationship.sourceId, elementId),
        eq(architectureRelationship.targetId, elementId),
      ),
    ));

  // Get related element IDs
  const relatedIds = new Set<string>();
  for (const rel of relationships) {
    if (rel.sourceId !== elementId) relatedIds.add(rel.sourceId);
    if (rel.targetId !== elementId) relatedIds.add(rel.targetId);
  }

  // Fetch related elements
  const relatedElements = relatedIds.size > 0
    ? await db.select().from(architectureElement)
        .where(and(
          eq(architectureElement.orgId, ctx.orgId),
          sql`${architectureElement.id} = ANY(${sql.raw(`ARRAY[${[...relatedIds].map((id) => `'${id}'`).join(",")}]::uuid[]`)})`,
        ))
    : [];

  // Classify into sectors
  const sectorMap: Record<string, typeof relatedElements> = {
    business: [], organization: [], integration: [],
    data: [], technology: [], risk: [], provider: [],
  };

  for (const el of relatedElements) {
    if (el.layer === "business") sectorMap.business.push(el);
    else if (el.layer === "technology") sectorMap.technology.push(el);
    else if (el.type === "app_interface") sectorMap.integration.push(el);
    else if (el.type === "data_object") sectorMap.data.push(el);
    else if (el.type === "provider") sectorMap.provider.push(el);
    else sectorMap.integration.push(el);
  }

  // Also query entity_reference for risk links
  const riskRefs = await db.execute(sql`
    SELECT er.source_id, er.source_type, er.target_id, er.target_type
    FROM entity_reference er
    WHERE (er.target_id = ${elementId} AND er.source_type = 'risk')
       OR (er.source_id = ${elementId} AND er.target_type = 'risk')
  `);

  return Response.json({
    data: {
      centralNode: {
        id: element[0].id,
        name: element[0].name,
        type: element[0].type,
        layer: element[0].layer,
      },
      sectors: sectorMap,
      edges: relationships.map((r) => ({
        sourceId: r.sourceId,
        targetId: r.targetId,
        relationshipType: r.relationshipType,
        description: r.description,
      })),
      riskReferences: riskRefs.rows ?? riskRefs,
    },
  });
}
