// Cron Job: CCI Monthly Aggregation (1st of month at 02:00)
// For each org: calculate CCI for previous month, store snapshot, detect trend

import {
  db,
  complianceCultureSnapshot,
  cciConfiguration,
  organization,
  workItem,
  policyAcknowledgment,
  policyDistribution,
  securityIncident,
  finding,
  rcsaCampaign,
  rcsaAssignment,
} from "@grc/db";
import { eq, and, sql, isNull, isNotNull, gte, lt, desc } from "drizzle-orm";
import {
  DEFAULT_CCI_WEIGHTS,
  buildCCIResult,
  getPeriodString,
  getPreviousPeriod,
  getPeriodRange,
  calcPercentageScore,
  calcIncidentResponseScore,
} from "@grc/shared";
import type { CCIFactorWeights, CCIRawMetrics, CCIRawMetricDetail } from "@grc/shared";

interface AggregationResult {
  orgsProcessed: number;
  snapshotsCreated: number;
  errors: number;
}

export async function processCCIMonthlyAggregation(): Promise<AggregationResult> {
  // Calculate for the previous month
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const period = getPeriodString(prevMonth);

  console.log(`[cron:cci-monthly] Starting CCI aggregation for period ${period}`);

  let orgsProcessed = 0;
  let snapshotsCreated = 0;
  let errors = 0;

  const orgs = await db
    .select({ id: organization.id })
    .from(organization)
    .where(isNull(organization.deletedAt));

  for (const org of orgs) {
    try {
      const result = await calculateAndStoreSnapshot(org.id, period);
      if (result) snapshotsCreated++;
      orgsProcessed++;
    } catch (err) {
      errors++;
      console.error(
        `[cron:cci-monthly] Error for org ${org.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[cron:cci-monthly] Done. Orgs: ${orgsProcessed}, Snapshots: ${snapshotsCreated}, Errors: ${errors}`,
  );

  return { orgsProcessed, snapshotsCreated, errors };
}

async function calculateAndStoreSnapshot(
  orgId: string,
  period: string,
): Promise<boolean> {
  const weights = await getOrgWeights(orgId);
  const previousScore = await getPreviousOverallScore(orgId, period);
  const { start, end } = getPeriodRange(period);

  // Collect all raw metrics
  const [taskData, policyData, trainingData, incidentData, findingData, rcsaData] =
    await Promise.all([
      collectTaskCompliance(orgId, start, end),
      collectPolicyAckRate(orgId, start, end),
      collectTrainingCompletion(orgId, start, end),
      collectIncidentResponse(orgId, start, end),
      collectFindingClosure(orgId, start, end),
      collectRCSAParticipation(orgId, start, end),
    ]);

  const rawMetrics: CCIRawMetrics = {
    task_compliance: taskData,
    policy_ack_rate: policyData,
    training_completion: trainingData,
    incident_response_time: incidentData.rawMetric,
    audit_finding_closure: findingData,
    self_assessment_participation: rcsaData,
  };

  const result = buildCCIResult(rawMetrics, weights, incidentData.avgHours, previousScore);

  // Store org-wide snapshot (orgEntityId = null)
  await db
    .insert(complianceCultureSnapshot)
    .values({
      orgId,
      orgEntityId: null,
      period,
      overallScore: String(result.overall),
      factorScores: result.factors,
      factorWeights: result.weights,
      rawMetrics: result.rawMetrics,
      trend: result.trend,
    })
    .onConflictDoNothing();

  return true;
}

async function getOrgWeights(orgId: string): Promise<CCIFactorWeights> {
  const [config] = await db
    .select({ factorWeights: cciConfiguration.factorWeights })
    .from(cciConfiguration)
    .where(eq(cciConfiguration.orgId, orgId))
    .limit(1);
  return (config?.factorWeights as CCIFactorWeights) ?? DEFAULT_CCI_WEIGHTS;
}

async function getPreviousOverallScore(
  orgId: string,
  period: string,
): Promise<number | null> {
  const prevPeriod = getPreviousPeriod(period);
  const [prev] = await db
    .select({ overallScore: complianceCultureSnapshot.overallScore })
    .from(complianceCultureSnapshot)
    .where(
      and(
        eq(complianceCultureSnapshot.orgId, orgId),
        isNull(complianceCultureSnapshot.orgEntityId),
        eq(complianceCultureSnapshot.period, prevPeriod),
      ),
    )
    .limit(1);
  return prev ? Number(prev.overallScore) : null;
}

async function collectTaskCompliance(
  orgId: string,
  start: Date,
  end: Date,
): Promise<CCIRawMetricDetail> {
  const [result] = await db
    .select({
      total: sql<number>`COUNT(*)::integer`,
      successful: sql<number>`COUNT(*) FILTER (WHERE ${workItem.completedAt} IS NOT NULL AND ${workItem.completedAt} <= ${workItem.dueDate})::integer`,
    })
    .from(workItem)
    .where(
      and(
        eq(workItem.orgId, orgId),
        isNull(workItem.deletedAt),
        gte(workItem.dueDate, start),
        lt(workItem.dueDate, end),
      ),
    );
  return { total: result?.total ?? 0, successful: result?.successful ?? 0 };
}

async function collectPolicyAckRate(
  orgId: string,
  start: Date,
  end: Date,
): Promise<CCIRawMetricDetail> {
  const [result] = await db
    .select({
      total: sql<number>`COUNT(*)::integer`,
      successful: sql<number>`COUNT(*) FILTER (WHERE ${policyAcknowledgment.status} = 'acknowledged')::integer`,
    })
    .from(policyAcknowledgment)
    .innerJoin(policyDistribution, eq(policyAcknowledgment.distributionId, policyDistribution.id))
    .where(
      and(
        eq(policyAcknowledgment.orgId, orgId),
        gte(policyDistribution.deadline, start),
        lt(policyDistribution.deadline, end),
      ),
    );
  return { total: result?.total ?? 0, successful: result?.successful ?? 0 };
}

async function collectTrainingCompletion(
  orgId: string,
  start: Date,
  end: Date,
): Promise<CCIRawMetricDetail> {
  const [result] = await db
    .select({
      total: sql<number>`COUNT(*)::integer`,
      successful: sql<number>`COUNT(*) FILTER (WHERE ${policyAcknowledgment.status} = 'acknowledged')::integer`,
    })
    .from(policyAcknowledgment)
    .innerJoin(policyDistribution, eq(policyAcknowledgment.distributionId, policyDistribution.id))
    .where(
      and(
        eq(policyAcknowledgment.orgId, orgId),
        eq(policyDistribution.isMandatory, true),
        gte(policyDistribution.deadline, start),
        lt(policyDistribution.deadline, end),
      ),
    );
  return { total: result?.total ?? 0, successful: result?.successful ?? 0 };
}

async function collectIncidentResponse(
  orgId: string,
  start: Date,
  end: Date,
): Promise<{ rawMetric: CCIRawMetricDetail; avgHours: number }> {
  const [result] = await db
    .select({
      total: sql<number>`COUNT(*)::integer`,
      responded: sql<number>`COUNT(*) FILTER (WHERE ${securityIncident.closedAt} IS NOT NULL)::integer`,
      avgHours: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${securityIncident.closedAt} - ${securityIncident.detectedAt})) / 3600) FILTER (WHERE ${securityIncident.closedAt} IS NOT NULL), 0)::numeric(10,2)`,
    })
    .from(securityIncident)
    .where(
      and(
        eq(securityIncident.orgId, orgId),
        isNull(securityIncident.deletedAt),
        gte(securityIncident.detectedAt, start),
        lt(securityIncident.detectedAt, end),
      ),
    );
  return {
    rawMetric: { total: result?.total ?? 0, successful: result?.responded ?? 0 },
    avgHours: Number(result?.avgHours ?? 0),
  };
}

async function collectFindingClosure(
  orgId: string,
  start: Date,
  end: Date,
): Promise<CCIRawMetricDetail> {
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];
  const [result] = await db
    .select({
      total: sql<number>`COUNT(*)::integer`,
      successful: sql<number>`COUNT(*) FILTER (WHERE ${finding.remediatedAt} IS NOT NULL AND ${finding.remediatedAt}::date <= ${finding.remediationDueDate}::date)::integer`,
    })
    .from(finding)
    .where(
      and(
        eq(finding.orgId, orgId),
        isNull(finding.deletedAt),
        sql`${finding.remediationDueDate}::date >= ${startStr}`,
        sql`${finding.remediationDueDate}::date < ${endStr}`,
      ),
    );
  return { total: result?.total ?? 0, successful: result?.successful ?? 0 };
}

async function collectRCSAParticipation(
  orgId: string,
  start: Date,
  end: Date,
): Promise<CCIRawMetricDetail> {
  const [result] = await db
    .select({
      total: sql<number>`COUNT(*)::integer`,
      successful: sql<number>`COUNT(*) FILTER (WHERE ${rcsaAssignment.status} = 'submitted')::integer`,
    })
    .from(rcsaAssignment)
    .innerJoin(rcsaCampaign, eq(rcsaAssignment.campaignId, rcsaCampaign.id))
    .where(
      and(
        eq(rcsaAssignment.orgId, orgId),
        gte(rcsaAssignment.deadline, start),
        lt(rcsaAssignment.deadline, end),
      ),
    );
  return { total: result?.total ?? 0, successful: result?.successful ?? 0 };
}
