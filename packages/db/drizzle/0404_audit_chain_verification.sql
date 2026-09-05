-- 0404_audit_chain_verification.sql
-- ARCTOS-FULL-2026-08-31 · WP4 · S03-04, S03-05, S03-08, S03-12
--
-- ── One verification, three callers (S03-04) ──────────────────────────
--
-- The anchor gate `#WAVE10-CRITICAL-01` was a hand-copied second
-- implementation of the check in `/integrity`. It had a `WHEN
-- hash_version = 2` branch, a `WHEN hash_version = 1` branch and an
-- `ELSE entry_hash` fallback — but no branch for v3, which is what 100 %
-- of the live rows are. `expected_eh = entry_hash` compares the stored
-- hash with itself, so the gate reported 0 broken rows for every input,
-- including a chain its own `/integrity` endpoint reported as broken.
-- The nightly cron had no gate at all.
--
-- Copying the check was the defect. From here there is exactly one
-- implementation, `audit_chain_check()`, in the database, and the
-- endpoint, the manual anchor route, the nightly cron and the offline
-- verifier all call it. A new hash version cannot be forgotten in one of
-- four places, and an unknown version is a failure, not an `ELSE` that
-- silently passes.
--
-- ── v0 is a tamper signal, not a warning (S03-02) ─────────────────────
--
-- The old verifier skipped `hash_version = 0` rows and counted them as a
-- warning whose remedy text told the operator to rehash — which would
-- have made the forgery permanent. Any row whose version this function
-- cannot verify is now a mismatch.
--
-- ── Redaction is a state, not a break (S03-06) ────────────────────────
--
-- A tombstoned v4 row still recomputes, because the content commitment
-- is preserved. A tombstoned pre-v4 row cannot recompute — its payload
-- was a direct hash input and the payload is gone. For those, the proof
-- that it was a lawful redaction rather than tampering is the redaction
-- event written into the chain by `audit_log_redaction_event()`. Present
-- → `redacted_legacy` (reported, not fatal). Absent → `tamper`.
--
-- ── Rows outside the chain (S03-05) ───────────────────────────────────
--
-- `/integrity` reported unchained rows as `legacyRowCount`, described in
-- the code as "pre-rev2 legacy rows … reported informationally", while
-- six live code paths kept producing them. The function returns the
-- newest such row's timestamp so an auditor can tell historic residue
-- from an active bypass.

-- ──────────────────────────────────────────────────────────────────────
-- 1. Per-row verification
-- ──────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.audit_chain_check(text);

