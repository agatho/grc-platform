-- Migration 0085: EU AI Act Full Compliance
-- Closes all 9 gaps for complete Art. 5-99 coverage

-- ============================================================
-- 1. GPAI Model Register (Art. 51-56)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_gpai_model (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  name VARCHAR(500) NOT NULL,
  provider VARCHAR(500) NOT NULL,
  model_type VARCHAR(50) NOT NULL DEFAULT 'general_purpose',
  -- Art. 51: Classification
  is_systemic_risk BOOLEAN NOT NULL DEFAULT false,
  systemic_risk_justification TEXT,
  -- Art. 52: Provider obligations
  technical_documentation JSONB DEFAULT '{}',
  training_data_summary TEXT,
  computational_resources TEXT,
  energy_consumption_kwh NUMERIC,
  -- Art. 53: Systemic risk obligations
  model_evaluation_results JSONB DEFAULT '{}',
  adversarial_testing_results JSONB DEFAULT '{}',
  incident_reporting_enabled BOOLEAN NOT NULL DEFAULT false,
  cybersecurity_measures TEXT,
  -- Art. 54: Authorized representatives
  eu_representative_name VARCHAR(500),
  eu_representative_contact VARCHAR(500),
  -- Art. 55: Code of Practice
  code_of_practice_adherence BOOLEAN DEFAULT false,
  code_of_practice_notes TEXT,
  -- Metadata
  version VARCHAR(100),
  release_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'registered',
  capabilities_summary TEXT,
  limitations_summary TEXT,
  intended_use TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES "user"(id),
  updated_by UUID REFERENCES "user"(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_gpai_model_org ON ai_gpai_model(org_id);

-- ============================================================
-- 2. AI Incident (Art. 62-63)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_incident (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID REFERENCES ai_system(id),
  gpai_model_id UUID REFERENCES ai_gpai_model(id),
  incident_code VARCHAR(50),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  -- Art. 62: Classification
  severity VARCHAR(50) NOT NULL DEFAULT 'medium',
  is_serious BOOLEAN NOT NULL DEFAULT false,
  -- Art. 62(1): Serious incident criteria
  serious_criteria JSONB DEFAULT '[]',
  -- Deadlines
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Art. 73(4): 15 calendar days for initial report, 2 days if death/serious harm
  authority_deadline TIMESTAMPTZ,
  authority_notified_at TIMESTAMPTZ,
  authority_reference VARCHAR(200),
  -- Affected parties
  affected_persons_count INTEGER,
  affected_rights TEXT[],
  harm_type VARCHAR(100),
  harm_description TEXT,
  -- Root cause & remediation
  root_cause TEXT,
  root_cause_category VARCHAR(100),
  remediation_actions TEXT,
  preventive_measures TEXT,
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'detected',
  resolved_at TIMESTAMPTZ,
  lessons_learned TEXT,
  -- Metadata
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES "user"(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_incident_org ON ai_incident(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_incident_system ON ai_incident(ai_system_id);
CREATE INDEX IF NOT EXISTS idx_ai_incident_severity ON ai_incident(org_id, severity);

-- ============================================================
-- 3. Prohibited Practice Screening (Art. 5)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_prohibited_screening (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID NOT NULL REFERENCES ai_system(id),
  -- Art. 5 screening results
  screening_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  screened_by UUID REFERENCES "user"(id),
  -- 8 prohibited categories from Art. 5
  subliminal_manipulation BOOLEAN NOT NULL DEFAULT false,
  exploitation_vulnerable BOOLEAN NOT NULL DEFAULT false,
  social_scoring BOOLEAN NOT NULL DEFAULT false,
  predictive_policing_individual BOOLEAN NOT NULL DEFAULT false,
  facial_recognition_scraping BOOLEAN NOT NULL DEFAULT false,
  emotion_inference_workplace BOOLEAN NOT NULL DEFAULT false,
  biometric_categorization BOOLEAN NOT NULL DEFAULT false,
  real_time_biometric_public BOOLEAN NOT NULL DEFAULT false,
  -- Overall result
  has_prohibited_practice BOOLEAN GENERATED ALWAYS AS (
    subliminal_manipulation OR exploitation_vulnerable OR social_scoring OR
    predictive_policing_individual OR facial_recognition_scraping OR
    emotion_inference_workplace OR biometric_categorization OR real_time_biometric_public
  ) STORED,
  justification TEXT,
  exception_applied BOOLEAN DEFAULT false,
  exception_justification TEXT,
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'completed',
  review_required BOOLEAN DEFAULT false,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_prohibited_org ON ai_prohibited_screening(org_id);

-- ============================================================
-- 4. Provider QMS (Art. 16-17)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_provider_qms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID REFERENCES ai_system(id),
  -- Art. 17: Quality management system elements
  risk_management_procedure BOOLEAN NOT NULL DEFAULT false,
  risk_management_notes TEXT,
  data_governance_procedure BOOLEAN NOT NULL DEFAULT false,
  data_governance_notes TEXT,
  technical_documentation_procedure BOOLEAN NOT NULL DEFAULT false,
  record_keeping_procedure BOOLEAN NOT NULL DEFAULT false,
  transparency_procedure BOOLEAN NOT NULL DEFAULT false,
  human_oversight_procedure BOOLEAN NOT NULL DEFAULT false,
  accuracy_robustness_procedure BOOLEAN NOT NULL DEFAULT false,
  cybersecurity_procedure BOOLEAN NOT NULL DEFAULT false,
  incident_reporting_procedure BOOLEAN NOT NULL DEFAULT false,
  third_party_management_procedure BOOLEAN NOT NULL DEFAULT false,
  -- Maturity
  overall_maturity INTEGER DEFAULT 0 CHECK (overall_maturity BETWEEN 0 AND 5),
  last_audit_date DATE,
  next_audit_date DATE,
  audit_findings_count INTEGER DEFAULT 0,
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  responsible_id UUID REFERENCES "user"(id),
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_qms_org ON ai_provider_qms(org_id);

-- ============================================================
-- 5. Corrective Actions (Art. 20-21)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_corrective_action (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID REFERENCES ai_system(id),
  -- Source
  source_type VARCHAR(50) NOT NULL DEFAULT 'non_conformity',
  source_id UUID,
  -- Art. 20: Corrective actions
  title VARCHAR(500) NOT NULL,
  description TEXT,
  non_conformity_description TEXT,
  -- Art. 21: Recall/withdrawal
  action_type VARCHAR(50) NOT NULL DEFAULT 'corrective',
  is_recall BOOLEAN NOT NULL DEFAULT false,
  is_withdrawal BOOLEAN NOT NULL DEFAULT false,
  recall_reason TEXT,
  -- Tracking
  priority VARCHAR(50) NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES "user"(id),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  -- Authority notification (Art. 20(2))
  authority_notified BOOLEAN NOT NULL DEFAULT false,
  authority_notified_at TIMESTAMPTZ,
  authority_reference VARCHAR(200),
  -- Verification
  verification_required BOOLEAN NOT NULL DEFAULT true,
  verified_by UUID REFERENCES "user"(id),
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  effectiveness_rating VARCHAR(50),
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_corrective_org ON ai_corrective_action(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_corrective_system ON ai_corrective_action(ai_system_id);

-- ============================================================
-- 6. EU Database Registration Status (Art. 71)
-- ============================================================

ALTER TABLE ai_system ADD COLUMN IF NOT EXISTS eu_database_registered BOOLEAN DEFAULT false;
ALTER TABLE ai_system ADD COLUMN IF NOT EXISTS eu_database_registration_id VARCHAR(200);
ALTER TABLE ai_system ADD COLUMN IF NOT EXISTS eu_database_registered_at TIMESTAMPTZ;
ALTER TABLE ai_system ADD COLUMN IF NOT EXISTS eu_database_url VARCHAR(1000);

-- ============================================================
-- 7. Document Lifecycle / Retention (Art. 18-19)
-- ============================================================

ALTER TABLE ai_system ADD COLUMN IF NOT EXISTS documentation_retention_years INTEGER DEFAULT 10;
ALTER TABLE ai_system ADD COLUMN IF NOT EXISTS documentation_expiry_date DATE;
ALTER TABLE ai_system ADD COLUMN IF NOT EXISTS last_documentation_review DATE;

-- ============================================================
-- 8. Authority Communication Log (Art. 73-78)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_authority_communication (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID REFERENCES ai_system(id),
  -- Communication details
  authority_name VARCHAR(500) NOT NULL,
  authority_country VARCHAR(10),
  communication_type VARCHAR(50) NOT NULL DEFAULT 'notification',
  direction VARCHAR(20) NOT NULL DEFAULT 'outgoing',
  subject VARCHAR(500) NOT NULL,
  content TEXT,
  -- Reference
  reference_number VARCHAR(200),
  related_incident_id UUID REFERENCES ai_incident(id),
  related_action_id UUID REFERENCES ai_corrective_action(id),
  -- Dates
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  response_deadline TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES "user"(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_authority_org ON ai_authority_communication(org_id);

-- ============================================================
-- 9. Sanction / Penalty Tracking (Art. 99)
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_penalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  ai_system_id UUID REFERENCES ai_system(id),
  -- Penalty details
  authority_name VARCHAR(500) NOT NULL,
  penalty_type VARCHAR(50) NOT NULL DEFAULT 'fine',
  article_reference VARCHAR(100),
  -- Art. 99 amounts
  fine_amount NUMERIC,
  fine_currency VARCHAR(10) DEFAULT 'EUR',
  fine_percentage_turnover NUMERIC,
  -- Art. 99(3-5) penalty brackets
  penalty_bracket VARCHAR(50),
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'imposed',
  appeal_filed BOOLEAN DEFAULT false,
  appeal_status VARCHAR(50),
  appeal_deadline DATE,
  paid_at TIMESTAMPTZ,
  -- Description
  description TEXT,
  violation_description TEXT,
  mitigating_factors TEXT,
  aggravating_factors TEXT,
  imposed_at DATE NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_penalty_org ON ai_penalty(org_id);

-- ============================================================
-- RLS Policies
-- ============================================================

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ai_gpai_model ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY rls_ai_gpai_model ON ai_gpai_model USING (org_id = current_setting(''app.current_org_id'')::uuid)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ai_incident ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY rls_ai_incident ON ai_incident USING (org_id = current_setting(''app.current_org_id'')::uuid)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ai_prohibited_screening ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY rls_ai_prohibited ON ai_prohibited_screening USING (org_id = current_setting(''app.current_org_id'')::uuid)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ai_provider_qms ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY rls_ai_qms ON ai_provider_qms USING (org_id = current_setting(''app.current_org_id'')::uuid)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ai_corrective_action ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY rls_ai_corrective ON ai_corrective_action USING (org_id = current_setting(''app.current_org_id'')::uuid)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ai_authority_communication ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY rls_ai_authority ON ai_authority_communication USING (org_id = current_setting(''app.current_org_id'')::uuid)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER TABLE ai_penalty ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY rls_ai_penalty ON ai_penalty USING (org_id = current_setting(''app.current_org_id'')::uuid)';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
