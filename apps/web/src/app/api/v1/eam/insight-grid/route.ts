import {
  db,
  architectureElement,
  applicationPortfolio,
  architectureRelationship,
  businessCapability,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, lte, or, gt, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

function computeLifecyclePhaseAtTime(
  app: Record<string, unknown>,
  timeRef: Date,
): string {
  const intro = app.plannedIntroduction
    ? new Date(app.plannedIntroduction as string)
    : null;
  const goLive = app.goLiveDate ? new Date(app.goLiveDate as string) : null;
  const eol = app.plannedEol ? new Date(app.plannedEol as string) : null;

  if (intro && timeRef < intro) return "planning";
  if (goLive && timeRef < goLive) return "implementing";
  if (goLive) {
    const phaseInEnd = new Date(goLive.getTime() + 90 * 24 * 60 * 60 * 1000);
    if (timeRef < phaseInEnd) return "phase_in";
  }
  if (eol && timeRef > eol) return "inactive";
  if (eol) {
    const phaseOutStart = new Date(eol.getTime() - 180 * 24 * 60 * 60 * 1000);
    if (timeRef > phaseOutStart) return "phase_out";
  }
  return "active";
}

// GET /api/v1/eam/insight-grid — Matrix data with time-travel
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const timeRef = url.searchParams.get("timeRef")
    ? new Date(url.searchParams.get("timeRef")!)
    : new Date();
  const coloringMode = url.searchParams.get("coloring") ?? "lifecycle";

  // Get capabilities as columns
  const capabilities = await db
    .select()
    .from(businessCapability)
    .where(
      and(
        eq(businessCapability.orgId, ctx.orgId),
        eq(businessCapability.level, 1),
      ),
    );

  // Get IT components as rows
  const components = await db
    .select()
    .from(architectureElement)
    .where(
      and(
        eq(architectureElement.orgId, ctx.orgId),
        eq(architectureElement.layer, "technology"),
      ),
    );

  // Get active applications at timeRef
  const applications = await db
    .select({
      element: architectureElement,
      portfolio: applicationPortfolio,
    })
    .from(architectureElement)
    .leftJoin(
      applicationPortfolio,
      eq(applicationPortfolio.elementId, architectureElement.id),
    )
    .where(
      and(
        eq(architectureElement.orgId, ctx.orgId),
        eq(architectureElement.type, "application"),
      ),
    );

  // Get relationships
  const relationships = await db
    .select()
    .from(architectureRelationship)
    .where(eq(architectureRelationship.orgId, ctx.orgId));

  // Build lookup maps
  const appToCapabilities = new Map<string, string[]>();
  const appToComponents = new Map<string, string[]>();

  for (const rel of relationships) {
    if (rel.relationshipType === "realizes") {
      const existing = appToCapabilities.get(rel.sourceId) ?? [];
      existing.push(rel.targetId);
      appToCapabilities.set(rel.sourceId, existing);
    }
    if (["runs_on", "deployed_on"].includes(rel.relationshipType)) {
      const existing = appToComponents.get(rel.sourceId) ?? [];
      existing.push(rel.targetId);
      appToComponents.set(rel.sourceId, existing);
    }
  }

  // Build matrix cells
  const cells: Record<
    string,
    Record<string, Array<Record<string, unknown>>>
  > = {};

  for (const app of applications) {
    const phase = computeLifecyclePhaseAtTime(app.portfolio ?? {}, timeRef);
    if (phase === "inactive" || phase === "planning") continue;

    const capIds = appToCapabilities.get(app.element.id) ?? [];
    const compIds = appToComponents.get(app.element.id) ?? [];

    for (const compId of compIds) {
      if (!cells[compId]) cells[compId] = {};
      for (const capId of capIds) {
        if (!cells[compId][capId]) cells[compId][capId] = [];
        cells[compId][capId].push({
          applicationId: app.element.id,
          name: app.element.name,
          lifecyclePhase: phase,
          timeClassification: app.portfolio?.timeClassification,
          sixRStrategy: app.portfolio?.sixRStrategy,
          businessCriticality: app.portfolio?.businessCriticality,
          functionalFit: app.portfolio?.functionalFit,
          annualCost: app.portfolio?.annualCost,
        });
      }
    }
  }

  return Response.json({
    data: {
      columns: capabilities.map((c) => ({
        id: c.id,
        name: c.elementId,
        elementId: c.elementId,
      })),
      rows: components.map((c) => ({ id: c.id, name: c.name, type: c.type })),
      cells,
      timeReference: timeRef.toISOString(),
      coloringMode,
    },
  });
}
