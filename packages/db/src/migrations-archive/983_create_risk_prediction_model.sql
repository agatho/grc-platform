-- Sprint 71: Predictive Risk Intelligence
-- Migration 983: Create risk_prediction_model table

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
  training_samples INT NOT NULL DEFAULT 0,
  model_state JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'untrained',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rpm_org_idx ON risk_prediction_model(org_id);
CREATE INDEX rpm_type_idx ON risk_prediction_model(org_id, model_type);
CREATE INDEX rpm_active_idx ON risk_prediction_model(org_id, is_active);
CREATE INDEX rpm_target_idx ON risk_prediction_model(org_id, target_metric);

ALTER TABLE risk_prediction_model ENABLE ROW LEVEL SECURITY;
CREATE POLICY risk_prediction_model_org_isolation ON risk_prediction_model
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER risk_prediction_model_audit
  AFTER INSERT OR UPDATE OR DELETE ON risk_prediction_model
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
