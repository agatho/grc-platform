-- Sprint 53: EAM Governance & Deep Integration
-- Migration 816-840: Governance status, BPMN placement, personal data flag

-- ──────────────────────────────────────────────────────────────
-- ALTER architecture_element: Add governance fields
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "architecture_element" ADD COLUMN IF NOT EXISTS "governance_status" VARCHAR(20) DEFAULT 'draft';
ALTER TABLE "architecture_element" ADD COLUMN IF NOT EXISTS "predecessor_id" UUID REFERENCES "architecture_element"(id);
ALTER TABLE "architecture_element" ADD COLUMN IF NOT EXISTS "examiner_id" UUID REFERENCES "user"(id);
ALTER TABLE "architecture_element" ADD COLUMN IF NOT EXISTS "responsible_id" UUID REFERENCES "user"(id);

-- ──────────────────────────────────────────────────────────────
-- ALTER business_capability: Add governance fields
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "business_capability" ADD COLUMN IF NOT EXISTS "governance_status" VARCHAR(20) DEFAULT 'draft';
ALTER TABLE "business_capability" ADD COLUMN IF NOT EXISTS "predecessor_id" UUID;
ALTER TABLE "business_capability" ADD COLUMN IF NOT EXISTS "examiner_id" UUID REFERENCES "user"(id);
ALTER TABLE "business_capability" ADD COLUMN IF NOT EXISTS "responsible_id" UUID REFERENCES "user"(id);

-- ──────────────────────────────────────────────────────────────
-- ALTER application_portfolio: Add personal data fields
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "application_portfolio" ADD COLUMN IF NOT EXISTS "processes_personal_data" BOOLEAN DEFAULT false;
ALTER TABLE "application_portfolio" ADD COLUMN IF NOT EXISTS "personal_data_detail" TEXT;

-- ──────────────────────────────────────────────────────────────
-- EAM Governance Log (IMMUTABLE)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "eam_governance_log" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL REFERENCES "organization"(id),
  "element_id" UUID NOT NULL,
  "element_type" VARCHAR(30) NOT NULL,
  "from_status" VARCHAR(20),
  "to_status" VARCHAR(20) NOT NULL,
  "action" VARCHAR(20) NOT NULL,
  "performed_by" UUID NOT NULL REFERENCES "user"(id),
  "justification" TEXT,
  "performed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "egl_org_idx" ON "eam_governance_log" ("org_id");
CREATE INDEX IF NOT EXISTS "egl_element_idx" ON "eam_governance_log" ("element_id");
CREATE INDEX IF NOT EXISTS "egl_action_idx" ON "eam_governance_log" ("org_id", "action");
CREATE INDEX IF NOT EXISTS "egl_performed_by_idx" ON "eam_governance_log" ("performed_by");
CREATE INDEX IF NOT EXISTS "egl_date_idx" ON "eam_governance_log" ("org_id", "performed_at");

-- IMMUTABLE: Block UPDATE and DELETE on governance log
CREATE OR REPLACE FUNCTION prevent_governance_log_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'eam_governance_log is immutable. UPDATE and DELETE operations are not allowed.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_governance_log_update ON "eam_governance_log";
CREATE TRIGGER trg_prevent_governance_log_update
  BEFORE UPDATE OR DELETE ON "eam_governance_log"
  FOR EACH ROW EXECUTE FUNCTION prevent_governance_log_mutation();

-- ──────────────────────────────────────────────────────────────
-- EAM BPMN Element Placement
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "eam_bpmn_element_placement" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "process_version_id" UUID NOT NULL,
  "eam_element_id" UUID NOT NULL REFERENCES "architecture_element"(id),
  "org_id" UUID NOT NULL REFERENCES "organization"(id),
  "placement_type" VARCHAR(20) NOT NULL,
  "bpmn_node_id" VARCHAR(100),
  "position_x" NUMERIC,
  "position_y" NUMERIC,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ebep_process_idx" ON "eam_bpmn_element_placement" ("process_version_id");
CREATE INDEX IF NOT EXISTS "ebep_element_idx" ON "eam_bpmn_element_placement" ("eam_element_id");
CREATE INDEX IF NOT EXISTS "ebep_org_idx" ON "eam_bpmn_element_placement" ("org_id");

-- ──────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "eam_governance_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eam_bpmn_element_placement" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "egl_org_isolation" ON "eam_governance_log" USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY "ebep_org_isolation" ON "eam_bpmn_element_placement" USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- ──────────────────────────────────────────────────────────────
-- Audit trigger (only INSERT on governance_log since it is immutable)
-- ──────────────────────────────────────────────────────────────

CREATE TRIGGER audit_eam_governance_log AFTER INSERT ON "eam_governance_log" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_eam_bpmn_element_placement AFTER INSERT OR UPDATE OR DELETE ON "eam_bpmn_element_placement" FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- Governance performance indices
-- ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "ae_governance_idx" ON "architecture_element" ("org_id", "governance_status");
CREATE INDEX IF NOT EXISTS "ae_predecessor_idx" ON "architecture_element" ("predecessor_id");
CREATE INDEX IF NOT EXISTS "ae_examiner_idx" ON "architecture_element" ("examiner_id");
CREATE INDEX IF NOT EXISTS "ae_responsible_idx" ON "architecture_element" ("responsible_id");
CREATE INDEX IF NOT EXISTS "ap_personal_data_idx" ON "application_portfolio" ("org_id", "processes_personal_data");
