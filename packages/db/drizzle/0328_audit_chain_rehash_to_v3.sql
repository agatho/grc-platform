-- #WAVE23.2: rehash every audit_log entry to v3 (TZ-invariant).
--
-- See migration 0327 for the v3 rationale. This migration is the
-- one-time bulk rewrite of all existing entries from v0/v1/v2 to v3,
-- per-tenant chain order preserved, idempotent at the row level
-- (only rewrites rows whose hash_version != 3).
--
-- Idempotency contract:
--   - First run: rewrites every audit_log row's entry_hash + previous_hash
--     under the v3 formula, sets hash_version=3, writes one
--     `hash_repair` audit entry per tenant.
--   - Subsequent runs: counts rows with hash_version != 3, finds 0,
--     short-circuits without touching the chain.
--
-- The append-only guard (audit_log_tombstone_only_guard, migration 0284)
-- blocks UPDATE on entry_hash/previous_hash. ADR-011 rev.3 carves out
-- this exact one-time hash_repair action. We DISABLE the guard for the
-- duration of the rewrite and re-ENABLE it before returning.
--
-- NOTE: NO explicit BEGIN/COMMIT — migrate-all.ts wraps each file
-- in client.begin(), which IS the transaction boundary. Inner
-- COMMIT inside that wrapper would end the outer tx prematurely
-- (the bug that caused the 0312 oscillation). Wave-23.2 also fixes
-- migrate-all.ts to strip stray BEGIN/COMMIT from older files for
-- the same reason.

DO $$
DECLARE
  v_pending_count   int;
  v_org_id          uuid;
  v_orgs            uuid[];
  v_now             timestamptz := now();
  v_scope           text;
  v_metadata        jsonb;
  v_pre_count       int;
  v_repair_id       uuid;
  v_prev_hash       text;
  v_old_hash        text;
  v_new_hash        text;
  v_repair_hash     text;
