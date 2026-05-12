-- #WAVE7-CRITICAL-01: hash-chain integrity broken by migration 0308.
--
-- Root cause: 0308 added action_detail + metadata::text to the
-- audit_trigger's hash input, but apps/web/src/app/api/v1/audit-log/
-- integrity/route.ts still computes the rev.2 9-field formula. Result:
-- every row written after 2026-05-12 21:45:22 fails verification —
-- 4 broken rows reported, more on every new state transition.
--
-- Strategy: hash versioning.
--   v1: rev.2 trigger (migration 0284), 9 fields, no action_detail/metadata
--   v2: rev.3 trigger (this migration), 11 fields, includes both
--
-- Existing rows keep their stored hash. We retroactively tag every
-- pre-cutover row as v1 and every post-cutover row as v2 so verify
-- can dispatch to the right formula. The integrity endpoint will be
-- updated in the same PR to honour the version.

BEGIN;

-- 1. New column. Default 1 because everything before 0308 was v1.
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS hash_version INTEGER NOT NULL DEFAULT 1;

-- 2. Tag the 4 broken rows (and any subsequent ones written between
--    deploy of 0308 and this fix) as v2. They are correct by their own
--    formula — the bug was in verify, not the hash itself.
UPDATE audit_log
SET hash_version = 2
WHERE created_at >= '2026-05-12 21:45:00+00'::timestamptz
  AND action_detail IS NOT NULL OR metadata IS NOT NULL;

-- 3. Re-deploy the trigger with explicit v2 marker. Hash formula is
--    the same as 0308 (the data the trigger writes is correct);
--    we just need to stamp hash_version=2 on the row so verify knows
--    which formula to use.
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

  -- Per-tenant chain: previous-hash lookup is scoped, AND must match
  -- a v2 row so we don't chain a v2 hash off a v1 hash (the formulas
  -- differ; mixing them is what created the original bug).
  SELECT entry_hash INTO v_prev_hash
  FROM audit_log
  WHERE previous_hash_scope = v_scope
    AND hash_version = 2
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  -- v2 hash formula (11 fields). Verify endpoint dispatches on
  -- hash_version=2 and uses the same formula.
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

COMMIT;
