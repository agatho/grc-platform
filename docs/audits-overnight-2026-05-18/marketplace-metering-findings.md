# Alpha-Readiness Audit: Marketplace + Plugin Architecture & SaaS Metering
Date: 2026-05-18  
Scope: Sprints 58, 82, 61  
Auditor: Claude Code  

## Executive Summary

Alpha-readiness audit of Marketplace + Plugin Architecture and SaaS Metering found MEDIUM RISK overall. Platform is NOT ALPHA-READY for production SaaS deployment without addressing 4 HIGH-severity findings related to plugin sandboxing, permission enforcement, usage event idempotency, and billing webhook security.

---

## FINDINGS

### 1. CRITICAL: Plugin Code Execution Not Sandboxed
**Severity:** HIGH  
**File:** extension.ts (lines 36-39)  

The plugin schema declares executionMode (wasm, isolated, native) but no execution engine validates or enforces the declared mode. No code fetches, verifies, or sandboxes plugins. Entry point field allows arbitrary strings with no shell metacharacter validation.

**Fix:** Implement plugin execution engine with WASM/VM sandboxing, HTTPS validation for entry points, SHA-256 verification, and restricted host imports.

---

### 2. HIGH: Plugin Permissions Not Enforced at Execution Time
**Severity:** HIGH  
**File:** extension.ts (lines 34, 40-41)  

Plugins declare permissions but no middleware enforces them. No permission gate at install. No runtime check before hook execution. A plugin with read-only permission could access write APIs.

**Fix:** Implement permission-gating middleware. Check plugin permissions before hook invocation. Validate config against configSchema at install time. Add permissionGrantedAt timestamp.

---

### 3. MEDIUM: Plugin Manifest Validation Missing
**Severity:** MEDIUM  
**File:** extension.ts (lines 6-38)  

Entry point accepts any string (max 500 chars) with no shell metacharacter validation. Permissions array has no namespace format validation. No plugin signature verification.

**Fix:** Add regex validation for entryPoint (HTTPS URL only). Validate permissions format (namespace:action). Implement Ed25519 signing for marketplace plugins.

---

### 4. CRITICAL: No Idempotency Key for Usage Events
**Severity:** HIGH  
**File:** usage/route.ts (lines 6-46)  

POST /api/v1/usage endpoint records events without idempotency. No idempotencyKey parameter. No deduplication table. Retry vulnerability: duplicate events recorded twice = double-billing risk.

Scenario: Client POSTs 100 calls → network timeout → retries → billed for 200 calls instead of 100.

**Fix:** Add idempotencyKey to recordUsageSchema. Create usage_event_idempotency table. Check for duplicates before insert. Set Cache-Control header for safe replay.

---

### 5. MEDIUM: Usage Query Unbounded
**Severity:** MEDIUM  
**File:** usage/route.ts (lines 49-96)  

GET /api/v1/usage endpoint has no aggregation or materialized views. 1-year query on 1000-user tenant = 365,000 rows. No date range enforcement (attacker could trigger full table scan). DoS/performance risk.

**Fix:** Enforce max 90-day date range per query. Create daily rollup materialized views. Add rate limiting (100 req/min per API key).

---

### 6. CRITICAL: No Webhook Signature Verification for Billing
**Severity:** HIGH  
**File:** /billing/ (missing implementation)  

No webhook endpoint for billing events (Stripe, Adyen). If webhooks added later without signature verification, attackers can forge payloads to manipulate billing.

**Fix:** Create /api/v1/billing/webhooks endpoint with signature verification. Implement idempotent processing. Log all webhook events.

---

### 7. MEDIUM: Marketplace Listings Cross-Publisher Risk
**Severity:** MEDIUM  
**File:** marketplace/listings/route.ts (lines 72-90)  

No publisher ownership validation. Admin of Org A could create listing under Publisher B (Org C) if they know the UUID. No marketplace approval workflow.

**Fix:** Add publisher ownership check. Require platform admin approval before published. Enforce security scan before publishing.

---

### 8. LOW: Metering Metadata Could Leak Sensitive Data
**Severity:** LOW  
**File:** saas-metering.ts (line 56)  

recordUsageSchema accepts arbitrary metadata with no PII validation. Developers could accidentally record emails, SSNs, or content.

**Fix:** Document metadata sanitization requirements. Implement PII scrubber. Quarterly audit for leaks.

---

### 9. MEDIUM: Missing Module Gate on Plugin Routes
**Severity:** MEDIUM  
**File:** plugins/installations/route.ts (lines 8)  

No requireModule check. No module_config enforcement. Hook bindings not validated for existence.

**Fix:** Add module gate. Create plugin_manager role. Validate hook bindings exist.

---

### 10. MEDIUM: Subscription Unique Index Too Strict
**Severity:** MEDIUM  
**File:** saas-metering.ts (line 100)  

Unique index allows only one org_subscription row per org with no status filter. Breaks upgrade/downgrade flow.

**Fix:** Make index conditional: WHERE status IN ('active', 'trialing').

---

### 11. LOW: Plugin Execution Log Not Used
**Severity:** LOW  
**File:** extension.ts (lines 126-154)  

pluginExecutionLog table defined but never populated. No code writes execution metrics.

**Fix:** Populate log once execution engine implemented.

---

### 12. MEDIUM: Installation Status Not Validated
**Severity:** MEDIUM  
**File:** marketplace.ts  

No status enum. No transition validation. Invalid status values accepted.

**Fix:** Add PostgreSQL enum for status. Implement state machine validation.

---

## SUMMARY

| ID | Finding | Severity | Category | Status |
|----|---------|----------|----------|--------|
| 1 | Plugin not sandboxed | HIGH | Security | BLOCKING |
| 2 | Plugin permissions not enforced | HIGH | AuthZ | BLOCKING |
| 3 | Manifest validation missing | MEDIUM | Security | High Priority |
| 4 | No idempotency key | HIGH | Data Integrity | BLOCKING |
| 5 | Query unbounded | MEDIUM | Performance | High Priority |
| 6 | No webhook verification | HIGH | Security | BLOCKING |
| 7 | Cross-publisher risk | MEDIUM | AuthZ | High Priority |
| 8 | Metadata PII leak | LOW | Compliance | Medium Priority |
| 9 | No module gate | MEDIUM | AuthZ | High Priority |
| 10 | Index too strict | MEDIUM | Data Model | High Priority |
| 11 | Execution log unused | LOW | Code Quality | Low Priority |
| 12 | Status not validated | MEDIUM | Data Integrity | High Priority |

---

## RECOMMENDATION

**NOT ALPHA-READY for production SaaS.**

Must-fix (blocking): Findings 1, 2, 4, 6.  
Should-fix (high priority): Findings 3, 5, 7, 9, 10, 12.  
Nice-to-have (low priority): Findings 8, 11.

Estimated effort: 3-4 sprints (6-8 weeks) for critical path.

Recommend postponing SaaS billing launch until all HIGH-severity findings resolved and end-to-end integration tests pass.
