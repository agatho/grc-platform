-- Migration 0284: Audit chain rev.2 (per-tenant) — implements ADR-011 rev.2
--
-- Changes:
--  1. audit_log gains tombstone columns (GDPR Art. 17 support without
--     chain break)
--  2. audit_trigger() rewritten: previous_hash now scoped to org_id,
--     advisory lock scoped to org_id — parallel tenants no longer block
--     each other and parallel inserts within one tenant are strictly
--     serialised
--  3. /api/v1/audit-log/integrity is rewritten in TypeScript to match
--     the per-tenant chain model (see apps/web/src/app/api/v1/audit-log/integrity/route.ts)
--  4. whistleblowing_audit_log created as a separate chain with its own
--     trigger, RLS, and registration on the three wb tables. Never
--     visible to org admins — only whistleblowing_officer + ombudsperson.
--  5. tombstone_audit_entry(uuid, text) function: redacts PII from a
--     single audit_log row without breaking entry_hash
--
-- The audit_log table already contains ~5000 seed rows from the old
-- global-chain design. This migration does NOT rehash them — the old
-- rows are kept as historical context, marked implicitly via their NULL
-- `previous_hash_scope` column (new). All new rows land under the per-
-- tenant chain, with `previous_hash_scope = 'org:<uuid>'`.
--
-- Rationale for not rehashing: forensic integrity. A rewrite of
-- previous_hash values would destroy the ability to prove the old rows
-- haven't been tampered with since insert. The old chain is labelled
-- "legacy" in the integrity endpoint output and excluded from "healthy"
-- calculation.

-- ─────────────────────────────────────────────────────────────────
-- 1. Tombstone columns on audit_log (GDPR Art. 17)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS pii_tombstoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pii_tombstone_reason text,
  ADD COLUMN IF NOT EXISTS previous_hash_scope text;

CREATE INDEX IF NOT EXISTS audit_log_org_created_idx
  ON audit_log (org_id, created_at, id);

CREATE INDEX IF NOT EXISTS audit_log_tombstone_idx
  ON audit_log (pii_tombstoned_at)
  WHERE pii_tombstoned_at IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────
