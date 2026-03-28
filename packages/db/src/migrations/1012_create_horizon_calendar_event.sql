-- Sprint 75: Regulatory Horizon Scanner
-- Migration 1012: Create horizon_calendar_event table

CREATE TABLE IF NOT EXISTS horizon_calendar_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  scan_item_id UUID REFERENCES horizon_scan_item(id),
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

CREATE INDEX hce_org_idx ON horizon_calendar_event(org_id);
CREATE INDEX hce_date_idx ON horizon_calendar_event(org_id, event_date);
CREATE INDEX hce_item_idx ON horizon_calendar_event(scan_item_id);
CREATE INDEX hce_priority_idx ON horizon_calendar_event(org_id, priority);

ALTER TABLE horizon_calendar_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY horizon_calendar_event_org_isolation ON horizon_calendar_event
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER horizon_calendar_event_audit
  AFTER INSERT OR UPDATE OR DELETE ON horizon_calendar_event
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
