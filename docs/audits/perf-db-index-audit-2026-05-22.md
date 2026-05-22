# Performance Audit — Missing Indexes & N+1 Query Patterns

**Date:** 2026-05-22
**Scope:** post-Wave-25 main; 108 Drizzle schemas, 347 migrations, ~1,700 API routes
**Method:** static analysis via Grep + Read; spot-checked ~40 routes across erm/, ics/, isms/, dpms/, bcms/, tprm/, audit-mgmt/, esg/
**Read-only:** no DB queries executed; findings inferred from schema + route source.

Out of scope: migrations 0300+ (Wave 23+ — already well-indexed), historical perf issues that predate the Hetzner load profile, and best-practice hygiene that doesn't change query plans (e.g. covering indexes for read-mostly admin endpoints).

---

## TL;DR — Top 5 HIGH-severity findings

1. **`risk(catalog_source, catalog_entry_id)`** — N+1 lookup in `cross/risk-sync` for upsert dedup.
2. **`ics/ces/recompute`** — N+1 fan-out: 3 sequential queries + 1 upsert per control.
3. **`erm/residual/recompute`** — N+1 fan-out: join + UPDATE per risk in a loop.
4. **`portal/dd/[token]/responses`** — N+1 insert/upsert + per-question `findFirst` in the supplier portal hot path.
5. **`vendor_due_diligence` is missing `org_id` index** — every TPRM list query falls back to vendor-scoped fan-out.

---

## Findings

### F-01 [HIGH] `risk` lacks `(catalog_source, catalog_entry_id)` composite — N+1 dedup in `cross/risk-sync`

**File:** `apps/web/src/app/api/v1/cross/risk-sync/route.ts:138-188`
**Query pattern:**

```ts
.where(and(
  eq(risk.orgId, ctx.orgId),
  eq(risk.catalogSource, draft.catalogSource),
  eq(risk.catalogEntryId, draft.catalogEntryId),
))
```

The endpoint runs this `SELECT id` inside `for (const draft of batch.drafts)`, then `UPDATE` or `INSERT`. Each iteration is a full transaction round-trip. `batch.drafts` can be hundreds of rows when reconciling DPIA + FRIA + AI-incident sources against the central register.

**Why slow:** `risk` schema (`packages/db/src/schema/risk.ts:199-207`) declares only `(orgId, status)`, `ownerId`, `riskScoreResidual`, and `(orgId, riskAppetiteExceeded)`. `catalogSource` + `catalogEntryId` have no index. With `orgId`-filtered scans + filter on two NULLable cols, planner falls back to seq-scan after the `orgId` selectivity is exhausted.

**Fix:**

```sql
CREATE INDEX CONCURRENTLY risk_catalog_link_idx
  ON risk (org_id, catalog_source, catalog_entry_id)
  WHERE catalog_entry_id IS NOT NULL;
```

This is also the natural unique-key for the upsert; a partial unique index would let us replace the loop with a single `INSERT ... ON CONFLICT (org_id, catalog_source, catalog_entry_id) DO UPDATE`.

---

### F-02 [HIGH] `ics/ces/recompute` — 4 sequential queries per control

**File:** `apps/web/src/app/api/v1/ics/ces/recompute/route.ts:46-148`
**Query pattern:** For each `ctrl` in `controls`:

1. `SELECT controlTest WHERE controlId = ? AND orgId = ? ORDER BY testDate DESC LIMIT 4`
2. `SELECT finding WHERE controlId = ? AND orgId = ? AND deletedAt IS NULL AND status NOT IN ('closed','verified')`
3. `SELECT controlEffectivenessScore WHERE controlId = ? AND orgId = ?`
4. `INSERT INTO controlEffectivenessScore ... ON CONFLICT DO UPDATE`

**Why slow:** Each control round-trips 4× to Postgres. With ~500 controls per mid-size org → 2,000 queries on every "recompute". Indexes on `controlTest.controlId`, `finding.controlId` exist so each query is fast individually, but round-trip latency dominates.

