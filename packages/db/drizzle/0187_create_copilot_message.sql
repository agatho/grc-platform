-- Sprint 67: GRC Copilot Enterprise Chat
-- Migration 962: Create copilot_message table

CREATE TABLE IF NOT EXISTS copilot_message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES copilot_conversation(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(20) NOT NULL DEFAULT 'text',
  rag_sources JSONB DEFAULT '[]',
  model VARCHAR(100),
  input_tokens INT,
  output_tokens INT,
  latency_ms INT,
  template_key VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX copilot_message_conv_idx ON copilot_message(conversation_id);
CREATE INDEX copilot_message_org_idx ON copilot_message(org_id);
CREATE INDEX copilot_message_role_idx ON copilot_message(conversation_id, role);

-- RLS
ALTER TABLE copilot_message ENABLE ROW LEVEL SECURITY;
CREATE POLICY copilot_message_org_isolation ON copilot_message
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER copilot_message_audit
  AFTER INSERT OR UPDATE OR DELETE ON copilot_message
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
