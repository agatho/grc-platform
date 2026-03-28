-- Sprint 74: Tax CMS und Financial Compliance
-- Migration 1006: Create tax_gobd_archive table

CREATE TABLE IF NOT EXISTS tax_gobd_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  archive_code VARCHAR(30) NOT NULL,
  document_title VARCHAR(500) NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  tax_year INT NOT NULL,
  retention_years INT NOT NULL DEFAULT 10,
  retention_end_date DATE,
  storage_location VARCHAR(500),
  hash_value VARCHAR(128),
  original_format VARCHAR(50),
  file_size INT,
  gobd_compliant BOOLEAN NOT NULL DEFAULT false,
  compliance_checks JSONB DEFAULT '{}',
  archived_by UUID REFERENCES "user"(id),
  archived_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX gobd_code_idx ON tax_gobd_archive(org_id, archive_code);
CREATE INDEX gobd_org_idx ON tax_gobd_archive(org_id);
CREATE INDEX gobd_year_idx ON tax_gobd_archive(org_id, tax_year);
CREATE INDEX gobd_type_idx ON tax_gobd_archive(org_id, document_type);
CREATE INDEX gobd_retention_idx ON tax_gobd_archive(org_id, retention_end_date);
CREATE INDEX gobd_status_idx ON tax_gobd_archive(org_id, status);

ALTER TABLE tax_gobd_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY tax_gobd_archive_org_isolation ON tax_gobd_archive
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER tax_gobd_archive_audit
  AFTER INSERT OR UPDATE OR DELETE ON tax_gobd_archive
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
