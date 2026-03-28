import { db, architectureElement, architectureRelationship } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/diagram — Three-layer diagram data (nodes + edges)
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const nodes = await db
    .select({
      id: architectureElement.id,
      name: architectureElement.name,
      layer: architectureElement.layer,
      type: architectureElement.type,
      status: architectureElement.status,
      criticality: architectureElement.criticality,
      department: architectureElement.department,
    })
    .from(architectureElement)
    .where(eq(architectureElement.orgId, ctx.orgId));

  const edges = await db
    .select({
      id: architectureRelationship.id,
      sourceId: architectureRelationship.sourceId,
      targetId: architectureRelationship.targetId,
      relationshipType: architectureRelationship.relationshipType,
      criticality: architectureRelationship.criticality,
    })
    .from(architectureRelationship)
    .where(eq(architectureRelationship.orgId, ctx.orgId));

  return Response.json({ data: { nodes, edges } });
}
