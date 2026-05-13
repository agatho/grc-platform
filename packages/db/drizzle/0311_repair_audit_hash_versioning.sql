-- #WAVE9-CRITICAL-01: repair the audit_log hash_version tagging that
-- migration 0309 got wrong, and introduce v0 for genuinely-broken rows.
--
-- Three problems with 0309:
--
--   (1) Operator-precedence bug. The UPDATE clause was
--         WHERE created_at >= '...' AND action_detail IS NOT NULL
--           OR metadata IS NOT NULL
--       which parses as
--         WHERE (created_at >= '...' AND action_detail IS NOT NULL)
--           OR  metadata IS NOT NULL
--       so EVERY pre-cutover row that ever carried metadata got tagged
--       v2 — and verify-with-v2-formula crashed on rows whose stored
--       entry_hash was actually written by the v1 trigger.
--
--   (2) Heuristic tagging. 0309 inferred the version from timestamp +
--       column-presence. That is fundamentally racy when the trigger
--       redeploy and the migration run aren't atomic. The right answer
--       is observational: recompute both formulas, see which one matches
--       the stored hash, and tag accordingly.
--
--   (3) No hash_version=0 (broken) state. The Wave-7 transition window
--       wrote 4 rows whose stored hash matches NEITHER formula. With no
--       way to tag them as known-broken, integrity verification kept
--       reporting them as plain mismatches and the chain looked
--       irreparably bad.
--
-- This migration:
--
--   - Re-tags every row by observation: try v1, try v2, set whichever
--     matches; set v0 if neither does.
--   - Logs counts to NOTICE so the deploy log captures the migration
--     outcome without requiring a separate query.
--   - Is idempotent — running it twice produces the same final state
--     because the matching is deterministic.
--   - Does NOT recompute or rewrite stored hashes. That is the job of
--     the separate repair migration 0312, which is gated behind an
--     explicit hash_repair audit-log entry. THIS migration is
--     forensically safe to run.

BEGIN;

-- Defensive: column should already exist from 0309, but if 0309 partially
-- failed on a deploy, this lets the repair land cleanly.
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS hash_version INTEGER NOT NULL DEFAULT 1;

-- Helper functions: compute v1 and v2 hashes from row columns. Both
-- mirror the SQL CASE used in apps/web/src/app/api/v1/audit-log/
-- integrity/route.ts. Defining as IMMUTABLE PARALLEL SAFE so Postgres
-- can use them in expressions without overhead.
CREATE OR REPLACE FUNCTION compute_audit_hash_v1(
  p_previous_hash       text,
  p_org_id              uuid,
  p_user_id             uuid,
  p_entity_type         text,
  p_entity_id           uuid,
  p_action              text,
  p_changes             jsonb,
  p_created_at          timestamptz,
  p_previous_hash_scope text
) RETURNS text AS $$
  SELECT encode(digest(
    COALESCE(p_previous_hash, '0') || '|' ||
    COALESCE(p_org_id::text, '')   || '|' ||
    COALESCE(p_user_id::text, '')  || '|' ||
    p_entity_type                  || '|' ||
    COALESCE(p_entity_id::text, '')|| '|' ||
    p_action                       || '|' ||
    COALESCE(p_changes::text, '')  || '|' ||
    p_created_at::text             || '|' ||
    p_previous_hash_scope,
    'sha256'
  ), 'hex');
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;

CREATE OR REPLACE FUNCTION compute_audit_hash_v2(
  p_previous_hash       text,
  p_org_id              uuid,
  p_user_id             uuid,
  p_entity_type         text,
  p_entity_id           uuid,
  p_action              text,
  p_changes             jsonb,
  p_action_detail       text,
  p_metadata            jsonb,
  p_created_at          timestamptz,
  p_previous_hash_scope text
) RETURNS text AS $$
  SELECT encode(digest(
    COALESCE(p_previous_hash, '0')      || '|' ||
    COALESCE(p_org_id::text, '')        || '|' ||
    COALESCE(p_user_id::text, '')       || '|' ||
    p_entity_type                       || '|' ||
    COALESCE(p_entity_id::text, '')     || '|' ||
    p_action                            || '|' ||
    COALESCE(p_changes::text, '')       || '|' ||
    COALESCE(p_action_detail, '')       || '|' ||
    COALESCE(p_metadata::text, '')      || '|' ||
    p_created_at::text                  || '|' ||
    p_previous_hash_scope,
    'sha256'
  ), 'hex');
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;

-- Re-tag. Single UPDATE with a CASE selects the right hash_version
-- per row based on which recomputed hash matches the stored one.
-- NULL action::text guard: audit_action enum needs an explicit cast
-- because the helper params take plain text.
WITH retagged AS (
  SELECT
    id,
    CASE
      WHEN entry_hash IS NULL THEN hash_version
      WHEN entry_hash = compute_audit_hash_v1(
        previous_hash, org_id, user_id, entity_type, entity_id,
        action::text, changes, created_at, previous_hash_scope
      ) THEN 1
      WHEN entry_hash = compute_audit_hash_v2(
        previous_hash, org_id, user_id, entity_type, entity_id,
        action::text, changes, action_detail, metadata, created_at,
        previous_hash_scope
      ) THEN 2
      ELSE 0
    END AS new_version
  FROM audit_log
)
UPDATE audit_log a
SET hash_version = r.new_version
FROM retagged r
WHERE a.id = r.id
  AND a.hash_version IS DISTINCT FROM r.new_version;

-- Diagnostic NOTICE so the deploy log captures the per-version totals.
DO $$
DECLARE
  v0_count int;
  v1_count int;
  v2_count int;
  total_count int;
BEGIN
  SELECT count(*) INTO v0_count FROM audit_log WHERE hash_version = 0;
  SELECT count(*) INTO v1_count FROM audit_log WHERE hash_version = 1;
  SELECT count(*) INTO v2_count FROM audit_log WHERE hash_version = 2;
  SELECT count(*) INTO total_count FROM audit_log;
  RAISE NOTICE '[migration 0311] Re-tagged audit_log by observation. v0=% v1=% v2=% total=%',
    v0_count, v1_count, v2_count, total_count;
  IF v0_count > 0 THEN
    RAISE NOTICE '[migration 0311] % broken-window rows tagged v0. Run 0312 to rehash them.', v0_count;
  END IF;
END $$;

COMMIT;
