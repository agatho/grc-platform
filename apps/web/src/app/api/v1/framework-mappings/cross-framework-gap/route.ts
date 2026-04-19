// POST /api/v1/framework-mappings/cross-framework-gap
//
// "I have framework X — how close am I to framework Y?"
//
// Inputs:
//   sourceFramework  — the framework you've already implemented (e.g. "iso27002_2022")
//   targetFramework  — the framework you want to add (e.g. "isae3402_soc2")
//
// Output:
//   - target controls covered (transitively, via framework_mapping)
//   - target controls not covered
//   - per-source-control: which target controls it satisfies
//   - estimated coverage % and gap count
//
// Uses framework_mapping (the bridged, API-side mapping table populated by
// migration 0106). Reads soaEntry filtered to active source-catalog entries
// to determine "what you have implemented".

import { db, frameworkMapping, soaEntry, catalog, catalogEntry } from "@grc/db";
import { withAuth } from "@/lib/api";
import { eq, and, inArray, sql } from "drizzle-orm";
import { z } from "zod";

const gapInputSchema = z.object({
  sourceFramework: z.string().min(1).max(50),
  targetFramework: z.string().min(1).max(50),
  // restrict source side to controls actually implemented for the org? default true
  onlyImplementedSource: z.boolean().default(true),
});

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;

  const body = gapInputSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }
  const { sourceFramework, targetFramework, onlyImplementedSource } = body.data;

  if (sourceFramework === targetFramework) {
    return Response.json(
      { error: "sourceFramework and targetFramework must differ" },
      { status: 422 },
    );
  }

  // Resolve target catalog total entries (the denominator)
  const [targetCat] = await db
    .select({ id: catalog.id, name: catalog.name })
    .from(catalog)
    .where(and(eq(catalog.source, targetFramework), eq(catalog.isActive, true)))
    .limit(1);

  if (!targetCat) {
    return Response.json(
      { error: `Target catalog "${targetFramework}" not seeded` },
      { status: 404 },
    );
  }

  const targetEntries = await db
    .select({ code: catalogEntry.code, name: catalogEntry.name, nameDe: catalogEntry.nameDe, level: catalogEntry.level })
    .from(catalogEntry)
    .where(and(eq(catalogEntry.catalogId, targetCat.id), eq(catalogEntry.status, "active")))
    .orderBy(catalogEntry.sortOrder);
  const targetLeafEntries = targetEntries.filter((e) => e.level > 0);
  const targetTotal = targetLeafEntries.length;

  // Determine the set of source controls to count as "implemented"
  let implementedSourceCodes: Set<string> | null = null;

  if (onlyImplementedSource) {
    const [srcCat] = await db
      .select({ id: catalog.id })
      .from(catalog)
      .where(and(eq(catalog.source, sourceFramework), eq(catalog.isActive, true)))
      .limit(1);

    if (!srcCat) {
      return Response.json(
        { error: `Source catalog "${sourceFramework}" not seeded` },
        { status: 404 },
      );
    }

    const implRows = await db
      .select({ code: catalogEntry.code })
      .from(soaEntry)
      .innerJoin(catalogEntry, eq(catalogEntry.id, soaEntry.catalogEntryId))
      .where(
        and(
          eq(soaEntry.orgId, ctx.orgId),
          eq(catalogEntry.catalogId, srcCat.id),
          inArray(soaEntry.implementation, ["implemented", "partially_implemented"]),
        ),
      );

    implementedSourceCodes = new Set(implRows.map((r) => r.code));
  }

  // Pull mappings in BOTH directions, normalised to source→target.
  // Many seed authors only encode one direction (SOC2→ISO27001 but not back).
  // Symmetric coverage is a property of the relationship type:
  //   equal       <-> equal
  //   subset      <-> superset (and vice versa)
  //   intersect   <-> intersect
  // Include reverse rows with their relationship type flipped accordingly.
  const flipRelationship = (r: string): string => {
    if (r === "subset") return "superset";
    if (r === "superset") return "subset";
    return r;
  };

  const fwd = await db
    .select({
      sourceCode: frameworkMapping.sourceControlId,
      sourceTitle: frameworkMapping.sourceControlTitle,
      targetCode: frameworkMapping.targetControlId,
      targetTitle: frameworkMapping.targetControlTitle,
      relationship: frameworkMapping.relationshipType,
      confidence: frameworkMapping.confidence,
    })
    .from(frameworkMapping)
    .where(
      and(
        eq(frameworkMapping.sourceFramework, sourceFramework),
        eq(frameworkMapping.targetFramework, targetFramework),
      ),
    );

  const rev = await db
    .select({
      sourceCode: frameworkMapping.targetControlId,
      sourceTitle: frameworkMapping.targetControlTitle,
      targetCode: frameworkMapping.sourceControlId,
      targetTitle: frameworkMapping.sourceControlTitle,
      relationship: frameworkMapping.relationshipType,
      confidence: frameworkMapping.confidence,
    })
    .from(frameworkMapping)
    .where(
      and(
        eq(frameworkMapping.sourceFramework, targetFramework),
        eq(frameworkMapping.targetFramework, sourceFramework),
      ),
    );

  // Merge + dedupe by (source, target). Forward-direction rows win on conflict.
  const seen = new Set(fwd.map((m) => `${m.sourceCode}|${m.targetCode}`));
  const mappings = [
    ...fwd,
    ...rev
      .filter((m) => !seen.has(`${m.sourceCode}|${m.targetCode}`))
      .map((m) => ({ ...m, relationship: flipRelationship(m.relationship) })),
  ];

  // Coverage logic:
  //   target control is "covered"          if at least one mapping with relationship 'equal' or 'superset'
  //                                        AND the source side is implemented (or onlyImplementedSource=false)
  //   target control is "partially_covered" if mapping is 'intersect' or 'subset'
  //   target control is "not_covered"      if no satisfying mapping
  const coverageMap = new Map<string, { status: "covered" | "partially_covered" | "not_covered"; via: { sourceCode: string; relationship: string; confidence: string }[] }>();
  for (const e of targetLeafEntries) {
    coverageMap.set(e.code, { status: "not_covered", via: [] });
  }

  for (const m of mappings) {
    if (!coverageMap.has(m.targetCode)) continue;
    if (implementedSourceCodes && !implementedSourceCodes.has(m.sourceCode)) continue;

    const cur = coverageMap.get(m.targetCode)!;
    cur.via.push({ sourceCode: m.sourceCode, relationship: m.relationship, confidence: String(m.confidence) });
    const isFull = m.relationship === "equal" || m.relationship === "superset";
    const isPartial = m.relationship === "intersect" || m.relationship === "subset";
    if (isFull) cur.status = "covered";
    else if (isPartial && cur.status !== "covered") cur.status = "partially_covered";
  }

  const covered = [...coverageMap.values()].filter((c) => c.status === "covered").length;
  const partial = [...coverageMap.values()].filter((c) => c.status === "partially_covered").length;
  const notCovered = targetTotal - covered - partial;
  const coveragePercent = targetTotal > 0 ? Math.round(((covered + partial * 0.5) / targetTotal) * 10000) / 100 : 0;

  // Top gaps (uncovered target controls)
  const gaps = targetLeafEntries
    .filter((e) => coverageMap.get(e.code)?.status === "not_covered")
    .slice(0, 25)
    .map((e) => ({
      code: e.code,
      title: e.nameDe ?? e.name,
      reason: "Kein passendes Mapping aus implementierten Source-Controls",
    }));

  // Per-source-control: which target controls does each source one satisfy?
  // Useful for "control reuse" reports.
  const sourceLeverage = new Map<string, { sourceTitle: string | null; targets: { code: string; relationship: string; status: string }[] }>();
  for (const m of mappings) {
    if (implementedSourceCodes && !implementedSourceCodes.has(m.sourceCode)) continue;
    if (!sourceLeverage.has(m.sourceCode)) sourceLeverage.set(m.sourceCode, { sourceTitle: m.sourceTitle, targets: [] });
    sourceLeverage.get(m.sourceCode)!.targets.push({
      code: m.targetCode,
      relationship: m.relationship,
      status: coverageMap.get(m.targetCode)?.status ?? "not_covered",
    });
  }

  const topReusable = [...sourceLeverage.entries()]
    .map(([sourceCode, info]) => ({
      sourceCode,
      sourceTitle: info.sourceTitle,
      satisfiesCount: info.targets.length,
      targets: info.targets.slice(0, 10),
    }))
    .sort((a, b) => b.satisfiesCount - a.satisfiesCount)
    .slice(0, 15);

  return Response.json({
    data: {
      sourceFramework,
      targetFramework,
      targetCatalogName: targetCat.name,
      targetTotal,
      covered,
      partiallyCovered: partial,
      notCovered,
      coveragePercent,
      onlyImplementedSource,
      implementedSourceControls: implementedSourceCodes ? implementedSourceCodes.size : null,
      mappingsConsidered: mappings.length,
      gaps,
      topReusableSourceControls: topReusable,
      summary: buildSummary(coveragePercent, covered, partial, notCovered, sourceFramework, targetFramework),
    },
  });
}

function buildSummary(
  pct: number,
  covered: number,
  partial: number,
  notCovered: number,
  src: string,
  tgt: string,
): string {
  if (pct >= 90) return `Du bist nahezu ${tgt}-ready: ${covered} Controls direkt aus ${src} abgedeckt, nur ${notCovered} Lücken.`;
  if (pct >= 70) return `Starke Basis: ${pct}% von ${tgt} aus ${src} ableitbar (${covered} voll + ${partial} teilweise). ${notCovered} echte Lücken bleiben.`;
  if (pct >= 40) return `${src} bringt dich zu ${pct}% Richtung ${tgt}. Plane gezielt für die ${notCovered} fehlenden Controls.`;
  return `${src} und ${tgt} überschneiden sich nur zu ${pct}% — das wird ein größeres Programm (${notCovered} fehlende Controls).`;
}
