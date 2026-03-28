-- Sprint 77: Embedded BI und Report Builder
-- Migration 1019: Create bi_query table

DO $$ BEGIN
  CREATE TYPE bi_query_status AS ENUM ('draft', 'validated', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS bi_query (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  name VARCHAR(300) NOT NULL,
  description TEXT,
  data_source_id UUID REFERENCES bi_data_source(id),
  sql_text TEXT NOT NULL,
  status bi_query_status NOT NULL DEFAULT 'draft',
  result_schema_json JSONB,
  last_validated_at TIMESTAMPTZ,
  validation_error TEXT,
  is_saved BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bi_q_org_idx ON bi_query(org_id);
CREATE INDEX bi_q_ds_idx ON bi_query(data_source_id);
CREATE INDEX bi_q_status_idx ON bi_query(org_id, status);

ALTER TABLE bi_query ENABLE ROW LEVEL SECURITY;
CREATE POLICY bi_query_org_isolation ON bi_query
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER bi_query_audit
  AFTER INSERT OR UPDATE OR DELETE ON bi_query
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
