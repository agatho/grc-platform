-- Sprint 57: API Playground
-- Migration 895: Create api_playground_snippet table

CREATE TABLE IF NOT EXISTS api_playground_snippet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  method VARCHAR(10) NOT NULL,
  path VARCHAR(500) NOT NULL,
  headers JSONB DEFAULT '{}',
  query_params JSONB DEFAULT '{}',
  body TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX playground_org_idx ON api_playground_snippet(org_id);
CREATE INDEX playground_created_by_idx ON api_playground_snippet(created_by);

-- RLS
ALTER TABLE api_playground_snippet ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_playground_snippet_org_isolation ON api_playground_snippet
  USING (org_id::text = current_setting('app.current_org_id', true));

-- Audit trigger
CREATE TRIGGER api_playground_snippet_audit AFTER INSERT OR UPDATE OR DELETE ON api_playground_snippet
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
