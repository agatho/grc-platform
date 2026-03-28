-- Sprint 71: Predictive Risk Intelligence
-- Migration 985: Create risk_anomaly_detection table

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

CREATE INDEX rad_org_idx ON risk_anomaly_detection(org_id);
CREATE INDEX rad_entity_idx ON risk_anomaly_detection(org_id, entity_type, entity_id);
CREATE INDEX rad_severity_idx ON risk_anomaly_detection(org_id, severity);
CREATE INDEX rad_status_idx ON risk_anomaly_detection(org_id, status);
CREATE INDEX rad_date_idx ON risk_anomaly_detection(org_id, detected_at);
CREATE INDEX rad_model_idx ON risk_anomaly_detection(model_id);

ALTER TABLE risk_anomaly_detection ENABLE ROW LEVEL SECURITY;
CREATE POLICY risk_anomaly_detection_org_isolation ON risk_anomaly_detection
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER risk_anomaly_detection_audit
  AFTER INSERT OR UPDATE OR DELETE ON risk_anomaly_detection
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
