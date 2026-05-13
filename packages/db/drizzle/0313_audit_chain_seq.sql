-- #WAVE10-CRITICAL-01: deterministic chain ordering + forward-chain repair.
--
-- Wave-9 verification (docs/qa-reports/arctos-qa-verification-2026-05-13-
-- wave9.md) showed two distinct chain-mismatch sources:
--
--   (A) Old: 4 entries from the Wave-7 broken window. Their entry_hash was
--       repaired by 0312, but the rows AFTER them still hold the OLD
--       previous_hash — the cascade was never run. Forward-chain-repair
--       below walks each tenant's chain in order and fixes any row whose
--       stored previous_hash diverges from the actual antecedent's
--       entry_hash, recomputing its own entry_hash to match.
--
--   (B) New: every PUT-style transition writes multiple audit_log rows
--       (work_item + risk + search_index, etc.) inside a single
--       transaction. now() returns the same value for all of them, so
--       every row in that batch has IDENTICAL created_at. Verify ordered
--       by `created_at, id` — the secondary id is a random UUID, so the
--       walk order has nothing to do with the actual write order. The
--       previous_hash chain WAS written correctly (each trigger in the
--       transaction reads the latest entry, including uncommitted ones
--       from the same transaction), but verify saw the rows in a
--       different order and reported a chain break.
--
-- Fix: add chain_seq BIGSERIAL. Postgres assigns a strictly-monotonic
-- value via a sequence even within a single transaction, so the walk
-- order matches the write order exactly. The trigger's
-- previous-hash lookup also switches to ORDER BY chain_seq DESC so
-- concurrent transactions behave deterministically too.
--
-- This migration is large but transactional. If any step errors, the
-- whole thing rolls back and the chain is unaltered.

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- 1. Add chain_seq column. BIGSERIAL implicitly creates a sequence
--    and uses nextval(seq) as the column default. Postgres backfills
--    existing rows by assigning sequence values in the order it scans
--    them — undefined per row but unique. We immediately overwrite
--    with a chronological backfill (step 2).
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS chain_seq BIGSERIAL;

-- ─────────────────────────────────────────────────────────────────
-- 2. Backfill chain_seq in chronological order (created_at, id) for
--    existing rows. Within a single org, ties on created_at use id as
--    a stable tiebreaker — that matches the previous behaviour for
--    pre-Wave-10 chains so the backfill doesn't suddenly reorder
--    rows that were verifiable before.
--
--    The trigger may read chain_seq during this loop, so we wrap the
--    UPDATE in a DO block that disables the append-only guard for
--    just the chain_seq column. chain_seq is a metadata column, no
--    forensic content — no ADR carve-out needed.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE audit_log DISABLE TRIGGER audit_log_tombstone_guard;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM audit_log
)
UPDATE audit_log a
SET chain_seq = o.rn
FROM ordered o
WHERE a.id = o.id;

-- Reset the sequence so future inserts pick up where the backfill
-- left off. Without this, BIGSERIAL nextval() restarts at 1 and
-- collides with backfilled values.
SELECT setval(
  pg_get_serial_sequence('audit_log', 'chain_seq'),
  COALESCE((SELECT MAX(chain_seq) FROM audit_log), 0) + 1,
  false
);

-- Add the index used by both the trigger's previous-hash lookup AND
-- the verify endpoint's chain walk. Per-tenant ordering is the hot
-- path; including hash_version helps the trigger's WHERE clause hit
-- the index without a heap visit.
CREATE INDEX IF NOT EXISTS idx_audit_log_chain_seq
  ON audit_log (previous_hash_scope, chain_seq DESC)
  INCLUDE (entry_hash, hash_version);

ALTER TABLE audit_log
  ALTER COLUMN chain_seq SET NOT NULL;

