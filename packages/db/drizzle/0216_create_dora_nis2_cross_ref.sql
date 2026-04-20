-- Sprint 72: DORA Compliance Module
-- Migration 991: Create dora_nis2_cross_ref table

CREATE TABLE IF NOT EXISTS dora_nis2_cross_ref (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  dora_article VARCHAR(50) NOT NULL,
  dora_requirement TEXT NOT NULL,
  nis2_article VARCHAR(50),
  nis2_requirement TEXT,
  overlap_type VARCHAR(20) NOT NULL,
  compliance_status VARCHAR(20) NOT NULL DEFAULT 'not_assessed',
  notes TEXT,
  assessed_by UUID REFERENCES "user"(id),
  assessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX dora_nis2_org_idx ON dora_nis2_cross_ref(org_id);
CREATE INDEX dora_nis2_dora_idx ON dora_nis2_cross_ref(org_id, dora_article);
CREATE INDEX dora_nis2_overlap_idx ON dora_nis2_cross_ref(org_id, overlap_type);
CREATE INDEX dora_nis2_compliance_idx ON dora_nis2_cross_ref(org_id, compliance_status);

ALTER TABLE dora_nis2_cross_ref ENABLE ROW LEVEL SECURITY;
CREATE POLICY dora_nis2_cross_ref_org_isolation ON dora_nis2_cross_ref
  USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TRIGGER dora_nis2_cross_ref_audit
  AFTER INSERT OR UPDATE OR DELETE ON dora_nis2_cross_ref
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
