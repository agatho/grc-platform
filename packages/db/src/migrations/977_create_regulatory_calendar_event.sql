-- Sprint 69: AI Regulatory Change Agent
-- Migration 977: Create regulatory_calendar_event table

CREATE TABLE IF NOT EXISTS regulatory_calendar_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  change_id UUID REFERENCES regulatory_change(id),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  event_type VARCHAR(50) NOT NULL,
  event_date DATE NOT NULL,
  jurisdiction VARCHAR(100),
  framework VARCHAR(100),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  reminder_days INT DEFAULT 30,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  assignee_id UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rce_org_idx ON regulatory_calendar_event(org_id);
CREATE INDEX rce_date_idx ON regulatory_calendar_event(org_id, event_date);
CREATE INDEX rce_change_idx ON regulatory_calendar_event(change_id);
CREATE INDEX rce_priority_idx ON regulatory_calendar_event(org_id, priority);

ALTER TABLE regulatory_calendar_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY regulatory_calendar_event_org_isolation ON regulatory_calendar_event
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER regulatory_calendar_event_audit
  AFTER INSERT OR UPDATE OR DELETE ON regulatory_calendar_event
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
