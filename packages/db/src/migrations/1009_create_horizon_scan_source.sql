-- Sprint 75: Regulatory Horizon Scanner
-- Migration 1009: Create horizon_scan_source table

CREATE TABLE IF NOT EXISTS horizon_scan_source (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organization(id),
  name VARCHAR(500) NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  url VARCHAR(2000),
  jurisdiction VARCHAR(100) NOT NULL,
  regulatory_body VARCHAR(200),
  frameworks TEXT[],
  fetch_frequency_hours INT NOT NULL DEFAULT 12,
  parser_type VARCHAR(50) NOT NULL DEFAULT 'rss',
  parser_config JSONB DEFAULT '{}',
  nlp_model VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_fetched_at TIMESTAMPTZ,
  last_fetch_error TEXT,
  total_items_fetched INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX hs_src_org_idx ON horizon_scan_source(org_id);
CREATE INDEX hs_src_type_idx ON horizon_scan_source(source_type);
CREATE INDEX hs_src_jurisdiction_idx ON horizon_scan_source(jurisdiction);
CREATE INDEX hs_src_active_idx ON horizon_scan_source(is_active);

ALTER TABLE horizon_scan_source ENABLE ROW LEVEL SECURITY;
CREATE POLICY horizon_scan_source_org_isolation ON horizon_scan_source
  USING (org_id IS NULL OR org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER horizon_scan_source_audit
  AFTER INSERT OR UPDATE OR DELETE ON horizon_scan_source
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