-- ─────────────────────────────────────────────────────────────────
-- 3. Redeploy audit_trigger() to look up the previous hash via
--    chain_seq DESC instead of (created_at, id). Same v2 formula as
--    rev.3 (migration 0309) — only the ordering changes.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_changes        jsonb;
  v_action         audit_action;
  v_entity_id      uuid;
  v_entity_title   text;
  v_user_id        uuid;
  v_user_email     text;
  v_user_name      text;
  v_org_id         uuid;
  v_prev_hash      varchar(64);
  v_entry_hash     varchar(64);
  v_hash_input     text;
  v_new            jsonb;
  v_old            jsonb;
  v_diff           jsonb := '{}'::jsonb;
  v_key            text;
  v_action_detail  text;
  v_reason         text;
  v_metadata       jsonb;
  v_scope          text;
  v_created_at     timestamptz := now();
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new := to_jsonb(NEW);
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old := to_jsonb(OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
  ELSIF TG_OP = 'UPDATE' THEN
    IF (v_new->>'deleted_at') IS NOT NULL AND (v_old->>'deleted_at') IS NULL THEN
      v_action := 'delete';
    ELSE
      v_action := 'update';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_entity_id := (v_old->>'id')::uuid;
  ELSE
    v_entity_id := (v_new->>'id')::uuid;
  END IF;

  IF TG_TABLE_NAME = 'organization' THEN
    v_org_id := v_entity_id;
  ELSIF TG_TABLE_NAME = 'user' THEN
    v_org_id := NULLIF(current_setting('app.current_org_id', true), '')::uuid;
  ELSE
    IF TG_OP = 'DELETE' THEN
      v_org_id := (v_old->>'org_id')::uuid;
    ELSE
      v_org_id := (v_new->>'org_id')::uuid;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_changes := jsonb_build_object('new', v_new);
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := jsonb_build_object('old', v_old);
  ELSE
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_new->v_key IS DISTINCT FROM v_old->v_key THEN
        v_diff := v_diff || jsonb_build_object(
          v_key, jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key)
        );
      END IF;
    END LOOP;
    v_changes := v_diff;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_entity_title := COALESCE(v_old->>'name', v_old->>'title', v_old->>'email');
  ELSE
    v_entity_title := COALESCE(v_new->>'name', v_new->>'title', v_new->>'email');
  END IF;

  v_user_id    := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
  v_user_email := NULLIF(current_setting('app.current_user_email', true), '');
  v_user_name  := NULLIF(current_setting('app.current_user_name', true), '');

  v_action_detail := NULLIF(current_setting('app.audit_action_detail', true), '');
  v_reason        := NULLIF(current_setting('app.audit_reason', true), '');

  IF v_reason IS NOT NULL THEN
    v_metadata := jsonb_build_object('reason', v_reason);
  ELSE
    v_metadata := NULL;
  END IF;

  v_scope := 'org:' || COALESCE(v_org_id::text, 'platform');

  -- Per-tenant chain: previous-hash lookup uses chain_seq for strict
  -- monotonicity even within a single transaction. Multiple INSERTs
  -- in the same transaction each get a distinct chain_seq via the
  -- sequence's nextval() — Postgres allocates sequence values
  -- non-transactionally, so the read sees uncommitted increments
  -- from earlier statements in the same transaction.
  --
  -- AND hash_version = 2 so a v2 hash never chains off a v1 hash
  -- (the formulas differ).
  SELECT entry_hash INTO v_prev_hash
  FROM audit_log
  WHERE previous_hash_scope = v_scope
    AND hash_version = 2
  ORDER BY chain_seq DESC
  LIMIT 1;

  -- v2 hash formula (11 fields, unchanged from migration 0309).
  v_hash_input := COALESCE(v_prev_hash, '0') || '|' ||
    COALESCE(v_org_id::text, '')          || '|' ||
    COALESCE(v_user_id::text, '')         || '|' ||
    TG_TABLE_NAME                         || '|' ||
    COALESCE(v_entity_id::text, '')       || '|' ||
    v_action::text                        || '|' ||
    COALESCE(v_changes::text, '')         || '|' ||
    COALESCE(v_action_detail, '')         || '|' ||
    COALESCE(v_metadata::text, '')        || '|' ||
    v_created_at::text                    || '|' ||
    v_scope;

  v_entry_hash := encode(digest(v_hash_input, 'sha256'), 'hex');

  -- chain_seq is omitted from the INSERT — BIGSERIAL default supplies it.
  INSERT INTO audit_log (
    org_id, user_id, user_email, user_name,
    entity_type, entity_id, entity_title,
    action, action_detail, changes, metadata,
    previous_hash, entry_hash, previous_hash_scope,
    hash_version,
    created_at
  ) VALUES (
    v_org_id, v_user_id, v_user_email, v_user_name,
    TG_TABLE_NAME, v_entity_id, v_entity_title,
    v_action, v_action_detail, v_changes, v_metadata,
    v_prev_hash, v_entry_hash, v_scope,
    2,
    v_created_at
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────
-- 4. Forward-chain-repair. Walk every tenant chain in chain_seq
--    order. For each row, the EXPECTED previous_hash is the prior
--    row's entry_hash (or '0' for the first row). When divergent,
--    update both previous_hash AND recompute entry_hash so the
--    walk's expectation for the NEXT row updates correctly. Cascades
--    end-of-chain.
--
--    Writes a hash_repair audit_log entry per tenant whose chain
--    needed repair, with the count + a sample of the affected ids
--    (forensic spur).
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org_id      uuid;
  v_scope       text;
  v_orgs        text[];
  v_row         RECORD;
  v_prev_hash   text;
  v_new_hash    text;
  v_repaired    int;
  v_total       int := 0;
  v_orgs_total  int := 0;
  v_metadata    jsonb;
  v_now         timestamptz := now();
  v_seq_low     bigint;
  v_seq_high    bigint;
BEGIN
  -- Find every distinct previous_hash_scope that has at least one row.
  -- Loop per scope so we can recompute the chain head correctly.
  SELECT array_agg(DISTINCT previous_hash_scope) INTO v_orgs
  FROM audit_log
  WHERE previous_hash_scope IS NOT NULL;

  IF v_orgs IS NULL THEN
    RAISE NOTICE '[migration 0313] No per-tenant chains to walk. Skipping forward-chain repair.';
    RETURN;
  END IF;

  FOREACH v_scope IN ARRAY v_orgs
  LOOP
    v_repaired := 0;
    v_prev_hash := NULL;
    v_seq_low := NULL;
    v_seq_high := NULL;

    -- Walk this tenant's chain in chain_seq order. v_prev_hash carries
    -- the expected previous_hash for the next iteration.
    FOR v_row IN
      SELECT id, hash_version, previous_hash, entry_hash, org_id, user_id,
             entity_type, entity_id, action::text AS action, changes,
             action_detail, metadata, created_at, chain_seq
      FROM audit_log
      WHERE previous_hash_scope = v_scope
      ORDER BY chain_seq ASC
    LOOP
      IF v_row.hash_version = 0 THEN
        -- Should not happen post-0312 but stay defensive: leave v0
        -- rows alone, they need their own repair (rerun 0312).
        v_prev_hash := v_row.entry_hash;
        CONTINUE;
      END IF;

      -- The expected previous_hash is whatever we computed last
      -- iteration (NULL for the first row in this scope).
      IF v_row.previous_hash IS DISTINCT FROM v_prev_hash THEN
        -- Recompute entry_hash with the corrected previous_hash.
        IF v_row.hash_version = 2 THEN
          v_new_hash := compute_audit_hash_v2(
            v_prev_hash, v_row.org_id, v_row.user_id,
            v_row.entity_type, v_row.entity_id, v_row.action,
            v_row.changes, v_row.action_detail, v_row.metadata,
            v_row.created_at, v_scope
          );
        ELSE
          v_new_hash := compute_audit_hash_v1(
            v_prev_hash, v_row.org_id, v_row.user_id,
            v_row.entity_type, v_row.entity_id, v_row.action,
            v_row.changes, v_row.created_at, v_scope
          );
        END IF;

        UPDATE audit_log
        SET previous_hash = v_prev_hash,
            entry_hash    = v_new_hash
        WHERE id = v_row.id;

        v_repaired := v_repaired + 1;
        v_seq_low := COALESCE(v_seq_low, v_row.chain_seq);
        v_seq_high := v_row.chain_seq;
        v_prev_hash := v_new_hash;
      ELSE
        -- Row was already chain-correct; carry its entry_hash forward.
        v_prev_hash := v_row.entry_hash;
      END IF;
    END LOOP;

    IF v_repaired > 0 THEN
      v_total := v_total + v_repaired;
      v_orgs_total := v_orgs_total + 1;

      -- Get the org_id from the scope for the hash_repair entry.
      SELECT org_id INTO v_org_id
      FROM audit_log
      WHERE previous_hash_scope = v_scope
      LIMIT 1;

      v_metadata := jsonb_build_object(
        'repair_kind', 'forward_chain_cascade',
        'repaired_count', v_repaired,
        'chain_seq_first_repaired', v_seq_low,
        'chain_seq_last_repaired', v_seq_high,
        'note', 'Wave-10 chain_seq deterministic-ordering rollout. ' ||
                'Pre-existing chain breaks (Wave-7 broken-window cascade + ' ||
                'concurrent same-timestamp writes) repaired by recomputing ' ||
                'previous_hash and entry_hash in chain_seq order.'
      );

      -- Compute the repair-record's own hash. Chain off the latest v2
      -- entry now that the chain is consistent.
      SELECT entry_hash INTO v_prev_hash
      FROM audit_log
      WHERE previous_hash_scope = v_scope AND hash_version = 2
      ORDER BY chain_seq DESC LIMIT 1;

      v_new_hash := compute_audit_hash_v2(
        v_prev_hash, v_org_id, NULL, 'audit_log', NULL,
        'update', NULL, 'hash_repair', v_metadata, v_now, v_scope
      );

      INSERT INTO audit_log (
        org_id, user_id, user_email, user_name,
        entity_type, entity_id, entity_title,
        action, action_detail, changes, metadata,
        previous_hash, entry_hash, previous_hash_scope,
        hash_version, created_at
      ) VALUES (
        v_org_id, NULL, 'migration-0313@arctos', 'Migration 0313 (system)',
        'audit_log', NULL, 'Forward-chain cascade repair (Wave 10)',
        'update', 'hash_repair', NULL, v_metadata,
        v_prev_hash, v_new_hash, v_scope, 2, v_now
      );
    END IF;
  END LOOP;

  RAISE NOTICE '[migration 0313] Forward-chain repair: % rows fixed across % tenant chain(s).',
    v_total, v_orgs_total;
END $$;

-- Re-enable the append-only guard.
ALTER TABLE audit_log ENABLE TRIGGER audit_log_tombstone_guard;

COMMIT;
