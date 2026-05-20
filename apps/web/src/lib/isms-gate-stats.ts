// Shared helpers for ISMS assessment gate stats.
//
// These were duplicated between /assessments/[id]/soa-gate-check and
// /assessments/[id]/risk-gate-check (discovery endpoints used by the UI).
// They are now also called from /assessments/[id]/transition so that
// gates G2 (SoA coverage) and G3 (risk assessment) actually block the
// in_progress → review transition — previously only G1 and G4 were
// enforced server-side, leaving G2/G3 as advisory-only.

import {
  catalogEntry,
  orgActiveCatalog,
  soaEntry,
  assessmentRiskEval,
  db,
} from "@grc/db";
import type { SoaStats, RiskEvalStats } from "@grc/shared";
import { and, eq, inArray, or, ne, sql } from "drizzle-orm";

// Both `db` and a `tx` from db.transaction(...) expose the same .select API.
// Narrowing to Pick<typeof db, "select"> lets callers pass either without
// the `as any` casts that the previous version relied on.
type SelectClient = Pick<typeof db, "select">;

export async function fetchSoaStats(
  db: SelectClient,
  orgId: string,
): Promise<SoaStats> {
  const activeCatalogs = await db
    .select({ catalogId: orgActiveCatalog.catalogId })
    .from(orgActiveCatalog)
    .where(
      and(
        eq(orgActiveCatalog.orgId, orgId),
        or(
          eq(orgActiveCatalog.catalogType, "control"),
          eq(orgActiveCatalog.catalogType, "reference"),
        ),
      ),
    );

  const catalogIds = activeCatalogs.map((c) => c.catalogId);

  if (catalogIds.length === 0) {
    return {
      totalCatalogEntries: 0,
      entriesWithSoa: 0,
      notApplicableWithoutJustification: 0,
    };
  }

  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(catalogEntry)
    .where(
      and(
        inArray(catalogEntry.catalogId, catalogIds),
        eq(catalogEntry.status, "active"),
      ),
    );

  const [{ count: soaCount }] = await db
    .select({
      count: sql<number>`count(DISTINCT ${soaEntry.catalogEntryId})::int`,
    })
    .from(soaEntry)
    .innerJoin(catalogEntry, eq(catalogEntry.id, soaEntry.catalogEntryId))
    .where(
      and(
        eq(soaEntry.orgId, orgId),
        inArray(catalogEntry.catalogId, catalogIds),
        eq(catalogEntry.status, "active"),
      ),
    );

  const [{ count: notApplicableBadCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(soaEntry)
    .innerJoin(catalogEntry, eq(catalogEntry.id, soaEntry.catalogEntryId))
    .where(
      and(
        eq(soaEntry.orgId, orgId),
        eq(soaEntry.applicability, "not_applicable"),
        inArray(catalogEntry.catalogId, catalogIds),
        sql`(${soaEntry.applicabilityJustification} IS NULL OR length(${soaEntry.applicabilityJustification}) < 50)`,
      ),
    );

  return {
    totalCatalogEntries: totalCount ?? 0,
    entriesWithSoa: soaCount ?? 0,
    notApplicableWithoutJustification: notApplicableBadCount ?? 0,
  };
}

export async function fetchRiskEvalStats(
  db: SelectClient,
  runId: string,
  orgId: string,
): Promise<RiskEvalStats> {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(assessmentRiskEval)
    .where(
      and(
        eq(assessmentRiskEval.assessmentRunId, runId),
        eq(assessmentRiskEval.orgId, orgId),
      ),
    );

  const [{ decided }] = await db
    .select({ decided: sql<number>`count(*)::int` })
    .from(assessmentRiskEval)
    .where(
      and(
        eq(assessmentRiskEval.assessmentRunId, runId),
        eq(assessmentRiskEval.orgId, orgId),
        ne(assessmentRiskEval.decision, "pending"),
      ),
    );

  const [{ scored }] = await db
    .select({ scored: sql<number>`count(*)::int` })
    .from(assessmentRiskEval)
    .where(
      and(
        eq(assessmentRiskEval.assessmentRunId, runId),
        eq(assessmentRiskEval.orgId, orgId),
        sql`${assessmentRiskEval.residualLikelihood} IS NOT NULL`,
        sql`${assessmentRiskEval.residualImpact} IS NOT NULL`,
      ),
    );

  return {
    totalRiskEvals: total ?? 0,
    decided: decided ?? 0,
    scored: scored ?? 0,
  };
}
