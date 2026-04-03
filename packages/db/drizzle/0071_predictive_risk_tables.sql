-- Migration 0071: Create predictive risk tables (Sprint 71 schema)
-- Tables: risk_prediction_model, risk_prediction, risk_anomaly_detection

-- ──────────────────────────────────────────────────────────────
-- risk_prediction_model — ML model configurations
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS risk_prediction_model (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  name VARCHAR(500) NOT NULL,
  description TEXT,
  model_type VARCHAR(50) NOT NULL,
  algorithm VARCHAR(50) NOT NULL,
  target_metric VARCHAR(100) NOT NULL,
  input_features JSONB NOT NULL DEFAULT '[]',
  hyperparameters JSONB DEFAULT '{}',
  training_config JSONB DEFAULT '{}',
  accuracy NUMERIC(5,2),
  last_trained_at TIMESTAMPTZ,
  training_samples INTEGER NOT NULL DEFAULT 0,
  model_state JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'untrained',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rpm_org_idx ON risk_prediction_model(org_id);
CREATE INDEX IF NOT EXISTS rpm_type_idx ON risk_prediction_model(org_id, model_type);
CREATE INDEX IF NOT EXISTS rpm_active_idx ON risk_prediction_model(org_id, is_active);
CREATE INDEX IF NOT EXISTS rpm_target_idx ON risk_prediction_model(org_id, target_metric);

-- ──────────────────────────────────────────────────────────────
-- risk_prediction — Forecast outputs
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS risk_prediction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES risk_prediction_model(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  prediction_type VARCHAR(50) NOT NULL,
  current_value NUMERIC(12,4),
  predicted_value NUMERIC(12,4) NOT NULL,
  confidence_interval JSONB DEFAULT '{}',
  prediction_horizon_days INTEGER NOT NULL,
  confidence NUMERIC(5,2) NOT NULL,
  trend_direction VARCHAR(20),
  trend_strength NUMERIC(5,2),
  risk_level VARCHAR(20),
  early_warning BOOLEAN NOT NULL DEFAULT false,
  early_warning_message TEXT,
  contributing_factors JSONB DEFAULT '[]',
  correlated_entities JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rp_model_idx ON risk_prediction(model_id);
CREATE INDEX IF NOT EXISTS rp_org_idx ON risk_prediction(org_id);
CREATE INDEX IF NOT EXISTS rp_entity_idx ON risk_prediction(org_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS rp_warning_idx ON risk_prediction(org_id, early_warning);
CREATE INDEX IF NOT EXISTS rp_risk_level_idx ON risk_prediction(org_id, risk_level);
CREATE INDEX IF NOT EXISTS rp_active_idx ON risk_prediction(org_id, is_active);

-- ──────────────────────────────────────────────────────────────
-- risk_anomaly_detection — Detected anomalies
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS risk_anomaly_detection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES risk_prediction_model(id),
  org_id UUID NOT NULL REFERENCES organization(id),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  anomaly_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  expected_value NUMERIC(12,4),
  actual_value NUMERIC(12,4) NOT NULL,
  deviation_percent NUMERIC(8,2),
  anomaly_score NUMERIC(5,2) NOT NULL,
  description TEXT NOT NULL,
  possible_causes JSONB DEFAULT '[]',
  suggested_actions JSONB DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  resolved_by UUID REFERENCES "user"(id),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rad_org_idx ON risk_anomaly_detection(org_id);
CREATE INDEX IF NOT EXISTS rad_entity_idx ON risk_anomaly_detection(org_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS rad_severity_idx ON risk_anomaly_detection(org_id, severity);
CREATE INDEX IF NOT EXISTS rad_status_idx ON risk_anomaly_detection(org_id, status);
CREATE INDEX IF NOT EXISTS rad_date_idx ON risk_anomaly_detection(org_id, detected_at);
CREATE INDEX IF NOT EXISTS rad_model_idx ON risk_anomaly_detection(model_id);

-- ──────────────────────────────────────────────────────────────
-- RLS policies
-- ──────────────────────────────────────────────────────────────

ALTER TABLE risk_prediction_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_prediction ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_anomaly_detection ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rls_risk_prediction_model' AND tablename = 'risk_prediction_model') THEN
    CREATE POLICY rls_risk_prediction_model ON risk_prediction_model
      USING (org_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rls_risk_prediction' AND tablename = 'risk_prediction') THEN
    CREATE POLICY rls_risk_prediction ON risk_prediction
      USING (org_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rls_risk_anomaly_detection' AND tablename = 'risk_anomaly_detection') THEN
    CREATE POLICY rls_risk_anomaly_detection ON risk_anomaly_detection
      USING (org_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────
-- Audit triggers
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_trigger' AND tgrelid = 'risk_prediction_model'::regclass) THEN
    CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON risk_prediction_model
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_trigger' AND tgrelid = 'risk_anomaly_detection'::regclass) THEN
    CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON risk_anomaly_detection
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;
