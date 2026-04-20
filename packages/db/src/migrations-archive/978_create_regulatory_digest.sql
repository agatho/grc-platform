-- Sprint 69: AI Regulatory Change Agent
-- Migration 978: Create regulatory_digest table

CREATE TABLE IF NOT EXISTS regulatory_digest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  digest_type VARCHAR(20) NOT NULL DEFAULT 'weekly',
  summary TEXT NOT NULL,
  change_count INT NOT NULL DEFAULT 0,
  critical_count INT NOT NULL DEFAULT 0,
  highlights JSONB DEFAULT '[]',
  recipients JSONB DEFAULT '[]',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rd_org_idx ON regulatory_digest(org_id);
CREATE INDEX rd_period_idx ON regulatory_digest(org_id, period_start);

ALTER TABLE regulatory_digest ENABLE ROW LEVEL SECURITY;
CREATE POLICY regulatory_digest_org_isolation ON regulatory_digest
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER regulatory_digest_audit
  AFTER INSERT OR UPDATE OR DELETE ON regulatory_digest
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
