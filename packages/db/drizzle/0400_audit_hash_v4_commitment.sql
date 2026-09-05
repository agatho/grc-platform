-- 0400_audit_hash_v4_commitment.sql
-- ARCTOS-FULL-2026-08-31 · WP4 · S03-02, S03-03, S03-06, S03-14
--
-- Introduces hash-chain formula **v4** and the content commitment it is
-- built on. Three audit findings collapse into one root cause and are
-- fixed together here:
--
--   S03-03  `user_email`, `user_name`, `ip_address` and `entity_title`
--           are NOT hash inputs, so "who did it" was silently rewritable
--           while `/integrity` kept reporting healthy.
--   S03-02  `changes` is a hash input but was on the guard's UPDATE
--           allow-list together with `hash_version`; flipping the version
--           to 0 switched verification off for the row while leaving
--           `entry_hash` — and therefore the anchored Merkle root — bit
--           identical.
--   S03-06  `tombstone_audit_entry()` rewrites `changes` for GDPR Art. 17,
--           which breaks the recompute permanently: the first real erasure
--           request pins `/integrity` to 503 for ever.
--
-- ── Design ────────────────────────────────────────────────────────────
--
-- v4 does NOT hash the redactable payload directly. It hashes a
-- **content commitment**:
--
--   content_commitment = SHA256(changes | user_email | user_name |
--                               ip_address | entity_title)
--   entry_hash         = SHA256(previous_hash | id | org_id | user_id |
--                               entity_type | entity_id | action |
--                               content_commitment | action_detail |
--                               metadata | created_at_utc | scope)
--
-- Consequences, all three findings at once:
--
--  * the actor fields are now cryptographically bound to the entry
--    (S03-03) — changing `user_email` changes the commitment, which
--    changes `entry_hash`, which breaks the row AND every following link;
--  * `id` is bound too, so rows can no longer be swapped or re-keyed;
--  * a redaction can rewrite the payload while *preserving* the
--    commitment, so `entry_hash` still recomputes and the chain stays
--    verifiable after a lawful erasure (S03-06). The commitment is then
--    no longer a commitment to the *current* payload — which is exactly
--    what a redaction means — and the verifier reports that state
--    explicitly instead of as a chain break;
--  * for every row that is NOT tombstoned, the verifier additionally
--    re-derives the commitment from the live column values. That check is
--    what makes S03-02-style content tampering visible: an attacker who
--    edits `changes` must also fix `content_commitment`, which the guard
--    forbids, and fixing it would change `entry_hash` and the anchored
--    Merkle root.
--
-- v1/v2/v3 rows are left untouched and keep verifying under their own
-- formula; `content_commitment` stays NULL for them. Only new rows are
-- written as v4. No rehash of history — a rehash is exactly the operation
-- that would make an existing forgery permanent (see ADR-026 and the
-- `remedy` text corrected in this wave).

-- ──────────────────────────────────────────────────────────────────────
-- 1. Column
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS content_commitment varchar(64);

COMMENT ON COLUMN audit_log.content_commitment IS
  'v4 hash chain: SHA-256 over the redactable payload (changes, user_email, user_name, ip_address, entity_title). Immutable — a GDPR redaction rewrites the payload but keeps this commitment so entry_hash still recomputes (ADR-011 rev.4 / S03-03, S03-06).';

-- v4 rows must carry a commitment. Older versions must not.
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_v4_commitment_ck;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_v4_commitment_ck
  CHECK (hash_version < 4 OR content_commitment IS NOT NULL)
  NOT VALID;

-- ──────────────────────────────────────────────────────────────────────
-- 2. Commitment helper
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_content_commitment(
  p_changes      jsonb,
  p_user_email   text,
  p_user_name    text,
  p_ip_address   inet,
  p_entity_title text
) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT encode(digest(
    COALESCE(p_changes::text, '')      || '|' ||
    COALESCE(p_user_email, '')         || '|' ||
    COALESCE(p_user_name, '')          || '|' ||
    COALESCE(p_ip_address::text, '')   || '|' ||
    COALESCE(p_entity_title, ''),
    'sha256'
  ), 'hex');
$$;

COMMENT ON FUNCTION public.audit_content_commitment(jsonb, text, text, inet, text) IS
  'S03-03: binds the four previously unhashed actor/payload columns into a single 64-hex commitment that feeds compute_audit_hash_v4.';

