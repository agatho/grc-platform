-- Sprint 63: Cloud Infrastructure Connectors
-- Migration 941: Create cloud_compliance_snapshot table

CREATE TABLE IF NOT EXISTS cloud_compliance_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  connector_id UUID NOT NULL REFERENCES evidence_connector(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL,
  snapshot_date TIMESTAMPTZ NOT NULL,
  overall_score NUMERIC(5,2) NOT NULL,
  category_scores JSONB DEFAULT '{}',
  total_checks INT NOT NULL,
  passing_checks INT NOT NULL,
  failing_checks INT NOT NULL,
  critical_findings INT NOT NULL DEFAULT 0,
  high_findings INT NOT NULL DEFAULT 0,
  medium_findings INT NOT NULL DEFAULT 0,
  low_findings INT NOT NULL DEFAULT 0,
  trend_direction VARCHAR(10),
  trend_delta NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ccs_org_idx ON cloud_compliance_snapshot(org_id);
CREATE INDEX ccs_connector_idx ON cloud_compliance_snapshot(connector_id);
CREATE INDEX ccs_provider_idx ON cloud_compliance_snapshot(provider);
CREATE INDEX ccs_date_idx ON cloud_compliance_snapshot(snapshot_date);

-- RLS
ALTER TABLE cloud_compliance_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY cloud_compliance_snapshot_org_isolation ON cloud_compliance_snapshot
  USING (org_id = current_setting('app.current_org_id')::uuid);