**Fix (refactor sketch):** Pre-fetch in 3 batched queries using `inArray(controlTest.controlId, controlIds)` + `GROUP BY controlId`, build in-memory maps, then bulk-upsert all CES rows via a single `INSERT ... VALUES (...), (...) ON CONFLICT`. No new index needed; just batch.

---

### F-03 [HIGH] `erm/residual/recompute` — N+1 join + UPDATE per risk

**File:** `apps/web/src/app/api/v1/erm/residual/recompute/route.ts:23-56`
**Query pattern:** For each `r` in `risks`:

```ts
.from(riskControl)
.innerJoin(controlEffectivenessScore, ...)
.where(and(eq(riskControl.riskId, r.id), eq(riskControl.orgId, ctx.orgId)))
// then: db.update(risk).set({ riskScoreResidual }).where(eq(risk.id, r.id))
```

**Why slow:** Same shape as F-02 — full org risk register, two queries each. ~500 risks × 2 = 1,000 round-trips per call.

**Fix:** Single SQL aggregate:

```sql
WITH ces_avg AS (
  SELECT rc.risk_id, AVG(ces.score) AS avg_ces, COUNT(*) AS ces_count
  FROM risk_control rc
  JOIN control_effectiveness_score ces
    ON ces.control_id = rc.control_id AND ces.org_id = rc.org_id
  WHERE rc.org_id = $1
  GROUP BY rc.risk_id
)
UPDATE risk r
  SET risk_score_residual = ROUND(r.risk_score_inherent * (1 - LEAST(ca.avg_ces/100.0, 1.0))),
      updated_at = now(),
      updated_by = $2
FROM ces_avg ca
WHERE ca.risk_id = r.id AND r.org_id = $1 AND r.deleted_at IS NULL AND ca.ces_count > 0;
```

No new index needed (`riskControl.riskId`, `controlEffectivenessScore.controlId` already covered).

---

### F-04 [HIGH] `portal/dd/[token]/responses` — N+1 in supplier portal write path

**File:** `apps/web/src/app/api/v1/portal/dd/[token]/responses/route.ts:32-90`
**Query pattern:**

```ts
for (const resp of body.data.responses) {
  const question = await db.query.questionnaireQuestion.findFirst({ where: eq(...) });
  // ... score computation ...
  await db.insert(ddResponse).values({...}).onConflictDoUpdate({...});
}
```

**Why slow:** A typical supplier questionnaire is 50–200 questions; saving a full response set issues 100–400 queries serially on a public-portal endpoint. This is auto-save — runs every few seconds while the supplier is typing.

**Fix:** Pre-fetch all questions for the session's template in one query keyed by `inArray(questionnaireQuestion.id, questionIds)` (or join via section→template), compute scores in-memory, then `INSERT ... ON CONFLICT DO UPDATE` with multi-row VALUES (one statement). `dd_response` already has the right unique index (`ddr_session_question_idx`, `supplier-portal.ts:227`).

---

### F-05 [HIGH] `vendor_due_diligence` missing `org_id` index

**File:** `packages/db/src/schema/tprm.ts:225-255`
**Current indexes:** `vdd_vendor_idx` on `(vendorId)`, `vdd_access_token_idx` unique on `(accessToken)`.
**Problem:** Every TPRM dashboard / vendor-list endpoint scopes by `WHERE org_id = ?`. Without an `org_id` index, Postgres falls back to a seq-scan of the table or relies on `vendor_id`'s correlation (which only helps when filtering by a known vendor). For a multi-tenant table this is a tenant-isolation perf risk as soon as one tenant accumulates >10k DD records.

**Fix:**

```sql
CREATE INDEX CONCURRENTLY vdd_org_status_idx
  ON vendor_due_diligence (org_id, status);
```

The status column is co-filtered in most list endpoints; composite gives both org-scope and status-scope coverage.

---

### F-06 [MEDIUM] `dd-sessions/[id]/results` — section-by-section N+1 fetch

