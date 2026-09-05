-- 0406_wb_audit_chain_hardening.sql
-- ARCTOS-FULL-2026-08-31 · WP4 · S03-15
--
-- The whistleblowing chain is the one HinSchG §8 depends on, and it was
-- the least protected chain in the system:
--
--   1. `whistleblowing_audit_log` had no append-only rule, no guard and
--      no TRUNCATE protection — UPDATE and DELETE were unrestricted,
--      unlike audit_log, access_log and data_export_log.
--   2. Its hash formula ends in `v_created_at::text`, which serialises in
--      the *session* timezone. That is the exact defect ADR-026 describes
--      for audit_log v2 ("a row hashed on Hetzner failed verification on
--      CI and vice versa"); the WB chain never received the fix and had no
--      `hash_version` column to migrate with.
--   3. Nothing ever verified it. The only reference to the table in the
--      whole TypeScript tree is a comment.
--
-- ── Scope note ────────────────────────────────────────────────────────
-- WP8 also works on `whistleblowing_audit_trigger`, for pseudonymisation
-- and erasure (S07-01/-03/-06). The change here is confined to chain
-- integrity: the hash formula, the version column and the append-only
-- guards. The actor-hash construction, the payload and the case-id
-- resolution are byte-identical to the previous definition so the two
-- work packages do not collide.

ALTER TABLE whistleblowing_audit_log
  ADD COLUMN IF NOT EXISTS hash_version integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN whistleblowing_audit_log.hash_version IS
  'S03-15: 1 = original session-TZ-dependent formula (created_at::text). 2 = TZ-invariant, same construction as audit_log v3.';

-- ──────────────────────────────────────────────────────────────────────
-- 1. TZ-invariant formula
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.compute_wb_audit_hash_v2(
  p_previous_hash text,
  p_case_id       uuid,
  p_actor_hash    text,
  p_entity_type   text,
  p_entity_id     uuid,
  p_action        text,
  p_changes       jsonb,
  p_created_at    timestamptz
) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT encode(digest(
    COALESCE(p_previous_hash, '0')                                            || '|' ||
    COALESCE(p_case_id::text, '')                                             || '|' ||
    p_actor_hash                                                              || '|' ||
    p_entity_type                                                             || '|' ||
    COALESCE(p_entity_id::text, '')                                           || '|' ||
    p_action                                                                  || '|' ||
    COALESCE(p_changes::text, '')                                             || '|' ||
    to_char(p_created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'sha256'
  ), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.compute_wb_audit_hash_v1(
  p_previous_hash text,
  p_case_id       uuid,
  p_actor_hash    text,
  p_entity_type   text,
  p_entity_id     uuid,
  p_action        text,
  p_changes       jsonb,
  p_created_at    timestamptz
) RETURNS text
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
  -- Deliberately STABLE, not IMMUTABLE: the result depends on the session
  -- timezone. That is the defect; the function exists only so historic
  -- rows can still be verified under the formula they were written with.
  SELECT encode(digest(
    COALESCE(p_previous_hash, '0')   || '|' ||
    COALESCE(p_case_id::text, '')    || '|' ||
    p_actor_hash                     || '|' ||
    p_entity_type                    || '|' ||
    COALESCE(p_entity_id::text, '')  || '|' ||
    p_action                         || '|' ||
    COALESCE(p_changes::text, '')    || '|' ||
    p_created_at::text,
    'sha256'
  ), 'hex');
$$;

-- ──────────────────────────────────────────────────────────────────────
-- 2. Trigger — chain part only
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.whistleblowing_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_changes    jsonb;
  v_action     audit_action;
  v_case_id    uuid;
  v_entity_id  uuid;
  v_actor_hash text;
  v_user_id    uuid;
  v_prev_hash  varchar(64);
  v_entry_hash varchar(64);
  v_new        jsonb;
  v_old        jsonb;
  v_diff       jsonb := '{}'::jsonb;
  v_key        text;
  v_created_at timestamptz;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN v_new := to_jsonb(NEW); END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN v_old := to_jsonb(OLD); END IF;

  v_action := CASE TG_OP
    WHEN 'INSERT' THEN 'create'::audit_action
    WHEN 'DELETE' THEN 'delete'::audit_action
    ELSE 'update'::audit_action
  END;

  IF TG_TABLE_NAME = 'wb_case' THEN
    v_case_id := COALESCE((v_new->>'id')::uuid, (v_old->>'id')::uuid);
  ELSE
    v_case_id := COALESCE((v_new->>'case_id')::uuid, (v_old->>'case_id')::uuid);
  END IF;

  v_entity_id := COALESCE((v_new->>'id')::uuid, (v_old->>'id')::uuid);

  -- Actor identity is HASHED — never store the user_id directly in wb
  -- audit log (HinSchG §8 confidentiality requirement). Unchanged.
  v_user_id := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
  v_actor_hash := encode(
    digest(COALESCE(v_user_id::text, 'system') || '|' || v_case_id::text, 'sha256'),
    'hex'
  );

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

  -- S03-14: the report token and any other credential is stripped here
  -- too — the confidential chain is still a log, not a token store.
  v_changes := audit_scrub_changes(TG_TABLE_NAME, v_changes);

  PERFORM pg_advisory_xact_lock(hashtext('wb_audit:' || v_case_id::text));

  v_created_at := clock_timestamp();

  -- ORDER BY id was the tiebreak before, i.e. a random UUID. Ordering by
  -- created_at alone is unambiguous here because the trigger uses
  -- clock_timestamp(), not now() — but the entry_hash tiebreak makes the
  -- order total instead of merely usually-total.
  SELECT entry_hash INTO v_prev_hash
  FROM whistleblowing_audit_log
  WHERE case_id = v_case_id
  ORDER BY created_at DESC, entry_hash DESC
  LIMIT 1;

  v_entry_hash := compute_wb_audit_hash_v2(
    v_prev_hash, v_case_id, v_actor_hash, TG_TABLE_NAME,
    v_entity_id, v_action::text, v_changes, v_created_at
  );

  INSERT INTO whistleblowing_audit_log (
    case_id, actor_role, actor_hash,
    entity_type, entity_id, action, changes,
    previous_hash, entry_hash, created_at, hash_version
  ) VALUES (
    v_case_id,
    NULLIF(current_setting('app.current_user_role', true), ''),
    v_actor_hash,
    TG_TABLE_NAME, v_entity_id, v_action, v_changes,
    v_prev_hash, v_entry_hash, v_created_at, 2
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────
-- 3. Append-only, and a fork guard like the main chain
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.wb_audit_log_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO audit_log_write_attempt (operation, table_name, row_id, detail)
  VALUES (TG_OP, 'whistleblowing_audit_log', OLD.id,
          'refused — the HinSchG §8 chain is append-only');
  RAISE EXCEPTION
    'whistleblowing_audit_log is append-only — % is refused (S03-15)', TG_OP
    USING ERRCODE = 'raise_exception';
END;
$$;

DROP TRIGGER IF EXISTS wb_audit_log_append_only_trg ON whistleblowing_audit_log;
CREATE TRIGGER wb_audit_log_append_only_trg
  BEFORE UPDATE OR DELETE ON whistleblowing_audit_log
  FOR EACH ROW EXECUTE FUNCTION wb_audit_log_append_only();
ALTER TABLE whistleblowing_audit_log
  ENABLE ALWAYS TRIGGER wb_audit_log_append_only_trg;

DO $wbfork$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wb_audit_log_case_prev_uniq'
      AND conrelid = 'whistleblowing_audit_log'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM whistleblowing_audit_log
    GROUP BY case_id, previous_hash HAVING count(*) > 1
  ) THEN
    ALTER TABLE whistleblowing_audit_log
      ADD CONSTRAINT wb_audit_log_case_prev_uniq
      UNIQUE NULLS NOT DISTINCT (case_id, previous_hash);
  END IF;
END
$wbfork$;

-- ──────────────────────────────────────────────────────────────────────
-- 4. The verifier that did not exist
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.wb_audit_chain_verify(p_case_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  WITH ordered AS (
    SELECT
      w.id, w.case_id, w.hash_version, w.entry_hash, w.previous_hash,
      LAG(w.entry_hash) OVER (PARTITION BY w.case_id ORDER BY w.created_at, w.entry_hash) AS expected_prev,
      CASE w.hash_version
        WHEN 2 THEN compute_wb_audit_hash_v2(
          w.previous_hash, w.case_id, w.actor_hash, w.entity_type,
          w.entity_id, w.action::text, w.changes, w.created_at)
        WHEN 1 THEN compute_wb_audit_hash_v1(
          w.previous_hash, w.case_id, w.actor_hash, w.entity_type,
          w.entity_id, w.action::text, w.changes, w.created_at)
        ELSE NULL
      END AS recomputed
    FROM whistleblowing_audit_log w
    WHERE p_case_id IS NULL OR w.case_id = p_case_id
  )
  SELECT jsonb_build_object(
    'total',           count(*),
    'rowMismatches',   count(*) FILTER (WHERE recomputed IS NULL OR entry_hash <> recomputed),
    'chainMismatches', count(*) FILTER (WHERE COALESCE(previous_hash,'') <> COALESCE(expected_prev,'')),
    'v1',              count(*) FILTER (WHERE hash_version = 1),
    'v2',              count(*) FILTER (WHERE hash_version = 2),
    'healthy',
      count(*) FILTER (WHERE recomputed IS NULL OR entry_hash <> recomputed) = 0
      AND count(*) FILTER (WHERE COALESCE(previous_hash,'') <> COALESCE(expected_prev,'')) = 0
  )
  FROM ordered;
$$;

COMMENT ON FUNCTION public.wb_audit_chain_verify(uuid) IS
  'S03-15: verification of the HinSchG §8 chain. v1 rows verify under the session-TZ formula they were written with — a v1 row that fails on one host and passes on another is the defect, not a tamper; run the check with TimeZone=UTC as the migration runner does.';
