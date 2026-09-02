import {
  db,
  applicationPortfolio,
  architectureElement,
  architectureRelationship,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/eam/roadmap — Gantt roadmap data (all applications with lifecycle phases)
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const groupBy = url.searchParams.get("groupBy") ?? "lifecycleStatus";

  const apps = await db
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

  // Get replacement relationships for dependency arrows
  const replacements = await db
    .select()
    .from(architectureRelationship)
    .where(
      and(
        eq(architectureRelationship.orgId, ctx.orgId),
        eq(architectureRelationship.relationshipType, "depends_on"),
      ),
    );

  const entries = apps.map((app) => {
    const portfolio = app.portfolio;
    const groupValue = portfolio
      ? ((portfolio as Record<string, unknown>)[groupBy] ?? "unassigned")
      : "unassigned";

    return {
      id: app.element.id,
      name: app.element.name,
      group: String(groupValue),
      phases: [
        {
          phase: "planning",
          start: portfolio?.plannedIntroduction,
          end: portfolio?.goLiveDate,
        },
        {
          phase: "active",
          start: portfolio?.goLiveDate,
          end: portfolio?.plannedEol,
        },
        { phase: "retired", start: portfolio?.plannedEol, end: null },
      ].filter((p) => p.start),
      lifecycleStatus: portfolio?.lifecycleStatus ?? "unknown",
      timeClassification: portfolio?.timeClassification,
      sixRStrategy: portfolio?.sixRStrategy,
    };
  });

  // Group entries
  const groups = new Map<string, { count: number }>();
  for (const entry of entries) {
    const g = groups.get(entry.group) ?? { count: 0 };
    g.count += 1;
    groups.set(entry.group, g);
  }

  return Response.json({
    data: {
      entries,
      groups: [...groups.entries()].map(([key, val]) => ({
        key,
        label: key,
        count: val.count,
      })),
      dependencies: replacements.map((r) => ({
        from: r.sourceId,
        to: r.targetId,
      })),
    },
  });
});
