-- Sprint 67: GRC Copilot Enterprise Chat
-- Migration 964: Create copilot_rag_source table

CREATE TABLE IF NOT EXISTS copilot_rag_source (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  source_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  embedding JSONB,
  chunk_index INT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  last_indexed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX crs_org_source_idx ON copilot_rag_source(org_id, source_type);
CREATE INDEX crs_entity_idx ON copilot_rag_source(org_id, entity_id);
CREATE INDEX crs_indexed_idx ON copilot_rag_source(last_indexed_at);

-- RLS
ALTER TABLE copilot_rag_source ENABLE ROW LEVEL SECURITY;
CREATE POLICY copilot_rag_source_org_isolation ON copilot_rag_source
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER copilot_rag_source_audit
  AFTER INSERT OR UPDATE OR DELETE ON copilot_rag_source
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