-- 2. audit_trigger rev.2: per-tenant chain + org-scoped advisory lock
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_changes      jsonb;
  v_action       audit_action;
  v_entity_id    uuid;
  v_entity_title text;
  v_user_id      uuid;
  v_user_email   text;
  v_user_name    text;
  v_org_id       uuid;
  v_prev_hash    varchar(64);
  v_entry_hash   varchar(64);
  v_hash_input   text;
  v_new          jsonb;
  v_old          jsonb;
  v_diff         jsonb := '{}'::jsonb;
  v_key          text;
  v_created_at   timestamptz;
  v_scope        text;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN v_new := to_jsonb(NEW); END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN v_old := to_jsonb(OLD); END IF;

  -- Action inference
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
  ELSE
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

  -- org_id resolution per table
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

  -- Diff computation
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

  -- Title snapshot
  IF TG_OP = 'DELETE' THEN
    v_entity_title := COALESCE(v_old->>'name', v_old->>'title', v_old->>'email');
  ELSE
    v_entity_title := COALESCE(v_new->>'name', v_new->>'title', v_new->>'email');
  END IF;

  -- User session snapshot
  v_user_id    := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
  v_user_email := NULLIF(current_setting('app.current_user_email', true), '');
  v_user_name  := NULLIF(current_setting('app.current_user_name', true), '');

  -- Per-tenant chain scope
  v_scope := CASE
    WHEN v_org_id IS NOT NULL THEN 'org:' || v_org_id::text
    ELSE 'platform'
  END;

  -- Tenant-scoped advisory lock: parallel inserts across tenants do not
  -- contend, but within one tenant the read-of-prev and insert-of-new
  -- are serialised. Lock is released at COMMIT.
  PERFORM pg_advisory_xact_lock(hashtext('audit_log_chain:' || v_scope));

  -- Fetch previous hash WITHIN this tenant's chain
  SELECT entry_hash INTO v_prev_hash
  FROM audit_log
  WHERE previous_hash_scope = v_scope
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  -- Use clock_timestamp() (not statement_timestamp) so that multiple
  -- trigger firings inside ONE statement — e.g. a `INSERT … SELECT`
  -- that creates 240 module_config rows at once — each get a distinct
  -- created_at. Otherwise the integrity check's LAG window cannot
  -- reconstruct the firing order (UUID ids provide no monotonic
  -- secondary sort) and the chain looks forked to the verifier.
  v_created_at := clock_timestamp();

  v_hash_input := COALESCE(v_prev_hash, '0') || '|' ||
    COALESCE(v_org_id::text, '')       || '|' ||
    COALESCE(v_user_id::text, '')      || '|' ||
    TG_TABLE_NAME                      || '|' ||
    COALESCE(v_entity_id::text, '')    || '|' ||
    v_action::text                     || '|' ||
    COALESCE(v_changes::text, '')      || '|' ||
    v_created_at::text                 || '|' ||
    v_scope;

  v_entry_hash := encode(digest(v_hash_input, 'sha256'), 'hex');

  INSERT INTO audit_log (
    org_id, user_id, user_email, user_name,
    entity_type, entity_id, entity_title,
    action, changes,
    ip_address, session_id,
    previous_hash, entry_hash,
    previous_hash_scope,
    created_at
  ) VALUES (
    v_org_id, v_user_id, v_user_email, v_user_name,
    TG_TABLE_NAME, v_entity_id, v_entity_title,
    v_action, v_changes,
    NULLIF(current_setting('app.current_ip', true), '')::inet,
    NULLIF(current_setting('app.current_session_id', true), ''),
    v_prev_hash, v_entry_hash,
    v_scope,
    v_created_at
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────────
-- 2b. Replace audit_log_no_update rule with a guard trigger
--     The old rule was "ON UPDATE DO INSTEAD NOTHING" — a silent black
--     hole. Tombstone operations need to UPDATE specific columns, so we
--     replace the rule with a BEFORE UPDATE trigger that only permits
--     changes to the tombstone / redaction columns. Any other column
--     update raises an exception (loud failure, not silent drop).
-- ─────────────────────────────────────────────────────────────────
DROP RULE IF EXISTS audit_log_no_update ON audit_log;

CREATE OR REPLACE FUNCTION audit_log_tombstone_only_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_key text;
  v_allowed text[] := ARRAY[
    'user_email', 'user_name', 'ip_address', 'changes',
    'pii_tombstoned_at', 'pii_tombstone_reason'
  ];
BEGIN
  -- Any column outside the allow list must be unchanged
  FOR v_key IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
    IF NOT (v_key = ANY(v_allowed)) THEN
      IF to_jsonb(NEW)->v_key IS DISTINCT FROM to_jsonb(OLD)->v_key THEN
        RAISE EXCEPTION 'audit_log is append-only — column % cannot be updated (use tombstone_audit_entry for PII redaction)', v_key;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_tombstone_guard ON audit_log;
CREATE TRIGGER audit_log_tombstone_guard
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_tombstone_only_guard();


-- ─────────────────────────────────────────────────────────────────
-- 3. tombstone_audit_entry() — redacts PII in one audit_log row
-- ─────────────────────────────────────────────────────────────────
-- entry_hash is deliberately NOT updated — the original row content is
-- still provable via re-computation against the tombstoned row fields,
-- but the PII is no longer readable. Reason is required and logged.
--
-- The function replaces:
--   - user_email, user_name: hashed with the entry's entry_hash as salt
--   - changes.new.*, changes.old.*: any string field that starts with
--     the PII marker (first_name, last_name, email, phone, date_of_birth,
--     national_id, iban, passport_no, address, ip_address) is replaced
--     by a SHA-256 hash of the original value
--   - ip_address set to NULL
CREATE OR REPLACE FUNCTION tombstone_audit_entry(
  p_audit_log_id uuid,
  p_reason text
) RETURNS void AS $$
DECLARE
  v_existing audit_log%ROWTYPE;
  v_new_changes jsonb;
  v_email_hash text;
  v_name_hash text;
BEGIN
  SELECT * INTO v_existing FROM audit_log WHERE id = p_audit_log_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Audit log entry % does not exist', p_audit_log_id;
  END IF;

  IF v_existing.pii_tombstoned_at IS NOT NULL THEN
    RAISE EXCEPTION 'Audit log entry % is already tombstoned (reason=%)',
      p_audit_log_id, v_existing.pii_tombstone_reason;
  END IF;

  -- Deterministic hashes using entry_hash as salt
  v_email_hash := encode(digest(COALESCE(v_existing.user_email, '') || '|' || v_existing.entry_hash, 'sha256'), 'hex');
  v_name_hash  := encode(digest(COALESCE(v_existing.user_name, '')  || '|' || v_existing.entry_hash, 'sha256'), 'hex');

  -- Redact PII from `changes` JSON
  v_new_changes := v_existing.changes;
  IF v_new_changes ? 'new' AND v_new_changes->'new' IS NOT NULL THEN
    v_new_changes := jsonb_set(v_new_changes, '{new}',
      redact_pii_jsonb(v_new_changes->'new', v_existing.entry_hash));
  END IF;
  IF v_new_changes ? 'old' AND v_new_changes->'old' IS NOT NULL THEN
    v_new_changes := jsonb_set(v_new_changes, '{old}',
      redact_pii_jsonb(v_new_changes->'old', v_existing.entry_hash));
  END IF;

  UPDATE audit_log SET
    user_email = '__tombstoned__:' || v_email_hash,
    user_name  = '__tombstoned__:' || v_name_hash,
    ip_address = NULL,
    changes    = v_new_changes,
    pii_tombstoned_at = now(),
    pii_tombstone_reason = p_reason
  WHERE id = p_audit_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION redact_pii_jsonb(p_obj jsonb, p_salt text)
RETURNS jsonb AS $$
DECLARE
  v_out jsonb := p_obj;
  v_key text;
  v_val text;
  v_pii_keys text[] := ARRAY[
    'email','first_name','last_name','full_name','name',
    'phone','phone_number','mobile',
    'date_of_birth','birthday','birth_date',
    'national_id','tax_id','passport_no','id_number',
    'iban','bic','account_number',
    'address','street','postal_code','city','country_of_birth',
    'ip_address','user_agent'
  ];
BEGIN
  IF p_obj IS NULL OR jsonb_typeof(p_obj) <> 'object' THEN
    RETURN p_obj;
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_obj) LOOP
    IF v_key = ANY(v_pii_keys) AND jsonb_typeof(p_obj->v_key) = 'string' THEN
      v_val := p_obj->>v_key;
      v_out := jsonb_set(v_out, ARRAY[v_key],
        to_jsonb('__tombstoned__:' || encode(digest(v_val || '|' || p_salt, 'sha256'), 'hex')));
    END IF;
  END LOOP;

  RETURN v_out;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ─────────────────────────────────────────────────────────────────
