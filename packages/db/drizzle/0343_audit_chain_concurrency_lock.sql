-- Migration 0343: Serialize audit_trigger() per tenant scope.
--
-- ── The race ──────────────────────────────────────────────────────────
-- audit_trigger() (latest version: 0327_audit_hash_v3_tz_invariant.sql)
-- runs inside the user's transaction. It does:
--
--   SELECT entry_hash FROM audit_log
--    WHERE previous_hash_scope = v_scope
--      AND hash_version = 3
--    ORDER BY chain_seq DESC LIMIT 1;
--   ...
--   INSERT INTO audit_log (..., previous_hash, entry_hash, ...)
--
-- The SELECT takes a READ-COMMITTED snapshot; the INSERT writes back.
-- Two concurrent user transactions modifying different tables (e.g.
-- one user updates a risk, another approves a process at the same
-- instant) both fire this trigger, both see the same "latest" row,
-- both compute their entry_hash on top of it, and both INSERT.
--
-- The verify CTE uses LAG OVER (ORDER BY chain_seq), so when one of
-- those two new rows gets the larger chain_seq, its `previous_hash`
-- references the row TWO steps back (not its predecessor by chain_seq)
-- → chain_ok=false at that row, non-deterministically.
--
-- This is the same shape of bug as the sign-off chain concurrency hole
-- fixed in migration 0341. Sign-offs are POST-handlers, so we could
-- enforce UNIQUE NULLS NOT DISTINCT and surface 23505→409. The audit
-- trigger runs synchronously inside arbitrary user transactions — a
-- unique-violation here would abort the *user's* transaction (a risk
-- edit returning 500 because some unrelated insert won a race). That
-- is not the right tradeoff.
--
-- ── The fix ───────────────────────────────────────────────────────────
-- Take a transaction-scoped advisory lock keyed on the tenant scope
-- before reading prev_hash. The lock:
--   • auto-releases at end of transaction (no cleanup needed)
--   • is per-tenant, so different orgs don't block each other
--   • costs ~µs when uncontended
--   • serialises the SELECT-then-INSERT pair so concurrent triggers
--     see each other's writes
--
-- Once the lock is held, the SELECT sees the committed tail of the
-- chain (READ COMMITTED takes a fresh snapshot per statement), so
-- prev_hash is always the actual latest row.

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

  -- #0343: per-scope transaction-level advisory lock so concurrent
  -- audit_trigger() executions across different user transactions
  -- can't both read the same MAX(chain_seq) row as prev_hash. Cheap
  -- when uncontended; auto-released at COMMIT or ROLLBACK.
  PERFORM pg_advisory_xact_lock(hashtext('audit_chain:' || v_scope));

  -- Per-tenant chain: previous-hash lookup is scoped, AND must match
  -- the latest v3 entry. Once 0328 has rehashed all entries to v3,
  -- there are no v0/v1/v2 rows left in any scope's tail.
  --
  -- ORDER BY chain_seq DESC (not created_at, id DESC): when 5 rows
  -- share now() inside one tx, (created_at, id DESC) picks the largest
  -- random UUID which is NOT necessarily the most recently inserted
  -- row. The integrity verify CTE uses LAG OVER (ORDER BY chain_seq)
  -- which IS monotonic by INSERT time. Trigger lookup and verify CTE
  -- must agree on chain order.
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
