-- Migration 0338: Audit-Mgmt Overhaul Phase 1 — sign-off + FK hardening.
--
-- Adds:
--   1. audit_sign_off table (analogous to process_sign_off) with SHA-256 hash chain
--   2. FK on audit.report_document_id → document(id) (ON DELETE SET NULL)
--   3. Index on finding.audit_id to support the cross-module aggregation queries

BEGIN;

-- ─── audit_sign_off ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_sign_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organization(id),
  audit_id uuid NOT NULL REFERENCES audit(id) ON DELETE CASCADE,
  signer_id uuid NOT NULL,
  signer_role varchar(80) NOT NULL,                   -- lead_auditor | auditee | qa_reviewer | compliance_officer | management
  signoff_type varchar(32) NOT NULL,                  -- fieldwork_complete | report_draft | report_approved | published | closed
  comments text,
  payload_hash varchar(128) NOT NULL,
  previous_chain_hash varchar(128),
  chain_hash varchar(128) NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text
);

CREATE INDEX IF NOT EXISTS aso_org_idx ON audit_sign_off(org_id);
CREATE INDEX IF NOT EXISTS aso_audit_idx ON audit_sign_off(audit_id);
CREATE INDEX IF NOT EXISTS aso_chain_idx ON audit_sign_off(audit_id, signed_at);

ALTER TABLE audit_sign_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_sign_off FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_sign_off' AND policyname='audit_sign_off_tenant_select') THEN
    CREATE POLICY audit_sign_off_tenant_select ON audit_sign_off FOR SELECT
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_sign_off' AND policyname='audit_sign_off_tenant_insert') THEN
    CREATE POLICY audit_sign_off_tenant_insert ON audit_sign_off FOR INSERT
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  -- Append-only: no UPDATE/DELETE policies.
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN
    DROP TRIGGER IF EXISTS audit_sign_off_audit_trigger ON audit_sign_off;
    CREATE TRIGGER audit_sign_off_audit_trigger
      AFTER INSERT ON audit_sign_off
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ─── audit.report_document_id FK ────────────────────────────────
DO $$
DECLARE
  orphans int;
BEGIN
  -- Drop orphaned references before adding the FK
  UPDATE audit SET report_document_id = NULL
    WHERE report_document_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM document d WHERE d.id = audit.report_document_id);
  GET DIAGNOSTICS orphans = ROW_COUNT;
  IF orphans > 0 THEN
    RAISE NOTICE '[0338] nulled % orphaned audit.report_document_id rows', orphans;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_report_document_fk'
  ) THEN
    ALTER TABLE audit
      ADD CONSTRAINT audit_report_document_fk
      FOREIGN KEY (report_document_id) REFERENCES document(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── finding.audit_id index (already exists on column, ensure it's indexed) ─
CREATE INDEX IF NOT EXISTS finding_audit_idx ON finding(audit_id) WHERE audit_id IS NOT NULL;

COMMIT;
