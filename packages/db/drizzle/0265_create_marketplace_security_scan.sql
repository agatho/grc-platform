-- Sprint 82: Integration Marketplace
-- Migration 1046: Create marketplace_security_scan table

DO $$ BEGIN
  CREATE TYPE marketplace_scan_status AS ENUM ('pending', 'scanning', 'passed', 'failed', 'warning');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS marketplace_security_scan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  version_id UUID NOT NULL REFERENCES marketplace_version(id) ON DELETE CASCADE,
  scan_status marketplace_scan_status NOT NULL DEFAULT 'pending',
  scan_engine VARCHAR(100) NOT NULL DEFAULT 'builtin',
  findings_json JSONB NOT NULL DEFAULT '[]',
  critical_count INT NOT NULL DEFAULT 0,
  high_count INT NOT NULL DEFAULT 0,
  medium_count INT NOT NULL DEFAULT 0,
  low_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mp_scan_org_idx ON marketplace_security_scan(org_id);
CREATE INDEX mp_scan_version_idx ON marketplace_security_scan(version_id);
CREATE INDEX mp_scan_status_idx ON marketplace_security_scan(scan_status);

ALTER TABLE marketplace_security_scan ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_security_scan_org_isolation ON marketplace_security_scan
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER marketplace_security_scan_audit
  AFTER INSERT OR UPDATE OR DELETE ON marketplace_security_scan
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
