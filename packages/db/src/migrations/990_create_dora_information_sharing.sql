-- Sprint 72: DORA Compliance Module
-- Migration 990: Create dora_information_sharing table

CREATE TABLE IF NOT EXISTS dora_information_sharing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  title VARCHAR(500) NOT NULL,
  sharing_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  classification VARCHAR(20) NOT NULL,
  recipient_groups JSONB DEFAULT '[]',
  source_incident_id UUID REFERENCES dora_ict_incident(id),
  shared_at TIMESTAMPTZ,
  shared_by UUID REFERENCES "user"(id),
  anonymized BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX dora_is_org_idx ON dora_information_sharing(org_id);
CREATE INDEX dora_is_type_idx ON dora_information_sharing(org_id, sharing_type);
CREATE INDEX dora_is_status_idx ON dora_information_sharing(org_id, status);

ALTER TABLE dora_information_sharing ENABLE ROW LEVEL SECURITY;
CREATE POLICY dora_information_sharing_org_isolation ON dora_information_sharing
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER dora_information_sharing_audit
  AFTER INSERT OR UPDATE OR DELETE ON dora_information_sharing
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
