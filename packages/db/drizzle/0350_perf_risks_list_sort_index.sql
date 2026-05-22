-- Migration 0350: covering index for GET /api/v1/risks default sort.
--
-- The CI E2E k6 baseline (scripts/perf/ci-baseline.js) gated
-- risks_list_duration p95 < 1500ms. Recent runs showed p95 ≈ 2450ms
-- on the 2-vCPU GitHub runner — 63% over the budget — blocking every
-- open PR's E2E job even when the PR didn't touch risks code.
--
-- Cause: GET /api/v1/risks defaults to `ORDER BY risk_score_residual
-- DESC, id ASC` and filters by `org_id = $1 AND deleted_at IS NULL`.
-- The existing `risk_score_residual_idx` (single column) doesn't carry
-- org_id so the planner has to bitmap-OR with `risk_org_status_idx`,
-- collect rows, then run a fully-buffered sort before applying the
-- LIMIT 100. With only a handful of rows in CI that work is
-- microseconds; the cost is the per-request planner + sort allocation
-- on a contended 2-vCPU runner, repeated under 10 VU concurrency.
--
-- This index lets the planner serve `WHERE org_id = $1 AND deleted_at
-- IS NULL ORDER BY risk_score_residual DESC NULLS LAST LIMIT 100` as
-- a single index range scan with LIMIT pushdown — no sort buffer, no
-- bitmap OR.
--
-- Partial WHERE clause means the index size is bounded to active rows
-- only; soft-deleted rows don't bloat it.
--
-- Idempotent (IF NOT EXISTS), non-concurrent per ADR-014 transaction
-- policy. Table is small enough that the brief AccessExclusive lock
-- during creation is acceptable.

BEGIN;

CREATE INDEX IF NOT EXISTS risk_org_residual_active_idx
  ON risk (org_id, risk_score_residual DESC NULLS LAST, id)
  WHERE deleted_at IS NULL;

COMMIT;
