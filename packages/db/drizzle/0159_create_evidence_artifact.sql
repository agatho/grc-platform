-- Sprint 62: Evidence Connector Framework
-- Migration 934: Create evidence_artifact table

CREATE TABLE IF NOT EXISTS evidence_artifact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  connector_id UUID NOT NULL REFERENCES evidence_connector(id) ON DELETE CASCADE,
  test_result_id UUID,
  artifact_type VARCHAR(30) NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  storage_path VARCHAR(1000) NOT NULL,
  file_size INT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  checksum_sha256 VARCHAR(64) NOT NULL,
  metadata JSONB DEFAULT '{}',
  retention_days INT NOT NULL DEFAULT 365,
  expires_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ea_connector_idx ON evidence_artifact(connector_id);
CREATE INDEX ea_org_idx ON evidence_artifact(org_id);
CREATE INDEX ea_type_idx ON evidence_artifact(artifact_type);
CREATE INDEX ea_collected_idx ON evidence_artifact(collected_at);
CREATE INDEX ea_expiry_idx ON evidence_artifact(expires_at);

-- RLS
ALTER TABLE evidence_artifact ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_artifact_org_isolation ON evidence_artifact
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER evidence_artifact_audit AFTER INSERT OR UPDATE OR DELETE ON evidence_artifact
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
