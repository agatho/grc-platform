-- Sprint 69: AI Regulatory Change Agent
-- Migration 975: Create regulatory_change table

CREATE TABLE IF NOT EXISTS regulatory_change (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  source_id UUID REFERENCES regulatory_source(id),
  external_id VARCHAR(500),
  title VARCHAR(1000) NOT NULL,
  summary TEXT NOT NULL,
  full_text TEXT,
  change_type VARCHAR(50) NOT NULL,
  classification VARCHAR(50) NOT NULL,
  jurisdiction VARCHAR(100) NOT NULL,
  affected_frameworks TEXT[],
  affected_modules TEXT[],
  effective_date DATE,
  published_at TIMESTAMPTZ,
  source_url VARCHAR(2000),
  nlp_classification JSONB DEFAULT '{}',
  relevance_score NUMERIC(5,2),
  ai_summary TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  reviewed_by UUID REFERENCES "user"(id),
  reviewed_at TIMESTAMPTZ,
  is_notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rc_org_idx ON regulatory_change(org_id);
CREATE INDEX rc_source_idx ON regulatory_change(source_id);
CREATE INDEX rc_class_idx ON regulatory_change(org_id, classification);
CREATE INDEX rc_status_idx ON regulatory_change(org_id, status);
CREATE INDEX rc_date_idx ON regulatory_change(org_id, published_at);
CREATE UNIQUE INDEX rc_external_idx ON regulatory_change(org_id, source_id, external_id);

ALTER TABLE regulatory_change ENABLE ROW LEVEL SECURITY;
CREATE POLICY regulatory_change_org_isolation ON regulatory_change
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER regulatory_change_audit
  AFTER INSERT OR UPDATE OR DELETE ON regulatory_change
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
