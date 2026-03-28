import { db, architectureElement, applicationPortfolio } from "@grc/db";
import { requireModule } from "@grc/auth";
import { biExportQuerySchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/bi-export — Power BI REST API with OData-like query syntax
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const params = {
    $filter: url.searchParams.get("$filter") ?? undefined,
    $select: url.searchParams.get("$select") ?? undefined,
    $top: parseInt(url.searchParams.get("$top") ?? "100"),
    $skip: parseInt(url.searchParams.get("$skip") ?? "0"),
    $orderby: url.searchParams.get("$orderby") ?? undefined,
  };

  const parsed = biExportQuerySchema.safeParse(params);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  // Fetch all applications with portfolio data (flat tabular format for BI)
  const apps = await db.select({
    id: architectureElement.id,
    name: architectureElement.name,
    type: architectureElement.type,
    layer: architectureElement.layer,
    status: architectureElement.status,
    department: architectureElement.department,
    governanceStatus: architectureElement.governanceStatus,
    lifecycleStatus: applicationPortfolio.lifecycleStatus,
    timeClassification: applicationPortfolio.timeClassification,
    functionalFit: applicationPortfolio.functionalFit,
    technicalFit: applicationPortfolio.technicalFit,
    sixRStrategy: applicationPortfolio.sixRStrategy,
    businessCriticality: applicationPortfolio.businessCriticality,
    annualCost: applicationPortfolio.annualCost,
    userCount: applicationPortfolio.userCount,
    vendorName: applicationPortfolio.vendorName,
    licenseType: applicationPortfolio.licenseType,
    processesPersonalData: applicationPortfolio.processesPersonalData,
  })
    .from(architectureElement)
    .leftJoin(applicationPortfolio, eq(applicationPortfolio.elementId, architectureElement.id))
    .where(eq(architectureElement.orgId, ctx.orgId))
    .limit(parsed.data.$top)
    .offset(parsed.data.$skip);

  return Response.json({
    value: apps,
    count: apps.length,
  });
}