-- ──────────────────────────────────────────────────────────────────────
-- 3. compute_audit_hash_v4
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.compute_audit_hash_v4(
  p_previous_hash       text,
  p_id                  uuid,
  p_org_id              uuid,
  p_user_id             uuid,
  p_entity_type         text,
  p_entity_id           uuid,
  p_action              text,
  p_content_commitment  text,
  p_action_detail       text,
  p_metadata            jsonb,
  p_created_at          timestamptz,
  p_previous_hash_scope text
) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT encode(digest(
    COALESCE(p_previous_hash, '0')                                            || '|' ||
    COALESCE(p_id::text, '')                                                  || '|' ||
    COALESCE(p_org_id::text, '')                                              || '|' ||
    COALESCE(p_user_id::text, '')                                             || '|' ||
    p_entity_type                                                             || '|' ||
    COALESCE(p_entity_id::text, '')                                           || '|' ||
    p_action                                                                  || '|' ||
    COALESCE(p_content_commitment, '')                                        || '|' ||
    COALESCE(p_action_detail, '')                                             || '|' ||
    COALESCE(p_metadata::text, '')                                            || '|' ||
    -- TZ-invariant, unchanged from v3 (ADR-026).
    to_char(p_created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' ||
    p_previous_hash_scope,
    'sha256'
  ), 'hex');
$$;

COMMENT ON FUNCTION public.compute_audit_hash_v4(text, uuid, uuid, uuid, text, uuid, text, text, text, jsonb, timestamptz, text) IS
  'ADR-011 rev.4 hash formula. Adds row id and the content commitment (actor fields + payload) over v3.';

-- ──────────────────────────────────────────────────────────────────────
-- 4. Secret scrubbing (S03-14)
-- ──────────────────────────────────────────────────────────────────────
--
-- The trigger writes `to_jsonb(NEW)` verbatim into `audit_log.changes`.
-- Ten audited tables carry credential columns, so password hashes, OIDC
-- client secrets, refresh/access tokens and mailbox tokens ended up in a
-- table from which nothing can be deleted and which every admin/auditor
-- of the tenant can read. That is a reportable data-protection defect in
-- its own right, and it is also an escalation path: the log becomes a
-- credential store.
--
-- Two layers:
--   (a) a declarative deny list per (entity_type, column) so the set is
--       auditable and extendable without touching PL/pgSQL;
--   (b) a recursive key-pattern fallback that catches nested objects and
--       columns nobody registered — `redact_pii_jsonb` (owned by WP8 for
--       the PII side) is deliberately NOT reused here: this is about
--       secrets, runs on every write, and must not depend on a function
--       another work package is reshaping.

CREATE TABLE IF NOT EXISTS audit_sensitive_column (
  entity_type text NOT NULL,
  column_name text NOT NULL,
  reason      text NOT NULL DEFAULT 'credential',
  PRIMARY KEY (entity_type, column_name)
);

COMMENT ON TABLE audit_sensitive_column IS
  'S03-14: columns whose values must never be written into audit_log.changes. Values are replaced by ''__redacted__''; a change is still visible as a key, only the secret is gone.';

INSERT INTO audit_sensitive_column (entity_type, column_name, reason) VALUES
  ('bi_shared_dashboard',  'password',           'credential'),
  ('bi_shared_dashboard',  'share_token',        'credential'),
  ('connector_credential', 'encrypted_payload',  'credential'),
  ('connector_credential', 'refresh_token',      'credential'),
  ('dd_session',           'access_token',       'credential'),
  ('device_registration',  'device_token',       'credential'),
  ('portal_session',       'access_token',       'credential'),
  ('sso_config',           'oidc_client_secret', 'credential'),
  ('user',                 'password_hash',      'credential'),
  ('user',                 'ical_token',         'credential'),
  ('vendor_due_diligence', 'access_token',       'credential'),
  ('wb_report',            'report_token',       'credential')
ON CONFLICT (entity_type, column_name) DO NOTHING;

-- Key-name patterns applied recursively at every JSON depth.
--
-- The allow-list of exceptions matters: LLM bookkeeping columns
-- (`prompt_tokens`, `total_tokens`, …) are integers, not secrets, and
-- redacting them would destroy usage evidence for no gain.
CREATE OR REPLACE FUNCTION public.audit_key_is_secret(p_key text)
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT lower(p_key) ~ '(password|passwd|secret|token|api[_-]?key|private[_-]?key|credential|access[_-]?key|session[_-]?key|(^|[^a-z])t?otp([^a-z]|$)|mfa[_-]?seed|recovery[_-]?code|signing[_-]?key|encrypted[_-]?payload)'
     AND lower(p_key) !~ '(token[_-]?count|tokens?[_-]?used|(total|input|output|prompt|completion|cached)[_-]?tokens)';
$$;

-- Cheap pre-check: does this payload contain any key worth inspecting?
-- One regex over the serialised value, so the overwhelming majority of
-- audit writes skip the recursive walk entirely.
CREATE OR REPLACE FUNCTION public.audit_payload_may_contain_secret(p_value jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT p_value IS NOT NULL
     AND lower(p_value::text) ~ '(password|passwd|secret|token|api[_-]?key|private[_-]?key|credential|access[_-]?key|session[_-]?key|otp|mfa|recovery[_-]?code|signing[_-]?key|encrypted[_-]?payload)';
$$;

CREATE OR REPLACE FUNCTION public.audit_scrub_secrets_jsonb(p_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
AS $$
DECLARE
  v_key    text;
  v_out    jsonb;
  v_item   jsonb;
  v_arr    jsonb := '[]'::jsonb;
BEGIN
  IF p_value IS NULL THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(p_value) = 'object' THEN
    v_out := '{}'::jsonb;
    FOR v_key IN SELECT jsonb_object_keys(p_value) LOOP
      IF audit_key_is_secret(v_key) THEN
        v_out := v_out || jsonb_build_object(v_key, '__redacted__'::text);
      ELSE
        v_out := v_out || jsonb_build_object(
          v_key, audit_scrub_secrets_jsonb(p_value -> v_key)
        );
      END IF;
    END LOOP;
    RETURN v_out;
  ELSIF jsonb_typeof(p_value) = 'array' THEN
    FOR v_item IN SELECT jsonb_array_elements(p_value) LOOP
      v_arr := v_arr || jsonb_build_array(audit_scrub_secrets_jsonb(v_item));
    END LOOP;
    RETURN v_arr;
  ELSE
    RETURN p_value;
  END IF;
END;
$$;

-- Entity-aware entry point: deny list first, then the recursive pattern
-- pass. `changes` has the shapes {'new': {...}}, {'old': {...}} and
-- {'col': {'old': …, 'new': …}} — the recursive pass handles all three,
-- the deny list needs to look one level deeper for the diff shape.
CREATE OR REPLACE FUNCTION public.audit_scrub_changes(
  p_entity_type text,
  p_changes     jsonb
) RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_out  jsonb;
  v_col  text;
  v_cols text[];
BEGIN
  IF p_changes IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(array_agg(column_name), ARRAY[]::text[])
    INTO v_cols
    FROM audit_sensitive_column
   WHERE entity_type = p_entity_type;

  -- Fast path: no declared column for this entity type and no
  -- secret-looking key anywhere in the payload.
  IF cardinality(v_cols) = 0 AND NOT audit_payload_may_contain_secret(p_changes) THEN
    RETURN p_changes;
  END IF;

  v_out := audit_scrub_secrets_jsonb(p_changes);

  -- Declared columns for this entity type, in all three payload shapes.
  FOREACH v_col IN ARRAY v_cols
  LOOP
    IF v_out ? 'new' AND jsonb_typeof(v_out->'new') = 'object' AND (v_out->'new') ? v_col THEN
      v_out := jsonb_set(v_out, ARRAY['new', v_col], '"__redacted__"'::jsonb);
    END IF;
    IF v_out ? 'old' AND jsonb_typeof(v_out->'old') = 'object' AND (v_out->'old') ? v_col THEN
      v_out := jsonb_set(v_out, ARRAY['old', v_col], '"__redacted__"'::jsonb);
    END IF;
    IF v_out ? v_col THEN
      v_out := jsonb_set(v_out, ARRAY[v_col], '{"old":"__redacted__","new":"__redacted__"}'::jsonb);
    END IF;
  END LOOP;

  RETURN v_out;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────
-- 5. Isolation-level warning (S03-09)
-- ──────────────────────────────────────────────────────────────────────
--
-- The per-scope advisory lock only serialises correctly under READ
-- COMMITTED; under REPEATABLE READ the blocked writer keeps its old
-- snapshot and reads a stale chain tail. Migration 0402 adds a UNIQUE
-- constraint that turns that into a hard error instead of a silent fork.
-- This warning makes the cause obvious in the log when it happens — no
-- codepath in the repo sets an isolation level today, and that silent
-- assumption is what the finding is about.
CREATE OR REPLACE FUNCTION public.audit_warn_non_read_committed()
RETURNS void
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE WARNING
      'audit_log write under isolation level "%" — the per-scope advisory lock cannot prevent a stale chain-tail read here; audit_log_scope_prev_uniq will reject a forked insert (S03-09).',
      current_setting('transaction_isolation');
  END IF;
END;
$$;

COMMENT ON FUNCTION public.audit_scrub_changes(text, jsonb) IS
  'S03-14: strips credentials out of the audit payload before it is hashed and stored. Applied by audit_log_chain_assign() on EVERY insert, so no write path can bypass it.';
