-- 0401_audit_chain_assign_and_guards.sql
-- ARCTOS-FULL-2026-08-31 · WP4 · S03-02, S03-05, S03-06, S03-14, S03-16
--
-- Three structural changes to how audit_log is written and protected.
--
-- ── A. The chain is assigned by the table, not by the caller (S03-05) ──
--
-- Until now `audit_trigger()` computed scope/previous_hash/entry_hash and
-- then INSERTed. Anything that INSERTed into audit_log directly therefore
-- landed in the table with `entry_hash = NULL`, `previous_hash_scope =
-- NULL` and `hash_version = 1` (the column default) — outside every
-- integrity check and outside every external anchor. Six production paths
-- did exactly that, among them GDPR erasure, the retention hard-delete
-- cron and the controlled-copy download; `/integrity` reported those rows
-- as "pre-rev2 legacy rows", i.e. as historic residue, while live code
-- kept producing them.
--
-- The chain logic moves into a BEFORE INSERT trigger on audit_log itself.
-- Every insert — trigger, raw SQL, migration, psql — is chained, scoped,
-- scrubbed and hashed, or it does not enter the table. Caller-supplied
-- values for the chain columns are ignored, not trusted.
--
-- ── B. The append-only guard is no longer bypassable (S03-02) ──────────
--
-- `hash_version` came off the UPDATE allow-list: the audit reproduced
-- that a single allowed UPDATE setting `changes` and `hash_version = 0`
-- makes arbitrary content forgery invisible while `entry_hash` — and with
-- it the anchored Merkle root — stays bit identical. The verifier skipped
-- v0 rows, so `/integrity` still answered healthy.
--
-- The redaction columns are allowed **only** on the one transition that
-- legitimately needs them: NULL → NOT NULL on `pii_tombstoned_at`, i.e.
-- the first (and only) GDPR Art. 17 tombstone of that row. Everything
-- else, `content_commitment` and `hash_version` included, is immutable.
--
-- All guards are `ENABLE ALWAYS`. `SET session_replication_role =
-- 'replica'` — the bypass the audit used to rewrite the whole chain, and
-- a pattern the project's own tests use — no longer disables them.
--
-- ── C. Redaction becomes a chain event (S03-06) ────────────────────────
--
-- A tombstone used to be an invisible in-place edit that broke the
-- recompute for ever. Now an AFTER UPDATE trigger writes a normal, hashed,
-- anchorable audit entry recording that row X was redacted, by whom and
-- why. For v4 rows the redacted row itself still verifies (the commitment
-- is preserved); for pre-v4 rows the redaction event is what proves the
-- row was redacted rather than tampered with.

-- ──────────────────────────────────────────────────────────────────────
-- A. BEFORE INSERT — chain assignment
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_log_chain_assign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_prev_hash varchar(64);
  v_scope     text;
