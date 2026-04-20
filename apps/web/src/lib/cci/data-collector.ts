// Sprint 27: CCI Data Collector — Queries existing tables for CCI factor data
// Each factor queries EXISTING tables (NO new data collection)

import {
  db,
  workItem,
  policyAcknowledgment,
  policyDistribution,
  securityIncident,
  finding,
  rcsaCampaign,
  rcsaAssignment,
  cciConfiguration,
  complianceCultureSnapshot,
} from "@grc/db";
import { eq, and, sql, isNull, gte, lt, desc } from "drizzle-orm";
import type {
  CCIFactorWeights,
  CCIRawMetrics,
  CCIRawMetricDetail,
} from "@grc/shared";
import {
  DEFAULT_CCI_WEIGHTS,
  getPeriodRange,
  buildCCIResult,
  getPreviousPeriod,
} from "@grc/shared";
import type { CCICalculationResult } from "@grc/shared";

/**
 * Get the CCI weights for an organization, falling back to defaults.
 */
export async function getOrgWeights(orgId: string): Promise<CCIFactorWeights> {
  const [config] = await db
    .select({ factorWeights: cciConfiguration.factorWeights })
    .from(cciConfiguration)
    .where(eq(cciConfiguration.orgId, orgId))
    .limit(1);

  if (!config?.factorWeights) return DEFAULT_CCI_WEIGHTS;
  return config.factorWeights as CCIFactorWeights;
}

/**
 * Task Compliance: % of work_items due in period where completed_at <= due_date
 */
export async function calcTaskCompliance(
  orgId: string,
  period: string,
  orgEntityId?: string,
): Promise<CCIRawMetricDetail> {
  const { start, end } = getPeriodRange(period);

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

  return {
    total: result?.total ?? 0,
    successful: result?.successful ?? 0,
  };
}

/**
 * Policy Acknowledgment Rate: % of acknowledgments done before deadline
 */
export async function calcPolicyAckRate(
  orgId: string,
  period: string,
  orgEntityId?: string,
): Promise<CCIRawMetricDetail> {
  const { start, end } = getPeriodRange(period);

  const [result] = await db
    .select({
      total: sql<number>`COUNT(*)::integer`,
      successful: sql<number>`COUNT(*) FILTER (WHERE ${policyAcknowledgment.acknowledgedAt} IS NOT NULL AND ${policyAcknowledgment.status} = 'acknowledged')::integer`,
    })
    .from(policyAcknowledgment)
    .innerJoin(
      policyDistribution,
      eq(policyAcknowledgment.distributionId, policyDistribution.id),
    )
    .where(
      and(
        eq(policyAcknowledgment.orgId, orgId),
        gte(policyDistribution.deadline, start),
        lt(policyDistribution.deadline, end),
      ),
    );

  return {
    total: result?.total ?? 0,
    successful: result?.successful ?? 0,
  };
}

/**
 * Training Completion: Uses policy acknowledgments marked as mandatory training.
 * Since there is no dedicated training table, we use mandatory policy distributions.
 */
export async function calcTrainingCompletion(
  orgId: string,
  period: string,
  orgEntityId?: string,
): Promise<CCIRawMetricDetail> {
  const { start, end } = getPeriodRange(period);

  const [result] = await db
    .select({
      total: sql<number>`COUNT(*)::integer`,
      successful: sql<number>`COUNT(*) FILTER (WHERE ${policyAcknowledgment.status} = 'acknowledged')::integer`,
    })
    .from(policyAcknowledgment)
    .innerJoin(
      policyDistribution,
      eq(policyAcknowledgment.distributionId, policyDistribution.id),
    )
    .where(
      and(
        eq(policyAcknowledgment.orgId, orgId),
        eq(policyDistribution.isMandatory, true),
        gte(policyDistribution.deadline, start),
        lt(policyDistribution.deadline, end),
      ),
    );

  return {
    total: result?.total ?? 0,
    successful: result?.successful ?? 0,
  };
}

