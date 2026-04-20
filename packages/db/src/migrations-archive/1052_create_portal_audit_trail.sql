-- Sprint 83: External Stakeholder Portals
-- Migration 1052: Create portal_audit_trail table

CREATE TABLE IF NOT EXISTS portal_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  session_id UUID REFERENCES portal_session(id),
  portal_type portal_type NOT NULL,
  action VARCHAR(200) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  ip_address VARCHAR(45),
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pat_org_idx ON portal_audit_trail(org_id);
CREATE INDEX pat_session_idx ON portal_audit_trail(session_id);
CREATE INDEX pat_action_idx ON portal_audit_trail(org_id, action);
CREATE INDEX pat_created_idx ON portal_audit_trail(created_at);

ALTER TABLE portal_audit_trail ENABLE ROW LEVEL SECURITY;
CREATE POLICY portal_audit_trail_org_isolation ON portal_audit_trail
  USING (org_id = current_setting('app.current_org_id')::uuid);
