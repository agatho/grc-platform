// GET /api/v1/isms/maturity/heatmap
//
// Returns a framework × control-family matrix of average maturity, ready to
// render as a heatmap. Each cell = average currentMaturity of all controls in
// that family for that framework.
//
// Query parameters:
//   frameworks  — comma-separated framework sources (e.g.
//                 "iso27002_2022,nist_csf_2,bsi_itgs_bausteine"). Optional;
//                 defaults to all frameworks active for the org.
//   includeTarget — "true" to include target maturity per cell.
//
// Response:
//   {
//     frameworks: ["iso27002_2022", ...],
//     families:   ["A.5", "A.6", ...] (union across all frameworks, framework-prefixed)
//     cells: [{ framework, family, currentAvg, targetAvg, controlCount }]
//   }
//
// The "family" derives from catalog_entry.code prefix (the parent header) which
// is the natural grouping for ISO 27001/27002, NIST 800-53 (control families),
// BSI (layers), CSA CCM (domains) and similar hierarchical catalogs.

import { db, controlMaturity, control, catalogEntry, catalog, orgActiveCatalog, soaEntry } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { eq, and, inArray, sql } from "drizzle-orm";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const fwParam = url.searchParams.get("frameworks");
  const includeTarget = url.searchParams.get("includeTarget") === "true";

  // Resolve framework list. If unspecified, use active catalogs of type 'control'.
  let frameworkSources: string[];
  if (fwParam) {
    frameworkSources = fwParam.split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    const active = await db
      .select({ source: catalog.source })
      .from(orgActiveCatalog)
      .innerJoin(catalog, eq(catalog.id, orgActiveCatalog.catalogId))
      .where(and(eq(orgActiveCatalog.orgId, ctx.orgId), eq(catalog.catalogType, "control")));
    frameworkSources = active.map((a) => a.source);
  }

  if (frameworkSources.length === 0) {
    return Response.json({
      data: { frameworks: [], families: [], cells: [], hint: "No control frameworks active for this org. Activate a catalog under /catalogs first." },
    });
  }

  // Resolve catalog IDs for the requested frameworks
  const catalogs = await db
    .select({ id: catalog.id, source: catalog.source, name: catalog.name })
    .from(catalog)
    .where(and(eq(catalog.isActive, true), inArray(catalog.source, frameworkSources)));
  const catalogIdToSource = new Map(catalogs.map((c) => [c.id, c.source]));
  const catalogIds = catalogs.map((c) => c.id);

  if (catalogIds.length === 0) {
    return Response.json({ data: { frameworks: frameworkSources, families: [], cells: [] } });
  }

  // Pull all leaf catalog entries with their family code (level-0 ancestor).
  // The family is the chunk before the first dot or full level-0 entry.
  const entries = await db
    .select({
      id: catalogEntry.id,
      code: catalogEntry.code,
      level: catalogEntry.level,
      catalogId: catalogEntry.catalogId,
    })
    .from(catalogEntry)
    .where(and(inArray(catalogEntry.catalogId, catalogIds), eq(catalogEntry.status, "active")));

  // Resolve family for each leaf code: take the first segment before "." or "_".
  // For BSI ("ISMS.1.A1") family = "ISMS"; for ISO ("A.5.1") family = "A.5";
  // for NIST 800-53 ("AC-2") family = "AC"; for SOC 2 ("CC6.1") family = "CC6".
  function deriveFamily(code: string): string {
    // ISO-style "A.x.y" → "A.x"
    if (/^[A-Z]\.\d+\.\d+/.test(code)) return code.split(".").slice(0, 2).join(".");
    // Multi-dot code with prefix like "ISMS.1.A1" → first segment
    if (code.includes(".")) return code.split(".")[0];
    // NIST-style "AC-2" → "AC"
    if (code.includes("-")) return code.split("-")[0];
    // Numeric PCI-DSS "1.2" → first segment
    return code;
  }

  const leafEntryFamilies = new Map<string, { family: string; source: string }>();
  for (const e of entries) {
    if (e.level === 0) continue; // skip headers
    const source = catalogIdToSource.get(e.catalogId);
    if (!source) continue;
    leafEntryFamilies.set(e.id, { family: deriveFamily(e.code), source });
  }

  // SoA links catalog_entry → control. Maturity is on control.
  // To aggregate maturity per (framework, family), we need:
  //   catalog_entry → soa.control_id → control_maturity.current_maturity
  const soas = await db
    .select({
      catalogEntryId: soaEntry.catalogEntryId,
      controlId: soaEntry.controlId,
    })
    .from(soaEntry)
    .where(and(eq(soaEntry.orgId, ctx.orgId), inArray(soaEntry.catalogEntryId, [...leafEntryFamilies.keys()])));

  const controlIdToFamily = new Map<string, { family: string; source: string }>();
  for (const s of soas) {
    if (!s.controlId) continue;
    const fam = leafEntryFamilies.get(s.catalogEntryId);
    if (fam) controlIdToFamily.set(s.controlId, fam);
  }

  if (controlIdToFamily.size === 0) {
    return Response.json({
      data: {
        frameworks: frameworkSources,
        families: [],
        cells: [],
        hint: "No SoA entries link catalog controls to operational controls yet. Use /api/v1/isms/soa/populate first.",
      },
    });
  }

  // Fetch all maturity rows for these controls
  const maturities = await db
    .select({
      controlId: controlMaturity.controlId,
      currentMaturity: controlMaturity.currentMaturity,
      targetMaturity: controlMaturity.targetMaturity,
    })
    .from(controlMaturity)
    .where(and(eq(controlMaturity.orgId, ctx.orgId), inArray(controlMaturity.controlId, [...controlIdToFamily.keys()])));

  // Aggregate
  type CellAccum = { framework: string; family: string; currents: number[]; targets: number[]; controlCount: number };
  const cellMap = new Map<string, CellAccum>();
  for (const m of maturities) {
    const fam = controlIdToFamily.get(m.controlId);
    if (!fam) continue;
    const key = `${fam.source}::${fam.family}`;
    if (!cellMap.has(key)) {
      cellMap.set(key, { framework: fam.source, family: fam.family, currents: [], targets: [], controlCount: 0 });
    }
    const cell = cellMap.get(key)!;
    cell.currents.push(m.currentMaturity);
    cell.targets.push(m.targetMaturity);
    cell.controlCount++;
  }

  const cells = [...cellMap.values()].map((c) => ({
    framework: c.framework,
    family: c.family,
    currentAvg: c.currents.length ? Math.round((c.currents.reduce((a, b) => a + b, 0) / c.currents.length) * 10) / 10 : 0,
    targetAvg: includeTarget && c.targets.length
      ? Math.round((c.targets.reduce((a, b) => a + b, 0) / c.targets.length) * 10) / 10
      : null,
    gap: includeTarget && c.targets.length && c.currents.length
      ? Math.round(((c.targets.reduce((a, b) => a + b, 0) / c.targets.length) - (c.currents.reduce((a, b) => a + b, 0) / c.currents.length)) * 10) / 10
      : null,
    controlCount: c.controlCount,
  }));

  // Stable axis ordering for the UI
  const families = [...new Set(cells.map((c) => c.family))].sort();
  const usedFrameworks = [...new Set(cells.map((c) => c.framework))];

  return Response.json({
    data: {
      frameworks: usedFrameworks,
      families,
      cells,
      includeTarget,
      stats: {
        cellCount: cells.length,
        avgMaturityOverall: cells.length
          ? Math.round((cells.reduce((a, b) => a + b.currentAvg, 0) / cells.length) * 10) / 10
          : 0,
      },
    },
  });
}