/**
 * Incident Response Time: average hours between detected_at and closed_at.
 * Returns raw metric + the actual avg hours for score calculation.
 */
export async function calcIncidentResponseData(
  orgId: string,
  period: string,
  orgEntityId?: string,
): Promise<{ rawMetric: CCIRawMetricDetail; avgHours: number }> {
  const { start, end } = getPeriodRange(period);

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
    rawMetric: {
      total: result?.total ?? 0,
      successful: result?.responded ?? 0,
    },
    avgHours: Number(result?.avgHours ?? 0),
  };
}

/**
 * Audit Finding Closure Rate: % of findings resolved within target date
 */
export async function calcFindingClosureRate(
  orgId: string,
  period: string,
  orgEntityId?: string,
): Promise<CCIRawMetricDetail> {
  const { start, end } = getPeriodRange(period);

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
        sql`${finding.remediationDueDate}::date >= ${start.toISOString().split("T")[0]}`,
        sql`${finding.remediationDueDate}::date < ${end.toISOString().split("T")[0]}`,
      ),
    );

  return {
    total: result?.total ?? 0,
    successful: result?.successful ?? 0,
  };
}

/**
 * RCSA Self-Assessment Participation: % of completed RCSA assignments
 */
export async function calcRCSAParticipation(
  orgId: string,
  period: string,
  orgEntityId?: string,
): Promise<CCIRawMetricDetail> {
  const { start, end } = getPeriodRange(period);

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

  return {
    total: result?.total ?? 0,
    successful: result?.successful ?? 0,
  };
}

/**
 * Get the previous period's overall score for trend detection.
 */
export async function getPreviousScore(
  orgId: string,
  period: string,
  orgEntityId?: string,
): Promise<number | null> {
  const previousPeriod = getPreviousPeriod(period);

  const conditions = [
    eq(complianceCultureSnapshot.orgId, orgId),
    eq(complianceCultureSnapshot.period, previousPeriod),
  ];
  if (orgEntityId) {
    conditions.push(eq(complianceCultureSnapshot.orgEntityId, orgEntityId));
  } else {
    conditions.push(isNull(complianceCultureSnapshot.orgEntityId));
  }

  const [prev] = await db
    .select({ overallScore: complianceCultureSnapshot.overallScore })
    .from(complianceCultureSnapshot)
    .where(and(...conditions))
    .limit(1);

  return prev ? Number(prev.overallScore) : null;
}

/**
 * Full CCI calculation for an org (and optionally a department).
 */
export async function calculateCCIForOrg(
  orgId: string,
  period: string,
  orgEntityId?: string,
): Promise<CCICalculationResult> {
  const weights = await getOrgWeights(orgId);
  const previousScore = await getPreviousScore(orgId, period, orgEntityId);

  const [
    taskCompliance,
    policyAckRate,
    trainingCompletion,
    incidentData,
    findingClosure,
    rcsaParticipation,
  ] = await Promise.all([
    calcTaskCompliance(orgId, period, orgEntityId),
    calcPolicyAckRate(orgId, period, orgEntityId),
    calcTrainingCompletion(orgId, period, orgEntityId),
    calcIncidentResponseData(orgId, period, orgEntityId),
    calcFindingClosureRate(orgId, period, orgEntityId),
    calcRCSAParticipation(orgId, period, orgEntityId),
  ]);

  const rawMetrics: CCIRawMetrics = {
    task_compliance: taskCompliance,
    policy_ack_rate: policyAckRate,
    training_completion: trainingCompletion,
    incident_response_time: incidentData.rawMetric,
    audit_finding_closure: findingClosure,
    self_assessment_participation: rcsaParticipation,
  };

  return buildCCIResult(
    rawMetrics,
    weights,
    incidentData.avgHours,
    previousScore,
  );
}
