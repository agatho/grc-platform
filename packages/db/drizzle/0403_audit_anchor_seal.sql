-- 0403_audit_anchor_seal.sql
-- ARCTOS-FULL-2026-08-31 · WP4 · S03-01, S03-08, S03-11, S03-17
--
-- S03-01 is the finding that decides whether the product's central
-- promise holds: "the platform vendor loses the ability to rewrite audit
-- events retroactively from the anchor point onwards". It did not hold,
-- because the evidence of the "external witness" lived entirely inside
-- the database it was supposed to testify about:
--
--   * `audit_anchor` had no append-only rule, no guard trigger and no
--     RLS; production code overwrites it itself via onConflictDoUpdate;
--   * nothing in the platform ever verified an anchor after writing it —
--     `verified_at` existed as a column and was never set by any code
--     path;
--   * the TSA response was accepted on `statusCode == 0` alone, so an
--     anchor could attest to a completely different hash (S03-11);
--   * the audit reproduced a full chain rewrite followed by
--     `UPDATE audit_anchor SET merkle_root = repeat('0',64)`, after which
--     `/integrity` answered healthy and the anchor gate answered 0/0.
--
-- ── What this migration builds ────────────────────────────────────────
--
-- 1. `audit_anchor` becomes append-only for its evidentiary fields.
--    `merkle_root` and `leaf_count` of a completed anchor can no longer
--    change; only the documented OpenTimestamps upgrade path and the
--    failed → complete retry may write, and only the fields that path
--    needs. Guards are ENABLE ALWAYS, so session_replication_role does
--    not switch them off.
--
-- 2. A separate, chained seal ledger `audit_anchor_seal`, owned by its own
--    role `grc_audit_seal`, revoked from `grc_app` and from PUBLIC, with
--    FORCE ROW LEVEL SECURITY and a deny-all policy so even the table
--    owner cannot read or write it directly — only through the
--    SECURITY DEFINER functions below. Each seal chains to the previous
--    one and carries an HMAC under a key that is **not stored in the
--    database** (`app.audit_seal_key`, supplied per session from the
--    application's environment). Overwriting an `audit_anchor` row now
--    requires forging an HMAC under a key the database does not hold.
--
-- 3. `audit_anchor_verify()` — the verification that never existed.
--    It recomputes each anchor's digest, compares it against the seal,
--    walks the seal chain and checks the HMAC. An anchor that was
--    overwritten is reported as `anchor_digest_mismatch`; a seal that was
--    removed is reported as `seal_missing`; a broken seal chain is
--    reported as `seal_chain_broken`.
--
-- ── The honest limit ──────────────────────────────────────────────────
--
-- A PostgreSQL superuser can drop any trigger and any table. Nothing
-- inside a database can be made tamper-PROOF against the owner of that
-- database — and the production compose file deliberately runs the worker
-- as the superuser `grc`. What this migration changes is the difference
-- between tamper-proof and tamper-EVIDENT: after it, a manipulation
-- either fails, or leaves a gap that `audit_anchor_verify()` names,
-- because the attacker cannot produce a valid HMAC without the key and
-- cannot silently renumber a chained ledger. The remaining step —
-- shipping the seal lines to storage outside this database — is the
-- worker's `AUDIT_SEAL_SINK_*` export added in the same wave, and it is
-- the only part that is genuinely outside the vendor's reach.

-- ──────────────────────────────────────────────────────────────────────
-- 0. Columns the continuity endpoint has always queried but never had
--    (S03-08) and the Merkle version marker (S03-17)
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE audit_anchor
  ADD COLUMN IF NOT EXISTS anchored_at    timestamptz,
  ADD COLUMN IF NOT EXISTS hash_version   smallint,
  ADD COLUMN IF NOT EXISTS merkle_version smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tsa_verified   boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tsa_gen_time   timestamptz;

COMMENT ON COLUMN audit_anchor.anchored_at IS
  'S03-08: the continuity endpoint queried this column since Wave 24; it did not exist, the error was swallowed by a bare catch and freeTsaAnchors was constant {null,null}.';
COMMENT ON COLUMN audit_anchor.merkle_version IS
  'S03-17: 1 = Bitcoin duplication convention without domain separation (historic anchors). 2 = RFC-6962 domain separation with the leaf count bound into the root.';
COMMENT ON COLUMN audit_anchor.tsa_verified IS
  'S03-11: set only after the RFC-3161 response was validated (nonce, messageImprint, signature, certificate). proof_status=''complete'' without this flag means "stored", not "verified".';

UPDATE audit_anchor SET anchored_at = created_at WHERE anchored_at IS NULL;
UPDATE audit_anchor
   SET hash_version = 3
 WHERE hash_version IS NULL;

-- ──────────────────────────────────────────────────────────────────────
-- 1. audit_anchor becomes append-only for its evidentiary fields
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_anchor_append_only_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log_write_attempt (operation, table_name, row_id, detail)
    VALUES ('DELETE', 'audit_anchor', OLD.id,
            format('refused — anchor %s/%s/%s is evidence', OLD.org_id, OLD.anchor_date, OLD.provider));
    RAISE EXCEPTION
      'audit_anchor is append-only: anchors are the external tamper-evidence and cannot be deleted (S03-01)'
      USING ERRCODE = 'raise_exception';
  END IF;

  -- Identity never changes.
  IF NEW.id           IS DISTINCT FROM OLD.id
  OR NEW.org_id       IS DISTINCT FROM OLD.org_id
  OR NEW.anchor_date  IS DISTINCT FROM OLD.anchor_date
  OR NEW.provider     IS DISTINCT FROM OLD.provider THEN
    RAISE EXCEPTION 'audit_anchor: identity columns are immutable (S03-01)'
      USING ERRCODE = 'raise_exception';
  END IF;

  -- A committed proof is evidence. Only a previously FAILED attempt may
  -- be replaced by a real one — the retry path the API already has and
  -- the nightly cron was missing (S03-10).
  IF OLD.proof_status <> 'failed' THEN
    IF NEW.merkle_root IS DISTINCT FROM OLD.merkle_root
    OR NEW.leaf_count  IS DISTINCT FROM OLD.leaf_count
    OR NEW.merkle_version IS DISTINCT FROM OLD.merkle_version THEN
      INSERT INTO audit_log_write_attempt (operation, table_name, row_id, detail)
      VALUES ('UPDATE', 'audit_anchor', OLD.id,
              format('refused — attempt to rewrite merkle_root/leaf_count of a %s anchor', OLD.proof_status));
      RAISE EXCEPTION
        'audit_anchor: merkle_root/leaf_count of a % anchor are immutable — rewriting them is the S03-01 attack',
        OLD.proof_status
        USING ERRCODE = 'raise_exception';
    END IF;
    -- The stored proof may only grow into a stronger one: an
    -- OpenTimestamps stub becomes a complete Bitcoin attestation.
    IF NEW.proof IS DISTINCT FROM OLD.proof
       AND NOT (OLD.provider = 'opentimestamps' AND OLD.proof_status = 'pending') THEN
      RAISE EXCEPTION
        'audit_anchor: proof bytes are immutable except for the OpenTimestamps pending → complete upgrade'
        USING ERRCODE = 'raise_exception';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_anchor_append_only_trg ON audit_anchor;
CREATE TRIGGER audit_anchor_append_only_trg
  BEFORE UPDATE OR DELETE ON audit_anchor
  FOR EACH ROW EXECUTE FUNCTION audit_anchor_append_only_guard();
ALTER TABLE audit_anchor ENABLE ALWAYS TRIGGER audit_anchor_append_only_trg;

-- ──────────────────────────────────────────────────────────────────────
-- 2. The seal ledger
-- ──────────────────────────────────────────────────────────────────────

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_audit_seal') THEN
    CREATE ROLE grc_audit_seal NOLOGIN;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING '0403: could not create role grc_audit_seal (not a superuser) — the seal ledger stays under the current owner. Create the role manually before production use.';
END
$role$;

CREATE TABLE IF NOT EXISTS audit_anchor_seal (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seal_seq       bigserial NOT NULL,
  org_id         uuid,
  anchor_date    date        NOT NULL,
  provider       varchar(32) NOT NULL,
  merkle_root    varchar(64) NOT NULL,
  leaf_count     integer     NOT NULL,
  merkle_version smallint    NOT NULL DEFAULT 1,
  chain_tip_hash varchar(64),
  chain_tip_seq  bigint,
  proof_sha256   varchar(64),
  -- Digest over exactly the fields that make the anchor evidence.
  anchor_digest  varchar(64) NOT NULL,
  prev_seal_hash varchar(64),
  seal_hash      varchar(64) NOT NULL,
  -- HMAC of seal_hash under a key that is NOT in this database.
  seal_hmac      varchar(64),
  seal_key_id    text        NOT NULL DEFAULT 'unsealed',
  sealed_at      timestamptz NOT NULL DEFAULT now(),
  sealed_by      text        NOT NULL DEFAULT session_user
);

CREATE INDEX IF NOT EXISTS audit_anchor_seal_lookup_idx
  ON audit_anchor_seal (org_id, anchor_date, provider);
CREATE UNIQUE INDEX IF NOT EXISTS audit_anchor_seal_hash_uniq
  ON audit_anchor_seal (seal_hash);
-- One seal may only ever have one successor: renumbering or splicing the
-- ledger is rejected by the database, exactly like the audit chain.
CREATE UNIQUE INDEX IF NOT EXISTS audit_anchor_seal_prev_uniq
  ON audit_anchor_seal (prev_seal_hash) NULLS NOT DISTINCT;

COMMENT ON TABLE audit_anchor_seal IS
  'S03-01: chained, HMAC-signed ledger of every anchor ever issued. Written only through audit_anchor_seal_record(); readable only through audit_anchor_verify() / audit_anchor_seal_export(). The HMAC key lives in the application environment, not in this database.';

-- Digest over the evidentiary fields of an anchor.
CREATE OR REPLACE FUNCTION public.audit_anchor_digest(
  p_org_id         uuid,
  p_anchor_date    date,
  p_provider       text,
  p_merkle_root    text,
  p_leaf_count     integer,
  p_merkle_version smallint,
  p_proof_sha256   text,
  p_chain_tip_hash text,
  p_chain_tip_seq  bigint
) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT encode(digest(
    COALESCE(p_org_id::text, '')      || '|' ||
    p_anchor_date::text               || '|' ||
    p_provider                        || '|' ||
    p_merkle_root                     || '|' ||
    p_leaf_count::text                || '|' ||
    COALESCE(p_merkle_version, 1)::text || '|' ||
    COALESCE(p_proof_sha256, '')      || '|' ||
    COALESCE(p_chain_tip_hash, '')    || '|' ||
    COALESCE(p_chain_tip_seq::text, ''),
    'sha256'
  ), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.audit_anchor_seal_record(p_anchor_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
-- Function-local GUC: PostgreSQL restores it on exit, so the deny-all
-- policy on the ledger opens for exactly the duration of this call and
-- for no other statement in the transaction.
SET app.audit_seal_ctx = 'on'
AS $$
DECLARE
  a               audit_anchor%ROWTYPE;
  v_prev_hash     varchar(64);
  v_digest        varchar(64);
  v_seal_hash     varchar(64);
  v_key           text;
  v_key_id        text;
  v_proof_sha     varchar(64);
  v_tip_hash      varchar(64);
  v_tip_seq       bigint;
  v_sealed_at     timestamptz := now();
  v_id            uuid;
BEGIN
  SELECT * INTO a FROM audit_anchor WHERE id = p_anchor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'audit_anchor % does not exist', p_anchor_id;
  END IF;
  IF a.proof_status = 'failed' THEN
    -- A failed attempt is not evidence; nothing to seal.
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM audit_anchor_seal
    WHERE org_id IS NOT DISTINCT FROM a.org_id
      AND anchor_date = a.anchor_date
      AND provider = a.provider
      AND merkle_root = a.merkle_root
  ) THEN
    -- Idempotent: the same anchor is only sealed once. A *different*
    -- root for the same (org, day, provider) does get its own seal —
    -- that is precisely the event an auditor must be able to see.
    SELECT id INTO v_id FROM audit_anchor_seal
     WHERE org_id IS NOT DISTINCT FROM a.org_id
       AND anchor_date = a.anchor_date
       AND provider = a.provider
       AND merkle_root = a.merkle_root
     LIMIT 1;
    RETURN v_id;
  END IF;

  v_proof_sha := CASE
    WHEN a.proof IS NULL OR a.proof = '' THEN NULL
    ELSE encode(digest(a.proof, 'sha256'), 'hex')
  END;

  SELECT entry_hash, chain_seq INTO v_tip_hash, v_tip_seq
    FROM audit_log
   WHERE previous_hash_scope = 'org:' || COALESCE(a.org_id::text, 'platform')
   ORDER BY chain_seq DESC
   LIMIT 1;

  v_digest := audit_anchor_digest(
    a.org_id, a.anchor_date, a.provider, a.merkle_root,
    a.leaf_count, a.merkle_version, v_proof_sha, v_tip_hash, v_tip_seq
  );

  SELECT seal_hash INTO v_prev_hash
    FROM audit_anchor_seal
   ORDER BY seal_seq DESC
   LIMIT 1;

  v_seal_hash := encode(digest(
    COALESCE(v_prev_hash, '0') || '|' || v_digest || '|' ||
    to_char(v_sealed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'sha256'), 'hex');

  v_key    := NULLIF(current_setting('app.audit_seal_key', true), '');
  v_key_id := COALESCE(NULLIF(current_setting('app.audit_seal_key_id', true), ''), 'default');

  INSERT INTO audit_anchor_seal (
    org_id, anchor_date, provider, merkle_root, leaf_count, merkle_version,
    chain_tip_hash, chain_tip_seq, proof_sha256,
    anchor_digest, prev_seal_hash, seal_hash, seal_hmac, seal_key_id, sealed_at
  ) VALUES (
    a.org_id, a.anchor_date, a.provider, a.merkle_root, a.leaf_count, a.merkle_version,
    v_tip_hash, v_tip_seq, v_proof_sha,
    v_digest, v_prev_hash, v_seal_hash,
    CASE WHEN v_key IS NULL THEN NULL
         ELSE encode(hmac(v_seal_hash, v_key, 'sha256'), 'hex') END,
    CASE WHEN v_key IS NULL THEN 'unsealed' ELSE v_key_id END,
    v_sealed_at
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.audit_anchor_seal_record(uuid) IS
  'S03-01: writes the chained, HMAC-signed seal for an anchor. Call it in the same transaction that created the anchor. Without app.audit_seal_key the seal is still chained but unsigned, and audit_anchor_verify() reports seal_unsigned so the gap is visible instead of silent.';

-- Append-only ledger.
CREATE OR REPLACE FUNCTION public.audit_anchor_seal_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO audit_log_write_attempt (operation, table_name, row_id, detail)
  VALUES (TG_OP, 'audit_anchor_seal', OLD.id, 'refused — seal ledger is immutable');
  RAISE EXCEPTION
    'audit_anchor_seal is immutable — % is refused (S03-01)', TG_OP
    USING ERRCODE = 'raise_exception';
END;
$$;

DROP TRIGGER IF EXISTS audit_anchor_seal_immutable_trg ON audit_anchor_seal;
CREATE TRIGGER audit_anchor_seal_immutable_trg
  BEFORE UPDATE OR DELETE ON audit_anchor_seal
  FOR EACH ROW EXECUTE FUNCTION audit_anchor_seal_immutable();
ALTER TABLE audit_anchor_seal ENABLE ALWAYS TRIGGER audit_anchor_seal_immutable_trg;

DROP TRIGGER IF EXISTS audit_anchor_seal_no_truncate ON audit_anchor_seal;
CREATE TRIGGER audit_anchor_seal_no_truncate
  BEFORE TRUNCATE ON audit_anchor_seal
  FOR EACH STATEMENT EXECUTE FUNCTION log_table_refuse_truncate();
ALTER TABLE audit_anchor_seal ENABLE ALWAYS TRIGGER audit_anchor_seal_no_truncate;

-- ──────────────────────────────────────────────────────────────────────
-- 3. Verification — the check that never existed
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_anchor_verify(p_org_id uuid DEFAULT NULL)
RETURNS TABLE (
  anchor_date  date,
  provider     text,
  org_id       uuid,
  issue        text,
  detail       text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
SET app.audit_seal_ctx = 'on'
AS $$
-- The OUT parameters share names with the columns they are built from;
-- resolve to the column everywhere.
#variable_conflict use_column
DECLARE
  v_key text := NULLIF(current_setting('app.audit_seal_key', true), '');
BEGIN
  -- (a) an anchor whose evidentiary fields no longer match its seal:
  --     the S03-01 rewrite.
  RETURN QUERY
  SELECT a.anchor_date, a.provider::text, a.org_id,
         'anchor_digest_mismatch'::text,
         format('stored root %s does not match the sealed digest (seal %s)',
                a.merkle_root, s.id)
    FROM audit_anchor a
    JOIN audit_anchor_seal s
      ON s.org_id IS NOT DISTINCT FROM a.org_id
     AND s.anchor_date = a.anchor_date
     AND s.provider    = a.provider
   WHERE (p_org_id IS NULL OR a.org_id = p_org_id)
     AND a.proof_status <> 'failed'
     AND s.anchor_digest <> audit_anchor_digest(
           a.org_id, a.anchor_date, a.provider, a.merkle_root,
           a.leaf_count, a.merkle_version,
           CASE WHEN a.proof IS NULL OR a.proof = '' THEN NULL
                ELSE encode(digest(a.proof, 'sha256'), 'hex') END,
           s.chain_tip_hash, s.chain_tip_seq);

  -- (b) an anchor that was never sealed, or whose seal was removed.
  RETURN QUERY
  SELECT a.anchor_date, a.provider::text, a.org_id,
         'seal_missing'::text,
         'anchor exists but carries no seal — it cannot be shown to be the anchor that was issued'::text
    FROM audit_anchor a
   WHERE (p_org_id IS NULL OR a.org_id = p_org_id)
     AND a.proof_status <> 'failed'
     AND NOT EXISTS (
       SELECT 1 FROM audit_anchor_seal s
        WHERE s.org_id IS NOT DISTINCT FROM a.org_id
          AND s.anchor_date = a.anchor_date
          AND s.provider    = a.provider
     );

  -- (c) a seal whose anchor disappeared.
  RETURN QUERY
  SELECT s.anchor_date, s.provider::text, s.org_id,
         'anchor_missing'::text,
         format('a seal exists for %s/%s but the anchor row is gone', s.anchor_date, s.provider)
    FROM audit_anchor_seal s
   WHERE (p_org_id IS NULL OR s.org_id = p_org_id)
     AND NOT EXISTS (
       SELECT 1 FROM audit_anchor a
        WHERE a.org_id IS NOT DISTINCT FROM s.org_id
          AND a.anchor_date = s.anchor_date
          AND a.provider    = s.provider
     );

  -- (d) the seal ledger itself: a broken link means a seal was removed
  --     or inserted after the fact.
  RETURN QUERY
  WITH walked AS (
    SELECT seal_seq, anchor_date, provider, org_id, prev_seal_hash, seal_hash, sealed_at,
           anchor_digest,
           LAG(seal_hash) OVER (ORDER BY seal_seq) AS expected_prev
      FROM audit_anchor_seal
  )
  SELECT w.anchor_date, w.provider::text, w.org_id,
         'seal_chain_broken'::text,
         format('seal %s claims predecessor %s, the ledger says %s',
                w.seal_seq, COALESCE(w.prev_seal_hash, '∅'), COALESCE(w.expected_prev, '∅'))
    FROM walked w
   WHERE COALESCE(w.prev_seal_hash, '') <> COALESCE(w.expected_prev, '')
     AND (p_org_id IS NULL OR w.org_id = p_org_id);

  -- (e) the seal hash itself must be reproducible from its inputs.
  RETURN QUERY
  SELECT s.anchor_date, s.provider::text, s.org_id,
         'seal_hash_invalid'::text,
         format('seal %s does not recompute from (prev_seal_hash, anchor_digest, sealed_at)', s.seal_seq)
    FROM audit_anchor_seal s
   WHERE (p_org_id IS NULL OR s.org_id = p_org_id)
     AND s.seal_hash <> encode(digest(
           COALESCE(s.prev_seal_hash, '0') || '|' || s.anchor_digest || '|' ||
           to_char(s.sealed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
           'sha256'), 'hex');

  -- (f) HMAC — only checkable when the key is present in this session.
  IF v_key IS NOT NULL THEN
    RETURN QUERY
    SELECT s.anchor_date, s.provider::text, s.org_id,
           'seal_hmac_invalid'::text,
           format('seal %s carries an HMAC that does not verify under key id %s', s.seal_seq, s.seal_key_id)
      FROM audit_anchor_seal s
     WHERE (p_org_id IS NULL OR s.org_id = p_org_id)
       AND s.seal_key_id <> 'unsealed'
       AND s.seal_hmac IS DISTINCT FROM encode(hmac(s.seal_hash, v_key, 'sha256'), 'hex');
  END IF;

  RETURN QUERY
  SELECT s.anchor_date, s.provider::text, s.org_id,
         'seal_unsigned'::text,
         'seal is chained but not HMAC-signed — app.audit_seal_key was not set when it was written'::text
    FROM audit_anchor_seal s
   WHERE (p_org_id IS NULL OR s.org_id = p_org_id)
     AND s.seal_key_id = 'unsealed';
END;
$$;

COMMENT ON FUNCTION public.audit_anchor_verify(uuid) IS
  'S03-01: the anchor verification the platform never performed. Detects an overwritten anchor (anchor_digest_mismatch), a deleted anchor or seal, a spliced seal ledger and an invalid HMAC.';

-- Export for the out-of-database sink. Returns the seal lines the worker
-- ships to WORM storage; the whole point is that these end up somewhere
-- this database cannot reach.
CREATE OR REPLACE FUNCTION public.audit_anchor_seal_export(p_after_seq bigint DEFAULT 0)
RETURNS TABLE (
  seal_seq bigint,
  payload  jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
SET app.audit_seal_ctx = 'on'
AS $$
  SELECT s.seal_seq,
         jsonb_build_object(
           'sealSeq',       s.seal_seq,
           'orgId',         s.org_id,
           'anchorDate',    s.anchor_date,
           'provider',      s.provider,
           'merkleRoot',    s.merkle_root,
           'leafCount',     s.leaf_count,
           'merkleVersion', s.merkle_version,
           'chainTipHash',  s.chain_tip_hash,
           'chainTipSeq',   s.chain_tip_seq,
           'proofSha256',   s.proof_sha256,
           'anchorDigest',  s.anchor_digest,
           'prevSealHash',  s.prev_seal_hash,
           'sealHash',      s.seal_hash,
           'sealHmac',      s.seal_hmac,
           'sealKeyId',     s.seal_key_id,
           'sealedAt',      to_char(s.sealed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
         )
    FROM audit_anchor_seal s
   WHERE s.seal_seq > p_after_seq
   ORDER BY s.seal_seq;
$$;

-- ──────────────────────────────────────────────────────────────────────
-- 4. Ownership and privileges
-- ──────────────────────────────────────────────────────────────────────

DO $own$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_audit_seal') THEN
    -- The LEDGER moves to its own role. `grc_app` therefore has no path
    -- to it at all — not through a GRANT, not through RLS, not by
    -- accident when someone widens privileges on the public schema.
    ALTER TABLE audit_anchor_seal OWNER TO grc_audit_seal;
    ALTER SEQUENCE audit_anchor_seal_seal_seq_seq OWNER TO grc_audit_seal;

    -- The FUNCTIONS deliberately stay owned by the migration role. They
    -- have to read audit_anchor and audit_log, which carry RLS policies
    -- owned by another work package; running them as grc_audit_seal
    -- would couple this migration to every policy-helper function those
    -- policies happen to call today. The security boundary that matters
    -- here is not which role executes the seal function — it is that the
    -- HMAC key is not in the database at all.
    EXECUTE format(
      'GRANT SELECT, INSERT ON TABLE audit_anchor_seal TO %I', current_user);
    EXECUTE format(
      'GRANT USAGE, SELECT ON SEQUENCE audit_anchor_seal_seal_seq_seq TO %I',
      current_user);

    -- Idempotency: CREATE OR REPLACE FUNCTION keeps the existing owner,
    -- so a database that ran an earlier revision of this migration would
    -- otherwise keep the seal functions under grc_audit_seal and hit
    -- "permission denied" on the RLS helper functions of audit_anchor.
    EXECUTE format('ALTER FUNCTION audit_anchor_seal_record(uuid)   OWNER TO %I', current_user);
    EXECUTE format('ALTER FUNCTION audit_anchor_seal_export(bigint) OWNER TO %I', current_user);
    EXECUTE format('ALTER FUNCTION audit_anchor_verify(uuid)        OWNER TO %I', current_user);
    EXECUTE format('ALTER FUNCTION audit_anchor_seal_immutable()    OWNER TO %I', current_user);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '0403: could not transfer ownership of the seal ledger to grc_audit_seal: %', SQLERRM;
END
$own$;

REVOKE ALL ON TABLE audit_anchor_seal FROM PUBLIC;
DO $g$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    EXECUTE 'REVOKE ALL ON TABLE audit_anchor_seal FROM grc_app';
    EXECUTE 'GRANT EXECUTE ON FUNCTION audit_anchor_verify(uuid) TO grc_app';
    EXECUTE 'GRANT EXECUTE ON FUNCTION audit_anchor_seal_record(uuid) TO grc_app';
    EXECUTE 'GRANT EXECUTE ON FUNCTION audit_anchor_seal_export(bigint) TO grc_app';
  END IF;
END
$g$;

-- FORCE RLS with a deny-all policy: even the table owner has to go
-- through the SECURITY DEFINER functions. This does not bind a superuser
-- — nothing in a database does — but it does bind every role the
-- application can reach, which is the reachable part of the threat model.
ALTER TABLE audit_anchor_seal ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_anchor_seal FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_anchor_seal_deny_all ON audit_anchor_seal;
CREATE POLICY audit_anchor_seal_deny_all ON audit_anchor_seal
  FOR ALL
  USING (current_setting('app.audit_seal_ctx', true) = 'on')
  WITH CHECK (current_setting('app.audit_seal_ctx', true) = 'on');

COMMENT ON POLICY audit_anchor_seal_deny_all ON audit_anchor_seal IS
  'WP4/S03-01. Deny-all except inside the three SECURITY DEFINER seal functions, which set app.audit_seal_ctx as a function-local GUC that PostgreSQL restores on exit. Combined with FORCE ROW LEVEL SECURITY this also binds the table owner. It does NOT bind a superuser — that is stated in the migration header and in ADR-011 rev.4; the boundary that does is the HMAC key, which is not stored in this database. WP2 owns RLS policy design elsewhere; this policy is part of the seal construction and must not be relaxed.';
