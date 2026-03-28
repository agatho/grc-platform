import { db, soaEntry, controlCatalogEntry } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import type { PostureDomain } from "@grc/shared";

// ISO 27001:2022 Annex A domain mapping
// Clauses 5-8: Organizational, People, Physical, Technological
const ANNEX_A_DOMAINS: Record<string, PostureDomain> = {
  "5": "organizational",
  "6": "people",
  "7": "physical",
  "8": "technological",
};

// GET /api/v1/isms/posture/domains — Score per Annex-A domain
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Get SoA entries joined with catalog entries for control code
  const soaEntries = await db
    .select({
      code: controlCatalogEntry.code,
      implementation: soaEntry.implementation,
    })
    .from(soaEntry)
    .innerJoin(
      controlCatalogEntry,
      eq(controlCatalogEntry.id, soaEntry.catalogEntryId),
    )
    .where(eq(soaEntry.orgId, ctx.orgId));

  // Group SoA entries by domain
  const domainStats: Record<PostureDomain, { total: number; implemented: number }> = {
    organizational: { total: 0, implemented: 0 },
    people: { total: 0, implemented: 0 },
    physical: { total: 0, implemented: 0 },
    technological: { total: 0, implemented: 0 },
  };

  for (const entry of soaEntries) {
    const ref = entry.code ?? "";
    // Extract domain from control code (e.g., "A.5.1" -> "5")
    const match = ref.match(/A\.(\d+)/);
    if (!match) continue;
    const domain = ANNEX_A_DOMAINS[match[1]];
    if (!domain) continue;

    domainStats[domain].total++;
    if (entry.implementation === "implemented" || entry.implementation === "partially_implemented") {
      domainStats[domain].implemented++;
    }
  }

  // Compute domain scores as implementation percentage
  const domains: Record<PostureDomain, number> = {
    organizational: 0,
    people: 0,
    physical: 0,
    technological: 0,
  };

  for (const [domain, stats] of Object.entries(domainStats) as [PostureDomain, typeof domainStats.organizational][]) {
    domains[domain] =
      stats.total > 0
        ? Math.round((stats.implemented / stats.total) * 100)
        : 0;
  }

  return Response.json({
    domains,
    details: domainStats,
  });
}
