-- 0407_audit_grants_and_migration_anchor.sql
-- ARCTOS-FULL-2026-08-31 · WP4 · S03-19, S03-08
--
-- ── S03-19: grc_app has no rights on the audit tables ─────────────────
--
-- `relacl` of audit_log, audit_anchor, access_log, data_export_log and
-- whistleblowing_audit_log is NULL, i.e. only the owner has any
-- privilege. Either the web app runs as the least-privilege role and
-- every audit endpoint fails with 42501 — which `/integrity` reports as
-- 503 "hash-chain verification could not complete", indistinguishable
-- from an actually broken chain — or `APP_DATABASE_URL` is unset and the
-- user-facing app runs as the superuser, which makes the S03-01 rewrite
-- reachable from a web request. Both readings are findings.
--
-- The audit endpoints need to READ. They never need to write: every write
-- goes through a SECURITY DEFINER trigger or through write_audit_entry().
-- So: SELECT only, and explicitly no INSERT/UPDATE/DELETE. The grants
-- live in a migration rather than in `deploy/provision-grc-app.sh`
-- because a privilege that only exists in a shell script does not exist
-- in CI, in the DR restore or in a fresh install.
--
-- ── S03-08: the migration anchor ADR-026 describes ────────────────────
--
-- ADR-026 grounds its continuity claim on a "migration audit trigger
-- added in 0341" writing rows with `entity_type='database'`,
-- `action='migration_run'`. Migration 0341 contains no trigger, the enum
-- has no such value, so the cast in the reading query throws, the bare
-- catch swallows it and `gatherMigrationAnchors()` returns `[]` for ever
-- — while `totalContinuityValid` gates the production start.
--
-- Either the ADR is corrected or the mechanism is built. It is built
-- here, because a cross-link between pre- and post-rehash history is
-- worth having: the enum value exists, and this migration writes the
-- anchor row for the v3 → v4 formula change itself.

-- ──────────────────────────────────────────────────────────────────────
-- 1. Read privileges for the runtime role
-- ──────────────────────────────────────────────────────────────────────

DO $grants$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    RAISE WARNING '0407: role grc_app does not exist — audit read grants skipped';
    RETURN;
  END IF;

  GRANT SELECT ON audit_log                TO grc_app;
  GRANT SELECT ON audit_anchor             TO grc_app;
  GRANT SELECT ON audit_chain_verification TO grc_app;
  GRANT SELECT ON audit_log_write_attempt  TO grc_app;
  GRANT SELECT ON audit_sensitive_column   TO grc_app;

  -- Explicitly NOT granted: INSERT, UPDATE, DELETE, TRUNCATE on any of
  -- them. The runtime writes the trail only through triggers and through
  -- write_audit_entry(), both SECURITY DEFINER.
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON audit_log    FROM grc_app;
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON audit_anchor FROM grc_app;

  GRANT EXECUTE ON FUNCTION audit_chain_check(text)                 TO grc_app;
  GRANT EXECUTE ON FUNCTION audit_chain_verify(text)                TO grc_app;
  GRANT EXECUTE ON FUNCTION audit_chain_verify_and_record(text, text) TO grc_app;
  GRANT EXECUTE ON FUNCTION write_audit_entry(uuid, uuid, text, text, text, uuid, text, text, text, jsonb, jsonb, inet) TO grc_app;
  GRANT EXECUTE ON FUNCTION wb_audit_chain_verify(uuid)             TO grc_app;

  -- The verification job records its runs.
  GRANT INSERT ON audit_chain_verification TO grc_app;
  GRANT USAGE, SELECT ON SEQUENCE audit_chain_verification_run_seq_seq TO grc_app;

  -- whistleblowing_audit_log stays unreadable for the generic runtime
  -- role: it is reached through wb_audit_chain_verify() only.
END
$grants$;

-- ──────────────────────────────────────────────────────────────────────
-- 2. migration_run — the enum value ADR-026 assumes
-- ──────────────────────────────────────────────────────────────────────
-- ALTER TYPE ... ADD VALUE cannot run in the same transaction that uses
-- the value, so this file manages its own transactions and is classified
-- "self-managed" by migrate-all.ts (see its header).

BEGIN;
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'audit_action' AND e.enumlabel = 'migration_run'
  ) THEN
    ALTER TYPE audit_action ADD VALUE 'migration_run';
  END IF;
END
$enum$;
COMMIT;

BEGIN;

CREATE OR REPLACE FUNCTION public.record_migration_anchor(
  p_migration text,
  p_name      text,
  p_purpose   text,
  p_rows      bigint DEFAULT 0
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
    action, action_detail, changes, metadata
  ) VALUES (
    NULL, NULL, NULL, 'system:migration',
    'database', NULL, p_migration,
    'migration_run'::audit_action, p_migration,
    jsonb_build_object('migration', p_migration, 'rowsAffected', p_rows),
    jsonb_build_object('name', p_name, 'purpose', p_purpose, 'rowsRehashed', p_rows)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.record_migration_anchor(text, text, text, bigint) IS
  'S03-08: writes the migration anchor row that ADR-026 describes and that no code ever produced. The row is a normal chain entry, so the cross-link between pre- and post-change history is itself hashed and anchored.';

-- The anchor for this wave's own formula change. entity_id stays NULL —
-- the continuity endpoint matches on entity_title/action_detail, which
-- carry the migration number; a uuid column cannot hold "0400".
SELECT record_migration_anchor(
  '0400',
  'audit_chain_v4_commitment',
  'v3 → v4: row id and a content commitment over changes/user_email/user_name/ip_address/entity_title become hash inputs (S03-02, S03-03, S03-06). Existing rows are NOT rehashed; they keep verifying under v3.',
  0
);

COMMIT;