**File:** `apps/web/src/app/api/v1/dd-sessions/[id]/results/route.ts:54-63`
**Query pattern:**

```ts
for (const section of sections) {
  const sectionQuestions = await db
    .select()
    .from(questionnaireQuestion)
    .where(eq(questionnaireQuestion.sectionId, section.id))
    .orderBy(asc(questionnaireQuestion.sortOrder));
  allQuestions.push(...sectionQuestions);
}
```

**Why slow:** A questionnaire template has ~10–20 sections; results endpoint round-trips per section instead of one `inArray(sectionId, sectionIds)` query. Less hot than F-04 (read-only, called once per result view).

**Fix:** Replace loop with `inArray(questionnaireQuestion.sectionId, sections.map(s => s.id))`. No new index — `qq_section_idx` already covers it.

---

### F-07 [MEDIUM] `ai/rcm-gap-analysis` — N+1 join per risk

**File:** `apps/web/src/app/api/v1/ai/rcm-gap-analysis/route.ts:47-77`
**Query pattern:** For each risk, query `riskControl ⋈ control` for linked controls.
**Why slow:** Same shape — admin-only endpoint, fewer calls than F-02, but on a 500-risk register it's still 500 round-trips before the AI call even starts.
**Fix:** Single batched query with `inArray(riskControl.riskId, riskIds)` + group in memory. No new index.

---

### F-08 [MEDIUM] `isms/dashboard` — 8 sequential queries serializable to parallel

**File:** `apps/web/src/app/api/v1/isms/dashboard/route.ts:22-138`
**Query pattern:** 8 independent count/list queries (`asset`, `assetClassification`, `securityIncident`×2, `threat`, `vulnerability`, recentIncidents).
**Why slow:** Sequential `await` even though all queries are independent. Each adds round-trip latency.
**Fix:** Wrap in `Promise.all([...])`. No schema change.

---

### F-09 [MEDIUM] `security_incident` lacks index on `detected_at` for "recent incidents" sort

**File:** `packages/db/src/schema/isms.ts:309-316`; used by `isms/dashboard/route.ts:119-138`
**Query pattern:**

```ts
.where(and(eq(securityIncident.orgId, orgId), isNull(securityIncident.deletedAt)))
.orderBy(sql`${securityIncident.detectedAt} DESC`)
.limit(10)
```

**Why slow:** `si_org_idx` filters by org, then Postgres must sort by `detected_at` for that subset. On large incident histories this becomes a Sort node above a Bitmap Index Scan.
**Fix:**

```sql
CREATE INDEX CONCURRENTLY si_org_detected_at_idx
  ON security_incident (org_id, detected_at DESC)
  WHERE deleted_at IS NULL;
```

---

### F-10 [MEDIUM] `process_version (process_id, is_current)` not partial-indexed

**File:** `packages/db/src/schema/process.ts:151-158`; used by `processes/bulk-approve/route.ts:123-146`
**Query pattern:**

```ts
.where(and(eq(processVersion.processId, processId), eq(processVersion.isCurrent, true)))
.limit(1);
```

**Why slow:** `process_version_unique (processId, versionNumber)` exists but doesn't filter by `is_current`. Each "find current version" must scan all versions of a process and filter — small effect per call but bulk-approve loops up to 100×.
**Fix:**

```sql
CREATE INDEX CONCURRENTLY pv_process_current_idx
  ON process_version (process_id)
  WHERE is_current = true;
```

Partial index makes "find current version of process X" a unique-row lookup.

---

### F-11 [MEDIUM] Pagination on `finding(severity, created_at)` lacks composite

**File:** `packages/db/src/schema/control.ts:361-370`
**Indexes:** `(orgId, status)`, `(orgId, severity)`, `controlId`, `controlTestId`, `riskId`, `ownerId`, `processId`, `processStepId`.
**Query pattern (multiple routes, e.g. `findings/analytics/sla/route.ts:38`):**

```ts
.where(and(eq(finding.orgId, orgId), isNull(finding.deletedAt)))
```

