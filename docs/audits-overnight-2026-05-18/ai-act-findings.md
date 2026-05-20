# EU AI Act Module — Alpha-Readiness Audit

**Date:** 2026-05-18  
**Module:** EU AI Act (Sprint 73+, Waves 11-22)  
**Scope:** 13 DB tables, 47 API routes, 7 state-machine files

## Executive Summary

The EU AI Act module is feature-complete but has 7 critical security gaps blocking production:

1. RLS policies incomplete on 7 newer tables
2. Audit triggers missing on all 13 AI Act tables
3. State-machine validators wired inconsistently
4. Missing role-based access control on incident classification
5. PDF streaming uses legacy buffer pattern
6. Concurrency hotspot in corrective-action status transitions
7. Missing AI call error handling

---

## Finding 1: RLS Policy Gaps on 7 Tables

**Severity:** HIGH  
**File:** packages/db/drizzle/0085_ai_act_full_compliance.sql:309-342

**Tables affected:**

- ai_gpai_model (Art. 51-56)
- ai_incident (Art. 62-63)
- ai_prohibited_screening (Art. 5)
- ai_provider_qms (Art. 16-17)
- ai_corrective_action (Art. 20-21)
- ai_authority_communication (Art. 73-78)
- ai_penalty (Art. 99)

**What's wrong:**

Migration 0085 creates RLS-enabled tables with only SELECT policies:

- SELECT: USING (org_id = current_setting('app.current_org_id'))
- INSERT: MISSING
- UPDATE: MISSING
- DELETE: MISSING

Migration 0315 adds full RLS to base tables but NOT these 7 newer tables.

**Risk:** Auth'd user from Org B can INSERT/UPDATE/DELETE Org A's incidents, penalties, corrective actions.

**Fix:** Add INSERT/UPDATE/DELETE WITH CHECK policies for all 7 tables to migration 0315.

---

## Finding 2: Audit Triggers Missing on All 13 AI Act Tables

**Severity:** HIGH  
**File:** packages/db/drizzle/0085_ai_act_complete.sql and related

**What's wrong:**

No CREATE TRIGGER audit_trigger statements for:

- ai_system, ai_conformity_assessment, ai_human_oversight_log, ai_transparency_entry
- ai_fria, ai_framework_mapping, ai_gpai_model, ai_incident
- ai_prohibited_screening, ai_provider_qms, ai_corrective_action
- ai_authority_communication, ai_penalty

**Risk:** No audit trail for regulatory changes. Cannot prove who modified incidents, penalties, FRIA approvals.

**Fix:** Create migration 0326 with 13 CREATE TRIGGER statements for audit_trigger on each table.

---

## Finding 3: State-Machine Validators Partially Wired

**Severity:** MEDIUM

**Fully wired:**

- classifyIncidentDeadline() to /incidents/classify-deadline
- canTransitionToProduction() to /systems/[id]/transition-stage
- validateHighRiskProductionGate() to /systems/[id]/transition-stage
- classifyAiSystem() to /systems/[id]/classify
- evaluateConformityChecklist() to /systems/[id]/conformity-checklist
- assessFriaQuality() to /frias/[id]/quality-check
- validateCeMarkingGate() to /systems/[id]/ce-marking-gate

**Missing wiring:**

- determineFriaRequirement() NOT imported/called anywhere
- assessQmsReadinessForCe() used in annual-report but NOT enforced in QMS routes

**Fix:**

1. Create /frias/[id]/requirement-check POST route
2. Add enforcement in /qms/[id] PATCH to block 'approved' status if not CE-ready

---

## Finding 4: Missing Role-Based Access Control on Incident Classification

**Severity:** MEDIUM  
**File:** apps/web/src/app/api/v1/ai-act/incidents/route.ts:57

**What's wrong:**

POST endpoint only enforces withAuth("admin", "risk_manager", "dpo") globally, but does NOT gate serious/critical classification:

```typescript
if (
  (parsed.data.is_serious || severity === "critical") &&
  ctx.role !== "admin" &&
  ctx.role !== "dpo"
) {
  return 403; // MISSING!
}
```

**Risk:** Any risk_manager can maliciously classify incident as serious, triggering Article 73 2-day authority deadline.

**Fix:** Add role check before accepting is_serious=true or severity='critical'.

---

## Finding 5: PDF Response Streaming — Potential Memory Bloat

**Severity:** MEDIUM  
**File:** apps/web/src/app/api/v1/ai-act/annual-report/[year]/pdf/route.ts:463

**What's wrong:**

renderHtmlToPdfResponse() may buffer entire PDF in memory instead of streaming.

**Risk:** 50MB+ annual report (14+ pages, 1000+ incidents) could OOM on Node.js.

**Fix:** Verify @/lib/pdf uses ReadableStream, not Buffer. Test with 5000 incidents.

---

## Finding 6: Concurrency Hotspot in Corrective Action Status Transitions

**Severity:** MEDIUM  
**File:** apps/web/src/app/api/v1/ai-act/corrective-actions/[id]/route.ts:74-105

**What's wrong:**

Status transition logic computed in JavaScript BEFORE UPDATE:

- User A: open -> completed
- User B: open -> verified (simultaneously)
- Both compute their SQL clauses
- Last-one-wins; state transition logic is lost

**Risk:** Concurrent status changes lose atomicity. Final state is only one transition, not both.

**Fix:** Move state-machine validation into database transaction. SELECT current status within transaction, validate transition, then UPDATE atomically.

---

## Finding 7: Missing AI Call Error Handling

**Severity:** LOW  
**File:** Future routes using aiComplete()

**What's wrong:**

No try/catch + 502 handling on aiComplete() calls (per PR #195 pattern).

**Risk:** AI service failures return 500 instead of 502, confusing API consumers.

**Fix:** Wrap aiComplete() in try/catch, return 502 + retry_after on failure.

---

## Summary Table

| ID  | Finding                    | File                                    | Severity | Status  |
| --- | -------------------------- | --------------------------------------- | -------- | ------- |
| 1   | RLS gaps on 7 tables       | 0085_ai_act_full_compliance.sql:309-342 | HIGH     | Unfixed |
| 2   | Audit triggers missing     | All 13 AI Act tables                    | HIGH     | Unfixed |
| 3   | Validators partially wired | packages/shared/state-machines/         | MEDIUM   | Partial |
| 4   | No role RBAC on incidents  | incidents/route.ts:57                   | MEDIUM   | Unfixed |
| 5   | PDF buffering pattern      | @/lib/pdf                               | MEDIUM   | Unknown |
| 6   | Concurrency in CA status   | corrective-actions/[id]/route.ts:74-105 | MEDIUM   | Unfixed |
| 7   | Missing AI error handling  | Future routes                           | LOW      | N/A     |

**Generated:** 2026-05-18  
**Action:** Complete findings 1-2 before alpha; 3-6 before beta.
