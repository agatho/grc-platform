-- Sprint 40: ICS Advanced — CCM, SOX, Deficiency Management, Control Library, 3LoD Dashboard
-- Migrations 541–565

-- ═══════════════════════════════════════════════════════════
-- ccm_connector
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ccm_connector (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organization(id),
  name             VARCHAR(300) NOT NULL,
  connector_type   VARCHAR(50) NOT NULL,
  config           JSONB NOT NULL,
  credential_ref   VARCHAR(200),
  target_control_ids JSONB NOT NULL DEFAULT '[]',
  schedule         VARCHAR(20) NOT NULL DEFAULT 'daily',
  evaluation_rules JSONB NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  last_run_at      TIMESTAMPTZ,
  last_run_status  VARCHAR(20),
  created_by       UUID REFERENCES "user"(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ccmc_org_idx ON ccm_connector(org_id);

-- ═══════════════════════════════════════════════════════════
-- ccm_evidence (IMMUTABLE — no UPDATE trigger)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ccm_evidence (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id      UUID NOT NULL REFERENCES ccm_connector(id),
  org_id            UUID NOT NULL REFERENCES organization(id),
  control_id        UUID NOT NULL REFERENCES control(id),
  collected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_data          JSONB NOT NULL,
  evaluation_result VARCHAR(20) NOT NULL,
  evaluation_detail TEXT,
  score             INTEGER
);
CREATE INDEX IF NOT EXISTS ccme_connector_idx ON ccm_evidence(connector_id, collected_at);
CREATE INDEX IF NOT EXISTS ccme_control_idx ON ccm_evidence(control_id, collected_at);
CREATE INDEX IF NOT EXISTS ccme_org_idx ON ccm_evidence(org_id);

-- Prevent updates on ccm_evidence (immutable)
CREATE OR REPLACE FUNCTION prevent_ccm_evidence_update() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ccm_evidence is immutable — updates are not permitted';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS prevent_ccm_evidence_update ON ccm_evidence;
CREATE TRIGGER prevent_ccm_evidence_update BEFORE UPDATE ON ccm_evidence
  FOR EACH ROW EXECUTE FUNCTION prevent_ccm_evidence_update();

-- ═══════════════════════════════════════════════════════════
-- sox_scope
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sox_scope (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 UUID NOT NULL REFERENCES organization(id),
  fiscal_year            INTEGER NOT NULL,
  in_scope_process_ids   JSONB DEFAULT '[]',
  in_scope_accounts      JSONB DEFAULT '[]',
  in_scope_location_ids  JSONB DEFAULT '[]',
  in_scope_it_system_ids JSONB DEFAULT '[]',
  scoping_criteria       JSONB DEFAULT '{}',
  status                 VARCHAR(20) NOT NULL DEFAULT 'draft',
  approved_by            UUID REFERENCES "user"(id),
  approved_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ss_org_year_idx ON sox_scope(org_id, fiscal_year);

-- ═══════════════════════════════════════════════════════════
-- sox_walkthrough
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sox_walkthrough (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   UUID NOT NULL REFERENCES organization(id),
  control_id               UUID NOT NULL REFERENCES control(id),
  fiscal_year              INTEGER NOT NULL,
  narrative                TEXT NOT NULL,
  inputs                   TEXT,
  procedures               TEXT,
  outputs                  TEXT,
  evidence_description     TEXT,
  control_design_effective BOOLEAN,
  performed_by             UUID REFERENCES "user"(id),
  performed_at             TIMESTAMPTZ,
  reviewed_by              UUID REFERENCES "user"(id),
  reviewed_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sw_org_year_idx ON sox_walkthrough(org_id, fiscal_year);
CREATE INDEX IF NOT EXISTS sw_control_idx ON sox_walkthrough(control_id);

-- ═══════════════════════════════════════════════════════════
-- control_deficiency
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS control_deficiency (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   UUID NOT NULL REFERENCES organization(id),
  control_id               UUID NOT NULL REFERENCES control(id),
  finding_id               UUID,
  title                    VARCHAR(500) NOT NULL,
  description              TEXT,
  classification           VARCHAR(30) NOT NULL,
  root_cause_method        VARCHAR(20),
  root_cause               TEXT,
  remediation_plan         TEXT,
  remediation_responsible  UUID REFERENCES "user"(id),
  remediation_deadline     DATE,
  remediation_status       VARCHAR(20) NOT NULL DEFAULT 'open',
  retest_date              DATE,
  retest_result            VARCHAR(20),
  retest_by                UUID REFERENCES "user"(id),
  closed_at                TIMESTAMPTZ,
  created_by               UUID REFERENCES "user"(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cd_org_idx ON control_deficiency(org_id);
CREATE INDEX IF NOT EXISTS cd_control_idx ON control_deficiency(control_id);
CREATE INDEX IF NOT EXISTS cd_status_idx ON control_deficiency(org_id, remediation_status);

-- ═══════════════════════════════════════════════════════════
-- control_library_entry (NOT org-scoped — shared catalog)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS control_library_entry (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_ref         VARCHAR(50) NOT NULL,
  title               JSONB NOT NULL,
  description         JSONB NOT NULL,
  category            VARCHAR(50) NOT NULL,
  cobit_domain        VARCHAR(50),
  control_type        VARCHAR(20) NOT NULL,
  frequency           VARCHAR(20),
  automatable         BOOLEAN NOT NULL DEFAULT false,
  framework_mappings  JSONB NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS cle_category_idx ON control_library_entry(category);
CREATE INDEX IF NOT EXISTS cle_type_idx ON control_library_entry(control_type);

-- Add line_of_defense to entity tables for 3LoD
ALTER TABLE control ADD COLUMN IF NOT EXISTS line_of_defense VARCHAR(10);
ALTER TABLE risk ADD COLUMN IF NOT EXISTS line_of_defense VARCHAR(10);
ALTER TABLE process ADD COLUMN IF NOT EXISTS line_of_defense VARCHAR(10);
-- Add source_library_ref for traceability when adopting library controls
ALTER TABLE control ADD COLUMN IF NOT EXISTS source_library_ref VARCHAR(50);

-- ═══════════════════════════════════════════════════════════
-- RLS (all except control_library_entry which is shared)
-- ═══════════════════════════════════════════════════════════
ALTER TABLE ccm_connector ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccm_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE sox_scope ENABLE ROW LEVEL SECURITY;
ALTER TABLE sox_walkthrough ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_deficiency ENABLE ROW LEVEL SECURITY;

CREATE POLICY ccmc_org_isolation ON ccm_connector USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY ccme_org_isolation ON ccm_evidence USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY ss_org_isolation ON sox_scope USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY sw_org_isolation ON sox_walkthrough USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY cd_org_isolation ON control_deficiency USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Audit triggers
DROP TRIGGER IF EXISTS audit_ccm_connector ON ccm_connector;
CREATE TRIGGER audit_ccm_connector AFTER INSERT OR UPDATE OR DELETE ON ccm_connector FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_sox_scope ON sox_scope;
CREATE TRIGGER audit_sox_scope AFTER INSERT OR UPDATE OR DELETE ON sox_scope FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_sox_walkthrough ON sox_walkthrough;
CREATE TRIGGER audit_sox_walkthrough AFTER INSERT OR UPDATE OR DELETE ON sox_walkthrough FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_control_deficiency ON control_deficiency;
CREATE TRIGGER audit_control_deficiency AFTER INSERT OR UPDATE OR DELETE ON control_deficiency FOR EACH ROW EXECUTE FUNCTION audit_trigger();
-- ccm_evidence: INSERT-only audit trigger (no UPDATE/DELETE)
DROP TRIGGER IF EXISTS audit_ccm_evidence ON ccm_evidence;
CREATE TRIGGER audit_ccm_evidence AFTER INSERT ON ccm_evidence FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ═══════════════════════════════════════════════════════════
-- SOX Sample Size Reference
-- ═══════════════════════════════════════════════════════════
COMMENT ON TABLE sox_walkthrough IS 'PCAOB AS 2201 sample sizes: annual=1, quarterly=2, monthly=3, weekly=5, daily=25, multiple_daily=40';
