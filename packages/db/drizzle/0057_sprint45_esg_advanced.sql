-- Sprint 45: ESG Advanced — Double Materiality, Carbon Calculator,
-- ESRS Templates, Data Collection, Supply Chain ESG
-- Migrations 661–685

-- ═══════════════════════════════════════════════════════════
-- materiality_assessment
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS materiality_assessment (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 UUID NOT NULL REFERENCES organization(id),
  reporting_period_year  INTEGER NOT NULL,
  status                 VARCHAR(30) NOT NULL DEFAULT 'draft',
  financial_threshold    JSONB DEFAULT '{}',
  impact_threshold       JSONB DEFAULT '{}',
  finalized_by           UUID REFERENCES "user"(id),
  finalized_at           TIMESTAMPTZ,
  created_by             UUID REFERENCES "user"(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ma_org_idx ON materiality_assessment(org_id);
CREATE INDEX IF NOT EXISTS ma_year_idx ON materiality_assessment(org_id, reporting_period_year);

-- ═══════════════════════════════════════════════════════════
-- materiality_iro — IRO entries with dual materiality scores
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS materiality_iro (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id               UUID NOT NULL REFERENCES materiality_assessment(id) ON DELETE CASCADE,
  org_id                      UUID NOT NULL,
  esrs_topic                  VARCHAR(10) NOT NULL,
  iro_type                    VARCHAR(20) NOT NULL,
  title                       VARCHAR(500) NOT NULL,
  description                 TEXT,
  affected_stakeholders       TEXT[] DEFAULT '{}',
  value_chain_stage           VARCHAR(30),
  time_horizon                VARCHAR(20),
  financial_magnitude         VARCHAR(20),
  financial_likelihood        VARCHAR(20),
  impact_scale                VARCHAR(20),
  impact_scope                VARCHAR(20),
  impact_irremediable         VARCHAR(30),
  is_positive_impact          BOOLEAN DEFAULT false,
  financial_materiality_score INTEGER,
  impact_materiality_score    INTEGER,
  is_material                 BOOLEAN,
  created_by                  UUID REFERENCES "user"(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS miro_assessment_idx ON materiality_iro(assessment_id);
CREATE INDEX IF NOT EXISTS miro_topic_idx ON materiality_iro(assessment_id, esrs_topic);

-- Trigger: auto-compute is_material based on thresholds
CREATE OR REPLACE FUNCTION compute_materiality_score() RETURNS TRIGGER AS $$
DECLARE
  assessment_rec RECORD;
  fin_threshold INTEGER;
  imp_threshold INTEGER;
BEGIN
  SELECT financial_threshold, impact_threshold INTO assessment_rec
  FROM materiality_assessment WHERE id = NEW.assessment_id;

  fin_threshold := COALESCE((assessment_rec.financial_threshold->>'score_threshold')::int, 50);
  imp_threshold := COALESCE((assessment_rec.impact_threshold->>'score_threshold')::int, 50);

  NEW.is_material := (COALESCE(NEW.financial_materiality_score, 0) >= fin_threshold)
                   OR (COALESCE(NEW.impact_materiality_score, 0) >= imp_threshold);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER materiality_iro_score_trigger
  BEFORE INSERT OR UPDATE ON materiality_iro
  FOR EACH ROW EXECUTE FUNCTION compute_materiality_score();

-- ═══════════════════════════════════════════════════════════
-- materiality_stakeholder_engagement
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS materiality_stakeholder_engagement (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id         UUID NOT NULL REFERENCES materiality_assessment(id) ON DELETE CASCADE,
  org_id                UUID NOT NULL,
  stakeholder_group     VARCHAR(30) NOT NULL,
  engagement_method     VARCHAR(30) NOT NULL,
  key_concerns          TEXT,
  participant_count     INTEGER,
  engagement_date       DATE,
  linked_iro_ids        UUID[] DEFAULT '{}',
  evidence_document_id  UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mse_assessment_idx ON materiality_stakeholder_engagement(assessment_id);

-- ═══════════════════════════════════════════════════════════
-- emission_source — Emission source registry
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS emission_source (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organization(id),
  scope           INTEGER NOT NULL,
  scope3_category INTEGER,
  source_name     VARCHAR(500) NOT NULL,
  source_type     VARCHAR(50) NOT NULL,
  fuel_type       VARCHAR(100),
  facility_name   VARCHAR(200),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS es_org_idx ON emission_source(org_id);
CREATE INDEX IF NOT EXISTS es_scope_idx ON emission_source(org_id, scope);

-- ═══════════════════════════════════════════════════════════
-- emission_activity_data — Activity data with auto-CO2e
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS emission_activity_data (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id              UUID NOT NULL REFERENCES emission_source(id),
  org_id                 UUID NOT NULL,
  reporting_period_start DATE NOT NULL,
  reporting_period_end   DATE NOT NULL,
  quantity               NUMERIC(15,4) NOT NULL,
  unit                   VARCHAR(50) NOT NULL,
  data_quality           VARCHAR(20) NOT NULL,
  evidence_reference     TEXT,
  emission_factor_id     UUID,
  computed_co2e_tonnes   NUMERIC(15,4),
  computation_method     VARCHAR(20),
  created_by             UUID REFERENCES "user"(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ead_source_idx ON emission_activity_data(source_id);
CREATE INDEX IF NOT EXISTS ead_org_period_idx ON emission_activity_data(org_id, reporting_period_start);

-- Trigger: auto-compute CO2e from emission factor
CREATE OR REPLACE FUNCTION compute_co2e() RETURNS TRIGGER AS $$
DECLARE
  factor_rec RECORD;
BEGIN
  IF NEW.emission_factor_id IS NOT NULL THEN
    SELECT co2e_factor INTO factor_rec FROM emission_factor WHERE id = NEW.emission_factor_id;
    IF FOUND THEN
      NEW.computed_co2e_tonnes := NEW.quantity * factor_rec.co2e_factor / 1000;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER emission_activity_co2e_trigger
  BEFORE INSERT OR UPDATE ON emission_activity_data
  FOR EACH ROW EXECUTE FUNCTION compute_co2e();

-- ═══════════════════════════════════════════════════════════
-- emission_factor — Global + custom factor library
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS emission_factor (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factor_source VARCHAR(30) NOT NULL,
  activity_type VARCHAR(100) NOT NULL,
  fuel_type     VARCHAR(100),
  unit          VARCHAR(50) NOT NULL,
  co2e_factor   NUMERIC(15,8) NOT NULL,
  co2_factor    NUMERIC(15,8),
  ch4_factor    NUMERIC(15,8),
  n2o_factor    NUMERIC(15,8),
  valid_year    INTEGER NOT NULL,
  country       VARCHAR(5),
  is_custom     BOOLEAN NOT NULL DEFAULT false,
  org_id        UUID
);
CREATE INDEX IF NOT EXISTS ef_lookup_idx ON emission_factor(activity_type, fuel_type, valid_year);
CREATE INDEX IF NOT EXISTS ef_source_idx ON emission_factor(factor_source);

-- ═══════════════════════════════════════════════════════════
-- esg_collection_campaign
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS esg_collection_campaign (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 UUID NOT NULL REFERENCES organization(id),
  title                  VARCHAR(500) NOT NULL,
  reporting_period_start DATE NOT NULL,
  reporting_period_end   DATE NOT NULL,
  deadline               DATE NOT NULL,
  status                 VARCHAR(20) NOT NULL DEFAULT 'draft',
  template_id            UUID,
  created_by             UUID REFERENCES "user"(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ecc_org_idx ON esg_collection_campaign(org_id);
CREATE INDEX IF NOT EXISTS ecc_status_idx ON esg_collection_campaign(org_id, status);

-- ═══════════════════════════════════════════════════════════
-- esg_collection_assignment
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS esg_collection_assignment (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           UUID NOT NULL REFERENCES esg_collection_campaign(id) ON DELETE CASCADE,
  org_id                UUID NOT NULL,
  metric_id             UUID NOT NULL,
  assignee_id           UUID NOT NULL REFERENCES "user"(id),
  reviewer_id           UUID REFERENCES "user"(id),
  status                VARCHAR(20) NOT NULL DEFAULT 'pending',
  submitted_value       NUMERIC(20,4),
  submitted_unit        VARCHAR(50),
  submitted_evidence    TEXT,
  submitted_notes       TEXT,
  submitted_at          TIMESTAMPTZ,
  reviewed_at           TIMESTAMPTZ,
  approved_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  previous_period_value NUMERIC(20,4),
  validation_warnings   JSONB DEFAULT '[]',
  validation_errors     JSONB DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS eca_campaign_idx ON esg_collection_assignment(campaign_id);
CREATE INDEX IF NOT EXISTS eca_assignee_idx ON esg_collection_assignment(assignee_id);

-- ═══════════════════════════════════════════════════════════
-- supplier_esg_assessment
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS supplier_esg_assessment (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 UUID NOT NULL REFERENCES organization(id),
  vendor_id              UUID NOT NULL REFERENCES vendor(id),
  assessment_date        DATE NOT NULL,
  questionnaire_version  INTEGER DEFAULT 1,
  environmental_score    INTEGER,
  social_score           INTEGER,
  governance_score       INTEGER,
  overall_score          INTEGER,
  risk_classification    VARCHAR(20),
  industry_risk_factor   NUMERIC(3,1),
  geographic_risk_factor NUMERIC(3,1),
  responses              JSONB DEFAULT '{}',
  assessed_by            UUID REFERENCES "user"(id),
  next_assessment_date   DATE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sea_org_idx ON supplier_esg_assessment(org_id);
CREATE INDEX IF NOT EXISTS sea_vendor_idx ON supplier_esg_assessment(vendor_id);

-- ═══════════════════════════════════════════════════════════
-- supplier_esg_corrective_action
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS supplier_esg_corrective_action (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id     UUID NOT NULL REFERENCES supplier_esg_assessment(id),
  org_id            UUID NOT NULL,
  vendor_id         UUID NOT NULL REFERENCES vendor(id),
  finding           TEXT NOT NULL,
  corrective_action TEXT NOT NULL,
  responsible_id    UUID REFERENCES "user"(id),
  deadline          DATE,
  follow_up_date    DATE,
  status            VARCHAR(20) NOT NULL DEFAULT 'open',
  verification_notes TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seca_assessment_idx ON supplier_esg_corrective_action(assessment_id);
CREATE INDEX IF NOT EXISTS seca_vendor_idx ON supplier_esg_corrective_action(vendor_id);

-- ═══════════════════════════════════════════════════════════
-- lksg_due_diligence — LkSG documentation per supplier
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS lksg_due_diligence (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                       UUID NOT NULL REFERENCES organization(id),
  vendor_id                    UUID NOT NULL REFERENCES vendor(id),
  reporting_year               INTEGER NOT NULL,
  risk_analysis_status         VARCHAR(20) NOT NULL DEFAULT 'not_started',
  risk_analysis_document_id    UUID,
  preventive_measures          TEXT,
  remedial_measures            TEXT,
  complaints_procedure_status  VARCHAR(20),
  documentation_status         VARCHAR(20) NOT NULL DEFAULT 'incomplete',
  overall_compliance           VARCHAR(30),
  created_by                   UUID REFERENCES "user"(id),
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ldd_org_idx ON lksg_due_diligence(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS ldd_vendor_year_idx ON lksg_due_diligence(vendor_id, reporting_year);

-- ═══════════════════════════════════════════════════════════
-- esrs_disclosure_template
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS esrs_disclosure_template (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES organization(id),
  standard                VARCHAR(10) NOT NULL,
  disclosure_requirement  VARCHAR(20) NOT NULL,
  title                   VARCHAR(500) NOT NULL,
  description             TEXT,
  required_data_points    JSONB DEFAULT '[]',
  content                 TEXT,
  auto_populated_values   JSONB DEFAULT '{}',
  status                  VARCHAR(20) NOT NULL DEFAULT 'not_started',
  reviewed_by             UUID REFERENCES "user"(id),
  reviewed_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS edt_org_idx ON esrs_disclosure_template(org_id);
CREATE INDEX IF NOT EXISTS edt_standard_idx ON esrs_disclosure_template(org_id, standard);

-- ═══════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════
ALTER TABLE materiality_assessment ENABLE ROW LEVEL SECURITY;
CREATE POLICY materiality_assessment_org ON materiality_assessment USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE materiality_iro ENABLE ROW LEVEL SECURITY;
CREATE POLICY materiality_iro_org ON materiality_iro USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE materiality_stakeholder_engagement ENABLE ROW LEVEL SECURITY;
CREATE POLICY materiality_stakeholder_engagement_org ON materiality_stakeholder_engagement USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE emission_source ENABLE ROW LEVEL SECURITY;
CREATE POLICY emission_source_org ON emission_source USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE emission_activity_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY emission_activity_data_org ON emission_activity_data USING (org_id = current_setting('app.current_org_id')::uuid);

-- emission_factor: NO RLS for global library (org_id IS NULL), RLS for custom factors
ALTER TABLE emission_factor ENABLE ROW LEVEL SECURITY;
CREATE POLICY emission_factor_access ON emission_factor USING (
  org_id IS NULL OR org_id = current_setting('app.current_org_id')::uuid
);

ALTER TABLE esg_collection_campaign ENABLE ROW LEVEL SECURITY;
CREATE POLICY esg_collection_campaign_org ON esg_collection_campaign USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE esg_collection_assignment ENABLE ROW LEVEL SECURITY;
CREATE POLICY esg_collection_assignment_org ON esg_collection_assignment USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE supplier_esg_assessment ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_esg_assessment_org ON supplier_esg_assessment USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE supplier_esg_corrective_action ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_esg_corrective_action_org ON supplier_esg_corrective_action USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE lksg_due_diligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY lksg_due_diligence_org ON lksg_due_diligence USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE esrs_disclosure_template ENABLE ROW LEVEL SECURITY;
CREATE POLICY esrs_disclosure_template_org ON esrs_disclosure_template USING (org_id = current_setting('app.current_org_id')::uuid);

-- ═══════════════════════════════════════════════════════════
-- Audit triggers
-- ═══════════════════════════════════════════════════════════
CREATE TRIGGER materiality_assessment_audit AFTER INSERT OR UPDATE OR DELETE ON materiality_assessment FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER materiality_iro_audit AFTER INSERT OR UPDATE OR DELETE ON materiality_iro FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER materiality_stakeholder_engagement_audit AFTER INSERT ON materiality_stakeholder_engagement FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER emission_source_audit AFTER INSERT OR UPDATE OR DELETE ON emission_source FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER emission_activity_data_audit AFTER INSERT OR UPDATE ON emission_activity_data FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER esg_collection_campaign_audit AFTER INSERT OR UPDATE OR DELETE ON esg_collection_campaign FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER esg_collection_assignment_audit AFTER INSERT OR UPDATE ON esg_collection_assignment FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER supplier_esg_assessment_audit AFTER INSERT OR UPDATE ON supplier_esg_assessment FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER supplier_esg_corrective_action_audit AFTER INSERT OR UPDATE ON supplier_esg_corrective_action FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER lksg_due_diligence_audit AFTER INSERT OR UPDATE ON lksg_due_diligence FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER esrs_disclosure_template_audit AFTER INSERT OR UPDATE ON esrs_disclosure_template FOR EACH ROW EXECUTE FUNCTION audit_trigger();
