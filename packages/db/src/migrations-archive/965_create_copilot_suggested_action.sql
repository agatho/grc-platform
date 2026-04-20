-- Sprint 67: GRC Copilot Enterprise Chat
-- Migration 965: Create copilot_suggested_action table

CREATE TABLE IF NOT EXISTS copilot_suggested_action (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES copilot_conversation(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  message_id UUID REFERENCES copilot_message(id),
  action_type VARCHAR(50) NOT NULL,
  label VARCHAR(500) NOT NULL,
  description TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'suggested',
  executed_at TIMESTAMPTZ,
  executed_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX csa_conv_idx ON copilot_suggested_action(conversation_id);
CREATE INDEX csa_org_status_idx ON copilot_suggested_action(org_id, status);

-- RLS
ALTER TABLE copilot_suggested_action ENABLE ROW LEVEL SECURITY;
CREATE POLICY copilot_suggested_action_org_isolation ON copilot_suggested_action
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER copilot_suggested_action_audit
  AFTER INSERT OR UPDATE OR DELETE ON copilot_suggested_action
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
