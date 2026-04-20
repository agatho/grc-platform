-- Sprint 65: DevOps und IT Connectors
-- Migration 953: Create it_infrastructure_check table

CREATE TABLE IF NOT EXISTS it_infrastructure_check (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  connector_id UUID NOT NULL REFERENCES evidence_connector(id) ON DELETE CASCADE,
  check_type VARCHAR(50) NOT NULL,
  check_name VARCHAR(500) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  total_devices INT NOT NULL DEFAULT 0,
  compliant_devices INT NOT NULL DEFAULT 0,
  non_compliant_devices INT NOT NULL DEFAULT 0,
  compliance_rate NUMERIC(5,2),
  findings JSONB DEFAULT '[]',
  details JSONB DEFAULT '{}',
  remediation_guide TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX iic_org_idx ON it_infrastructure_check(org_id);
CREATE INDEX iic_connector_idx ON it_infrastructure_check(connector_id);
CREATE INDEX iic_check_type_idx ON it_infrastructure_check(check_type);
CREATE INDEX iic_status_idx ON it_infrastructure_check(status);
CREATE INDEX iic_executed_idx ON it_infrastructure_check(executed_at);

-- RLS
ALTER TABLE it_infrastructure_check ENABLE ROW LEVEL SECURITY;
CREATE POLICY it_infrastructure_check_org_isolation ON it_infrastructure_check
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER it_infrastructure_check_audit AFTER INSERT OR UPDATE OR DELETE ON it_infrastructure_check
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
