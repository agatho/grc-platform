# Alpha-Readiness Audit: Process Mining & Workflow Automation

Date: 2026-05-18
Scope: Process Mining (Sprint 47), Workflow Automation (Sprint 28)

## EXECUTIVE SUMMARY

Overall Risk Posture: MEDIUM-HIGH

9 critical/high-severity findings identified. DO NOT RELEASE to production alpha until CRITICAL and HIGH findings remediated.

## CRITICAL FINDINGS (5)

F-1: EVENT-LOG INGESTION DOS
File: apps/web/src/app/api/v1/processes/[id]/event-logs/route.ts:24
Issue: Zod cap is 5000 events/request, CLAUDE.md says "Bulk operations capped at 100"
Fix: Reduce to 100, add rate-limit (1000 events/min per org), add cumulative cap (1M/log)
Effort: 1h

F-2: PROCESS MINING QUERY UNBOUNDED
Files: apps/web/src/app/api/v1/processes/[id]/mining/*.ts, apps/worker/src/crons/process-mining-conformance.ts
Issue: No date-range/pagination on event aggregation. 100M+ events cause OOM
Fix: Add daysBack param (default 90), paginate cron (10 logs/run max), LIMIT 100000, set 5s timeout
Effort: 4h

F-3: WEBHOOK URL VALIDATION MISSING - SSRF RISK
File: packages/shared/src/schemas/event-bus.ts
Issue: Only z.string().url() check. Allows localhost, 169.254.169.254, file://, gopher://
Fix: Add allowlist validation (HTTPS only, block RFC1918 ranges, cloud metadata endpoints)
Effort: 2h

F-4: TRIGGER LOOP INFINITE RECURSION - NO PERSISTENT GUARD
File: packages/automation/src/rule-engine.ts:34-36
Issue: Only in-memory cache. Worker restart clears it. Rule mutating same entity it triggers = infinite loop
Example: "Risk status changed" trigger + "change status" action = loop
Fix: Add triggered_by_rule_id to event metadata, track chain depth (max 10), block re-firing within trace
Effort: 3h

F-5: WEBHOOK DISPATCHER HMAC SIGNATURES STUBBED
File: apps/worker/src/crons/automation-engine-init.ts:133-137
Issue: Webhook signing functions exist but dispatch is console.log stub. No HMAC computed. Never sent.
Fix: Implement full dispatch (fetch webhook, sign, POST with X-Arctos-Signature, log delivery, add retry cron)
Effort: 3h

## HIGH-SEVERITY FINDINGS (3)

F-6: ACTION EXECUTION SEQUENTIAL - NO ATOMICITY
File: packages/automation/src/action-executor.ts:187-200
Issue: Multiple actions execute sequentially with no transaction. Partial failure exposure.
Example: task created, email fails, status changed = inconsistent state
Fix: Wrap all actions in DB transaction, add failureMode (continue/rollback)
Effort: 2h

F-7: AUTOMATION RULE CREATION - PRIVILEGE ESCALATION
File: apps/web/src/app/api/v1/automation/rules/route.ts:10-39
Issue: No check that rule creator has permission for target role in escalate action
Risk: risk_manager creates rule escalating all risks to admin
Fix: Validate creator has target role or is admin, track creator_roles, test 403 for unauthorized escalation
Effort: 2h

F-8: RBAC INCONSISTENCY - MIXED ADMIN vs PROCESS_OWNER
Files: apps/web/src/app/api/v1/automation/rules/*
Issue: process_owner cannot create rules for their processes (admin-only). Breaks delegation model.
Fix: Create process-scoped rules, allow process_owner to manage rules for own process
Effort: 3h

## MEDIUM-SEVERITY FINDINGS (4)

F-9: PROCESS MINING CRON UNBOUNDED
File: apps/worker/src/crons/process-mining-conformance.ts:36-176
Issue: Fetches ALL imported logs at once. 1000 logs x 100k events = OOM/timeout/restart loop
Fix: Paginate (max 10 logs/run), add timeout guard (4min), requeue remaining
Effort: 2h

F-10: NO requireModule("automation") CHECK
Files: All /api/v1/automation/* routes
Issue: Missing module gate. Users access automation API even if module disabled.
Fix: Add requireModule("automation", orgId, method) to all routes
Effort: 1h

F-11: CSV PARSER NO TIMESTAMP VALIDATION
File: apps/web/src/app/api/v1/processes/[id]/event-logs/upload/route.ts:22-60
Issue: new Date(invalid) throws. No validation before conversion.
Fix: Validate timestamp format before conversion, reject if NaN
Effort: 1h

F-12: MINING SUGGESTION STATUS NOT ENFORCED
File: packages/db/src/schema/bpm-advanced.ts:115-132
Issue: No state machine. Suggestions can transition pending -> dismissed -> pending (wrong)
Fix: Add processMiningSuggestionGates library, validate transitions in API
Effort: 1h

F-13: NO INTEGRATION TESTS FOR RULE EXECUTION
Issue: Missing end-to-end test: rule fires -> actions execute -> logs recorded
Effort: 2h

## SUMMARY

Total Critical: 5 (13 hours)
Total High: 3 (7 hours)
Total Medium/Low: 5 (7 hours)
TOTAL EFFORT: 27 engineer-hours

## RECOMMENDATION

DO NOT RELEASE to production alpha until CRITICAL and HIGH findings remediated.

Estimated Timeline: 3 days (1 engineer @ 8h/day)

Critical fixes must include:
- F-1: Event array cap
- F-2: Mining date-range + pagination
- F-3: Webhook URL allowlist
- F-4: Trigger loop guard
- F-5: Webhook dispatch implementation

High fixes must include:
- F-6: Action transaction wrapper
- F-7: Rule escalation privilege check
- F-8: RBAC scope consistency

Audit Completed: 2026-05-18
Auditor: Claude AI Audit Agent
Confidence: High (direct code inspection + schema analysis)

