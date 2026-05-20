// GET /api/v1/compliance/coverage — Cross-framework coverage rollup.
//
// #WAVE14-CROSS-05: Compliance dashboards live on a small set of
// aggregation endpoints. /controls/effectiveness already covers the
// "controls are tested and pass" angle; this one covers the upstream
// "controls exist for every framework requirement" angle.
//
// Data sources (in order of preference):
//   1. framework_gap_analysis — periodic snapshots from the worker
//      cron + manual /framework-mappings/gap-analysis triggers.
//      Wave-14 was built on this assumption.
//   2. control_framework_coverage — per-control mapping rows. Live
//      computation when no snapshot exists yet but mapping rows do.
//   3. control.catalog_entry_id — last-resort heuristic. Works for
//      a brand-new org that hasn't yet kicked off a coverage workflow
//      but does have org-controls catalog-linked. Surfaces a
//      non-zero number for the dashboard tile.
//
// #WAVE24-D7: Wave-24 QA reported overallCoveragePct=0, frameworkCount=0
// even though /compliance/frameworks reported 1319 entries across 46
// catalogs. Root cause: no framework_gap_analysis rows existed for
// the org (no one had run an analysis), and the endpoint had no
// fallback. This rewrite adds (a) the missing ?framework filter, and
// (b) live computation paths (2) and (3) so the dashboard shows
// realistic values immediately on an unused alpha tenant.