CREATE FUNCTION public.audit_chain_check(p_scope text)
RETURNS TABLE (
  id                    uuid,
  chain_seq             bigint,
  entity_type           text,
  entity_id             uuid,
  action                text,
  created_at            timestamptz,
  hash_version          integer,
  stored_entry_hash     text,
  recomputed_entry_hash text,
  stored_previous_hash  text,
  prev_row_entry_hash   text,
  stored_commitment     text,
  recomputed_commitment text,
  tombstoned            boolean,
  redaction_proven      boolean,
  row_ok                boolean,
  chain_ok              boolean,
  commitment_ok         boolean,
  status                text
)
LANGUAGE sql STABLE
AS $$
  WITH ordered AS (
    SELECT
      a.id,
      a.chain_seq,
      a.entity_type::text                      AS entity_type,
      a.entity_id,
      a.action::text                           AS action,
      a.created_at,
      a.hash_version,
      a.entry_hash                             AS stored_entry_hash,
      a.previous_hash                          AS stored_previous_hash,
      a.content_commitment                     AS stored_commitment,
      a.pii_tombstoned_at IS NOT NULL          AS tombstoned,
      LAG(a.entry_hash) OVER (ORDER BY a.chain_seq) AS prev_row_entry_hash,
      CASE a.hash_version
        WHEN 4 THEN compute_audit_hash_v4(
          a.previous_hash, a.id, a.org_id, a.user_id, a.entity_type, a.entity_id,
          a.action::text, a.content_commitment, a.action_detail, a.metadata,
          a.created_at, a.previous_hash_scope)
        WHEN 3 THEN compute_audit_hash_v3(
          a.previous_hash, a.org_id, a.user_id, a.entity_type, a.entity_id,
          a.action::text, a.changes, a.action_detail, a.metadata,
          a.created_at, a.previous_hash_scope)
        WHEN 2 THEN compute_audit_hash_v2(
          a.previous_hash, a.org_id, a.user_id, a.entity_type, a.entity_id,
          a.action::text, a.changes, a.action_detail, a.metadata,
          a.created_at, a.previous_hash_scope)
        WHEN 1 THEN compute_audit_hash_v1(
          a.previous_hash, a.org_id, a.user_id, a.entity_type, a.entity_id,
          a.action::text, a.changes, a.created_at, a.previous_hash_scope)
        -- v0 and anything unknown: no formula, therefore unverifiable,
        -- therefore a mismatch. NOT a warning (S03-02).
        ELSE NULL
      END AS recomputed_entry_hash,
      CASE WHEN a.hash_version = 4
           THEN audit_content_commitment(a.changes, a.user_email, a.user_name,
                                         a.ip_address, a.entity_title)
           ELSE NULL END AS recomputed_commitment,
      EXISTS (
        SELECT 1 FROM audit_log r
         WHERE r.entity_type = 'audit_log'
           AND r.entity_id   = a.id
           AND r.action_detail = 'pii_tombstone'
      ) AS redaction_proven
    FROM audit_log a
    WHERE a.previous_hash_scope = p_scope
  ),
  judged AS (
    SELECT o.*,
      (o.recomputed_entry_hash IS NOT NULL
       AND o.stored_entry_hash = o.recomputed_entry_hash)                   AS row_ok_raw,
      (COALESCE(o.stored_previous_hash, '') = COALESCE(o.prev_row_entry_hash, '')) AS chain_ok_raw,
      CASE
        WHEN o.hash_version <> 4 THEN NULL
        WHEN o.tombstoned          THEN NULL
        ELSE o.stored_commitment = o.recomputed_commitment
      END                                                                   AS commitment_ok_raw
    FROM ordered o
  )
  SELECT
    j.id, j.chain_seq, j.entity_type, j.entity_id, j.action, j.created_at,
    j.hash_version, j.stored_entry_hash, j.recomputed_entry_hash,
    j.stored_previous_hash, j.prev_row_entry_hash,
    j.stored_commitment, j.recomputed_commitment,
    j.tombstoned, j.redaction_proven,
    j.row_ok_raw, j.chain_ok_raw, j.commitment_ok_raw,
    CASE
      WHEN NOT j.chain_ok_raw                                      THEN 'chain_mismatch'
      WHEN j.hash_version NOT IN (1,2,3,4)                         THEN 'unverifiable_version'
      WHEN j.row_ok_raw AND COALESCE(j.commitment_ok_raw, true)    THEN 'ok'
      -- pre-v4 redaction: payload gone, so the recompute cannot match.
      -- The redaction event in the chain is what makes it lawful.
      WHEN j.tombstoned AND j.hash_version < 4 AND j.redaction_proven
                                                                   THEN 'redacted_legacy'
      WHEN j.tombstoned AND j.hash_version = 4 AND NOT j.redaction_proven
                                                                   THEN 'redaction_unproven'
      WHEN NOT j.row_ok_raw                                        THEN 'row_mismatch'
      ELSE 'commitment_mismatch'
    END AS status
  FROM judged j
  ORDER BY j.chain_seq;
$$;

COMMENT ON FUNCTION public.audit_chain_check(text) IS
  'S03-04: the single hash-chain verification. /audit-log/integrity, the anchor gate, the nightly anchor cron and the chain-verification cron all call this one function so they cannot drift apart again.';

-- ──────────────────────────────────────────────────────────────────────
-- 2. Summary
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_chain_verify(p_scope text)
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_org        uuid;
  v_result     jsonb;
  v_unchained  jsonb;
