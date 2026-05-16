-- #WAVE23.2: audit-trail hash v3 — timezone-invariant formula.
--
-- Root cause (discovered during Wave-23 prod-diagnose 2026-05-16):
-- The audit_log hash chain has 29 241 v0 entries on production. Migration
-- 0312 was supposed to rehash all v0 → v2 and be idempotent. It's not
-- — every redeploy re-tags ~29k rows as v0. Two interacting bugs:
--
--   1. v1/v2 formulas feed `created_at::text` into SHA-256. `timestamptz`
--      cast to text uses the SESSION timezone, NOT UTC. Migrate runs
--      from CI (Linux container, UTC) and from the prod host (Hetzner
--      cluster default Europe/Berlin) produce different recomputed
--      hashes for the same row → 0311's retag flips them to v0.
--
--   2. 0312's explicit `BEGIN; ... COMMIT;` ended migrate-all's outer
--      transaction prematurely. The rehash loop ran post-COMMIT and
--      any error (e.g. ownership-required ALTER TABLE DISABLE TRIGGER)
--      silently aborted without rolling back. v0 rows never got
--      rehashed.
--
-- Wave-23.2 fix:
--   (a) migrate-all.ts strips file-level BEGIN/COMMIT and pins SET LOCAL
--       TIME ZONE = 'UTC' (separate change in the same PR).
--   (b) This migration defines `compute_audit_hash_v3` with explicit
--       UTC formatting via `to_char(... AT TIME ZONE 'UTC', ...)` so
--       the hash is identical regardless of session TZ.
--   (c) Redeploys `audit_trigger()` to write `hash_version = 3` and
--       use the new formula for all NEW entries.
--   (d) Companion migration 0328 rehashes every existing entry to v3.
--
-- ADR-011 rev.3 already carves out one-time hash_repair for this
-- exact failure mode (hash-function-version drift during deploy).
-- The 0328 rehash records its own hash_repair audit entry per tenant,
-- preserving the forensic trail.

-- ──────────────────────────────────────────────────────────────────
-- v3 hash helper — UTC-normalised, microsecond-precision.
-- ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION compute_audit_hash_v3(
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
    COALESCE(p_previous_hash, '0')                                                            || '|' ||
    COALESCE(p_org_id::text, '')                                                              || '|' ||
    COALESCE(p_user_id::text, '')                                                             || '|' ||
    p_entity_type                                                                             || '|' ||
    COALESCE(p_entity_id::text, '')                                                           || '|' ||
    p_action                                                                                  || '|' ||
    COALESCE(p_changes::text, '')                                                             || '|' ||
    COALESCE(p_action_detail, '')                                                             || '|' ||
    COALESCE(p_metadata::text, '')                                                            || '|' ||
    -- TZ-invariant: ISO-8601 UTC with microsecond precision and a literal "Z" suffix.
    to_char(p_created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')                 || '|' ||
    p_previous_hash_scope,
    'sha256'
  ), 'hex');
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;

-- ──────────────────────────────────────────────────────────────────
-- Re-deploy audit_trigger() — writes hash_version = 3 going forward.
-- Same shape as 0309's trigger; only the hash call changes.
-- ──────────────────────────────────────────────────────────────────

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

  -- Per-tenant chain: previous-hash lookup is scoped, AND must match
  -- the latest v3 entry. Once 0328 has rehashed all entries to v3,
  -- there are no v0/v1/v2 rows left in any scope's tail.
  --
  -- #WAVE23.2: ORDER BY chain_seq DESC (not created_at, id DESC).
  -- Latent bug since Wave 10: when 5 rows share now() inside one tx,
  -- (created_at, id DESC) picks the largest random UUID — which is
  -- NOT necessarily the most recently inserted row. The integrity
  -- verify CTE uses LAG OVER (ORDER BY chain_seq) which IS monotonic
  -- by INSERT time. Trigger lookup and verify CTE must agree on the
  -- chain order or chain_ok mismatches surface non-deterministically.
  -- chain_seq is BIGSERIAL (assigned at INSERT time, strictly
  -- monotonic within a single transaction; backfilled for pre-0313
  -- rows by migration 0313).
  SELECT entry_hash INTO v_prev_hash
  FROM audit_log
  WHERE previous_hash_scope = v_scope
    AND hash_version = 3
  ORDER BY chain_seq DESC
  LIMIT 1;

  v_entry_hash := compute_audit_hash_v3(
    v_prev_hash,
    v_org_id,
    v_user_id,
    TG_TABLE_NAME,
    v_entity_id,
    v_action::text,
    v_changes,
    v_action_detail,
    v_metadata,
    v_created_at,
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
    v_org_id, v_user_id, v_user_email, v_user_name,
    TG_TABLE_NAME, v_entity_id, v_entity_title,
    v_action, v_action_detail, v_changes, v_metadata,
    v_prev_hash, v_entry_hash, v_scope,
    3,
    v_created_at
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
