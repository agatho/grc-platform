// job-registry.ts — the single list of every scheduled worker job.
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S10-02, S13-14]
//
// The audit's finding was blunt: "Keine der 128 Cron-Jobs wird irgendwo
// ausgelöst — es existiert kein Scheduler." The jobs were reachable only as
// HTTP endpoints, the `X-Cron-Secret` header they demand appeared nowhere
// else in the repository, no deploy script created a caller, and the
// `*Cron = "*/15 * * * *"` constants scattered through the job files were
// read by nobody. In production the worker logged "listening on :3001" and
// then did nothing — no GDPR Art. 33 deadline monitoring, no HinSchG
// acknowledgement reminders, no retention purge, no audit anchoring.
//
// This module is the fix's foundation: one array that carries, for every
// job, its name, its schedule and its handler. Three consumers read it:
//
//   * `scheduler.ts` — runs each job when its expression matches (S10-02);
//   * `index.ts`     — derives `POST /crons/<name>` for every entry, so an
//                      external scheduler stays possible and the 96
//                      copy-pasted endpoint blocks disappear;
//   * the tests      — assert that every job file is registered exactly
//                      once and that every schedule parses.
//
// Schedules are UTC and deliberately staggered: 128 jobs firing at 00:00
// would be a self-inflicted thundering herd against one Postgres. Night
// window (00–06) for maintenance and snapshots, business morning (06–09)
// for reminders and escalations, evening (20–23) for recomputes, and
// minute-level cadences only for the queue processors.
//
// [S10-27] Five job files export their own `…Cron = "*/15 * * * *"`
// constant. The audit noted that nobody read them — they suggested a
// schedule that did not exist. Those five entries now take their schedule
// FROM the constant, so the file and the registry cannot disagree.
//
// Two schedules are fixed by another work package and must not be moved
// without talking to it: `daily-audit-anchor` at 00:05 UTC and
// `audit-chain-verify` at 02:00 UTC (WP4 / ADR-011 rev.4, S03-10, S03-12).

import type { JobDefinition } from "./scheduler";