BEGIN
  v_org := CASE WHEN p_scope LIKE 'org:%' AND p_scope <> 'org:platform'
                THEN substring(p_scope from 5)::uuid ELSE NULL END;

  SELECT jsonb_build_object(
    'scope',               p_scope,
    'total',               count(*),
    'ok',                  count(*) FILTER (WHERE status = 'ok'),
    'rowMismatches',       count(*) FILTER (WHERE status = 'row_mismatch'),
    'chainMismatches',     count(*) FILTER (WHERE status = 'chain_mismatch'),
    'commitmentMismatches',count(*) FILTER (WHERE status = 'commitment_mismatch'),
    'unverifiableVersion', count(*) FILTER (WHERE status = 'unverifiable_version'),
    'redactedLegacy',      count(*) FILTER (WHERE status = 'redacted_legacy'),
    'redactionUnproven',   count(*) FILTER (WHERE status = 'redaction_unproven'),
    'versionDistribution', jsonb_build_object(
        'v0', count(*) FILTER (WHERE hash_version = 0),
        'v1', count(*) FILTER (WHERE hash_version = 1),
        'v2', count(*) FILTER (WHERE hash_version = 2),
        'v3', count(*) FILTER (WHERE hash_version = 3),
        'v4', count(*) FILTER (WHERE hash_version = 4)
    ),
    'firstFailure', (
      SELECT jsonb_build_object('chainSeq', chain_seq, 'id', id, 'status', status)
      FROM audit_chain_check(p_scope)
      WHERE status NOT IN ('ok', 'redacted_legacy')
      ORDER BY chain_seq LIMIT 1
    )
  )
  INTO v_result
  FROM audit_chain_check(p_scope);

  -- S03-05: rows that never entered the chain at all. Reporting the
  -- newest one is what distinguishes historic residue from live bypass.
  SELECT jsonb_build_object(
    'unchainedRows', count(*),
    'unchainedNewest', max(created_at)
  )
  INTO v_unchained
  FROM audit_log
  WHERE previous_hash_scope IS NULL
    AND (v_org IS NULL OR org_id = v_org);

  v_result := v_result || v_unchained;

  RETURN v_result || jsonb_build_object(
    'healthy',
      (v_result->>'rowMismatches')::int = 0
      AND (v_result->>'chainMismatches')::int = 0
      AND (v_result->>'commitmentMismatches')::int = 0
      AND (v_result->>'unverifiableVersion')::int = 0
      AND (v_result->>'redactionUnproven')::int = 0
      AND (v_unchained->>'unchainedRows')::int = 0
  );
END;
$$;

COMMENT ON FUNCTION public.audit_chain_verify(text) IS
  'Summary over audit_chain_check(). `healthy` is false for any unverifiable row, including hash_version=0 and rows written outside the chain — the two states the previous verifier reported as informational warnings.';

-- ──────────────────────────────────────────────────────────────────────
-- 3. Verification run log (S03-12)
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_chain_verification (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_seq        bigserial NOT NULL,
  org_id         uuid,
  scope          text        NOT NULL,
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  rows_checked   integer     NOT NULL DEFAULT 0,
  healthy        boolean     NOT NULL DEFAULT false,
  anchor_issues  integer     NOT NULL DEFAULT 0,
  refused_writes integer     NOT NULL DEFAULT 0,
  result         jsonb       NOT NULL,
  triggered_by   text        NOT NULL DEFAULT 'cron'
);

CREATE INDEX IF NOT EXISTS audit_chain_verification_scope_idx
  ON audit_chain_verification (scope, started_at DESC);

COMMENT ON TABLE audit_chain_verification IS
  'S03-12: result of every automatic full-chain verification run. Before this, the only recurring check was scripts/dr-restore-drill.sh, which recomputed no hash at all, sampled the newest 1000 rows and tolerated up to ten chain breaks.';

