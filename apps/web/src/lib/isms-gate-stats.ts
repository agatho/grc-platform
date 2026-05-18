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
} from "@grc/db";
import type { SoaStats, RiskEvalStats } from "@grc/shared";
import { and, eq, inArray, or, ne, sql } from "drizzle-orm";

type DbLike = {
  select: (...args: unknown[]) => unknown;
};

export async function fetchSoaStats(
  db: DbLike,
  orgId: string,
): Promise<SoaStats> {
  const activeCatalogs = (await (db as any)
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
    )) as Array<{ catalogId: string }>;

  const catalogIds = activeCatalogs.map((c) => c.catalogId);

  if (catalogIds.length === 0) {
    return {
      totalCatalogEntries: 0,
      entriesWithSoa: 0,
      notApplicableWithoutJustification: 0,
    };
  }

  const [{ count: totalCount }] = (await (db as any)
    .select({ count: sql<number>`count(*)::int` })
    .from(catalogEntry)
    .where(
      and(
        inArray(catalogEntry.catalogId, catalogIds),
        eq(catalogEntry.status, "active"),
      ),
    )) as Array<{ count: number }>;

  const [{ count: soaCount }] = (await (db as any)
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
    )) as Array<{ count: number }>;

  const [{ count: notApplicableBadCount }] = (await (db as any)
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
    )) as Array<{ count: number }>;

  return {
    totalCatalogEntries: totalCount ?? 0,
    entriesWithSoa: soaCount ?? 0,
    notApplicableWithoutJustification: notApplicableBadCount ?? 0,
  };
}

export async function fetchRiskEvalStats(
  db: DbLike,
  runId: string,
  orgId: string,
): Promise<RiskEvalStats> {
  const [{ total }] = (await (db as any)
    .select({ total: sql<number>`count(*)::int` })
    .from(assessmentRiskEval)
    .where(
      and(
        eq(assessmentRiskEval.assessmentRunId, runId),
        eq(assessmentRiskEval.orgId, orgId),
      ),
    )) as Array<{ total: number }>;

  const [{ decided }] = (await (db as any)
    .select({ decided: sql<number>`count(*)::int` })
    .from(assessmentRiskEval)
    .where(
      and(
        eq(assessmentRiskEval.assessmentRunId, runId),
        eq(assessmentRiskEval.orgId, orgId),
        ne(assessmentRiskEval.decision, "pending"),
      ),
    )) as Array<{ decided: number }>;

  const [{ scored }] = (await (db as any)
    .select({ scored: sql<number>`count(*)::int` })
    .from(assessmentRiskEval)
    .where(
      and(
        eq(assessmentRiskEval.assessmentRunId, runId),
        eq(assessmentRiskEval.orgId, orgId),
        sql`${assessmentRiskEval.residualLikelihood} IS NOT NULL`,
        sql`${assessmentRiskEval.residualImpact} IS NOT NULL`,
      ),
    )) as Array<{ scored: number }>;

  return {
    totalRiskEvals: total ?? 0,
    decided: decided ?? 0,
    scored: scored ?? 0,
  };
}