BEGIN
  SELECT count(*) INTO v_pending_count
  FROM audit_log WHERE hash_version IS DISTINCT FROM 3;

  IF v_pending_count = 0 THEN
    RAISE NOTICE '[migration 0328] All audit_log rows already at v3. No-op.';
    RETURN;
  END IF;

  RAISE NOTICE '[migration 0328] Rehashing % audit_log rows to v3', v_pending_count;

  -- Disable the append-only guard for the duration of this transaction.
  ALTER TABLE audit_log DISABLE TRIGGER audit_log_tombstone_guard;

  -- Collect orgs (plus the platform-scope NULL) that have any non-v3
  -- rows. Each chain is processed independently per tenant.
  SELECT array_agg(DISTINCT org_id) INTO v_orgs
  FROM audit_log
  WHERE hash_version IS DISTINCT FROM 3;

  FOREACH v_org_id IN ARRAY v_orgs
  LOOP
    v_scope := 'org:' || COALESCE(v_org_id::text, 'platform');

    -- Capture pre-rewrite metadata for the hash_repair record.
    SELECT
      count(*),
      jsonb_build_object(
        'repaired_count', count(*),
        'from_versions',  jsonb_agg(DISTINCT hash_version),
        'first_id',       (array_agg(id ORDER BY created_at, id))[1],
        'last_id',        (array_agg(id ORDER BY created_at DESC, id DESC))[1]
      )
    INTO v_pre_count, v_metadata
    FROM audit_log
    WHERE hash_version IS DISTINCT FROM 3
      AND COALESCE(org_id::text, 'platform') = COALESCE(v_org_id::text, 'platform');

    -- Walk this tenant's chain in created_at order, rewriting each row's
    -- entry_hash + the previous_hash of the NEXT row in chain order. We
    -- need to carry the "previous v3 hash" across rows because each
    -- row's previous_hash must reference the v3 hash of the prior row.
    --
    -- Start: previous_hash for the FIRST rewritten row is the existing
    -- previous_hash of that row (which references either NULL/'0' for
    -- the chain root, or a prior row's old hash). After rewriting we
    -- update both this row's entry_hash AND, post-update, fix the
    -- previous_hash of the next row to chain to the new value.
    v_prev_hash := NULL;
    FOR v_repair_id, v_old_hash IN
      SELECT id, entry_hash
      FROM audit_log
      WHERE COALESCE(org_id::text, 'platform') = COALESCE(v_org_id::text, 'platform')
      ORDER BY created_at, id
    LOOP
      -- Compute v3 hash from this row's current data. The previous_hash
      -- INPUT to the formula is the v3 hash we computed for the prior
      -- row (or whatever was in previous_hash for the first row).
      IF v_prev_hash IS NULL THEN
        SELECT previous_hash INTO v_prev_hash
        FROM audit_log WHERE id = v_repair_id;
      END IF;

      v_new_hash := compute_audit_hash_v3(
        v_prev_hash,
        v_org_id,
        (SELECT user_id        FROM audit_log WHERE id = v_repair_id),
        (SELECT entity_type    FROM audit_log WHERE id = v_repair_id),
        (SELECT entity_id      FROM audit_log WHERE id = v_repair_id),
        (SELECT action::text   FROM audit_log WHERE id = v_repair_id),
        (SELECT changes        FROM audit_log WHERE id = v_repair_id),
        (SELECT action_detail  FROM audit_log WHERE id = v_repair_id),
        (SELECT metadata       FROM audit_log WHERE id = v_repair_id),
        (SELECT created_at     FROM audit_log WHERE id = v_repair_id),
        v_scope
      );

      -- Update this row.
      UPDATE audit_log
      SET entry_hash    = v_new_hash,
          previous_hash = v_prev_hash,
          hash_version  = 3
      WHERE id = v_repair_id;

      -- This row's new v3 hash becomes the previous_hash input for the
      -- next row in the loop.
      v_prev_hash := v_new_hash;
    END LOOP;

    -- Look up the latest v3 entry_hash in this scope to chain the
    -- repair record off of (will be v_prev_hash from the loop tail).
    -- Then write a hash_repair audit entry recording the repair.
    v_repair_hash := compute_audit_hash_v3(
      v_prev_hash,
      v_org_id,
      NULL,                 -- system-driven
      'audit_log',
      NULL,
      'update',
      NULL,
      'hash_repair_v3',
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
      v_org_id, NULL, 'migration-0328@arctos', 'Migration 0328 (system)',
      'audit_log', NULL, 'Hash chain v*->v3 repair (TZ-invariant)',
      'update', 'hash_repair_v3', NULL, v_metadata,
      v_prev_hash, v_repair_hash, v_scope,
      3,
      v_now
    );
  END LOOP;

  -- Re-enable the append-only guard.
  ALTER TABLE audit_log ENABLE TRIGGER audit_log_tombstone_guard;

  RAISE NOTICE '[migration 0328] Rehashed % rows across % tenant scope(s) to v3.',
    v_pending_count, array_length(v_orgs, 1);
END $$;

-- ──────────────────────────────────────────────────────────────────
-- Diagnostic NOTICE for the deploy log.
-- ──────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v0_count int;
  v1_count int;
  v2_count int;
  v3_count int;
BEGIN
  SELECT count(*) INTO v0_count FROM audit_log WHERE hash_version = 0;
  SELECT count(*) INTO v1_count FROM audit_log WHERE hash_version = 1;
  SELECT count(*) INTO v2_count FROM audit_log WHERE hash_version = 2;
  SELECT count(*) INTO v3_count FROM audit_log WHERE hash_version = 3;
  RAISE NOTICE '[migration 0328] Post-rehash distribution: v0=%, v1=%, v2=%, v3=% (expect v0=v1=v2=0)',
    v0_count, v1_count, v2_count, v3_count;
END $$;
