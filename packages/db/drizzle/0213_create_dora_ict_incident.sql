-- Sprint 72: DORA Compliance Module
-- Migration 988: Create dora_ict_incident table

CREATE TABLE IF NOT EXISTS dora_ict_incident (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  incident_code VARCHAR(30) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  incident_type VARCHAR(50) NOT NULL,
  classification VARCHAR(20) NOT NULL,
  affected_services JSONB DEFAULT '[]',
  affected_clients INT DEFAULT 0,
  financial_impact NUMERIC(15,2),
  geographic_scope TEXT[],
  root_cause TEXT,
  detected_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  initial_report_due TIMESTAMPTZ,
  initial_report_sent TIMESTAMPTZ,
  intermediate_report_due TIMESTAMPTZ,
  intermediate_report_sent TIMESTAMPTZ,
  final_report_due TIMESTAMPTZ,
  final_report_sent TIMESTAMPTZ,
  reporting_authority VARCHAR(200),
  remediation_actions JSONB DEFAULT '[]',
  lessons_learned TEXT,
  handler_id UUID REFERENCES "user"(id),
  status VARCHAR(20) NOT NULL DEFAULT 'detected',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX dora_ict_inc_code_idx ON dora_ict_incident(org_id, incident_code);
CREATE INDEX dora_ict_inc_org_idx ON dora_ict_incident(org_id);
CREATE INDEX dora_ict_inc_class_idx ON dora_ict_incident(org_id, classification);
CREATE INDEX dora_ict_inc_status_idx ON dora_ict_incident(org_id, status);
CREATE INDEX dora_ict_inc_detected_idx ON dora_ict_incident(org_id, detected_at);

ALTER TABLE dora_ict_incident ENABLE ROW LEVEL SECURITY;
CREATE POLICY dora_ict_incident_org_isolation ON dora_ict_incident
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER dora_ict_incident_audit
  AFTER INSERT OR UPDATE OR DELETE ON dora_ict_incident
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
