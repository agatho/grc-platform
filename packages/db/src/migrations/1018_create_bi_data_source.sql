-- Sprint 77: Embedded BI und Report Builder
-- Migration 1018: Create bi_data_source table

CREATE TABLE IF NOT EXISTS bi_data_source (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  name VARCHAR(300) NOT NULL,
  source_type bi_data_source_type NOT NULL,
  description TEXT,
  schema_definition JSONB NOT NULL DEFAULT '{}',
  available_columns JSONB NOT NULL DEFAULT '[]',
  default_filters JSONB NOT NULL DEFAULT '{}',
  refresh_interval_minutes INT NOT NULL DEFAULT 60,
  last_refreshed_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bi_ds_org_idx ON bi_data_source(org_id);
CREATE INDEX bi_ds_type_idx ON bi_data_source(org_id, source_type);

ALTER TABLE bi_data_source ENABLE ROW LEVEL SECURITY;
CREATE POLICY bi_data_source_org_isolation ON bi_data_source
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER bi_data_source_audit
  AFTER INSERT OR UPDATE OR DELETE ON bi_data_source
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
