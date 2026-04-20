// GET /api/v1/isms/assessments/[id]/soa-gate-check
//
// Sprint 1.2 Gate-Check-Endpoint. Laedt die aktuellen SoA-Stats fuer
// die Org des Assessments und liefert Gate-G2-Blocker + Progress.
//
// Verwendung: UI zeigt dem User VOR Transition 'planning -> in_progress'
// an, was noch fehlt. Kein State-Change.

import {
  db,
  assessmentRun,
  catalogEntry,
  orgActiveCatalog,
  soaEntry,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { validateGate2SoaCoverage, type SoaStats } from "@grc/shared";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;

  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  // Assessment-Run existiert + gehoert zur Org
  const [run] = await db
    .select()
    .from(assessmentRun)
    .where(and(eq(assessmentRun.id, id), eq(assessmentRun.orgId, ctx.orgId)));
  if (!run) {
    return Response.json(
      { error: "Assessment run not found" },
      { status: 404 },
    );
  }

  // SoA-Stats berechnen: Anzahl catalog_entries in aktiven Katalogen
  // + Anzahl mit soa_entry + Anzahl not_applicable ohne Justification
  const activeCatalogs = await db
    .select({ catalogId: orgActiveCatalog.catalogId })
    .from(orgActiveCatalog)
    .where(
      and(
        eq(orgActiveCatalog.orgId, ctx.orgId),
        or(
          eq(orgActiveCatalog.catalogType, "control"),
          eq(orgActiveCatalog.catalogType, "reference"),
        ),
      ),
    );

  const catalogIds = activeCatalogs.map((c) => c.catalogId);

  if (catalogIds.length === 0) {
    const stats: SoaStats = {
      totalCatalogEntries: 0,
      entriesWithSoa: 0,
      notApplicableWithoutJustification: 0,
    };
    return Response.json({
      data: {
        assessmentRunId: run.id,
        stats,
        blockers: validateGate2SoaCoverage(stats),
        hint: "Aktiviere zuerst mindestens ein Framework unter /catalogs.",
      },
    });
  }

  // Gesamt-Entries
  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(catalogEntry)
    .where(
      and(
        inArray(catalogEntry.catalogId, catalogIds),
        eq(catalogEntry.status, "active"),
      ),
    );

  // Entries mit SoA
  const [{ count: soaCount }] = await db
    .select({
      count: sql<number>`count(DISTINCT ${soaEntry.catalogEntryId})::int`,
    })
    .from(soaEntry)
    .innerJoin(catalogEntry, eq(catalogEntry.id, soaEntry.catalogEntryId))
    .where(
      and(
        eq(soaEntry.orgId, ctx.orgId),
        inArray(catalogEntry.catalogId, catalogIds),
        eq(catalogEntry.status, "active"),
      ),
    );

  // not_applicable ohne Justification
  const [{ count: notApplicableBadCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(soaEntry)
    .innerJoin(catalogEntry, eq(catalogEntry.id, soaEntry.catalogEntryId))
    .where(
      and(
        eq(soaEntry.orgId, ctx.orgId),
        eq(soaEntry.applicability, "not_applicable"),
        inArray(catalogEntry.catalogId, catalogIds),
        sql`(${soaEntry.applicabilityJustification} IS NULL OR length(${soaEntry.applicabilityJustification}) < 50)`,
      ),
    );

  const stats: SoaStats = {
    totalCatalogEntries: totalCount ?? 0,
    entriesWithSoa: soaCount ?? 0,
    notApplicableWithoutJustification: notApplicableBadCount ?? 0,
  };

  const blockers = validateGate2SoaCoverage(stats);

  return Response.json({
    data: {
      assessmentRunId: run.id,
      stats,
      coverage:
        stats.totalCatalogEntries > 0
          ? Math.round((stats.entriesWithSoa / stats.totalCatalogEntries) * 100)
          : 0,
      blockers,
      passed: blockers.filter((b) => b.severity === "error").length === 0,
    },
  });
}
