-- Sprint 75: Regulatory Horizon Scanner
-- Migration 1010: Create horizon_scan_item table

CREATE TABLE IF NOT EXISTS horizon_scan_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  source_id UUID REFERENCES horizon_scan_source(id),
  external_id VARCHAR(500),
  title VARCHAR(1000) NOT NULL,
  summary TEXT NOT NULL,
  full_text TEXT,
  item_type VARCHAR(50) NOT NULL,
  classification VARCHAR(20) NOT NULL,
  jurisdiction VARCHAR(100) NOT NULL,
  regulatory_body VARCHAR(200),
  affected_frameworks TEXT[],
  affected_modules TEXT[],
  effective_date DATE,
  consultation_end_date DATE,
  published_at TIMESTAMPTZ,
  source_url VARCHAR(2000),
  nlp_topics JSONB DEFAULT '[]',
  nlp_entities JSONB DEFAULT '[]',
  nlp_sentiment VARCHAR(20),
  relevance_score NUMERIC(5,2),
  ai_summary TEXT,
  suggested_controls JSONB DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  reviewed_by UUID REFERENCES "user"(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX hs_item_external_idx ON horizon_scan_item(org_id, source_id, external_id);
CREATE INDEX hs_item_org_idx ON horizon_scan_item(org_id);
CREATE INDEX hs_item_source_idx ON horizon_scan_item(source_id);
CREATE INDEX hs_item_class_idx ON horizon_scan_item(org_id, classification);
CREATE INDEX hs_item_status_idx ON horizon_scan_item(org_id, status);
CREATE INDEX hs_item_date_idx ON horizon_scan_item(org_id, published_at);
CREATE INDEX hs_item_type_idx ON horizon_scan_item(org_id, item_type);

ALTER TABLE horizon_scan_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY horizon_scan_item_org_isolation ON horizon_scan_item
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER horizon_scan_item_audit
  AFTER INSERT OR UPDATE OR DELETE ON horizon_scan_item
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
