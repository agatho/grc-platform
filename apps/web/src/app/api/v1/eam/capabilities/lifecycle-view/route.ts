import { db, businessCapability, architectureElement } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/capabilities/lifecycle-view — Capabilities with lifecycle coloring data
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const capabilities = await db.select({
    id: businessCapability.id,
    elementId: businessCapability.elementId,
    parentId: businessCapability.parentId,
    level: businessCapability.level,
    sortOrder: businessCapability.sortOrder,
    maturityLevel: businessCapability.maturityLevel,
    strategicImportance: businessCapability.strategicImportance,
    functionalCoverage: businessCapability.functionalCoverage,
    strategicAlignment: businessCapability.strategicAlignment,
    lifecycleStatus: businessCapability.lifecycleStatus,
    name: architectureElement.name,
    description: architectureElement.description,
  })
    .from(businessCapability)
    .innerJoin(architectureElement, eq(businessCapability.elementId, architectureElement.id))
    .where(eq(businessCapability.orgId, ctx.orgId))
    .orderBy(businessCapability.level, businessCapability.sortOrder);

  return Response.json({ data: capabilities });
}
