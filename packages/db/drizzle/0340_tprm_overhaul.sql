-- Migration 0340: TPRM Overhaul — vendor sign-off, cross-module hardening,
-- DORA + LkSG critical-vendor flags.

BEGIN;

-- 1. vendor critical flags + cross-module link
ALTER TABLE vendor
  ADD COLUMN IF NOT EXISTS dora_critical_ict boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lksg_tier_1 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS designation_rationale text;

CREATE INDEX IF NOT EXISTS vendor_dora_critical_idx
  ON vendor(org_id, dora_critical_ict) WHERE dora_critical_ict = true;
CREATE INDEX IF NOT EXISTS vendor_lksg_tier1_idx
  ON vendor(org_id, lksg_tier_1) WHERE lksg_tier_1 = true;

-- 2. contract.affected_process_ids (cross-module: which processes the contract underwrites)
ALTER TABLE contract
  ADD COLUMN IF NOT EXISTS affected_process_ids uuid[] DEFAULT '{}'::uuid[];

-- 3. vendor_sign_off: chain-anchored signatures (onboarding, designation, exit)
CREATE TABLE IF NOT EXISTS vendor_sign_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organization(id),
  vendor_id uuid NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
  signer_id uuid NOT NULL,
  signer_role varchar(80) NOT NULL,
  signoff_type varchar(32) NOT NULL,   -- onboarding | designation | renewal | exit | dd_complete
  comments text,
  payload_hash varchar(128) NOT NULL,
  previous_chain_hash varchar(128),
  chain_hash varchar(128) NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text
);

CREATE INDEX IF NOT EXISTS vso_org_idx ON vendor_sign_off(org_id);
CREATE INDEX IF NOT EXISTS vso_vendor_idx ON vendor_sign_off(vendor_id);
CREATE INDEX IF NOT EXISTS vso_chain_idx ON vendor_sign_off(vendor_id, signed_at);

ALTER TABLE vendor_sign_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_sign_off FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_sign_off' AND policyname='vendor_sign_off_tenant_select') THEN
    CREATE POLICY vendor_sign_off_tenant_select ON vendor_sign_off FOR SELECT
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_sign_off' AND policyname='vendor_sign_off_tenant_insert') THEN
    CREATE POLICY vendor_sign_off_tenant_insert ON vendor_sign_off FOR INSERT
      WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  -- Append-only.
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN
    DROP TRIGGER IF EXISTS vendor_sign_off_audit_trigger ON vendor_sign_off;
    CREATE TRIGGER vendor_sign_off_audit_trigger
      AFTER INSERT ON vendor_sign_off
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

COMMIT;