import { processAcademyOverdueCheck } from "../crons/academy-overdue-check";
import { processAgentScheduler } from "../crons/agent-scheduler";
import { processAiActIncidentDeadlineMonitor } from "../crons/ai-act-incident-deadline-monitor";
import { processAnalyticsCleanup } from "../crons/analytics-cleanup";
import { processAnomalyDetection } from "../crons/anomaly-detection-runner";
import { checkApiKeyExpiry } from "../crons/api-key-expiry-check";
import { processArchitectureHealthSnapshot } from "../crons/architecture-health-snapshot";
import { processAssuranceSnapshot } from "../crons/assurance-snapshot";
import { processAuditChainVerify } from "../crons/audit-chain-verify";
import { processAuditRemediationDeadlines } from "../crons/audit-remediation-deadline-monitor";
import { processBenchmarkAggregator } from "../crons/benchmark-aggregator";
import { processBiReportScheduler } from "../crons/bi-report-scheduler";
import { processBreach72hMonitor } from "../crons/breach-72h-monitor";
import { processBudgetForecast } from "../crons/budget-forecast";
import { processCalendarDigest } from "../crons/calendar-digest";
import { processCalendarOverdueCheck } from "../crons/calendar-overdue-check";
import { processCCIMonthlyAggregation } from "../crons/cci-monthly-aggregation";
import { processCertReadinessCheck } from "../crons/cert-readiness-check";
import { processCertReadinessSnapshot } from "../crons/cert-readiness-snapshot";
import { processCesRecompute } from "../crons/ces-recompute";
import {
  cloudComplianceSnapshotJob,
  cloudComplianceSnapshotCron,
} from "../crons/cloud-compliance-snapshot";
import { processCommunityLicenseCheck } from "../crons/community-license-check";
import {
  connectorHealthMonitor,
  connectorHealthMonitorCron,
} from "../crons/connector-health-monitor";
import {
  connectorScheduleRunner,
  connectorScheduleRunnerCron,
} from "../crons/connector-schedule-runner";
import { processConsentMetrics } from "../crons/consent-metrics-updater";
import { processContinuousAuditRunner } from "../crons/continuous-audit-runner";
import { processContractExpiryMonitor } from "../crons/contract-expiry-monitor";
import { processControlEmbeddingSync } from "../crons/control-embedding-sync";
import { processControlTestLearning } from "../crons/control-test-learning-updater";
import { processControlTestScheduler } from "../crons/control-test-scheduler";
import { processCopilotRagIndexer } from "../crons/copilot-rag-indexer";
import { processCveFeedSync } from "../crons/cve-feed-sync";
import { processDailyAuditAnchor } from "../crons/daily-audit-anchor";
import { processDashboardCleanup } from "../crons/dashboard-cleanup";
import { processDdExpiry } from "../crons/dd-expiry";
import { processDdReminder } from "../crons/dd-reminder";
import { processDeficiencyEscalation } from "../crons/deficiency-escalation";
import { processDocumentAutoExpire } from "../crons/document-auto-expire";
import { processDocumentRetentionPurge } from "../crons/document-retention-purge";
import { processDocumentReviewReminders } from "../crons/document-review-reminder";
import { processDoraIncidentDeadlineMonitor } from "../crons/dora-incident-deadline-monitor";
import { processDsrSlaMonitor } from "../crons/dsr-sla-monitor";
import { processEamAssessmentReminder } from "../crons/eam-assessment-reminder";
import { processEamLifecycleMonitor } from "../crons/eam-lifecycle-monitor";
import { processEamPortfolioHealthCheck } from "../crons/eam-portfolio-health-check";
import { processEamRuleEvaluator } from "../crons/eam-rule-evaluator";
import { processEamSuggestionCompute } from "../crons/eam-suggestion-compute";
import { processEamTranslationReminder } from "../crons/eam-translation-reminder";
import { processEmergingRiskReviews } from "../crons/emerging-risk-review";
import { processEsgCollectionReminder } from "../crons/esg-collection-reminder";
import { processEsgCompletenessCheck } from "../crons/esg-completeness-check";
import { processEsgEmissionAggregate } from "../crons/esg-emission-aggregate";
import { processEsgTargetStatus } from "../crons/esg-target-status";
import {
  evidenceFreshnessCheck,
  evidenceFreshnessCheckCron,
} from "../crons/evidence-freshness-check";
import { processEvidenceReviewJobs } from "../crons/evidence-review-processor";
import { processExecutiveKpiSnapshot } from "../crons/executive-kpi-snapshot";
import { processExternalShareExpiry } from "../crons/external-share-expiry";
import { processFairAppetiteCheck } from "../crons/fair-appetite-check";
import {
  frameworkCoverageSnapshotJob,
  frameworkCoverageSnapshotCron,
} from "../crons/framework-coverage-snapshot";
import { processHorizonScannerFetch } from "../crons/horizon-scanner-fetch";
import { processImportJobs } from "../crons/import-job-processor";
import { processInterfaceHealthCheck } from "../crons/interface-health-check";
import { generateInvoices } from "../crons/invoice-generation";
import { processIsmsCapOverdueMonitor } from "../crons/isms-cap-overdue-monitor";
import { processKpiThresholdAlert } from "../crons/kpi-threshold-alert";
import { processKriOverdueAlerts } from "../crons/kri-overdue-alert";
import { processMarketplaceSecurityScanner } from "../crons/marketplace-security-scanner";
import { processMaturityAutoCalculator } from "../crons/maturity-auto-calculator";
import { processMonthlyReportGenerator } from "../crons/monthly-report-generator";
import { processNis2DeadlineMonitor } from "../crons/nis2-deadline-monitor";
import { processNotificationDigest } from "../crons/notification-digest";
import { processOtsUpgrade } from "../crons/ots-upgrade";
import { processOverdueTasks } from "../crons/overdue-tasks";
import { processPlaybookPhaseEscalation } from "../crons/playbook-phase-escalation";
import { processPlaybookSuggestion } from "../crons/playbook-suggestion";
import { pluginHealthCheck } from "../crons/plugin-health-check";
import { processPolicyOverdueEscalation } from "../crons/policy-overdue-escalation";
import { processPolicyReminder } from "../crons/policy-reminder";
import { processPolicyVersionCheck } from "../crons/policy-version-check";
import { processPortalSessionExpiry } from "../crons/portal-session-expiry";
import { processPostureSnapshot } from "../crons/posture-snapshot";
import { processPredictiveRiskTrainer } from "../crons/predictive-risk-trainer";
import { processMiningConformance } from "../crons/process-mining-conformance";
import { processReviewReminders } from "../crons/process-review-reminder";
import { processProgrammeDeadlineMonitor } from "../crons/programme-deadline-monitor";
import { processProgrammeHealthRecompute } from "../crons/programme-health-recompute";
import { processProgrammeProgressSnapshot } from "../crons/programme-progress-snapshot";
import { processPushNotifications } from "../crons/push-notification-sender";
import { processQueryCacheWarmer } from "../crons/query-cache-warmer";
import { processRcsaOverdueCheck } from "../crons/rcsa-overdue-check";
import { processRcsaReminder } from "../crons/rcsa-reminder";
import { processRegulatoryDigest } from "../crons/regulatory-digest-generator";
import { processRegulatoryFeedFetcher } from "../crons/regulatory-feed-fetcher";
import { processRegulatoryRelevanceScorer } from "../crons/regulatory-relevance-scorer";
import { processRegulatorySources } from "../crons/regulatory-source-fetcher";
import { processReplicationMonitor } from "../crons/replication-monitor";
import { processReportScheduler } from "../crons/report-scheduler";
import { processResilienceScoreSnapshot } from "../crons/resilience-score-snapshot";
import { processRetentionMonitoring } from "../crons/retention-monitoring";
import { processRiskAcceptanceExpiry } from "../crons/risk-acceptance-expiry";
import { processRiskAppetiteCheck } from "../crons/risk-appetite-check";
import { processRiskPredictionWeekly } from "../crons/risk-prediction-weekly";
import { processRiskReviewReminders } from "../crons/risk-review-reminder";
import { processRoiCalculation } from "../crons/roi-calculation";
import { processRopaReviewReminders } from "../crons/ropa-review-reminder";
import { processScheduledExport } from "../crons/scheduled-export";
import { processScheduledNotifications } from "../crons/scheduled-notifications";
import { processScimSyncCleanup } from "../crons/scim-sync-cleanup";
import { processScimTokenAudit } from "../crons/scim-token-audit";
import { processScorecardRecomputer } from "../crons/scorecard-recomputer";
import { processSignatureDueReminders } from "../crons/signature-due-reminder";
import { processSimulationRunner } from "../crons/simulation-runner";
import { processSlaMeasurementReminder } from "../crons/sla-measurement-reminder";
import { processSoaProgrammeBackfill } from "../crons/soa-programme-backfill";
import { processSovereigntyComplianceChecker } from "../crons/sovereignty-compliance-checker";
import { processSubProcessorReviewDeadline } from "../crons/sub-processor-review-deadline";
import { processTechRadarMigrationAlerts } from "../crons/tech-radar-migration-alerts";
import { processThreatFeedSync } from "../crons/threat-feed-sync";
import { processTranslationStalenessCheck } from "../crons/translation-staleness-check";
import { processTreatmentOverdueReminders } from "../crons/treatment-overdue-reminder";
import { aggregateUsage } from "../crons/usage-aggregation";
import { processVarCalculationRunner } from "../crons/var-calculation-runner";
import { processVendorReassessmentMonitor } from "../crons/vendor-reassessment-monitor";
import { processWbDeadlineMonitor } from "../crons/wb-deadline-monitor";
import { processWbOmbudspersonExpiry } from "../crons/wb-ombudsperson-expiry";
import { processWbRetaliationCheck } from "../crons/wb-retaliation-check";
import { processWebhookDispatchJob } from "../crons/webhook-dispatch";
import { processWebhookRetryJob } from "../crons/webhook-retry";
import { processJobRunRetention } from "../crons/job-run-retention";
// [WP8 handover] Neue Retention-Jobs; Inhalt gehört WP8, Registrierung WP9.
import { processRetentionAccessLogs } from "../crons/retention-access-logs";
import { processRetentionWhistleblowing } from "../crons/retention-whistleblowing";

