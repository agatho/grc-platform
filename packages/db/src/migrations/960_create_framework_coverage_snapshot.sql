-- Sprint 66: Cross-Framework Auto-Mapping Engine
-- Migration 960: Create framework_coverage_snapshot table

CREATE TABLE IF NOT EXISTS framework_coverage_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  snapshot_date TIMESTAMPTZ NOT NULL,
  framework_scores JSONB NOT NULL,
  overall_coverage NUMERIC(5,2) NOT NULL,
  total_frameworks INT NOT NULL,
  fully_compliant INT NOT NULL,
  partially_compliant INT NOT NULL,
  non_compliant INT NOT NULL,
  heatmap_data JSONB DEFAULT '{}',
  trend_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX fcs_org_idx ON framework_coverage_snapshot(org_id);
CREATE INDEX fcs_date_idx ON framework_coverage_snapshot(snapshot_date);

-- RLS
ALTER TABLE framework_coverage_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY framework_coverage_snapshot_org_isolation ON framework_coverage_snapshot
  USING (org_id = current_setting('app.current_org_id')::uuid);