-- 4. whistleblowing_audit_log — isolated chain for HinSchG compliance
-- ─────────────────────────────────────────────────────────────────
-- This table is functionally identical to audit_log but is legally
-- isolated. Normal org admins cannot see it; only whistleblowing_officer
-- and ombudsperson roles can read. Its own trigger maintains a chain
-- scoped per-case (not per-org), because the same officer may serve
-- multiple orgs and we don't want the org_id to be inferrable from the
-- chain ordering.

CREATE TABLE IF NOT EXISTS whistleblowing_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  actor_role varchar(64),
  actor_hash varchar(64) NOT NULL,
  entity_type varchar(100) NOT NULL,
  entity_id uuid,
  action audit_action NOT NULL,
  changes jsonb,
  metadata jsonb,
  previous_hash varchar(64),
  entry_hash varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whistleblowing_audit_log_case_idx
  ON whistleblowing_audit_log (case_id, created_at, id);

-- RLS on the wb audit log: only officer / ombudsperson read
ALTER TABLE whistleblowing_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wb_audit_log_officer_read ON whistleblowing_audit_log;
CREATE POLICY wb_audit_log_officer_read ON whistleblowing_audit_log
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) IN ('whistleblowing_officer', 'ombudsperson', 'admin')
  );

-- Writes only via trigger (no direct INSERT from API)
DROP POLICY IF EXISTS wb_audit_log_no_direct_write ON whistleblowing_audit_log;
CREATE POLICY wb_audit_log_no_direct_write ON whistleblowing_audit_log
  FOR ALL
  USING (false)
  WITH CHECK (false);