/**
 * Every scheduled job. Adding a file under `crons/` without adding it here
 * is caught by `apps/worker/tests/job-registry.test.ts`.
 */
export const JOB_REGISTRY: JobDefinition[] = [
  {
    name: "academy-overdue-check",
    schedule: "55 7 * * *",
    run: processAcademyOverdueCheck,
  },
  {
    name: "agent-scheduler",
    schedule: "*/5 * * * *",
    run: processAgentScheduler,
  },
  {
    name: "ai-act-incident-deadline-monitor",
    schedule: "32 * * * *",
    run: processAiActIncidentDeadlineMonitor,
  },
  {
    name: "analytics-cleanup",
    schedule: "15 4 * * *",
    run: processAnalyticsCleanup,
  },
  {
    name: "anomaly-detection-runner",
    schedule: "50 23 * * *",
    run: processAnomalyDetection,
  },
  {
    name: "api-key-expiry-check",
    schedule: "35 4 * * *",
    run: checkApiKeyExpiry,
  },
  {
    name: "architecture-health-snapshot",
    schedule: "30 22 * * *",
    run: processArchitectureHealthSnapshot,
  },
  {
    name: "assurance-snapshot",
    schedule: "0 22 * * *",
    run: processAssuranceSnapshot,
  },
  {
    name: "audit-chain-verify",
    schedule: "0 2 * * *",
    run: () => processAuditChainVerify(undefined),
  },
  {
    name: "audit-remediation-deadline-monitor",
    schedule: "0 7 * * *",
    run: processAuditRemediationDeadlines,
  },
  {
    name: "benchmark-aggregator",
    schedule: "0 4 * * 0",
    run: processBenchmarkAggregator,
  },
  {
    name: "bi-report-scheduler",
    schedule: "*/10 * * * *",
    run: processBiReportScheduler,
  },
  {
    name: "breach-72h-monitor",
    schedule: "7 * * * *",
    run: processBreach72hMonitor,
  },
  {
    name: "budget-forecast",
    schedule: "40 23 * * *",
    run: processBudgetForecast,
  },
  {
    name: "calendar-digest",
    schedule: "0 5 * * 1",
    run: processCalendarDigest,
  },
  {
    name: "calendar-overdue-check",
    schedule: "20 9 * * *",
    run: processCalendarOverdueCheck,
  },
  {
    name: "cci-monthly-aggregation",
    schedule: "0 2 1 * *",
    run: processCCIMonthlyAggregation,
  },
  {
    name: "cert-readiness-check",
    schedule: "25 22 * * *",
    run: processCertReadinessCheck,
  },
  {
    name: "cert-readiness-snapshot",
    schedule: "20 22 * * *",
    run: processCertReadinessSnapshot,
  },
  { name: "ces-recompute", schedule: "50 22 * * *", run: processCesRecompute },
  {
    name: "cloud-compliance-snapshot",
    schedule: cloudComplianceSnapshotCron,
    run: cloudComplianceSnapshotJob,
  },
  {
    name: "community-license-check",
    schedule: "35 23 * * *",
    run: processCommunityLicenseCheck,
  },
  {
    name: "connector-health-monitor",
    schedule: connectorHealthMonitorCron,
    run: connectorHealthMonitor,
  },
  {
    name: "connector-schedule-runner",
    schedule: connectorScheduleRunnerCron,
    run: connectorScheduleRunner,
  },
  {
    name: "consent-metrics-updater",
    schedule: "45 4 * * *",
    run: processConsentMetrics,
  },
  {
    name: "continuous-audit-runner",
    schedule: "30 5 * * *",
    run: processContinuousAuditRunner,
  },
  {
    name: "contract-expiry-monitor",
    schedule: "10 7 * * *",
    run: processContractExpiryMonitor,
  },
  {
    name: "control-embedding-sync",
    schedule: "0 20 * * *",
    run: processControlEmbeddingSync,
  },
  {
    name: "control-test-learning-updater",
    schedule: "55 23 * * *",
    run: processControlTestLearning,
  },
  {
    name: "control-test-scheduler",
    schedule: "5 8 * * *",
    run: processControlTestScheduler,
  },
  {
    name: "copilot-rag-indexer",
    schedule: "30 20 * * *",
    run: processCopilotRagIndexer,
  },
  { name: "cve-feed-sync", schedule: "0 */6 * * *", run: processCveFeedSync },
  {
    name: "daily-audit-anchor",
    schedule: "5 0 * * *",
    run: () => processDailyAuditAnchor(undefined),
  },
  {
    name: "dashboard-cleanup",
    schedule: "20 4 * * *",
    run: processDashboardCleanup,
  },
  { name: "dd-expiry", schedule: "35 7 * * *", run: processDdExpiry },
  { name: "dd-reminder", schedule: "30 7 * * *", run: processDdReminder },
  {
    name: "deficiency-escalation",
    schedule: "0 8 * * *",
    run: processDeficiencyEscalation,
  },
  {
    name: "document-auto-expire",
    schedule: "10 1 * * *",
    run: processDocumentAutoExpire,
  },
  {
    name: "document-retention-purge",
    schedule: "30 1 * * *",
    run: processDocumentRetentionPurge,
  },
  {
    name: "document-review-reminder",
    schedule: "25 6 * * *",
    run: processDocumentReviewReminders,
  },
  {
    name: "dora-incident-deadline-monitor",
    schedule: "22 * * * *",
    run: processDoraIncidentDeadlineMonitor,
  },
  {
    name: "dsr-sla-monitor",
    schedule: "12 * * * *",
    run: processDsrSlaMonitor,
  },
  {
    name: "eam-assessment-reminder",
    schedule: "30 8 * * *",
    run: processEamAssessmentReminder,
  },
  {
    name: "eam-lifecycle-monitor",
    schedule: "40 8 * * *",
    run: processEamLifecycleMonitor,
  },
  {
    name: "eam-portfolio-health-check",
    schedule: "35 22 * * *",
    run: processEamPortfolioHealthCheck,
  },
  {
    name: "eam-rule-evaluator",
    schedule: "45 8 * * *",
    run: processEamRuleEvaluator,
  },
  {
    name: "eam-suggestion-compute",
    schedule: "50 21 * * *",
    run: processEamSuggestionCompute,
  },
  {
    name: "eam-translation-reminder",
    schedule: "35 8 * * *",
    run: processEamTranslationReminder,
  },
  {
    name: "emerging-risk-review",
    schedule: "10 8 * * *",
    run: processEmergingRiskReviews,
  },
  {
    name: "esg-collection-reminder",
    schedule: "40 7 * * *",
    run: processEsgCollectionReminder,
  },
  {
    name: "esg-completeness-check",
    schedule: "45 7 * * *",
    run: processEsgCompletenessCheck,
  },
  {
    name: "esg-emission-aggregate",
    schedule: "5 23 * * *",
    run: processEsgEmissionAggregate,
  },
  {
    name: "esg-target-status",
    schedule: "50 7 * * *",
    run: processEsgTargetStatus,
  },
  {
    name: "evidence-freshness-check",
    schedule: evidenceFreshnessCheckCron,
    run: evidenceFreshnessCheck,
  },
  {
    name: "evidence-review-processor",
    schedule: "*/5 * * * *",
    run: processEvidenceReviewJobs,
  },
  {
    name: "executive-kpi-snapshot",
    schedule: "45 22 * * *",
    run: processExecutiveKpiSnapshot,
  },
  {
    name: "external-share-expiry",
    schedule: "*/15 * * * *",
    run: processExternalShareExpiry,
  },
  {
    name: "fair-appetite-check",
    schedule: "40 9 * * *",
    run: processFairAppetiteCheck,
  },
  {
    name: "framework-coverage-snapshot",
    schedule: frameworkCoverageSnapshotCron,
    run: frameworkCoverageSnapshotJob,
  },
  {
    name: "horizon-scanner-fetch",
    schedule: "40 */6 * * *",
    run: processHorizonScannerFetch,
  },
  {
    name: "import-job-processor",
    schedule: "*/5 * * * *",
    run: processImportJobs,
  },
  {
    name: "interface-health-check",
    schedule: "37 * * * *",
    run: processInterfaceHealthCheck,
  },
  { name: "invoice-generation", schedule: "0 6 1 * *", run: generateInvoices },
  {
    name: "isms-cap-overdue-monitor",
    schedule: "5 7 * * *",
    run: processIsmsCapOverdueMonitor,
  },
  {
    name: "kpi-threshold-alert",
    schedule: "55 8 * * *",
    run: processKpiThresholdAlert,
  },
  {
    name: "kri-overdue-alert",
    schedule: "10 6 * * *",
    run: processKriOverdueAlerts,
  },
  {
    name: "marketplace-security-scanner",
    schedule: "*/15 * * * *",
    run: processMarketplaceSecurityScanner,
  },
  {
    name: "maturity-auto-calculator",
    schedule: "20 23 * * *",
    run: processMaturityAutoCalculator,
  },
  {
    name: "monthly-report-generator",
    schedule: "30 2 1 * *",
    run: processMonthlyReportGenerator,
  },
  {
    name: "nis2-deadline-monitor",
    schedule: "27 * * * *",
    run: processNis2DeadlineMonitor,
  },
  {
    name: "notification-digest",
    schedule: "0 16 * * *",
    run: processNotificationDigest,
  },
  { name: "ots-upgrade", schedule: "20 2 * * *", run: processOtsUpgrade },
  { name: "overdue-tasks", schedule: "0 3 * * *", run: processOverdueTasks },
  {
    name: "playbook-phase-escalation",
    schedule: "0 9 * * *",
    run: processPlaybookPhaseEscalation,
  },
  {
    name: "playbook-suggestion",
    schedule: "10 9 * * *",
    run: processPlaybookSuggestion,
  },
  {
    name: "plugin-health-check",
    schedule: "47 * * * *",
    run: pluginHealthCheck,
  },
  {
    name: "policy-overdue-escalation",
    schedule: "40 6 * * *",
    run: processPolicyOverdueEscalation,
  },
  {
    name: "policy-reminder",
    schedule: "35 6 * * *",
    run: processPolicyReminder,
  },
  {
    name: "policy-version-check",
    schedule: "45 6 * * *",
    run: processPolicyVersionCheck,
  },
  {
    name: "portal-session-expiry",
    schedule: "*/15 * * * *",
    run: processPortalSessionExpiry,
  },
  {
    name: "posture-snapshot",
    schedule: "10 22 * * *",
    run: processPostureSnapshot,
  },
  {
    name: "predictive-risk-trainer",
    schedule: "*/30 * * * *",
    run: processPredictiveRiskTrainer,
  },
  {
    name: "process-mining-conformance",
    schedule: "45 23 * * *",
    run: processMiningConformance,
  },
  {
    name: "process-review-reminder",
    schedule: "20 6 * * *",
    run: processReviewReminders,
  },
  {
    name: "programme-deadline-monitor",
    schedule: "15 8 * * *",
    run: processProgrammeDeadlineMonitor,
  },
  {
    name: "programme-health-recompute",
    schedule: "0 23 * * *",
    run: processProgrammeHealthRecompute,
  },
  {
    name: "programme-progress-snapshot",
    schedule: "10 23 * * *",
    run: processProgrammeProgressSnapshot,
  },
  {
    name: "push-notification-sender",
    schedule: "*/5 * * * *",
    run: processPushNotifications,
  },
  {
    name: "query-cache-warmer",
    schedule: "52 * * * *",
    run: processQueryCacheWarmer,
  },
  {
    name: "rcsa-overdue-check",
    schedule: "55 6 * * *",
    run: processRcsaOverdueCheck,
  },
  { name: "rcsa-reminder", schedule: "50 6 * * *", run: processRcsaReminder },
  {
    name: "regulatory-digest-generator",
    schedule: "30 21 * * *",
    run: processRegulatoryDigest,
  },
  {
    name: "regulatory-feed-fetcher",
    schedule: "30 */6 * * *",
    run: processRegulatoryFeedFetcher,
  },
  {
    name: "regulatory-relevance-scorer",
    schedule: "0 21 * * *",
    run: processRegulatoryRelevanceScorer,
  },
  {
    name: "regulatory-source-fetcher",
    schedule: "10 */6 * * *",
    run: processRegulatorySources,
  },
  {
    name: "replication-monitor",
    schedule: "42 * * * *",
    run: processReplicationMonitor,
  },
  {
    name: "report-scheduler",
    schedule: "*/10 * * * *",
    run: processReportScheduler,
  },
  {
    name: "resilience-score-snapshot",
    schedule: "40 22 * * *",
    run: processResilienceScoreSnapshot,
  },
  {
    name: "retention-monitoring",
    schedule: "45 1 * * *",
    run: processRetentionMonitoring,
  },
  {
    name: "risk-acceptance-expiry",
    schedule: "0 5 * * *",
    run: processRiskAcceptanceExpiry,
  },
  {
    name: "risk-appetite-check",
    schedule: "30 9 * * *",
    run: processRiskAppetiteCheck,
  },
  {
    name: "risk-prediction-weekly",
    schedule: "30 3 * * 0",
    run: processRiskPredictionWeekly,
  },
  {
    name: "risk-review-reminder",
    schedule: "0 6 * * *",
    run: processRiskReviewReminders,
  },
  {
    name: "roi-calculation",
    schedule: "30 23 * * *",
    run: processRoiCalculation,
  },
  {
    name: "ropa-review-reminder",
    schedule: "15 6 * * *",
    run: processRopaReviewReminders,
  },
  {
    name: "scheduled-export",
    schedule: "*/15 * * * *",
    run: processScheduledExport,
  },
  {
    name: "scheduled-notifications",
    schedule: "*/5 * * * *",
    run: processScheduledNotifications,
  },
  {
    name: "scim-sync-cleanup",
    schedule: "25 4 * * *",
    run: processScimSyncCleanup,
  },
  {
    name: "scim-token-audit",
    schedule: "30 4 * * *",
    run: processScimTokenAudit,
  },
  {
    name: "scorecard-recomputer",
    schedule: "55 22 * * *",
    run: processScorecardRecomputer,
  },
  {
    name: "signature-due-reminder",
    schedule: "30 6 * * *",
    run: processSignatureDueReminders,
  },
  {
    name: "simulation-runner",
    schedule: "*/5 * * * *",
    run: processSimulationRunner,
  },
  {
    name: "sla-measurement-reminder",
    schedule: "25 7 * * *",
    run: processSlaMeasurementReminder,
  },
  {
    name: "soa-programme-backfill",
    schedule: "0 3 1 * *",
    run: processSoaProgrammeBackfill,
  },
  {
    name: "sovereignty-compliance-checker",
    schedule: "15 23 * * *",
    run: processSovereigntyComplianceChecker,
  },
  {
    name: "sub-processor-review-deadline",
    schedule: "20 7 * * *",
    run: processSubProcessorReviewDeadline,
  },
  {
    name: "tech-radar-migration-alerts",
    schedule: "25 23 * * *",
    run: processTechRadarMigrationAlerts,
  },
  {
    name: "threat-feed-sync",
    schedule: "20 */6 * * *",
    run: processThreatFeedSync,
  },
  {
    name: "translation-staleness-check",
    schedule: "50 8 * * *",
    run: processTranslationStalenessCheck,
  },
  {
    name: "treatment-overdue-reminder",
    schedule: "5 6 * * *",
    run: processTreatmentOverdueReminders,
  },
  { name: "usage-aggregation", schedule: "40 4 * * *", run: aggregateUsage },
  {
    name: "var-calculation-runner",
    schedule: "*/10 * * * *",
    run: processVarCalculationRunner,
  },
  {
    name: "vendor-reassessment-monitor",
    schedule: "15 7 * * *",
    run: processVendorReassessmentMonitor,
  },
  {
    name: "wb-deadline-monitor",
    schedule: "17 * * * *",
    run: processWbDeadlineMonitor,
  },
  {
    name: "wb-ombudsperson-expiry",
    schedule: "25 8 * * *",
    run: processWbOmbudspersonExpiry,
  },
  {
    name: "wb-retaliation-check",
    schedule: "20 8 * * *",
    run: processWbRetaliationCheck,
  },
  {
    name: "webhook-dispatch",
    schedule: "*/2 * * * *",
    run: processWebhookDispatchJob,
  },
  {
    name: "webhook-retry",
    schedule: "*/5 * * * *",
    run: processWebhookRetryJob,
  },
  {
    name: "job-run-retention",
    schedule: "0 4 * * *",
    run: processJobRunRetention,
  },
  // [WP8 · Datenschutz-Retention] Nachgemeldet in Welle 3. Nachts, versetzt
  // zu document-retention-purge (01:30), damit die Löschläufe nicht
  // gleichzeitig auf denselben Tabellen arbeiten.
  {
    name: "retention-access-logs",
    schedule: "0 2 * * *",
    run: processRetentionAccessLogs,
  },
  {
    name: "retention-whistleblowing",
    schedule: "40 2 * * *",
    run: processRetentionWhistleblowing,
  },
];

