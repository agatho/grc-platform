-- Sprint 80: Multi-Region Deployment und Data Sovereignty
-- Migration 1037: Create sovereignty_audit_log table

DO $$ BEGIN
  CREATE TYPE sovereignty_event_type AS ENUM ('data_access', 'data_transfer', 'region_change', 'policy_violation', 'replication_event', 'compliance_check');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS sovereignty_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  event_type sovereignty_event_type NOT NULL,
  region_code VARCHAR(50),
  target_region_code VARCHAR(50),
  entity_type VARCHAR(100),
  entity_id UUID,
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  ip_address VARCHAR(45),
  user_id UUID REFERENCES "user"(id),
  is_violation BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sal_org_idx ON sovereignty_audit_log(org_id);
CREATE INDEX sal_event_idx ON sovereignty_audit_log(org_id, event_type);
CREATE INDEX sal_violation_idx ON sovereignty_audit_log(org_id, is_violation);
CREATE INDEX sal_created_idx ON sovereignty_audit_log(org_id, created_at);

ALTER TABLE sovereignty_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY sovereignty_audit_log_org_isolation ON sovereignty_audit_log
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Append-only: no update/delete trigger needed, only insert
CREATE TRIGGER sovereignty_audit_log_audit
  AFTER INSERT ON sovereignty_audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
