-- Sprint 54, Migration 851: Create risk_treatment_link table (cross-cutting measures)

CREATE TABLE IF NOT EXISTS risk_treatment_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id UUID NOT NULL REFERENCES risk(id) ON DELETE CASCADE,
  treatment_id UUID NOT NULL REFERENCES risk_treatment(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organization(id),
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  linked_by UUID REFERENCES "user"(id),
  UNIQUE(risk_id, treatment_id)
);

CREATE INDEX IF NOT EXISTS rtl_risk_idx ON risk_treatment_link (risk_id);
CREATE INDEX IF NOT EXISTS rtl_treatment_idx ON risk_treatment_link (treatment_id);
CREATE INDEX IF NOT EXISTS rtl_org_idx ON risk_treatment_link (org_id);

ALTER TABLE risk_treatment_link ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS risk_treatment_link_org_isolation ON risk_treatment_link;
CREATE POLICY risk_treatment_link_org_isolation ON risk_treatment_link
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Register audit trigger
DROP TRIGGER IF EXISTS risk_treatment_link_audit ON risk_treatment_link;
CREATE TRIGGER risk_treatment_link_audit
  AFTER INSERT OR UPDATE OR DELETE ON risk_treatment_link
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
