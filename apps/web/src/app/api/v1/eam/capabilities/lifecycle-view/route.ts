import { db, businessCapability, architectureElement } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/eam/capabilities/lifecycle-view — Capabilities with lifecycle coloring data
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const capabilities = await db
    .select({
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
    .innerJoin(
      architectureElement,
      eq(businessCapability.elementId, architectureElement.id),
    )
    .where(eq(businessCapability.orgId, ctx.orgId))
    .orderBy(businessCapability.level, businessCapability.sortOrder);

  return Response.json({ data: capabilities });
});
