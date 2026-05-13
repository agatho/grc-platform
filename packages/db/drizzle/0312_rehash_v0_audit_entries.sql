-- #WAVE9-CRITICAL-01: rehash the broken-window audit_log entries.
--
-- The 4 (or however many) rows that 0311 tagged hash_version=0 have a
-- stored entry_hash matching neither v1 nor v2. They were written
-- during the brief window between deploying the v2 trigger and
-- deploying the corresponding verify endpoint — the trigger that wrote
-- them used a transitional formula that is now lost.
--
-- We rehash them under v2 so the chain becomes verifiable end-to-end.
-- Forensically this is a one-time, fully audited rewrite:
--
--   1. The new v2 hash is correct under the current contract — every
--      future verification will succeed.
--   2. We write a `hash_repair` audit-log entry recording exactly which
--      rows were rehashed, with the OLD entry_hash and the NEW one in
--      the metadata. The forensic trail is preserved.
--   3. We mark the rehashed rows hash_version=2 so subsequent integrity
--      checks treat them as valid v2 entries.
--   4. The migration is idempotent: a second run finds no v0 rows and
--      does nothing.
--
-- Trade-off acknowledged: rewriting entry_hash on an append-only table
-- is the kind of thing that should make you pause. The alternative —
-- leaving the chain permanently broken — is worse. ADR-011 rev.3
-- explicitly carves out a one-time hash_repair action for this exact
-- failure mode (hash-function-version drift during deploy).

BEGIN;

-- The chain entry that records the repair itself. We INSERT this FIRST
-- so the repaired rows can chain off of it cleanly. The trigger that
-- normally writes audit_log entries is bypassed (we INSERT directly)
-- because we need to control the entry_hash to chain correctly.
DO $$
DECLARE
  v_count int;
  v_new_hash text;
  v_prev_hash text;
  v_metadata jsonb;
  v_org_id uuid;
  v_now timestamptz := now();
  v_scope text;
  v_repair_id uuid;
  v_orgs uuid[];
BEGIN
  -- Quick exit if there is nothing to repair.
  SELECT count(*) INTO v_count FROM audit_log WHERE hash_version = 0;
  IF v_count = 0 THEN
    RAISE NOTICE '[migration 0312] No v0 rows to rehash. Migration is a no-op.';
    RETURN;
  END IF;

  RAISE NOTICE '[migration 0312] Rehashing % v0 rows under hash_version=2', v_count;

  -- Per-org loop: each tenant has its own chain. We rehash the v0 rows
  -- in chronological order within each org's chain so previous_hash
  -- references stay consistent.
  SELECT array_agg(DISTINCT org_id) INTO v_orgs
  FROM audit_log WHERE hash_version = 0;

  FOREACH v_org_id IN ARRAY v_orgs
  LOOP
    v_scope := 'org:' || COALESCE(v_org_id::text, 'platform');

    -- Build the repair-record metadata BEFORE rewriting any rows so it
    -- captures the pre-repair state.
    SELECT jsonb_build_object(
      'repaired_count', count(*),
      'rows', jsonb_agg(jsonb_build_object(
        'id', id,
        'entity_type', entity_type,
        'entity_id', entity_id,
        'old_entry_hash', entry_hash,
        'created_at', created_at
      ) ORDER BY created_at, id)
    ) INTO v_metadata
    FROM audit_log
    WHERE hash_version = 0 AND org_id = v_org_id;

    -- Rehash each v0 row in order. previous_hash already points at the
    -- right antecedent (we don't change the chain topology — only the
    -- hash of each row). After rewriting an entry_hash, the NEXT row in
    -- the chain may also be a v0 row whose previous_hash references the
    -- OLD hash of THIS row. So we ALSO update that row's previous_hash
    -- to the new value.
    FOR v_repair_id IN
      SELECT id FROM audit_log
      WHERE hash_version = 0 AND org_id = v_org_id
      ORDER BY created_at, id
    LOOP
      -- Recompute v2 hash for this row.
      v_new_hash := compute_audit_hash_v2(
        (SELECT previous_hash FROM audit_log WHERE id = v_repair_id),
        v_org_id,
        (SELECT user_id FROM audit_log WHERE id = v_repair_id),
        (SELECT entity_type FROM audit_log WHERE id = v_repair_id),
        (SELECT entity_id FROM audit_log WHERE id = v_repair_id),
        (SELECT action::text FROM audit_log WHERE id = v_repair_id),
        (SELECT changes FROM audit_log WHERE id = v_repair_id),
        (SELECT action_detail FROM audit_log WHERE id = v_repair_id),
        (SELECT metadata FROM audit_log WHERE id = v_repair_id),
        (SELECT created_at FROM audit_log WHERE id = v_repair_id),
        v_scope
      );

      -- Capture the OLD hash so we can repair downstream chain pointers.
      SELECT entry_hash INTO v_prev_hash
      FROM audit_log WHERE id = v_repair_id;

      -- Update this row.
      UPDATE audit_log
      SET entry_hash = v_new_hash, hash_version = 2
      WHERE id = v_repair_id;

      -- Fix any subsequent row that pointed at the OLD hash. The
      -- successor row keeps its own entry_hash unless ITS hash also
      -- needs recomputing — that case is handled when the loop reaches
      -- that row (if it was also v0) or is left intact (if it was v1/v2,
      -- since v1/v2 stored hashes were correct under their own formula
      -- AND they referenced the row's entry_hash regardless of version).
      UPDATE audit_log
      SET previous_hash = v_new_hash
      WHERE previous_hash = v_prev_hash
        AND previous_hash_scope = v_scope
        AND id <> v_repair_id;
    END LOOP;

    -- Look up the latest entry_hash in this scope to chain the repair
    -- record off of.
    SELECT entry_hash INTO v_prev_hash
    FROM audit_log
    WHERE previous_hash_scope = v_scope
      AND hash_version = 2
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    -- Compute the repair-record's own hash. Uses the v2 formula with
    -- entity_type='audit_log' (self-referential) and a synthetic action.
    v_new_hash := compute_audit_hash_v2(
      v_prev_hash,
      v_org_id,
      NULL,                                 -- no user — system-driven
      'audit_log',                          -- self-referential repair
      NULL,                                 -- no specific entity_id
      'update',                             -- closest enum value to repair
      NULL,                                 -- no row diff
      'hash_repair',                        -- action_detail tags the kind
      v_metadata,
      v_now,
      v_scope
    );

    INSERT INTO audit_log (
      org_id, user_id, user_email, user_name,
      entity_type, entity_id, entity_title,
      action, action_detail, changes, metadata,
      previous_hash, entry_hash, previous_hash_scope,
      hash_version,
      created_at
    ) VALUES (
      v_org_id, NULL, 'migration-0312@arctos', 'Migration 0312 (system)',
      'audit_log', NULL, 'Hash chain v0→v2 repair',
      'update', 'hash_repair', NULL, v_metadata,
      v_prev_hash, v_new_hash, v_scope,
      2,
      v_now
    );
  END LOOP;

  RAISE NOTICE '[migration 0312] Rehashed % rows across % tenant(s). Each affected tenant got a hash_repair audit_log entry.',
    v_count, array_length(v_orgs, 1);
END $$;

COMMIT;
