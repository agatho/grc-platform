-- Sprint 56, Migration 876: Create process_raci_override table + RLS

CREATE TABLE IF NOT EXISTS process_raci_override (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_version_id UUID NOT NULL REFERENCES process_version(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organization(id),
  activity_bpmn_id VARCHAR(100) NOT NULL,
  participant_bpmn_id VARCHAR(100) NOT NULL,
  raci_role VARCHAR(1) NOT NULL CHECK (raci_role IN ('R','A','C','I')),
  overridden_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(process_version_id, activity_bpmn_id, participant_bpmn_id)
);

CREATE INDEX IF NOT EXISTS pro_version_idx ON process_raci_override (process_version_id);
CREATE INDEX IF NOT EXISTS pro_org_idx ON process_raci_override (org_id);

ALTER TABLE process_raci_override ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS process_raci_override_org_isolation ON process_raci_override;
CREATE POLICY process_raci_override_org_isolation ON process_raci_override
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

DROP TRIGGER IF EXISTS process_raci_override_audit ON process_raci_override;
CREATE TRIGGER process_raci_override_audit
  AFTER INSERT OR UPDATE OR DELETE ON process_raci_override
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
