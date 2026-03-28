import { db, eamOrgUnit, eamBusinessContext, architectureElement } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/org-units/application-matrix — Org unit x application usage matrix
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const orgUnits = await db.select().from(eamOrgUnit)
    .where(eq(eamOrgUnit.orgId, ctx.orgId));

  const businessContexts = await db.select().from(eamBusinessContext)
    .where(eq(eamBusinessContext.orgId, ctx.orgId));

  // Build usage matrix from business contexts
  const usage: Record<string, Record<string, string>> = {};
  const appIds = new Set<string>();

  for (const bc of businessContexts) {
    if (!bc.orgUnitId || !bc.applicationIds) continue;
    if (!usage[bc.orgUnitId]) usage[bc.orgUnitId] = {};
    for (const appId of bc.applicationIds as string[]) {
      usage[bc.orgUnitId][appId] = "primary_user";
      appIds.add(appId);
    }
  }

  return Response.json({
    data: {
      orgUnits: orgUnits.map((u) => ({ id: u.id, name: u.name })),
      applicationIds: [...appIds],
      usage,
    },
  });
}