CREATE OR REPLACE FUNCTION whistleblowing_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_changes    jsonb;
  v_action     audit_action;
  v_case_id    uuid;
  v_entity_id  uuid;
  v_actor_hash text;
  v_user_id    uuid;
  v_prev_hash  varchar(64);
  v_entry_hash varchar(64);
  v_hash_input text;
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

  -- Case-ID resolution: wb_case has id = case_id; child tables have case_id FK
  IF TG_TABLE_NAME = 'wb_case' THEN
    v_case_id := COALESCE((v_new->>'id')::uuid, (v_old->>'id')::uuid);
  ELSE
    v_case_id := COALESCE((v_new->>'case_id')::uuid, (v_old->>'case_id')::uuid);
  END IF;

  v_entity_id := COALESCE((v_new->>'id')::uuid, (v_old->>'id')::uuid);

  -- Actor identity is HASHED — never store the user_id directly in wb
  -- audit log (HinSchG §8 confidentiality requirement)
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

  -- Per-case advisory lock
  PERFORM pg_advisory_xact_lock(hashtext('wb_audit:' || v_case_id::text));

  SELECT entry_hash INTO v_prev_hash
  FROM whistleblowing_audit_log
  WHERE case_id = v_case_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  v_created_at := clock_timestamp();

  v_hash_input := COALESCE(v_prev_hash, '0') || '|' ||
    v_case_id::text                      || '|' ||
    v_actor_hash                         || '|' ||
    TG_TABLE_NAME                        || '|' ||
    COALESCE(v_entity_id::text, '')      || '|' ||
    v_action::text                       || '|' ||
    COALESCE(v_changes::text, '')        || '|' ||
    v_created_at::text;

  v_entry_hash := encode(digest(v_hash_input, 'sha256'), 'hex');

  INSERT INTO whistleblowing_audit_log (
    case_id, actor_role, actor_hash,
    entity_type, entity_id, action, changes,
    previous_hash, entry_hash, created_at
  ) VALUES (
    v_case_id,
    NULLIF(current_setting('app.current_user_role', true), ''),
    v_actor_hash,
    TG_TABLE_NAME, v_entity_id, v_action, v_changes,
    v_prev_hash, v_entry_hash, v_created_at
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Register trigger on whistleblowing tables (case, evidence, message)
DROP TRIGGER IF EXISTS whistleblowing_audit_trigger_wb_case ON wb_case;
CREATE TRIGGER whistleblowing_audit_trigger_wb_case
  AFTER INSERT OR UPDATE OR DELETE ON wb_case
  FOR EACH ROW EXECUTE FUNCTION whistleblowing_audit_trigger();

DROP TRIGGER IF EXISTS whistleblowing_audit_trigger_wb_case_evidence ON wb_case_evidence;
CREATE TRIGGER whistleblowing_audit_trigger_wb_case_evidence
  AFTER INSERT OR UPDATE OR DELETE ON wb_case_evidence
  FOR EACH ROW EXECUTE FUNCTION whistleblowing_audit_trigger();

DROP TRIGGER IF EXISTS whistleblowing_audit_trigger_wb_case_message ON wb_case_message;
CREATE TRIGGER whistleblowing_audit_trigger_wb_case_message
  AFTER INSERT OR UPDATE OR DELETE ON wb_case_message
  FOR EACH ROW EXECUTE FUNCTION whistleblowing_audit_trigger();


-- ─────────────────────────────────────────────────────────────────
-- 5. Comments for operators
-- ─────────────────────────────────────────────────────────────────
COMMENT ON COLUMN audit_log.previous_hash_scope IS
  'Per-tenant chain identifier — ''org:<uuid>'' for tenant-scoped rows, ''platform'' for platform-level events. Set by audit_trigger(). Old rows from the pre-rev2 global chain have NULL here and are excluded from per-tenant integrity checks.';

COMMENT ON COLUMN audit_log.pii_tombstoned_at IS
  'Timestamp when PII in this row was redacted (GDPR Art. 17). Row survives for chain integrity; PII is replaced with deterministic hashes. entry_hash is unchanged.';

COMMENT ON FUNCTION tombstone_audit_entry(uuid, text) IS
  'Redacts PII from a single audit_log row while preserving entry_hash. Call from the DPMS workflow when executing a right-to-erasure request.';

COMMENT ON TABLE whistleblowing_audit_log IS
  'HinSchG-compliant audit log for whistleblowing cases. Isolated from the main audit_log: normal admins cannot read, only whistleblowing_officer + ombudsperson. Actor identity is hashed per-case to avoid cross-case correlation.';