CREATE OR REPLACE FUNCTION public.audit_chain_verification_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_chain_verification is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_chain_verification_immutable_trg ON audit_chain_verification;
CREATE TRIGGER audit_chain_verification_immutable_trg
  BEFORE UPDATE OF org_id, scope, started_at, result, healthy OR DELETE
  ON audit_chain_verification
  FOR EACH ROW EXECUTE FUNCTION audit_chain_verification_immutable();
ALTER TABLE audit_chain_verification
  ENABLE ALWAYS TRIGGER audit_chain_verification_immutable_trg;

-- One call the cron and the endpoint share: verify a scope, verify its
-- anchors, persist the result, return it.
CREATE OR REPLACE FUNCTION public.audit_chain_verify_and_record(
  p_scope        text,
  p_triggered_by text DEFAULT 'cron'
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_org      uuid;
  v_started  timestamptz := clock_timestamp();
  v_chain    jsonb;
  v_anchor   jsonb;
  v_issues   int;
  v_refused  int;
  v_healthy  boolean;
BEGIN
  v_org := CASE WHEN p_scope LIKE 'org:%' AND p_scope <> 'org:platform'
                THEN substring(p_scope from 5)::uuid ELSE NULL END;

  v_chain := audit_chain_verify(p_scope);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'anchorDate', anchor_date, 'provider', provider,
           'issue', issue, 'detail', detail)), '[]'::jsonb)
    INTO v_anchor
    FROM audit_anchor_verify(v_org);

  v_issues := jsonb_array_length(v_anchor);

  SELECT count(*) INTO v_refused
    FROM audit_log_write_attempt
   WHERE attempted_at > now() - interval '24 hours';

  v_healthy := (v_chain->>'healthy')::boolean AND v_issues = 0;

  INSERT INTO audit_chain_verification (
    org_id, scope, started_at, finished_at, rows_checked,
    healthy, anchor_issues, refused_writes, result, triggered_by
  ) VALUES (
    v_org, p_scope, v_started, clock_timestamp(),
    COALESCE((v_chain->>'total')::int, 0),
    v_healthy, v_issues, v_refused,
    v_chain || jsonb_build_object('anchorIssues', v_anchor,
                                  'refusedWrites24h', v_refused),
    p_triggered_by
  );

  RETURN v_chain || jsonb_build_object(
    'anchorIssues',     v_anchor,
    'refusedWrites24h', v_refused,
    'healthy',          v_healthy
  );
END;
$$;

-- ──────────────────────────────────────────────────────────────────────
-- 4. write_audit_entry() — the sanctioned manual write path (S03-05)
-- ──────────────────────────────────────────────────────────────────────
--
-- The BEFORE INSERT trigger from 0401 already chains every insert, so a
-- raw INSERT is no longer dangerous. This helper exists so the six
-- production paths that wrote raw SQL express what they mean, and so the
-- shape of a manual entry is defined in one place instead of six.

CREATE OR REPLACE FUNCTION public.write_audit_entry(
  p_org_id        uuid,
  p_user_id       uuid,
  p_user_email    text,
  p_user_name     text,
  p_entity_type   text,
  p_entity_id     uuid,
  p_entity_title  text,
  p_action        text,
  p_action_detail text DEFAULT NULL,
  p_changes       jsonb DEFAULT NULL,
  p_metadata      jsonb DEFAULT NULL,
  p_ip_address    inet  DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO audit_log (
    org_id, user_id, user_email, user_name,
    entity_type, entity_id, entity_title,
    action, action_detail, changes, metadata, ip_address
  ) VALUES (
    p_org_id, p_user_id, p_user_email, p_user_name,
    p_entity_type, p_entity_id, p_entity_title,
    p_action::audit_action, p_action_detail, p_changes, p_metadata, p_ip_address
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.write_audit_entry(uuid, uuid, text, text, text, uuid, text, text, text, jsonb, jsonb, inet) IS
  'S03-05: the sanctioned path for audit entries that do not originate from a table trigger (GDPR erasure, retention purge, controlled-copy download, bulk operations, malware rejection, integrity verification). Scope, previous_hash, commitment and entry_hash are assigned by audit_log_chain_assign().';
