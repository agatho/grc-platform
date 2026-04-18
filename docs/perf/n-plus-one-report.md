# N+1-Query-Report

_Generated: 2026-04-18T00:35:40.952Z_

Static-Analyse findet Stellen, an denen ein Loop ueber ein Array iteriert und im Body einen DB-Call ausfuehrt. Das ist ein klassisches N+1-Muster.

**137 Kandidaten** in 76 Dateien.

Nicht jeder Treffer ist ein echter Bug: es gibt legitime Faelle wie Transaktions-Loops mit 1-5 Items oder Seed-Scripts. Jeden Hit einzeln reviewen.

## Empfohlene Fixes (Pattern)

| Muster | Fix |
|---|---|
| Loop + einzelne SELECTs per ID | `inArray(table.id, ids)` + Map<id, row> |
| Loop + einzelne INSERTs | `db.insert(table).values([...])` (bulk) |
| Loop mit await im Body | `Promise.all(items.map(async ...))` nur wenn DB-Pool >= N |
| Rekursive Baum-Abfrage | Rekursive CTE (`WITH RECURSIVE`) statt JS-Loop |

## Treffer

| Datei | Loop-Zeile | Call-Zeile | Snippet |
|---|---|---|---|
| `apps/web/src/app/api/v1/eam/dashboards/portfolio-optimization/route.ts` | 21 | 22 | `const result = await db.execute(sql`` |
| `apps/web/src/app/api/v1/eam/data-objects/route.ts` | 47 | 48 | `const parent = await db.select().from(eamDataObject)` |
| `apps/web/src/app/api/v1/eam/governance/bulk/route.ts` | 35 | 37 | `await db.update(architectureElement)` |
| `apps/web/src/app/api/v1/eam/governance/bulk/route.ts` | 35 | 42 | `await db.insert(eamGovernanceLog).values({` |
| `apps/web/src/app/api/v1/portal/dd/[token]/responses/route.ts` | 32 | 34 | `const question = await db.query.questionnaireQuestion.findFirst({` |
| `apps/web/src/app/api/v1/scim/v2/Groups/[id]/route.ts` | 94 | 113 | `await db.execute(sql`` |
| `apps/web/src/app/api/v1/scim/v2/Groups/[id]/route.ts` | 97 | 98 | `await db.execute(sql`` |
| `apps/web/src/app/api/v1/scim/v2/Groups/[id]/route.ts` | 105 | 106 | `await db.execute(sql`` |
| `apps/web/src/app/api/v1/scim/v2/Groups/route.ts` | 100 | 101 | `await db.execute(sql`` |
| `apps/web/src/app/api/v1/scim/v2/Users/[id]/route.ts` | 187 | 191 | `await db.execute(sql`` |
| `apps/web/src/app/api/v1/scim/v2/Users/[id]/route.ts` | 187 | 198 | `const [current] = await db.select({ name: user.name }).from(user).where(eq(user.id, id));` |
| `apps/web/src/app/api/v1/scim/v2/Users/[id]/route.ts` | 187 | 205 | `await db.execute(sql`` |
| `apps/web/src/app/api/v1/scim/v2/Users/[id]/route.ts` | 187 | 210 | `await db.execute(sql`` |
| `apps/web/src/app/api/v1/scim/v2/Users/[id]/route.ts` | 187 | 215 | `await db.execute(sql`` |
| `apps/web/src/app/api/v1/translations/heatmap/route.ts` | 49 | 55 | `const countResult = await db.execute(sql.raw(`` |
| `apps/web/src/app/api/v1/translations/heatmap/route.ts` | 64 | 66 | `const statusResult = await db.execute(sql`` |
| `apps/web/src/app/api/v1/translations/progress/route.ts` | 50 | 56 | `const countResult = await db.execute(sql.raw(`` |
| `apps/web/src/app/api/v1/translations/progress/route.ts` | 50 | 83 | `const statusCounts = await db.execute(sql`` |
| `apps/web/src/app/api/v1/translations/queue/route.ts` | 53 | 64 | `const entities = await db.execute(sql`` |
| `apps/worker/src/crons/architecture-health-snapshot.ts` | 18 | 68 | `await db.insert(architectureHealthSnapshot).values({` |
| `apps/worker/src/crons/benchmark-aggregator.ts` | 37 | 40 | `await db.insert(benchmarkPool).values({` |
| `apps/worker/src/crons/bi-report-scheduler.ts` | 50 | 53 | `await db.insert(biReportExecution).values({` |
| `apps/worker/src/crons/breach-72h-monitor.ts` | 46 | 70 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/calendar-digest.ts` | 62 | 64 | `await db.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, false)`);` |
| `apps/worker/src/crons/calendar-digest.ts` | 62 | 68 | `const weekEvents = await db.execute(sql`` |
| `apps/worker/src/crons/calendar-digest.ts` | 62 | 80 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/calendar-overdue-check.ts` | 31 | 35 | `await db.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, false)`);` |
| `apps/worker/src/crons/calendar-overdue-check.ts` | 31 | 38 | `const overdueDsrs = await db.execute(sql`` |
| `apps/worker/src/crons/calendar-overdue-check.ts` | 31 | 71 | `const overdueBreaches = await db.execute(sql`` |
| `apps/worker/src/crons/calendar-overdue-check.ts` | 31 | 106 | `const overdueFindings = await db.execute(sql`` |
| `apps/worker/src/crons/calendar-overdue-check.ts` | 46 | 50 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/calendar-overdue-check.ts` | 81 | 85 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/calendar-overdue-check.ts` | 116 | 120 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/cert-readiness-check.ts` | 23 | 38 | `await db.update(certReadinessAssessment)` |
| `apps/worker/src/crons/cert-readiness-snapshot.ts` | 43 | 165 | `await db.insert(certificationReadinessSnapshot).values({` |
| `apps/worker/src/crons/cloud-compliance-snapshot.ts` | 24 | 42 | `await db.insert(cloudComplianceSnapshot).values({` |
| `apps/worker/src/crons/community-license-check.ts` | 24 | 27 | `await db.update(communityEditionConfig).set({` |
| `apps/worker/src/crons/connector-health-monitor.ts` | 20 | 29 | `await db.insert(connectorHealthCheck).values({` |
| `apps/worker/src/crons/connector-health-monitor.ts` | 20 | 47 | `await db.insert(connectorHealthCheck).values({` |
| `apps/worker/src/crons/connector-schedule-runner.ts` | 55 | 62 | `await db.insert(connectorTestResult).values({` |
| `apps/worker/src/crons/consent-metrics-updater.ts` | 23 | 60 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/continuous-audit-runner.ts` | 38 | 54 | `const [result] = await db.insert(continuousAuditResult).values({` |
| `apps/worker/src/crons/continuous-audit-runner.ts` | 38 | 64 | `await db.insert(continuousAuditException).values(` |
| `apps/worker/src/crons/continuous-audit-runner.ts` | 38 | 81 | `await db.update(continuousAuditRule)` |
| `apps/worker/src/crons/continuous-audit-runner.ts` | 38 | 87 | `await db.insert(continuousAuditResult).values({` |
| `apps/worker/src/crons/contract-expiry-monitor.ts` | 41 | 58 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/contract-expiry-monitor.ts` | 41 | 82 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/contract-expiry-monitor.ts` | 125 | 129 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/control-test-scheduler.ts` | 27 | 41 | `await db.insert(controlTestExecution).values({` |
| `apps/worker/src/crons/copilot-rag-indexer.ts` | 20 | 24 | `const risks = await db.execute(` |
| `apps/worker/src/crons/cve-feed-sync.ts` | 172 | 232 | `const allAssetCpes = await db.select().from(assetCpe);` |
| `apps/worker/src/crons/dd-reminder.ts` | 49 | 73 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/deficiency-escalation.ts` | 36 | 38 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/dora-incident-deadline-monitor.ts` | 38 | 41 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/dsr-sla-monitor.ts` | 44 | 55 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/eam-rule-evaluator.ts` | 23 | 33 | `const results = await db.execute(sql`` |
| `apps/worker/src/crons/eam-rule-evaluator.ts` | 23 | 43 | `const results = await db.execute(sql`` |
| `apps/worker/src/crons/eam-rule-evaluator.ts` | 23 | 78 | `const resolved = await db.execute(sql`` |
| `apps/worker/src/crons/eam-rule-evaluator.ts` | 54 | 67 | `await db.insert(architectureRuleViolation).values({` |
| `apps/worker/src/crons/eam-suggestion-compute.ts` | 29 | 30 | `await db.insert(eamObjectSuggestion).values({` |
| `apps/worker/src/crons/eam-suggestion-compute.ts` | 51 | 52 | `await db.insert(eamObjectSuggestion).values({` |
| `apps/worker/src/crons/emerging-risk-review.ts` | 35 | 37 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/esg-collection-reminder.ts` | 37 | 39 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/esg-completeness-check.ts` | 91 | 94 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/esg-target-status.ts` | 38 | 115 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/fair-appetite-check.ts` | 42 | 68 | `const latestSims = await db.execute(sql`` |
| `apps/worker/src/crons/fair-appetite-check.ts` | 92 | 107 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/framework-coverage-snapshot.ts` | 24 | 52 | `await db.insert(frameworkCoverageSnapshot).values({` |
| `apps/worker/src/crons/horizon-scanner-fetch.ts` | 34 | 37 | `await db.update(horizonScanSource)` |
| `apps/worker/src/crons/horizon-scanner-fetch.ts` | 34 | 45 | `await db.update(horizonScanSource)` |
| `apps/worker/src/crons/invoice-generation.ts` | 29 | 42 | `await db.insert(billingInvoice).values({` |
| `apps/worker/src/crons/kpi-threshold-alert.ts` | 23 | 27 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/kri-overdue-alert.ts` | 97 | 98 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/marketplace-security-scanner.ts` | 22 | 25 | `await db.update(marketplaceSecurityScan).set({` |
| `apps/worker/src/crons/marketplace-security-scanner.ts` | 22 | 34 | `await db.update(marketplaceSecurityScan).set({` |
| `apps/worker/src/crons/marketplace-security-scanner.ts` | 22 | 50 | `await db.update(marketplaceSecurityScan).set({` |
| `apps/worker/src/crons/overdue-tasks.ts` | 68 | 97 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/overdue-tasks.ts` | 68 | 108 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/playbook-phase-escalation.ts` | 36 | 109 | `await db.insert(incidentTimelineEntry).values({` |
| `apps/worker/src/crons/playbook-phase-escalation.ts` | 36 | 130 | `await db.insert(incidentTimelineEntry).values({` |
| `apps/worker/src/crons/playbook-phase-escalation.ts` | 36 | 150 | `const escalationUser = await db.execute(sql`` |
| `apps/worker/src/crons/playbook-phase-escalation.ts` | 36 | 164 | `const recentNotification = await db.execute(sql`` |
| `apps/worker/src/crons/playbook-phase-escalation.ts` | 36 | 180 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/playbook-suggestion.ts` | 44 | 56 | `const existingSuggestion = await db.execute(sql`` |
| `apps/worker/src/crons/playbook-suggestion.ts` | 44 | 103 | `const adminUsers = await db.execute(sql`` |
| `apps/worker/src/crons/playbook-suggestion.ts` | 111 | 113 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/policy-overdue-escalation.ts` | 38 | 58 | `const overdueResult = await db.execute(sql`` |
| `apps/worker/src/crons/policy-overdue-escalation.ts` | 38 | 73 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/policy-overdue-escalation.ts` | 94 | 96 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/policy-reminder.ts` | 56 | 58 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/policy-version-check.ts` | 42 | 50 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/process-review-reminder.ts` | 63 | 85 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/process-review-reminder.ts` | 152 | 174 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/rcsa-overdue-check.ts` | 33 | 68 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/rcsa-reminder.ts` | 61 | 74 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/regulatory-digest-generator.ts` | 30 | 33 | `await db.insert(regulatoryDigest).values({` |
| `apps/worker/src/crons/regulatory-feed-fetcher.ts` | 115 | 128 | `await db.insert(regulatoryFeedItem).values({` |
| `apps/worker/src/crons/regulatory-relevance-scorer.ts` | 45 | 98 | `await db.insert(regulatoryRelevanceScore).values({` |
| `apps/worker/src/crons/replication-monitor.ts` | 24 | 28 | `await db.insert(sovereigntyAuditLog).values({` |
| `apps/worker/src/crons/replication-monitor.ts` | 24 | 52 | `await db.insert(sovereigntyAuditLog).values({` |
| `apps/worker/src/crons/resilience-score-snapshot.ts` | 24 | 38 | `const [biaResult] = await db.execute(sql`` |
| `apps/worker/src/crons/resilience-score-snapshot.ts` | 24 | 49 | `const [exResult] = await db.execute(sql`` |
| `apps/worker/src/crons/resilience-score-snapshot.ts` | 24 | 58 | `const [commResult] = await db.execute(sql`` |
| `apps/worker/src/crons/resilience-score-snapshot.ts` | 24 | 66 | `const [procResult] = await db.execute(sql`` |
| `apps/worker/src/crons/resilience-score-snapshot.ts` | 24 | 75 | `await db.insert(resilienceScoreSnapshot).values({` |
| `apps/worker/src/crons/retention-monitoring.ts` | 25 | 45 | `await db.insert(deletionRequest).values({` |
| `apps/worker/src/crons/retention-monitoring.ts` | 25 | 56 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/risk-appetite-check.ts` | 78 | 99 | `await db.insert(task).values({` |
| `apps/worker/src/crons/risk-appetite-check.ts` | 127 | 129 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/risk-review-reminder.ts` | 43 | 52 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/ropa-review-reminder.ts` | 42 | 51 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/scheduled-export.ts` | 43 | 50 | `await db.execute(` |
| `apps/worker/src/crons/scheduled-export.ts` | 43 | 82 | `await db.execute(` |
| `apps/worker/src/crons/scheduled-export.ts` | 57 | 59 | `const dataResult = await db.execute(` |
| `apps/worker/src/crons/scorecard-recomputer.ts` | 16 | 32 | `await db.update(vendorScorecard)` |
| `apps/worker/src/crons/simulation-runner.ts` | 20 | 28 | `await db.insert(simulationResult).values({` |
| `apps/worker/src/crons/simulation-runner.ts` | 20 | 40 | `await db.update(simulationRun).set({` |
| `apps/worker/src/crons/simulation-runner.ts` | 20 | 46 | `await db.update(simulationScenario).set({` |
| `apps/worker/src/crons/simulation-runner.ts` | 20 | 54 | `await db.update(simulationRun).set({` |
| `apps/worker/src/crons/sla-measurement-reminder.ts` | 38 | 47 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/sovereignty-compliance-checker.ts` | 20 | 35 | `const [region] = await db.execute(sql`` |
| `apps/worker/src/crons/sovereignty-compliance-checker.ts` | 20 | 47 | `await db.insert(sovereigntyAuditLog).values({` |
| `apps/worker/src/crons/sovereignty-compliance-checker.ts` | 20 | 57 | `await db.insert(sovereigntyAuditLog).values({` |
| `apps/worker/src/crons/sub-processor-review-deadline.ts` | 22 | 24 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/threat-feed-sync.ts` | 127 | 184 | `await db.insert(threatFeedItem).values(` |
| `apps/worker/src/crons/translation-staleness-check.ts` | 39 | 40 | `const result = await db.execute(sql.raw(`` |
| `apps/worker/src/crons/translation-staleness-check.ts` | 39 | 57 | `const countResult = await db.execute(sql.raw(`` |
| `apps/worker/src/crons/treatment-overdue-reminder.ts` | 48 | 60 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/var-calculation-runner.ts` | 25 | 34 | `const risks = await db.execute(sql`` |
| `apps/worker/src/crons/vendor-reassessment-monitor.ts` | 42 | 51 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/wb-deadline-monitor.ts` | 36 | 39 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/wb-deadline-monitor.ts` | 76 | 79 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/wb-deadline-monitor.ts` | 115 | 118 | `const admins = await db.execute(` |
| `apps/worker/src/crons/wb-deadline-monitor.ts` | 125 | 126 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/wb-deadline-monitor.ts` | 159 | 161 | `const admins = await db.execute(` |
| `apps/worker/src/crons/wb-deadline-monitor.ts` | 168 | 169 | `await db.insert(notification).values({` |
| `apps/worker/src/crons/wb-retaliation-check.ts` | 32 | 35 | `await db.insert(notification).values({` |