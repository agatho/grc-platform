// GET /api/v1/programmes/journeys/[id]/maturity
//
// #WAVE22-MAR-P2-04: per-programme CMMI maturity. Returns the org-
// wide maturity rollup (same calculation as /erm/maturity) plus the
// programme's own progressPercent as a per-programme indicator,
// plus a `comparison` block so the dashboard can show "org is
// ML3/Defined; this programme is 67% complete".
//
// Future enhancement: scope the controls input to only the catalog
// entries this programme's msType is targeting (e.g. ISO 27001
// programme → only count tests against ISO 27002 controls). Held
// for a follow-up wave because the catalog-link metadata isn't
// uniformly populated yet — partial scoping would mislead.

import {
  db,
  control,
  controlTest,
  finding,
  securityIncident,
  audit,
  moduleConfig,
  esrsMetric,
  esgMeasurement,
  user,
  programmeJourney,
} from "@grc/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { calculateMaturity, type SourceInput } from "@grc/shared";
import { requireUuidParam } from "@/lib/param-validation";

type RouteParams = { params: Promise<{ id: string }> };

const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

// Same logic as /erm/maturity. Kept inline rather than imported so
// the two routes can diverge when per-programme scoping lands without
// rippling through the org-wide endpoint.
async function loadMaturityInputs(orgId: string): Promise<SourceInput[]> {
  const cfgRows = await db
    .select({
      moduleKey: moduleConfig.moduleKey,
      isDataActive: moduleConfig.isDataActive,
    })
    .from(moduleConfig)
    .where(eq(moduleConfig.orgId, orgId));
  const enabled = (key: string) =>
    cfgRows.find((r) => r.moduleKey === key)?.isDataActive ?? false;

  const cutoffDate = new Date(Date.now() - TWELVE_MONTHS_MS);

  const [controlStats] = await db
    .select({
      tests: sql<number>`count(*)::int`,
      eff: sql<number>`count(*) filter (where ${controlTest.toeResult} = 'effective')::int`,
      partial: sql<number>`count(*) filter (where ${controlTest.toeResult} = 'partially_effective')::int`,
      ineff: sql<number>`count(*) filter (where ${controlTest.toeResult} = 'ineffective')::int`,
    })
    .from(controlTest)
    .innerJoin(control, eq(controlTest.controlId, control.id))
    .where(
      and(
        eq(control.orgId, orgId),
        isNull(control.deletedAt),
        isNull(controlTest.deletedAt),
      ),
    );
  const controlsTested =
    (controlStats?.eff ?? 0) +
    (controlStats?.partial ?? 0) +
    (controlStats?.ineff ?? 0);
  const controlsScore =
    controlsTested > 0
      ? Math.round(
          (((controlStats?.eff ?? 0) + (controlStats?.partial ?? 0) * 0.5) /
            controlsTested) *
            100,
        )
      : 0;

  const [securityIncidentStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      closed: sql<number>`count(*) filter (where ${securityIncident.status} = 'closed')::int`,
    })
    .from(securityIncident)
    .where(
      and(
        eq(securityIncident.orgId, orgId),
        sql`${securityIncident.detectedAt} >= ${cutoffDate}`,
      ),
    );
  const securityIncidentsScore =
    (securityIncidentStats?.total ?? 0) > 0
      ? Math.round(
          ((securityIncidentStats?.closed ?? 0) /
            securityIncidentStats!.total) *
            100,
        )
      : 0;

  const [auditFindingStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      resolved: sql<number>`count(*) filter (where ${finding.status} in ('remediated','verified','closed'))::int`,
    })
    .from(finding)
    .innerJoin(audit, eq(finding.auditId, audit.id))
    .where(
      and(
        eq(finding.orgId, orgId),
        isNull(finding.deletedAt),
        sql`${finding.createdAt} >= ${cutoffDate}`,
      ),
    );
  const auditsScore =
    (auditFindingStats?.total ?? 0) > 0
      ? Math.round(
          ((auditFindingStats?.resolved ?? 0) / auditFindingStats!.total) * 100,
        )
      : 0;

  const [trainingStats] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(user);

  const [esrsCount] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(esrsMetric)
    .where(eq(esrsMetric.orgId, orgId));
  const [esgWithMeasurement] = await db
    .select({
      value: sql<number>`count(distinct ${esgMeasurement.metricId})::int`,
    })
    .from(esgMeasurement)
    .where(
      and(
        eq(esgMeasurement.orgId, orgId),
        sql`${esgMeasurement.recordedAt} >= ${cutoffDate}`,
      ),
    );
  const esgScore =
    (esrsCount?.value ?? 0) > 0
      ? Math.round(((esgWithMeasurement?.value ?? 0) / esrsCount!.value) * 100)
      : 0;

  return [
    {
      source: "controls",
      moduleEnabled: enabled("ics") || enabled("isms"),
      dataCount: controlsTested,
      score: controlsScore,
    },
    {
      source: "securityIncidents",
      moduleEnabled: enabled("isms"),
      dataCount: securityIncidentStats?.total ?? 0,
      score: securityIncidentsScore,
    },
    {
      source: "audits",
      moduleEnabled: enabled("audit"),
      dataCount: auditFindingStats?.total ?? 0,
      score: auditsScore,
    },
    {
      source: "training",
      moduleEnabled: enabled("academy"),
      dataCount: trainingStats?.total ?? 0,
      score: 0,
    },
    {
      source: "esg",
      moduleEnabled: enabled("esg"),
      dataCount: esgWithMeasurement?.value ?? 0,
      score: esgScore,
    },
  ];
}

export const GET = withErrorHandler<RouteParams>(async function GET(
  _req: Request,
  { params },
) {
  const { id } = await params;
  requireUuidParam(id);
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  // Verify the programme exists in the caller's org. Avoids leaking
  // cross-org programme presence via the maturity endpoint.
  const [journey] = await db
    .select({
      id: programmeJourney.id,
      name: programmeJourney.name,
      msType: programmeJourney.msType,
      status: programmeJourney.status,
      progressPercent: programmeJourney.progressPercent,
      templateCode: programmeJourney.templateCode,
    })
    .from(programmeJourney)
    .where(
      and(
        eq(programmeJourney.id, id),
        eq(programmeJourney.orgId, ctx.orgId),
        isNull(programmeJourney.deletedAt),
      ),
    );

  if (!journey) {
    return Response.json(
      { error: "Programme journey not found" },
      { status: 404 },
    );
  }

  const inputs = await loadMaturityInputs(ctx.orgId);
  const orgWide = calculateMaturity(inputs);

  return Response.json({
    data: {
      asOf: new Date().toISOString(),
      scope: "programme_journey",
      programmeJourneyId: journey.id,
      programmeName: journey.name,
      msType: journey.msType,
      templateCode: journey.templateCode,
      programmeStatus: journey.status,
      programmeProgressPercent: Number(journey.progressPercent),
      // Org-wide rollup as the comparison baseline. Per the design
      // call: both views surface, with the per-programme dimension
      // currently being progressPercent until catalog-scoped controls
      // land in a future wave.
      comparison: {
        orgWide: {
          level: orgWide.level,
          levelLabel: orgWide.levelLabel,
          score: orgWide.score,
          confidence: orgWide.confidence,
        },
      },
      orgWideDetail: orgWide,
      note: "This programme's score currently inherits the org-wide control/securityIncident/audit/training/esg signals. Catalog-scoped per-programme inputs are a Wave-23 enhancement.",
    },
  });
});
