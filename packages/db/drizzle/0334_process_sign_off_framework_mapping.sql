-- Migration 0334: BPM Overhaul Phase 1 — Sign-off + Framework Mapping tables.
--
-- process_sign_off:    hash-chain anchor per role-signature on a process version
-- process_framework_mapping: process ↔ catalog_entry (compliance coverage)

BEGIN;

-- ─── process_sign_off ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS process_sign_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organization(id),
  process_id uuid NOT NULL REFERENCES process(id) ON DELETE CASCADE,
  process_version_id uuid REFERENCES process_version(id) ON DELETE SET NULL,
  signer_id uuid NOT NULL,
  signer_role varchar(80) NOT NULL,                   -- process_owner | quality_manager | compliance_officer | dpo | ...
  signoff_type varchar(32) NOT NULL,                  -- review | approval | publish | retire
  comments text,
  -- Hash chain
  payload_hash varchar(128) NOT NULL,                 -- sha256 of signed payload
  previous_chain_hash varchar(128),                   -- nullable for first link
  chain_hash varchar(128) NOT NULL,                   -- sha256(previous_chain_hash || payload_hash)
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text
);

CREATE INDEX IF NOT EXISTS pso_org_idx ON process_sign_off(org_id);
CREATE INDEX IF NOT EXISTS pso_process_idx ON process_sign_off(process_id);
CREATE INDEX IF NOT EXISTS pso_version_idx ON process_sign_off(process_version_id);
CREATE INDEX IF NOT EXISTS pso_chain_idx ON process_sign_off(process_id, signed_at);

ALTER TABLE process_sign_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_sign_off FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_sign_off' AND policyname='process_sign_off_tenant_select') THEN
    CREATE POLICY process_sign_off_tenant_select ON process_sign_off FOR SELECT
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_sign_off' AND policyname='process_sign_off_tenant_insert') THEN
    CREATE POLICY process_sign_off_tenant_insert ON process_sign_off FOR INSERT
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  -- Sign-offs are append-only — no update/delete policies on purpose.
END $$;

-- ─── process_framework_mapping ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS process_framework_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organization(id),
  process_id uuid NOT NULL REFERENCES process(id) ON DELETE CASCADE,
  catalog_entry_id uuid NOT NULL,                     -- generic FK, may target catalog_entry / risk_catalog_entry / control_catalog_entry
  catalog_id uuid,                                    -- denormalized for filter speed
  framework_code varchar(40),                         -- e.g. 'iso-27001', 'iso-9001', 'nis2', 'dora', 'gdpr', 'iso-22301'
  mapping_strength varchar(20) NOT NULL DEFAULT 'covers',  -- covers | partial | references
  rationale text,
  evidence_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (process_id, catalog_entry_id)
);

CREATE INDEX IF NOT EXISTS pfm_org_idx ON process_framework_mapping(org_id);
CREATE INDEX IF NOT EXISTS pfm_process_idx ON process_framework_mapping(process_id);
CREATE INDEX IF NOT EXISTS pfm_entry_idx ON process_framework_mapping(catalog_entry_id);
CREATE INDEX IF NOT EXISTS pfm_framework_idx ON process_framework_mapping(org_id, framework_code);

ALTER TABLE process_framework_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_framework_mapping FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_framework_mapping' AND policyname='pfm_tenant_select') THEN
    CREATE POLICY pfm_tenant_select ON process_framework_mapping FOR SELECT
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_framework_mapping' AND policyname='pfm_tenant_insert') THEN
    CREATE POLICY pfm_tenant_insert ON process_framework_mapping FOR INSERT
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_framework_mapping' AND policyname='pfm_tenant_update') THEN
    CREATE POLICY pfm_tenant_update ON process_framework_mapping FOR UPDATE
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_framework_mapping' AND policyname='pfm_tenant_delete') THEN
    CREATE POLICY pfm_tenant_delete ON process_framework_mapping FOR DELETE
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
END $$;

-- Audit triggers
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN
    DROP TRIGGER IF EXISTS process_sign_off_audit_trigger ON process_sign_off;
    CREATE TRIGGER process_sign_off_audit_trigger
      AFTER INSERT ON process_sign_off
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();

    DROP TRIGGER IF EXISTS process_framework_mapping_audit_trigger ON process_framework_mapping;
    CREATE TRIGGER process_framework_mapping_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON process_framework_mapping
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

COMMIT;
