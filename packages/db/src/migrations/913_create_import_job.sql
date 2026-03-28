-- Sprint 59: Import Wizard
-- Migration 913: Create import_job table

CREATE TABLE IF NOT EXISTS import_job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  source VARCHAR(50) NOT NULL,
  source_file VARCHAR(500),
  template_pack_id UUID REFERENCES template_pack(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_items INT NOT NULL DEFAULT 0,
  processed_items INT NOT NULL DEFAULT 0,
  failed_items INT NOT NULL DEFAULT 0,
  error_log JSONB DEFAULT '[]',
  mapping JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX import_job_org_idx ON import_job(org_id);
CREATE INDEX import_job_status_idx ON import_job(org_id, status);
CREATE INDEX import_job_created_idx ON import_job(created_at);

-- RLS
ALTER TABLE import_job ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_job_org_isolation ON import_job
  USING (org_id::text = current_setting('app.current_org_id', true));

-- Audit trigger
CREATE TRIGGER import_job_audit AFTER INSERT OR UPDATE OR DELETE ON import_job
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
