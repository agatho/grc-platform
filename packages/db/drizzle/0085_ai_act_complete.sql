-- Migration 0085: EU AI Act Complete Module
-- Creates base tables (from Sprint 73 schema) + new Gap tables

-- ============================================================
-- BASE: ai_system (Sprint 73 - was missing from DB)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_system (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  system_code VARCHAR(30) NOT NULL,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  purpose TEXT,
  ai_technique VARCHAR(100),
  risk_classification VARCHAR(20) NOT NULL DEFAULT 'minimal',
  risk_justification TEXT,
  annex_category VARCHAR(50),
  provider_or_deployer VARCHAR(20) NOT NULL DEFAULT 'deployer',
  provider_name VARCHAR(500),
  provider_jurisdiction VARCHAR(100),
  deployment_date DATE,
  training_data JSONB DEFAULT '{}',
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  affected_persons JSONB DEFAULT '[]',
  technical_documentation JSONB DEFAULT '{}',
  human_oversight_required BOOLEAN NOT NULL DEFAULT false,
  transparency_obligations JSONB DEFAULT '[]',
  owner_id UUID REFERENCES "user"(id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  -- Gap 6: EU Database fields
  eu_database_registered BOOLEAN DEFAULT false,
  eu_database_registration_id VARCHAR(200),
  eu_database_registered_at TIMESTAMPTZ,
  eu_database_url VARCHAR(1000),
  -- Gap 7: Document lifecycle
  documentation_retention_years INTEGER DEFAULT 10,
  documentation_expiry_date DATE,
  last_documentation_review DATE,
  -- Tags & timestamps
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES "user"(id),
  updated_by UUID REFERENCES "user"(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_system_org ON ai_system(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_system_code ON ai_system(org_id, system_code);

-- ============================================================
-- BASE: ai_conformity_assessment (Sprint 73)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_conformity_assessment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID NOT NULL REFERENCES ai_system(id),
  assessment_code VARCHAR(30),
  assessment_type VARCHAR(30) NOT NULL DEFAULT 'self',
  assessor_name VARCHAR(500),
  assessor_organization VARCHAR(500),
  requirements JSONB DEFAULT '[]',
  findings JSONB DEFAULT '[]',
  overall_result VARCHAR(20) DEFAULT 'pending',
  certificate_reference VARCHAR(200),
  valid_from DATE,
  valid_until DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conformity_org ON ai_conformity_assessment(org_id);

-- ============================================================
-- BASE: ai_human_oversight_log (Sprint 73)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_human_oversight_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID NOT NULL REFERENCES ai_system(id),
  log_type VARCHAR(50) NOT NULL DEFAULT 'monitoring_check',
  description TEXT,
  risk_level VARCHAR(20),
  action_taken TEXT,
  reviewed_by UUID REFERENCES "user"(id),
  reviewed_at TIMESTAMPTZ,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_oversight_org ON ai_human_oversight_log(org_id);

-- ============================================================
-- BASE: ai_transparency_entry (Sprint 73)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_transparency_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID NOT NULL REFERENCES ai_system(id),
  entry_type VARCHAR(50) NOT NULL,
  title VARCHAR(500),
  content TEXT,
  audience VARCHAR(100),
  published_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_transparency_org ON ai_transparency_entry(org_id);

-- ============================================================
-- BASE: ai_fria (Sprint 73)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_fria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID NOT NULL REFERENCES ai_system(id),
  assessment_code VARCHAR(30),
  rights_assessed JSONB DEFAULT '[]',
  discrimination_risk VARCHAR(20),
  data_protection_impact VARCHAR(20),
  access_to_justice VARCHAR(20),
  overall_impact VARCHAR(20) DEFAULT 'low',
  mitigation_measures JSONB DEFAULT '[]',
  next_review_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES "user"(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_fria_org ON ai_fria(org_id);

-- ============================================================
-- BASE: ai_framework_mapping (Sprint 73)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_framework_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  control_reference VARCHAR(100) NOT NULL,
  control_title VARCHAR(500),
  framework VARCHAR(50) NOT NULL,
  ai_act_article VARCHAR(200),
  implementation_status VARCHAR(30) NOT NULL DEFAULT 'not_started',
  evidence_ids JSONB DEFAULT '[]',
  notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_mapping_org ON ai_framework_mapping(org_id);

-- ============================================================
-- GAP 2: AI Incident (Art. 62-63)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_incident (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID REFERENCES ai_system(id),
  gpai_model_id UUID REFERENCES ai_gpai_model(id),
  incident_code VARCHAR(50),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  severity VARCHAR(50) NOT NULL DEFAULT 'medium',
  is_serious BOOLEAN NOT NULL DEFAULT false,
  serious_criteria JSONB DEFAULT '[]',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  authority_deadline TIMESTAMPTZ,
  authority_notified_at TIMESTAMPTZ,
  authority_reference VARCHAR(200),
  affected_persons_count INTEGER,
  affected_rights TEXT[],
  harm_type VARCHAR(100),
  harm_description TEXT,
  root_cause TEXT,
  root_cause_category VARCHAR(100),
  remediation_actions TEXT,
  preventive_measures TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'detected',
  resolved_at TIMESTAMPTZ,
  lessons_learned TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES "user"(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_incident_org ON ai_incident(org_id);

-- ============================================================
-- GAP 3: Prohibited Practice Screening (Art. 5)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_prohibited_screening (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID NOT NULL REFERENCES ai_system(id),
  screening_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  screened_by UUID REFERENCES "user"(id),
  subliminal_manipulation BOOLEAN NOT NULL DEFAULT false,
  exploitation_vulnerable BOOLEAN NOT NULL DEFAULT false,
  social_scoring BOOLEAN NOT NULL DEFAULT false,
  predictive_policing_individual BOOLEAN NOT NULL DEFAULT false,
  facial_recognition_scraping BOOLEAN NOT NULL DEFAULT false,
  emotion_inference_workplace BOOLEAN NOT NULL DEFAULT false,
  biometric_categorization BOOLEAN NOT NULL DEFAULT false,
  real_time_biometric_public BOOLEAN NOT NULL DEFAULT false,
  has_prohibited_practice BOOLEAN GENERATED ALWAYS AS (
    subliminal_manipulation OR exploitation_vulnerable OR social_scoring OR
    predictive_policing_individual OR facial_recognition_scraping OR
    emotion_inference_workplace OR biometric_categorization OR real_time_biometric_public
  ) STORED,
  justification TEXT,
  exception_applied BOOLEAN DEFAULT false,
  exception_justification TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'completed',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- GAP 4: Provider QMS (Art. 16-17)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_provider_qms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID REFERENCES ai_system(id),
  risk_management_procedure BOOLEAN NOT NULL DEFAULT false,
  data_governance_procedure BOOLEAN NOT NULL DEFAULT false,
  technical_documentation_procedure BOOLEAN NOT NULL DEFAULT false,
  record_keeping_procedure BOOLEAN NOT NULL DEFAULT false,
  transparency_procedure BOOLEAN NOT NULL DEFAULT false,
  human_oversight_procedure BOOLEAN NOT NULL DEFAULT false,
  accuracy_robustness_procedure BOOLEAN NOT NULL DEFAULT false,
  cybersecurity_procedure BOOLEAN NOT NULL DEFAULT false,
  incident_reporting_procedure BOOLEAN NOT NULL DEFAULT false,
  third_party_management_procedure BOOLEAN NOT NULL DEFAULT false,
  overall_maturity INTEGER DEFAULT 0,
  last_audit_date DATE,
  next_audit_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  responsible_id UUID REFERENCES "user"(id),
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- GAP 5: Corrective Actions (Art. 20-21)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_corrective_action (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID REFERENCES ai_system(id),
  source_type VARCHAR(50) NOT NULL DEFAULT 'non_conformity',
  source_id UUID,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  non_conformity_description TEXT,
  action_type VARCHAR(50) NOT NULL DEFAULT 'corrective',
  is_recall BOOLEAN NOT NULL DEFAULT false,
  is_withdrawal BOOLEAN NOT NULL DEFAULT false,
  recall_reason TEXT,
  priority VARCHAR(50) NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES "user"(id),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  authority_notified BOOLEAN NOT NULL DEFAULT false,
  authority_notified_at TIMESTAMPTZ,
  authority_reference VARCHAR(200),
  verification_required BOOLEAN NOT NULL DEFAULT true,
  verified_by UUID REFERENCES "user"(id),
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  effectiveness_rating VARCHAR(50),
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- GAP 8: Authority Communication (Art. 73-78)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_authority_communication (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID REFERENCES ai_system(id),
  authority_name VARCHAR(500) NOT NULL,
  authority_country VARCHAR(10),
  communication_type VARCHAR(50) NOT NULL DEFAULT 'notification',
  direction VARCHAR(20) NOT NULL DEFAULT 'outgoing',
  subject VARCHAR(500) NOT NULL,
  content TEXT,
  reference_number VARCHAR(200),
  related_incident_id UUID REFERENCES ai_incident(id),
  related_action_id UUID REFERENCES ai_corrective_action(id),
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  response_deadline TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES "user"(id)
);

-- ============================================================
-- GAP 9: Penalty Tracking (Art. 99)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_penalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID REFERENCES ai_system(id),
  authority_name VARCHAR(500) NOT NULL,
  penalty_type VARCHAR(50) NOT NULL DEFAULT 'fine',
  article_reference VARCHAR(100),
  fine_amount NUMERIC,
  fine_currency VARCHAR(10) DEFAULT 'EUR',
  fine_percentage_turnover NUMERIC,
  penalty_bracket VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'imposed',
  appeal_filed BOOLEAN DEFAULT false,
  appeal_status VARCHAR(50),
  appeal_deadline DATE,
  paid_at TIMESTAMPTZ,
  description TEXT,
  violation_description TEXT,
  imposed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS Policies for ALL tables
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'ai_system', 'ai_conformity_assessment', 'ai_human_oversight_log',
    'ai_transparency_entry', 'ai_fria', 'ai_framework_mapping',
    'ai_gpai_model', 'ai_incident', 'ai_prohibited_screening',
    'ai_provider_qms', 'ai_corrective_action', 'ai_authority_communication', 'ai_penalty'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    BEGIN
      EXECUTE format('CREATE POLICY rls_%s ON %I USING (org_id = current_setting(''app.current_org_id'')::uuid)', replace(tbl, '.', '_'), tbl);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