Findings list pages typically sort by `created_at DESC` for "newest first" — there's no `(orgId, createdAt)` index, so the bitmap-and on `orgId` is followed by a Sort.

**Fix:**

```sql
CREATE INDEX CONCURRENTLY finding_org_created_idx
  ON finding (org_id, created_at DESC)
  WHERE deleted_at IS NULL;
```

---

### F-12 [LOW] `processes/bulk-approve` — intentional per-process loop, but no batched gates

**File:** `apps/web/src/app/api/v1/processes/bulk-approve/route.ts:63-232`
**Why slow-ish:** Cap is 100, per-process iteration runs `evaluateTransitionGates` + version snapshot + sign-off + notification. Acceptable for now but the per-process transaction means a bulk-approve of 100 takes ~10–20s; users will start hammering the button.
**Fix:** Out-of-scope structural change — wrap the whole bulk in one transaction and batch the gate-evaluator if it's ever hit at >50 row scale. Not urgent.

---

### F-13 [LOW] `notification.entityType/entityId` lookup unindexed

**File:** `packages/db/src/schema/platform.ts:513-516`
**Indexes:** `(userId, isRead)`, `orgId`.
**Used in:** `tasks/[id]/notify/route.ts` only — one caller.
**Why low:** Single caller, deduplication-only; not worth adding an index unless the call frequency grows.

---

### F-14 [LOW] `translations/queue|progress|heatmap` — `for-of-await` over translation requests

**Files:** `apps/web/src/app/api/v1/translations/queue/route.ts`, `progress/route.ts`, `heatmap/route.ts`
**Why low:** Admin-only endpoints, low call frequency, but the N+1 shape is real. Worth flagging for the next translation-engine refactor; not urgent.

---

## Hot-table index coverage — pass/fail summary

| Table                  | `org_id` indexed                         | Status filter combo                   | Notes                                                |
| ---------------------- | ---------------------------------------- | ------------------------------------- | ---------------------------------------------------- |
| `risk`                 | (orgId, status)                          | (orgId, status)                       | Missing `(catalogSource, catalogEntryId)` — F-01     |
| `control`              | (orgId, status)                          | (orgId, status), (orgId, controlType) | OK                                                   |
| `finding`              | (orgId, status), (orgId, severity)       | OK                                    | Missing `(orgId, createdAt)` for list-by-date — F-11 |
| `audit_log`            | (orgId, createdAt)                       | yes                                   | Well-indexed (ADR-011 rev.2)                         |
| `audit`                | (orgId, status), (orgId, auditType)      | OK                                    |                                                      |
| `control_test`         | (orgId), (orgId, status)                 | OK                                    |                                                      |
| `security_incident`    | (orgId, status), (orgId, severity)       | OK                                    | Missing `(orgId, detectedAt)` — F-09                 |
| `vendor`               | (orgId, status), (orgId, tier)           | OK                                    |                                                      |
| `vendor_due_diligence` | **NO `org_id` idx**                      | n/a                                   | F-05                                                 |
| `dd_session`           | (orgId, status), `accessToken` unique    | OK                                    |                                                      |
| `dd_response`          | unique (sessionId, questionId)           | OK                                    |                                                      |
| `process`              | (orgId), (orgId, status), (orgId, level) | OK                                    |                                                      |
| `process_sign_off`     | (orgId), (processId, signedAt)           | OK                                    |                                                      |
| `notification`         | orgId, (userId, isRead)                  | OK                                    |                                                      |

---

## Recommended action

1. **Single migration `0348_perf_indexes_2026_05_22.sql`** with F-01, F-05, F-09, F-10, F-11 (all `CREATE INDEX CONCURRENTLY`, safe to ship). Risk-acceptance: low — all are pure additions.
2. **One refactor PR per N+1** (F-02, F-03, F-04, F-06, F-07, F-08) — each touches one route file and is independently verifiable with a perf test that times the endpoint before/after.
3. Re-run this audit after migration 0348 ships; add an EXPLAIN-based check to CI for the five new indexes to catch regressions if a future schema change drops them.
