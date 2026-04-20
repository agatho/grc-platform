-- Sprint 67: GRC Copilot Enterprise Chat
-- Migration 966: Create copilot_feedback table

CREATE TABLE IF NOT EXISTS copilot_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES copilot_message(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES "user"(id),
  rating INT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX cf_msg_user_idx ON copilot_feedback(message_id, user_id);
CREATE INDEX cf_org_idx ON copilot_feedback(org_id);

-- RLS
ALTER TABLE copilot_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY copilot_feedback_org_isolation ON copilot_feedback
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER copilot_feedback_audit
  AFTER INSERT OR UPDATE OR DELETE ON copilot_feedback
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