import {
  db,
  frameworkGapAnalysis,
  controlFrameworkCoverage,
  control,
  catalog,
  catalogEntry,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc, sql, isNull, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

type FrameworkRow = {
  framework: string;
  coveragePct: number;
  coveredControls: number;
  notCoveredControls: number;
  totalControls: number;
  analysisDate: string;
  source: "snapshot" | "live_cfc" | "live_catalog_link";
};

// Heuristic banding so the dashboard chips can be coloured without
// the caller having to know the threshold scheme.
function classify(pct: number): {
  fullyCovered: number;
  atRisk: number;
  critical: number;
} {
  return {
    fullyCovered: pct === 100 ? 1 : 0,
    atRisk: pct < 80 && pct >= 50 ? 1 : 0,
    critical: pct < 50 ? 1 : 0,
  };
}

async function fromSnapshots(
  orgId: string,
  filter: string | null,
): Promise<FrameworkRow[]> {
  const baseWhere = filter
    ? and(
        eq(frameworkGapAnalysis.orgId, orgId),
        eq(frameworkGapAnalysis.framework, filter),
      )
    : eq(frameworkGapAnalysis.orgId, orgId);

  const recent = await db
    .select()
    .from(frameworkGapAnalysis)
    .where(baseWhere)
    .orderBy(desc(frameworkGapAnalysis.analysisDate))
    .limit(200);

  const latestByFramework = new Map<string, (typeof recent)[number]>();
  for (const row of recent) {
    if (!latestByFramework.has(row.framework)) {
      latestByFramework.set(row.framework, row);
    }
  }

  return Array.from(latestByFramework.values()).map((a) => ({
    framework: a.framework,
    coveragePct: Number(a.coveragePercentage),
    coveredControls: a.coveredControls ?? 0,
    notCoveredControls: a.notCoveredControls ?? 0,
    totalControls: (a.coveredControls ?? 0) + (a.notCoveredControls ?? 0),
    analysisDate: String(a.analysisDate),
    source: "snapshot",
  }));
}

async function fromControlFrameworkCoverage(
  orgId: string,
  filter: string | null,
): Promise<FrameworkRow[]> {
  // Live aggregation across control_framework_coverage rows. Same
  // covered + 0.5×partial formula as the snapshot writer uses.
  const baseWhere = filter
    ? and(
        eq(controlFrameworkCoverage.orgId, orgId),
        eq(controlFrameworkCoverage.framework, filter),
      )
    : eq(controlFrameworkCoverage.orgId, orgId);

  const rows = await db
    .select({
      framework: controlFrameworkCoverage.framework,
      total: sql<number>`count(*)::int`,
      covered: sql<number>`count(*) filter (where ${controlFrameworkCoverage.coverageStatus} = 'covered')::int`,
      partial: sql<number>`count(*) filter (where ${controlFrameworkCoverage.coverageStatus} = 'partially_covered')::int`,
      notCovered: sql<number>`count(*) filter (where ${controlFrameworkCoverage.coverageStatus} = 'not_covered')::int`,
      notApplicable: sql<number>`count(*) filter (where ${controlFrameworkCoverage.coverageStatus} = 'not_applicable')::int`,
    })
    .from(controlFrameworkCoverage)
    .where(baseWhere)
    .groupBy(controlFrameworkCoverage.framework);

  return rows.map((r) => {
    const applicable = r.total - r.notApplicable;
    const pct =
      applicable > 0
        ? Math.round(((r.covered + r.partial * 0.5) / applicable) * 100)
        : 0;
    return {
      framework: r.framework,
      coveragePct: pct,
      coveredControls: r.covered,
      notCoveredControls: r.notCovered,
      totalControls: applicable,
      analysisDate: new Date().toISOString().slice(0, 10),
      source: "live_cfc",
    };
  });
}

async function fromCatalogLinks(
  orgId: string,
  filter: string | null,
): Promise<FrameworkRow[]> {
  // Last-resort fallback. For each control-catalog, count how many of
  // its entries have at least one org-control with a matching
  // catalog_entry_id. Maps to "how much of this framework do we have
  // any control claim coverage of".
  //
  // The `framework` filter here is matched against catalog.code. Tier
  // mappings (iso-27001-annex-a, iso27001-2022, etc) are catalog-side
  // so we accept both the canonical id and any catalog code with
  // partial match.
  const catalogs = await db
    .select({
      catalogId: catalog.id,
      code: catalog.code,
    })
    .from(catalog)
    .where(
      filter
        ? sql`(${catalog.code} = ${filter} OR ${catalog.code} ILIKE ${"%" + filter + "%"})`
        : sql`${catalog.code} IS NOT NULL`,
    );

  if (catalogs.length === 0) return [];
  const catalogIds = catalogs.map((c) => c.catalogId);

  const totals = await db
    .select({
      catalogId: catalogEntry.catalogId,
      total: sql<number>`count(*)::int`,
    })
    .from(catalogEntry)
    .where(inArray(catalogEntry.catalogId, catalogIds))
    .groupBy(catalogEntry.catalogId);

  const totalsByCatalog = new Map<string, number>();
  for (const t of totals) totalsByCatalog.set(t.catalogId, t.total);

  const covered = await db
    .select({
      catalogId: catalogEntry.catalogId,
      coveredEntries: sql<number>`count(distinct ${catalogEntry.id})::int`,
    })
    .from(catalogEntry)
    .innerJoin(control, eq(control.catalogEntryId, catalogEntry.id))
    .where(
      and(
        inArray(catalogEntry.catalogId, catalogIds),
        eq(control.orgId, orgId),
        isNull(control.deletedAt),
      ),
    )
    .groupBy(catalogEntry.catalogId);

  const coveredByCatalog = new Map<string, number>();
  for (const c of covered) coveredByCatalog.set(c.catalogId, c.coveredEntries);

  return catalogs
    .map((cat) => {
      const total = totalsByCatalog.get(cat.catalogId) ?? 0;
      const cov = coveredByCatalog.get(cat.catalogId) ?? 0;
      if (total === 0) return null;
      const pct = Math.round((cov / total) * 100);
      return {
        framework: cat.code,
        coveragePct: pct,
        coveredControls: cov,
        notCoveredControls: total - cov,
        totalControls: total,
        analysisDate: new Date().toISOString().slice(0, 10),
        source: "live_catalog_link" as const,
      };
    })
    .filter((r): r is FrameworkRow => r !== null);
}

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const framework = url.searchParams.get("framework");

  // Preferred path — periodic gap-analysis snapshots.
  let frameworks = await fromSnapshots(ctx.orgId, framework);
  let usedSource: FrameworkRow["source"] = "snapshot";

  if (frameworks.length === 0) {
    frameworks = await fromControlFrameworkCoverage(ctx.orgId, framework);
    usedSource = "live_cfc";
  }
  if (frameworks.length === 0) {
    frameworks = await fromCatalogLinks(ctx.orgId, framework);
    usedSource = "live_catalog_link";
  }

  let fullyCovered = 0;
  let atRisk = 0;
  let critical = 0;
  for (const f of frameworks) {
    const c = classify(f.coveragePct);
    fullyCovered += c.fullyCovered;
    atRisk += c.atRisk;
    critical += c.critical;
  }

  const overallCoveragePct =
    frameworks.length > 0
      ? Math.round(
          frameworks.reduce((sum, f) => sum + f.coveragePct, 0) /
            frameworks.length,
        )
      : 0;

  return Response.json({
    data: {
      overallCoveragePct,
      frameworkCount: frameworks.length,
      fullyCovered,
      atRisk,
      critical,
      frameworks,
      source: usedSource,
      asOf: new Date().toISOString(),
    },
  });
});
