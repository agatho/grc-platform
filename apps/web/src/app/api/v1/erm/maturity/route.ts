// GET /api/v1/erm/maturity
//
// #WAVE22-MAR-P2-04: org-wide CMMI maturity rollup. Aggregates per-
// source signals (controls effectiveness, incident closure rate,
// audit-finding closure, training completion, ESG measurement
// coverage), filters via the two-stage rule (module enabled + min
// samples), re-normalises weights, and returns the CMMI level.
//
// Hardcoded weights live in packages/shared/src/maturity/cmmi.ts;
// per-org overrides aren't surfaced here yet — that's a Wave 23
// enhancement once we know whether org-side custom weighting is
// actually demanded.

import {
  db,
  control,
  controlTest,
  finding,
  incident,
  audit,
  moduleConfig,
  esrsMetric,
  esgMeasurement,
  user,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { calculateMaturity, type SourceInput } from "@grc/shared";

// Cutoff for "recent enough" data points where we apply a 12-month
// window (incidents, audits). Keeps the score from being dragged
// around by ancient items the org has long since fixed.
const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

async function loadMaturityInputs(orgId: string): Promise<SourceInput[]> {
  // Module-config snapshot — which modules is the org actually using?
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

  // ── controls source ──────────────────────────────────────────────
  // Score = effectiveness percentage from /controls/effectiveness's
  // formula, weighting partial-effective at 0.5.
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

  // ── incidents source ────────────────────────────────────────────
  // Score = % of incidents in the last 12 months that reached 'closed'.
  // High closure rate = mature incident-management process.
  const [incidentStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      closed: sql<number>`count(*) filter (where ${incident.status} = 'closed')::int`,
    })
    .from(incident)
    .where(
      and(
        eq(incident.orgId, orgId),
        sql`${incident.detectedAt} >= ${cutoffDate}`,
      ),
    );
  const incidentsScore =
    (incidentStats?.total ?? 0) > 0
      ? Math.round(((incidentStats?.closed ?? 0) / incidentStats!.total) * 100)
      : 0;

  // ── audits source ────────────────────────────────────────────────
  // Score = % of audit findings in the last 12 months in 'remediated',
  // 'verified', or 'closed' (the "we fixed it" terminal states).
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

  // ── training source ─────────────────────────────────────────────
  // No mandatory-training-completion table yet — placeholder reads
  // user count as "data exists" but score=0 so it falls through the
  // below-threshold filter on small orgs. When the academy module
  // ships training-completion data this counter wires to that.
  const [trainingStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
    })
    .from(user);
  // Score deliberately 0 until training-completion data exists. The
  // two-stage filter excludes by below-threshold so this returns the
  // active-source list pre-rebalanced.

  // ── esg source ──────────────────────────────────────────────────
  // Score = % of org's defined ESG metrics that have at least one
  // measurement in the last 12 months. Tracks "are we actually
  // collecting the data we said we would?"
  const [esrsMetricCount] = await db
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
    (esrsMetricCount?.value ?? 0) > 0
      ? Math.round(
          ((esgWithMeasurement?.value ?? 0) / esrsMetricCount!.value) * 100,
        )
      : 0;

  return [
    {
      source: "controls",
      moduleEnabled: enabled("ics") || enabled("isms"),
      dataCount: controlsTested,
      score: controlsScore,
    },
    {
      source: "incidents",
      moduleEnabled: enabled("isms"),
      dataCount: incidentStats?.total ?? 0,
      score: incidentsScore,
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
      score: 0, // placeholder until completion data lands
    },
    {
      source: "esg",
      moduleEnabled: enabled("esg"),
      dataCount: esgWithMeasurement?.value ?? 0,
      score: esgScore,
    },
  ];
}

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  // No requireModule — maturity is a cross-cutting executive metric.
  // Every authenticated org member can read.
  void requireModule;

  const inputs = await loadMaturityInputs(ctx.orgId);
  const result = calculateMaturity(inputs);

  return Response.json({
    data: {
      asOf: new Date().toISOString(),
      scope: "org_wide",
      ...result,
    },
  });
});
