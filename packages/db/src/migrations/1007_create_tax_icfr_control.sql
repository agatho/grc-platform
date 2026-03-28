-- Sprint 74: Tax CMS und Financial Compliance
-- Migration 1007: Create tax_icfr_control table

CREATE TABLE IF NOT EXISTS tax_icfr_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  control_code VARCHAR(30) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  control_type VARCHAR(50) NOT NULL,
  process_area VARCHAR(100) NOT NULL,
  assertion VARCHAR(50),
  frequency VARCHAR(20) NOT NULL,
  automation_level VARCHAR(20) NOT NULL,
  key_control BOOLEAN NOT NULL DEFAULT false,
  idw_ps340_ref VARCHAR(100),
  test_procedure TEXT,
  last_test_date DATE,
  last_test_result VARCHAR(20),
  owner_id UUID REFERENCES "user"(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX icfr_code_idx ON tax_icfr_control(org_id, control_code);
CREATE INDEX icfr_org_idx ON tax_icfr_control(org_id);
CREATE INDEX icfr_area_idx ON tax_icfr_control(org_id, process_area);
CREATE INDEX icfr_key_idx ON tax_icfr_control(org_id, key_control);
CREATE INDEX icfr_status_idx ON tax_icfr_control(org_id, status);

ALTER TABLE tax_icfr_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY tax_icfr_control_org_isolation ON tax_icfr_control
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER tax_icfr_control_audit
  AFTER INSERT OR UPDATE OR DELETE ON tax_icfr_control
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
