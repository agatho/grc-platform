-- Migration 0333: BPM Overhaul Phase 1 — GDPR Art. 30 ROPA profile per process.
--
-- The existing `ropa_entry` table (Sprint 7 DPMS) is a stand-alone Art-30 record.
-- The BPM Overhaul positions a process AS a Verarbeitungstätigkeit, so we attach
-- Art-30 metadata directly to a process via process_ropa_profile (1:1 with process).
--
-- Optionally links to an existing ropa_entry (for orgs that already keep the
-- separate ROPA register). If linked, the data is mastered there; otherwise this
-- profile IS the source of truth.

BEGIN;

CREATE TABLE IF NOT EXISTS process_ropa_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL UNIQUE REFERENCES process(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organization(id),

  -- Toggle: is this process actually a processing activity?
  is_processing_activity boolean NOT NULL DEFAULT false,

  -- Art. 30 (1) mandatory fields
  processing_purpose text,
  legal_basis ropa_legal_basis,
  legal_basis_detail text,
  data_subject_categories text[] DEFAULT '{}'::text[],
  personal_data_categories text[] DEFAULT '{}'::text[],
  special_categories text[] DEFAULT '{}'::text[],     -- Art. 9 sensitive data
  recipients text[] DEFAULT '{}'::text[],
  third_country_transfers boolean NOT NULL DEFAULT false,
  third_country_safeguards text,                       -- SCC, BCR, Adequacy
  retention_period_description text,
  retention_period_months integer,
  tom_description text,                                -- Technisch-organisatorische Maßnahmen

  -- DPIA trigger and link
  requires_dpia boolean NOT NULL DEFAULT false,
  dpia_trigger_reason text,
  dpia_id uuid REFERENCES dpia(id),

  -- Cross-link to dedicated RoPA register entry (optional)
  ropa_entry_id uuid REFERENCES ropa_entry(id) ON DELETE SET NULL,

  -- Controller / processor relationships
  controller_org_id uuid REFERENCES organization(id),
  joint_controller_org_ids uuid[] DEFAULT '{}'::uuid[],
  processor_vendor_ids uuid[] DEFAULT '{}'::uuid[],

  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE INDEX IF NOT EXISTS process_ropa_profile_process_idx ON process_ropa_profile(process_id);
CREATE INDEX IF NOT EXISTS process_ropa_profile_org_idx ON process_ropa_profile(org_id);
CREATE INDEX IF NOT EXISTS process_ropa_profile_dpia_idx ON process_ropa_profile(dpia_id);
CREATE INDEX IF NOT EXISTS process_ropa_profile_processing_idx
  ON process_ropa_profile(org_id, is_processing_activity)
  WHERE is_processing_activity = true;

-- RLS
ALTER TABLE process_ropa_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_ropa_profile FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_ropa_profile' AND policyname='process_ropa_profile_tenant_select') THEN
    CREATE POLICY process_ropa_profile_tenant_select ON process_ropa_profile FOR SELECT
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_ropa_profile' AND policyname='process_ropa_profile_tenant_insert') THEN
    CREATE POLICY process_ropa_profile_tenant_insert ON process_ropa_profile FOR INSERT
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_ropa_profile' AND policyname='process_ropa_profile_tenant_update') THEN
    CREATE POLICY process_ropa_profile_tenant_update ON process_ropa_profile FOR UPDATE
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='process_ropa_profile' AND policyname='process_ropa_profile_tenant_delete') THEN
    CREATE POLICY process_ropa_profile_tenant_delete ON process_ropa_profile FOR DELETE
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
END $$;

-- Audit trigger (only register if helper function exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN
    DROP TRIGGER IF EXISTS process_ropa_profile_audit_trigger ON process_ropa_profile;
    CREATE TRIGGER process_ropa_profile_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON process_ropa_profile
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- Also add the compliance_profile_enum used by process.ts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'compliance_profile_enum') THEN
    CREATE TYPE compliance_profile_enum AS ENUM (
      'standard',
      'gdpr_ropa',
      'iso_22301_bia',
      'nis2_critical',
      'iso_9001_quality',
      'dora_critical_ict'
    );
  END IF;
END $$;

-- Store active compliance profile on process
ALTER TABLE process
  ADD COLUMN IF NOT EXISTS compliance_profile compliance_profile_enum
    NOT NULL DEFAULT 'standard';

COMMIT;
