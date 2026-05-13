-- Migration 0321: add `reopened` value to the risk_status enum.
--
-- #WAVE14-STATE-02: Wave-13 QA flagged that `closed → identified` was a
-- silent reopen — the audit_log row read identical to any other
-- "regression" transition and an auditor had to infer the intent. The
-- state machine in packages/shared/src/state-machines/risk-status.ts
-- now routes closed-to-active through an explicit `reopened` state with
-- a mandatory reason; this migration adds the enum value to the live
-- DB so the existing PUT /api/v1/risks/[id]/status route can write it.
--
-- Single ALTER TYPE outside any transaction (PG forbids referencing a
-- newly-added enum value in the same tx that adds it). The entrypoint
-- runs each file with no --single-transaction wrap, so a bare statement
-- here autocommits — same pattern as 0318.
--
-- No data migration: existing closed risks keep status='closed' and are
-- unaffected. The next reopen attempt by a user will go through the new
-- closed → reopened edge instead of the removed closed → identified.

ALTER TYPE risk_status ADD VALUE IF NOT EXISTS 'reopened';
