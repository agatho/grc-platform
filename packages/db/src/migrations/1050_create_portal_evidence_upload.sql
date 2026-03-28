-- Sprint 83: External Stakeholder Portals
-- Migration 1050: Create portal_evidence_upload table

CREATE TABLE IF NOT EXISTS portal_evidence_upload (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  session_id UUID NOT NULL REFERENCES portal_session(id),
  file_name VARCHAR(500) NOT NULL,
  file_size INT NOT NULL,
  mime_type VARCHAR(200) NOT NULL,
  storage_path VARCHAR(2000) NOT NULL,
  checksum_sha256 VARCHAR(64),
  entity_type VARCHAR(100),
  entity_id UUID,
  description TEXT,
  virus_scan_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX peu_org_idx ON portal_evidence_upload(org_id);
CREATE INDEX peu_session_idx ON portal_evidence_upload(session_id);
CREATE INDEX peu_entity_idx ON portal_evidence_upload(entity_type, entity_id);

ALTER TABLE portal_evidence_upload ENABLE ROW LEVEL SECURITY;
CREATE POLICY portal_evidence_upload_org_isolation ON portal_evidence_upload
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER portal_evidence_upload_audit
  AFTER INSERT OR UPDATE OR DELETE ON portal_evidence_upload
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
