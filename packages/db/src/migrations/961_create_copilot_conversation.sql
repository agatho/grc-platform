-- Sprint 67: GRC Copilot Enterprise Chat
-- Migration 961: Create copilot_conversation table

CREATE TABLE IF NOT EXISTS copilot_conversation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  user_id UUID NOT NULL REFERENCES "user"(id),
  title VARCHAR(500),
  language VARCHAR(10) NOT NULL DEFAULT 'de',
  context_module VARCHAR(50),
  context_entity_type VARCHAR(50),
  context_entity_id UUID,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  message_count INT NOT NULL DEFAULT 0,
  total_tokens_used INT NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX cc_org_user_idx ON copilot_conversation(org_id, user_id);
CREATE INDEX cc_last_msg_idx ON copilot_conversation(org_id, last_message_at);
CREATE INDEX cc_context_idx ON copilot_conversation(org_id, context_module);

-- RLS
ALTER TABLE copilot_conversation ENABLE ROW LEVEL SECURITY;
CREATE POLICY copilot_conversation_org_isolation ON copilot_conversation
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER copilot_conversation_audit
  AFTER INSERT OR UPDATE OR DELETE ON copilot_conversation
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