/**
 * Historic endpoint spellings. Twenty `/crons/*` paths used a different name
 * than their job file — six pluralised, fourteen shortened in the former
 * "batch registration" block at the end of index.ts. Keeping the aliases
 * means an operator's existing curl or an old runbook line does not silently
 * 404 after this refactor.
 */
export const JOB_PATH_ALIASES: Record<string, string> = {
  "audit-remediation-deadlines": "audit-remediation-deadline-monitor",
  "kri-overdue-alerts": "kri-overdue-alert",
  "process-review-reminders": "process-review-reminder",
  "risk-review-reminders": "risk-review-reminder",
  "ropa-review-reminders": "ropa-review-reminder",
  "treatment-overdue-reminders": "treatment-overdue-reminder",
  "anomaly-detection": "anomaly-detection-runner",
  "api-key-expiry": "api-key-expiry-check",
  "consent-metrics": "consent-metrics-updater",
  "control-test-learning": "control-test-learning-updater",
  "evidence-freshness": "evidence-freshness-check",
  "evidence-review": "evidence-review-processor",
  "framework-coverage": "framework-coverage-snapshot",
  "import-jobs": "import-job-processor",
  "plugin-health": "plugin-health-check",
  "push-notifications": "push-notification-sender",
  "regulatory-digest": "regulatory-digest-generator",
  "regulatory-sources": "regulatory-source-fetcher",
  "resilience-score": "resilience-score-snapshot",
  "translation-staleness": "translation-staleness-check",
};

export function findJob(name: string): JobDefinition | undefined {
  const canonical = JOB_PATH_ALIASES[name] ?? name;
  return JOB_REGISTRY.find((j) => j.name === canonical);
}
