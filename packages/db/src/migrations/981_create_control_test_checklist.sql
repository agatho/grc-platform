-- Sprint 70: AI Control Testing Agent
-- Migration 981: Create control_test_checklist table

CREATE TABLE IF NOT EXISTS control_test_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  control_id UUID NOT NULL,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  total_items INT NOT NULL DEFAULT 0,
  completed_items INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  overall_result VARCHAR(20),
  ai_generated BOOLEAN NOT NULL DEFAULT true,
  assignee_id UUID REFERENCES "user"(id),
  completed_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ctc_org_idx ON control_test_checklist(org_id);
CREATE INDEX ctc_control_idx ON control_test_checklist(org_id, control_id);
CREATE INDEX ctc_status_idx ON control_test_checklist(org_id, status);
CREATE INDEX ctc_assignee_idx ON control_test_checklist(assignee_id);

ALTER TABLE control_test_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY control_test_checklist_org_isolation ON control_test_checklist
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER control_test_checklist_audit
  AFTER INSERT OR UPDATE OR DELETE ON control_test_checklist
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