BEGIN
  -- Identity and time are fixed here so both are hash inputs.
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;
  IF NEW.created_at IS NULL THEN
    NEW.created_at := now();
  END IF;

  -- Scope is derived, never accepted from the caller. A row that lied
  -- about its scope would sit in another tenant's chain.
  v_scope := 'org:' || COALESCE(NEW.org_id::text, 'platform');
  NEW.previous_hash_scope := v_scope;

  -- S03-14: credentials never enter the immutable log.
  NEW.changes := audit_scrub_changes(NEW.entity_type, NEW.changes);

  -- S03-03: actor fields and payload are bound into one commitment.
  NEW.content_commitment := audit_content_commitment(
    NEW.changes, NEW.user_email, NEW.user_name, NEW.ip_address, NEW.entity_title
  );

  -- #0343 kept: per-scope transaction advisory lock. S03-09 additionally
  -- adds a DB-enforced UNIQUE (previous_hash_scope, previous_hash) in
  -- migration 0402, which is what actually makes a fork impossible under
  -- REPEATABLE READ, where the lock alone is not sufficient because the
  -- blocked transaction keeps its old snapshot.
  PERFORM audit_warn_non_read_committed();
  PERFORM pg_advisory_xact_lock(hashtext('audit_chain:' || v_scope));

  SELECT entry_hash INTO v_prev_hash
  FROM audit_log
  WHERE previous_hash_scope = v_scope
  ORDER BY chain_seq DESC
  LIMIT 1;

  NEW.previous_hash := v_prev_hash;
  NEW.hash_version  := 4;
  NEW.entry_hash    := compute_audit_hash_v4(
    v_prev_hash,
    NEW.id,
    NEW.org_id,
    NEW.user_id,
    NEW.entity_type,
    NEW.entity_id,
    NEW.action::text,
    NEW.content_commitment,
    NEW.action_detail,
    NEW.metadata,
    NEW.created_at,
    v_scope
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.audit_log_chain_assign() IS
  'S03-05: single choke point for the hash chain. Every INSERT into audit_log — from the generic trigger, from application SQL, from a migration — is scoped, scrubbed, committed and hashed here. There is no write path that produces an unchained row.';

DROP TRIGGER IF EXISTS audit_log_chain_assign_trg ON audit_log;
CREATE TRIGGER audit_log_chain_assign_trg
  BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_chain_assign();
-- ALWAYS: fires even under session_replication_role = 'replica'.
ALTER TABLE audit_log ENABLE ALWAYS TRIGGER audit_log_chain_assign_trg;

-- ──────────────────────────────────────────────────────────────────────
-- A2. audit_trigger() — payload only, no chain arithmetic
-- ──────────────────────────────────────────────────────────────────────
--
-- Also fixes the whistleblowing leak half of S03-14: `wb_case`,
-- `wb_case_message`, `wb_case_evidence` and `wb_report` carry BOTH this
-- generic trigger and `whistleblowing_audit_trigger`. The confidential
-- one hashes the actor identity on purpose (HinSchG §8); the generic one
-- wrote the same event with `user_id`, `user_email`, `user_name` and the
-- full row content — including `wb_report.report_token` — into the
-- org-wide log, undoing the separation migration 0284 promised.
-- Here the generic entry is reduced to an identity-free existence record.
-- Removing the generic trigger from those tables altogether is S07-01 and
-- belongs to WP8; this change is safe either way.

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_changes        jsonb;
  v_action         audit_action;
  v_entity_id      uuid;
  v_entity_title   text;
  v_user_id        uuid;
  v_user_email     text;
  v_user_name      text;
  v_org_id         uuid;
  v_new            jsonb;
  v_old            jsonb;
  v_diff           jsonb := '{}'::jsonb;
  v_key            text;
  v_action_detail  text;
  v_reason         text;
  v_metadata       jsonb;
  v_confidential   boolean;
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

  v_user_id       := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
  v_user_email    := NULLIF(current_setting('app.current_user_email', true), '');
  v_user_name     := NULLIF(current_setting('app.current_user_name', true), '');
  v_action_detail := NULLIF(current_setting('app.audit_action_detail', true), '');
  v_reason        := NULLIF(current_setting('app.audit_reason', true), '');

  IF v_reason IS NOT NULL THEN
    v_metadata := jsonb_build_object('reason', v_reason);
  ELSE
    v_metadata := NULL;
  END IF;

  -- S03-14 / HinSchG §8: whistleblowing tables get an identity-free
  -- existence record in the org-wide log. The full, confidential record
  -- lives in whistleblowing_audit_log with a hashed actor.
  v_confidential := TG_TABLE_NAME IN
    ('wb_case', 'wb_case_message', 'wb_case_evidence', 'wb_report', 'wb_case_task');

  IF v_confidential THEN
    v_changes       := jsonb_build_object('confidential', true);
    v_entity_title  := NULL;
    v_user_id       := NULL;
    v_user_email    := NULL;
    v_user_name     := NULL;
    v_metadata      := jsonb_build_object(
      'confidential_channel', 'whistleblowing',
      'detail_location',      'whistleblowing_audit_log'
    );
    v_action_detail := 'confidential_redacted';
  END IF;

  -- No chain arithmetic here: audit_log_chain_assign() owns it.
  INSERT INTO audit_log (
    org_id, user_id, user_email, user_name,
    entity_type, entity_id, entity_title,
    action, action_detail, changes, metadata
  ) VALUES (
    v_org_id, v_user_id, v_user_email, v_user_name,
    TG_TABLE_NAME, v_entity_id, v_entity_title,
    v_action, v_action_detail, v_changes, v_metadata
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ──────────────────────────────────────────────────────────────────────
-- B. Append-only guard on UPDATE
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_log_tombstone_only_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_key text;
  -- Columns a lawful GDPR Art. 17 redaction has to overwrite. They are
  -- accepted ONLY on the NULL → NOT NULL transition of pii_tombstoned_at.
  -- `hash_version` is deliberately NOT here (S03-02) and neither is
  -- `content_commitment`: preserving it is what keeps the row verifiable.
  v_redactable text[] := ARRAY[
    'user_email', 'user_name', 'ip_address', 'changes',
    'pii_tombstoned_at', 'pii_tombstone_reason'
  ];
  v_is_tombstone boolean;
BEGIN
  v_is_tombstone := OLD.pii_tombstoned_at IS NULL
                AND NEW.pii_tombstoned_at IS NOT NULL;

  FOR v_key IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
    IF to_jsonb(NEW)->v_key IS DISTINCT FROM to_jsonb(OLD)->v_key THEN
      IF NOT (v_key = ANY(v_redactable)) THEN
        RAISE EXCEPTION
          'audit_log is append-only — column % cannot be updated (id=%)',
          v_key, OLD.id
          USING ERRCODE = 'raise_exception';
      END IF;
      IF NOT v_is_tombstone THEN
        RAISE EXCEPTION
          'audit_log column % may only change during the initial GDPR Art. 17 tombstone of the row (use tombstone_audit_entry); id=%',
          v_key, OLD.id
          USING ERRCODE = 'raise_exception';
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_log_tombstone_guard ON audit_log;
CREATE TRIGGER audit_log_tombstone_guard
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_tombstone_only_guard();
ALTER TABLE audit_log ENABLE ALWAYS TRIGGER audit_log_tombstone_guard;

-- ──────────────────────────────────────────────────────────────────────
-- C. Redaction leaves a chained trace
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_log_redaction_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF OLD.pii_tombstoned_at IS NULL AND NEW.pii_tombstoned_at IS NOT NULL THEN
    INSERT INTO audit_log (
      org_id, user_id, user_email, user_name,
      entity_type, entity_id, entity_title,
      action, action_detail, changes, metadata
    ) VALUES (
      OLD.org_id,
      NULLIF(current_setting('app.current_user_id', true), '')::uuid,
      NULLIF(current_setting('app.current_user_email', true), ''),
      NULLIF(current_setting('app.current_user_name', true), ''),
      'audit_log',
      OLD.id,
      NULL,
      'update',
      'pii_tombstone',
      jsonb_build_object(
        'redacted_entry_hash',        OLD.entry_hash,
        'redacted_hash_version',      OLD.hash_version,
        'redacted_content_commitment', OLD.content_commitment,
        'redacted_chain_seq',         OLD.chain_seq
      ),
      jsonb_build_object(
        'reason',    NEW.pii_tombstone_reason,
        'legal_basis', 'GDPR Art. 17'
      )
    );
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.audit_log_redaction_event() IS
  'S03-06: a GDPR redaction is itself an auditable, hashed, anchorable event. For pre-v4 rows, whose payload can no longer be recomputed after redaction, the presence of this event is what distinguishes a lawful redaction from tampering.';

DROP TRIGGER IF EXISTS audit_log_redaction_event_trg ON audit_log;
CREATE TRIGGER audit_log_redaction_event_trg
  AFTER UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_redaction_event();
ALTER TABLE audit_log ENABLE ALWAYS TRIGGER audit_log_redaction_event_trg;

-- ──────────────────────────────────────────────────────────────────────
-- D. DELETE and TRUNCATE (S03-16)
-- ──────────────────────────────────────────────────────────────────────
--
-- The DELETE rule `DO INSTEAD NOTHING` did prevent deletion, but it
-- reported `DELETE 0` — success — so an attempt was invisible to the
-- caller and to any monitoring. It is replaced by a BEFORE DELETE ROW
-- trigger that keeps the no-op semantics (nothing is ever removed, so no
-- existing caller changes behaviour) and raises a WARNING plus a counter
-- row that the daily verification job reports.
--
-- TRUNCATE is the actual hole: rules do not fire on TRUNCATE and no
-- ON TRUNCATE trigger existed, so `TRUNCATE audit_log CASCADE` removed
-- the entire trail without an error. That one is refused outright — there
-- is no legitimate caller.

CREATE TABLE IF NOT EXISTS audit_log_write_attempt (
  id          bigserial PRIMARY KEY,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  operation   text        NOT NULL,
  table_name  text        NOT NULL,
  db_user     text        NOT NULL DEFAULT session_user,
  row_id      uuid,
  detail      text
);

COMMENT ON TABLE audit_log_write_attempt IS
  'S03-16: refused destructive operations on the log tables. Written by the append-only guards; surfaced by the daily chain verification job and by /api/v1/audit-log/integrity.';

CREATE OR REPLACE FUNCTION public.audit_log_refuse_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO audit_log_write_attempt (operation, table_name, row_id, detail)
  VALUES ('DELETE', TG_TABLE_NAME, OLD.id,
          'refused — audit_log is append-only (ADR-011)');
  RAISE WARNING
    'audit_log is append-only: DELETE of row % was refused and recorded in audit_log_write_attempt',
    OLD.id;
  -- Cancel the delete for this row without aborting the statement, which
  -- preserves the previous (rule-based) contract for existing callers.
  RETURN NULL;
END;
$$;

DROP RULE IF EXISTS audit_log_no_delete ON audit_log;
DROP TRIGGER IF EXISTS audit_log_refuse_delete_trg ON audit_log;
CREATE TRIGGER audit_log_refuse_delete_trg
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_refuse_delete();
ALTER TABLE audit_log ENABLE ALWAYS TRIGGER audit_log_refuse_delete_trg;

CREATE OR REPLACE FUNCTION public.log_table_refuse_truncate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO audit_log_write_attempt (operation, table_name, detail)
  VALUES ('TRUNCATE', TG_TABLE_NAME, 'refused — append-only log table');
  RAISE EXCEPTION
    'TRUNCATE is refused on append-only log table % (ADR-011 rev.4 / S03-16)',
    TG_TABLE_NAME
    USING ERRCODE = 'raise_exception';
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'audit_log', 'audit_anchor', 'whistleblowing_audit_log',
    'access_log', 'data_export_log', 'audit_log_write_attempt'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_no_truncate', t);
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION log_table_refuse_truncate()',
        t || '_no_truncate', t);
      EXECUTE format('ALTER TABLE public.%I ENABLE ALWAYS TRIGGER %I', t, t || '_no_truncate');
    END IF;
  END LOOP;
END $$;

-- The attempt table itself is append-only.
CREATE OR REPLACE RULE audit_log_write_attempt_no_update AS
  ON UPDATE TO audit_log_write_attempt DO INSTEAD NOTHING;
CREATE OR REPLACE RULE audit_log_write_attempt_no_delete AS
  ON DELETE TO audit_log_write_attempt DO INSTEAD NOTHING;
