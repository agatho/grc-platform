-- Sprint 33: Audit Data Analytics + Predictive Risk Intelligence
-- Migrations 409–420 consolidated

-- ──────────────────────────────────────────────────────────────
-- 409: audit_analytics_import
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_analytics_import (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  audit_id UUID,
  name VARCHAR(500) NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  schema_json JSONB NOT NULL,
  row_count INTEGER NOT NULL,
  data_json JSONB NOT NULL,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS aai_org_idx ON audit_analytics_import(org_id);
CREATE INDEX IF NOT EXISTS aai_audit_idx ON audit_analytics_import(org_id, audit_id);

-- ──────────────────────────────────────────────────────────────
-- 410: audit_analytics_result
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_analytics_result (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  import_id UUID NOT NULL REFERENCES audit_analytics_import(id),
  analysis_type VARCHAR(30) NOT NULL,
  config_json JSONB NOT NULL,
  result_json JSONB NOT NULL,
  summary_json JSONB NOT NULL,
  finding_id UUID,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aar_org_import_idx ON audit_analytics_result(org_id, import_id);

-- ──────────────────────────────────────────────────────────────
-- 411: audit_analytics_template
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_analytics_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organization(id),
  name VARCHAR(500) NOT NULL,
  analysis_type VARCHAR(30) NOT NULL,
  config_json JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aat_org_idx ON audit_analytics_template(org_id);

-- ──────────────────────────────────────────────────────────────
-- 412: risk_prediction
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS risk_prediction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  risk_id UUID NOT NULL,
  prediction_horizon_days INTEGER NOT NULL DEFAULT 90,
  escalation_probability DECIMAL(5,2) NOT NULL,
  predicted_score DECIMAL(5,2),
  features_json JSONB NOT NULL,
  top_factors_json JSONB NOT NULL,
  model_version VARCHAR(50) NOT NULL,
  confidence DECIMAL(5,2),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rp_org_risk_idx ON risk_prediction(org_id, risk_id);
CREATE INDEX IF NOT EXISTS rp_prob_idx ON risk_prediction(org_id, escalation_probability);

-- ──────────────────────────────────────────────────────────────
-- 413: risk_prediction_model
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS risk_prediction_model (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  version VARCHAR(50) NOT NULL,
  algorithm VARCHAR(30) NOT NULL DEFAULT 'linear_regression',
  feature_importance_json JSONB NOT NULL,
  training_metrics JSONB NOT NULL,
  trained_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rpm_org_idx ON risk_prediction_model(org_id);

-- ──────────────────────────────────────────────────────────────
-- 414: risk_prediction_alert
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS risk_prediction_alert (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  risk_id UUID NOT NULL,
  prediction_id UUID NOT NULL REFERENCES risk_prediction(id),
  probability DECIMAL(5,2) NOT NULL,
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rpa_org_idx ON risk_prediction_alert(org_id);
CREATE INDEX IF NOT EXISTS rpa_risk_idx ON risk_prediction_alert(org_id, risk_id);

-- ──────────────────────────────────────────────────────────────
-- 415: RLS on all 6 tables
-- ──────────────────────────────────────────────────────────────

ALTER TABLE audit_analytics_import ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_analytics_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_analytics_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_prediction ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_prediction_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_prediction_alert ENABLE ROW LEVEL SECURITY;

CREATE POLICY aai_org_isolation ON audit_analytics_import
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY aar_org_isolation ON audit_analytics_result
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY aat_org_isolation ON audit_analytics_template
  USING (org_id IS NULL OR org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY rp_org_isolation ON risk_prediction
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY rpm_org_isolation ON risk_prediction_model
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY rpa_org_isolation ON risk_prediction_alert
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- ──────────────────────────────────────────────────────────────
-- 416: Audit triggers
-- ──────────────────────────────────────────────────────────────

CREATE TRIGGER aai_audit AFTER INSERT OR UPDATE OR DELETE ON audit_analytics_import
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER aar_audit AFTER INSERT OR UPDATE OR DELETE ON audit_analytics_result
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER aat_audit AFTER INSERT OR UPDATE OR DELETE ON audit_analytics_template
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER rp_audit AFTER INSERT OR UPDATE OR DELETE ON risk_prediction
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER rpm_audit AFTER INSERT OR UPDATE OR DELETE ON risk_prediction_model
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER rpa_audit AFTER INSERT OR UPDATE OR DELETE ON risk_prediction_alert
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- 417: Seed 3 default analytics templates
-- ──────────────────────────────────────────────────────────────

INSERT INTO audit_analytics_template (name, analysis_type, config_json, description) VALUES
  ('Invoice Audit', 'benford', '{"field": "amount", "minCount": 100}'::jsonb, 'Benford analysis on invoice amounts — detects anomalous first-digit distributions'),
  ('Expense Analysis', 'duplicate', '{"matchFields": ["vendor_name", "amount", "date"], "threshold": 0.85}'::jsonb, 'Fuzzy duplicate detection on expense records'),
  ('Payroll Check', 'outlier', '{"field": "gross_amount", "method": "zscore", "threshold": 3}'::jsonb, 'Statistical outlier detection on payroll amounts using Z-Score method')
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 418: Seed initial prediction model weights
-- ──────────────────────────────────────────────────────────────

-- Default model weights seeded per org during onboarding
-- Initial weights based on heuristic analysis:
-- score_trend: 0.35, kri_momentum: 0.28, incident_frequency: 0.15,
-- finding_backlog: 0.12, control_effectiveness: -0.20, days_since_review: 0.10

-- ──────────────────────────────────────────────────────────────
-- 419: Index for efficient score trend extraction
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS risk_score_history_trend_idx
  ON risk_prediction(org_id, risk_id, computed_at DESC);
