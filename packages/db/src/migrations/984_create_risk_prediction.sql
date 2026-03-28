-- Sprint 71: Predictive Risk Intelligence
-- Migration 984: Create risk_prediction table

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
  prediction_horizon_days INT NOT NULL,
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

CREATE INDEX rp_model_idx ON risk_prediction(model_id);
CREATE INDEX rp_org_idx ON risk_prediction(org_id);
CREATE INDEX rp_entity_idx ON risk_prediction(org_id, entity_type, entity_id);
CREATE INDEX rp_warning_idx ON risk_prediction(org_id, early_warning);
CREATE INDEX rp_risk_level_idx ON risk_prediction(org_id, risk_level);
CREATE INDEX rp_active_idx ON risk_prediction(org_id, is_active);

ALTER TABLE risk_prediction ENABLE ROW LEVEL SECURITY;
CREATE POLICY risk_prediction_org_isolation ON risk_prediction
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER risk_prediction_audit
  AFTER INSERT OR UPDATE OR DELETE ON risk_prediction
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
