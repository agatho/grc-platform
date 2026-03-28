-- Sprint 42: DPMS Advanced — Retention, TIA, Processor Agreements, PbD, Consent
-- Migrations 589–612

-- ═══════════════════════════════════════════════════════════
-- retention_schedule
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS retention_schedule (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   UUID NOT NULL REFERENCES organization(id),
  name                     VARCHAR(500) NOT NULL,
  data_category            VARCHAR(50) NOT NULL,
  legal_basis_reference    VARCHAR(500),
  retention_period_months  INTEGER NOT NULL,
  retention_start_event    VARCHAR(30) NOT NULL,
  responsible_department   VARCHAR(200),
  responsible_id           UUID REFERENCES "user"(id),
  deletion_method          VARCHAR(20) NOT NULL,
  affected_systems         JSONB DEFAULT '[]',
  is_active                BOOLEAN NOT NULL DEFAULT true,
  notes                    TEXT,
  created_by               UUID REFERENCES "user"(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rs_org_idx ON retention_schedule(org_id);
CREATE INDEX IF NOT EXISTS rs_category_idx ON retention_schedule(org_id, data_category);

-- ═══════════════════════════════════════════════════════════
-- retention_exception
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS retention_exception (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organization(id),
  schedule_id     UUID NOT NULL REFERENCES retention_schedule(id),
  reason          VARCHAR(30) NOT NULL,
  legal_basis     VARCHAR(500),
  description     TEXT,
  expires_at      DATE NOT NULL,
  responsible_id  UUID REFERENCES "user"(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  released_by     UUID REFERENCES "user"(id),
  released_at     TIMESTAMPTZ,
  created_by      UUID REFERENCES "user"(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS re_schedule_idx ON retention_exception(schedule_id);
CREATE INDEX IF NOT EXISTS re_status_idx ON retention_exception(org_id, status);
CREATE INDEX IF NOT EXISTS re_expiry_idx ON retention_exception(expires_at);

-- ═══════════════════════════════════════════════════════════
-- deletion_request
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS deletion_request (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organization(id),
  schedule_id           UUID NOT NULL REFERENCES retention_schedule(id),
  title                 VARCHAR(500) NOT NULL,
  data_category         VARCHAR(50) NOT NULL,
  record_count_estimate INTEGER,
  affected_system_ids   JSONB DEFAULT '[]',
  status                VARCHAR(30) NOT NULL DEFAULT 'identified',
  approved_by           UUID REFERENCES "user"(id),
  approved_at           TIMESTAMPTZ,
  rejected_by           UUID REFERENCES "user"(id),
  rejection_reason      TEXT,
  deletion_started_at   TIMESTAMPTZ,
  deletion_completed_at TIMESTAMPTZ,
  verified_by           UUID REFERENCES "user"(id),
  verified_at           TIMESTAMPTZ,
  verification_method   VARCHAR(30),
  evidence_description  TEXT,
  evidence_document_id  UUID,
  closed_at             TIMESTAMPTZ,
  created_by            UUID REFERENCES "user"(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dr_org_idx ON deletion_request(org_id);
CREATE INDEX IF NOT EXISTS dr_status_idx ON deletion_request(org_id, status);
CREATE INDEX IF NOT EXISTS dr_schedule_idx ON deletion_request(schedule_id);

-- ═══════════════════════════════════════════════════════════
-- transfer_impact_assessment
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS transfer_impact_assessment (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                          UUID NOT NULL REFERENCES organization(id),
  data_flow_id                    UUID,
  title                           VARCHAR(500) NOT NULL,
  transfer_description            TEXT,
  data_categories                 JSONB NOT NULL DEFAULT '[]',
  legal_transfer_basis            VARCHAR(30) NOT NULL,
  recipient_country               VARCHAR(5) NOT NULL,
  country_risk_level              VARCHAR(20),
  surveillance_law_assessment     TEXT,
  government_access_risk          TEXT,
  rule_of_law_assessment          TEXT,
  dpa_independence_assessment     TEXT,
  judicial_redress_assessment     TEXT,
  overall_country_risk_score      INTEGER,
  supplementary_measures_required BOOLEAN NOT NULL DEFAULT false,
  technical_measures              JSONB DEFAULT '[]',
  contractual_measures            JSONB DEFAULT '[]',
  organizational_measures         JSONB DEFAULT '[]',
  assessment_result               VARCHAR(50),
  assessor_id                     UUID REFERENCES "user"(id),
  assessed_at                     TIMESTAMPTZ,
  version                         INTEGER NOT NULL DEFAULT 1,
  next_review_date                DATE,
  review_trigger_notes            TEXT,
  status                          VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_by                      UUID REFERENCES "user"(id),
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tia_org_idx ON transfer_impact_assessment(org_id);
CREATE INDEX IF NOT EXISTS tia_flow_idx ON transfer_impact_assessment(data_flow_id);
CREATE INDEX IF NOT EXISTS tia_country_idx ON transfer_impact_assessment(recipient_country);
CREATE INDEX IF NOT EXISTS tia_status_idx ON transfer_impact_assessment(org_id, status);

-- ═══════════════════════════════════════════════════════════
-- country_risk_profile (shared, NOT org-scoped)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS country_risk_profile (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code            VARCHAR(5) NOT NULL,
  country_name            VARCHAR(200) NOT NULL,
  eu_adequacy_decision    BOOLEAN NOT NULL DEFAULT false,
  adequacy_decision_date  DATE,
  surveillance_laws_summary TEXT,
  government_access_summary TEXT,
  rule_of_law_index       NUMERIC(5,2),
  dpa_independent         BOOLEAN,
  judicial_redress_available BOOLEAN,
  overall_risk_level      VARCHAR(20) NOT NULL,
  edpb_assessment_notes   TEXT,
  last_updated            DATE NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS crp_country_idx ON country_risk_profile(country_code);

-- ═══════════════════════════════════════════════════════════
-- processor_agreement
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS processor_agreement (
  id                                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                             UUID NOT NULL REFERENCES organization(id),
  vendor_id                          UUID,
  processor_name                     VARCHAR(500) NOT NULL,
  processor_dpo_contact              TEXT,
  processing_activities              JSONB DEFAULT '[]',
  agreement_status                   VARCHAR(20) NOT NULL DEFAULT 'pending',
  agreement_document_id              UUID,
  effective_date                     DATE,
  expiry_date                        DATE,
  review_date                        DATE,
  compliance_checklist               JSONB DEFAULT '[]',
  overall_compliance_status          VARCHAR(20),
  authorized_sub_processors          JSONB DEFAULT '[]',
  sub_processor_notification_required BOOLEAN NOT NULL DEFAULT true,
  last_audit_date                    DATE,
  next_audit_date                    DATE,
  audit_findings_count               INTEGER NOT NULL DEFAULT 0,
  created_by                         UUID REFERENCES "user"(id),
  created_at                         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pa_org_idx ON processor_agreement(org_id);
CREATE INDEX IF NOT EXISTS pa_vendor_idx ON processor_agreement(vendor_id);
CREATE INDEX IF NOT EXISTS pa_status_idx ON processor_agreement(org_id, agreement_status);

-- ═══════════════════════════════════════════════════════════
-- sub_processor_notification
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sub_processor_notification (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organization(id),
  agreement_id          UUID NOT NULL REFERENCES processor_agreement(id) ON DELETE CASCADE,
  notification_type     VARCHAR(30) NOT NULL,
  sub_processor_name    VARCHAR(500) NOT NULL,
  sub_processor_country VARCHAR(5),
  processing_scope      TEXT,
  notified_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_deadline     DATE NOT NULL,
  response              VARCHAR(20) NOT NULL DEFAULT 'pending',
  response_by           UUID REFERENCES "user"(id),
  response_at           TIMESTAMPTZ,
  objection_reason      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spn_agreement_idx ON sub_processor_notification(agreement_id);
CREATE INDEX IF NOT EXISTS spn_response_idx ON sub_processor_notification(org_id, response);

-- ═══════════════════════════════════════════════════════════
-- pbd_assessment
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pbd_assessment (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organization(id),
  project_name        VARCHAR(500) NOT NULL,
  project_description TEXT,
  project_type        VARCHAR(30) NOT NULL,
  assessment_data     JSONB NOT NULL DEFAULT '[]',
  overall_score       INTEGER,
  dpia_criteria_met   JSONB DEFAULT '[]',
  dpia_required       BOOLEAN NOT NULL DEFAULT false,
  dpia_id             UUID,
  status              VARCHAR(20) NOT NULL DEFAULT 'draft',
  assessed_by         UUID REFERENCES "user"(id),
  assessed_at         TIMESTAMPTZ,
  approved_by         UUID REFERENCES "user"(id),
  approved_at         TIMESTAMPTZ,
  improvement_actions JSONB DEFAULT '[]',
  created_by          UUID REFERENCES "user"(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pbd_org_idx ON pbd_assessment(org_id);
CREATE INDEX IF NOT EXISTS pbd_status_idx ON pbd_assessment(org_id, status);

-- ═══════════════════════════════════════════════════════════
-- consent_type
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS consent_type (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organization(id),
  name                  VARCHAR(500) NOT NULL,
  purpose               VARCHAR(30) NOT NULL,
  description           TEXT,
  collection_point      VARCHAR(30) NOT NULL,
  legal_requirements    JSONB DEFAULT '{}',
  linked_ropa_entry_ids JSONB DEFAULT '[]',
  freely_given_status   VARCHAR(20),
  specific_status       VARCHAR(20),
  informed_status       VARCHAR(20),
  unambiguous_status    VARCHAR(20),
  validity_notes        TEXT,
  validity_assessed_by  UUID REFERENCES "user"(id),
  validity_assessed_at  TIMESTAMPTZ,
  total_given           INTEGER NOT NULL DEFAULT 0,
  total_withdrawn       INTEGER NOT NULL DEFAULT 0,
  withdrawal_rate       NUMERIC(5,2) NOT NULL DEFAULT 0,
  active_consents       INTEGER NOT NULL DEFAULT 0,
  metrics_updated_at    TIMESTAMPTZ,
  created_by            UUID REFERENCES "user"(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ct_org_idx ON consent_type(org_id);
CREATE INDEX IF NOT EXISTS ct_purpose_idx ON consent_type(org_id, purpose);

-- ═══════════════════════════════════════════════════════════
-- consent_record (pseudonymized data_subject_identifier)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS consent_record (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   UUID NOT NULL REFERENCES organization(id),
  consent_type_id          UUID NOT NULL REFERENCES consent_type(id),
  data_subject_identifier  VARCHAR(256) NOT NULL,
  consent_given_at         TIMESTAMPTZ NOT NULL,
  consent_mechanism        VARCHAR(30) NOT NULL,
  consent_text_version     VARCHAR(50),
  withdrawn_at             TIMESTAMPTZ,
  withdrawal_mechanism     VARCHAR(30),
  ip_address               VARCHAR(45),
  source_system            VARCHAR(200),
  metadata                 JSONB DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cr_type_idx ON consent_record(consent_type_id);
CREATE INDEX IF NOT EXISTS cr_subject_idx ON consent_record(org_id, data_subject_identifier);
CREATE INDEX IF NOT EXISTS cr_given_idx ON consent_record(consent_type_id, consent_given_at);

-- ═══════════════════════════════════════════════════════════
-- RLS (all except country_risk_profile which is shared)
-- ═══════════════════════════════════════════════════════════
ALTER TABLE retention_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_exception ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_impact_assessment ENABLE ROW LEVEL SECURITY;
ALTER TABLE processor_agreement ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_processor_notification ENABLE ROW LEVEL SECURITY;
ALTER TABLE pbd_assessment ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_record ENABLE ROW LEVEL SECURITY;

CREATE POLICY rs_org_isolation ON retention_schedule USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY re_org_isolation ON retention_exception USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY dr_org_isolation ON deletion_request USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY tia_org_isolation ON transfer_impact_assessment USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY pa_org_isolation ON processor_agreement USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY spn_org_isolation ON sub_processor_notification USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY pbd_org_isolation ON pbd_assessment USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY ct_org_isolation ON consent_type USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY cr_org_isolation ON consent_record USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Audit triggers
DROP TRIGGER IF EXISTS audit_retention_schedule ON retention_schedule;
CREATE TRIGGER audit_retention_schedule AFTER INSERT OR UPDATE OR DELETE ON retention_schedule FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_retention_exception ON retention_exception;
CREATE TRIGGER audit_retention_exception AFTER INSERT OR UPDATE OR DELETE ON retention_exception FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_deletion_request ON deletion_request;
CREATE TRIGGER audit_deletion_request AFTER INSERT OR UPDATE OR DELETE ON deletion_request FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_transfer_impact_assessment ON transfer_impact_assessment;
CREATE TRIGGER audit_transfer_impact_assessment AFTER INSERT OR UPDATE OR DELETE ON transfer_impact_assessment FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_processor_agreement ON processor_agreement;
CREATE TRIGGER audit_processor_agreement AFTER INSERT OR UPDATE OR DELETE ON processor_agreement FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_sub_processor_notification ON sub_processor_notification;
CREATE TRIGGER audit_sub_processor_notification AFTER INSERT OR UPDATE OR DELETE ON sub_processor_notification FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_pbd_assessment ON pbd_assessment;
CREATE TRIGGER audit_pbd_assessment AFTER INSERT OR UPDATE OR DELETE ON pbd_assessment FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_consent_type ON consent_type;
CREATE TRIGGER audit_consent_type AFTER INSERT OR UPDATE OR DELETE ON consent_type FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_consent_record ON consent_record;
CREATE TRIGGER audit_consent_record AFTER INSERT ON consent_record FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ═══════════════════════════════════════════════════════════
-- Seed: Country Risk Profiles (50+ countries)
-- ═══════════════════════════════════════════════════════════
INSERT INTO country_risk_profile (country_code, country_name, eu_adequacy_decision, adequacy_decision_date, surveillance_laws_summary, government_access_summary, rule_of_law_index, dpa_independent, judicial_redress_available, overall_risk_level, last_updated)
VALUES
  ('DE','Germany',true,'2018-05-25','BND Act (BNDG) with oversight','Parliamentary oversight committee',1.61,true,true,'low','2025-01-01'),
  ('FR','France',true,'2018-05-25','Intelligence Act 2015','CNCTR oversight body',1.39,true,true,'low','2025-01-01'),
  ('AT','Austria',true,'2018-05-25','Police State Protection Act','Independent oversight',1.78,true,true,'low','2025-01-01'),
  ('NL','Netherlands',true,'2018-05-25','Intelligence Services Act 2017','CTIVD oversight',1.77,true,true,'low','2025-01-01'),
  ('BE','Belgium',true,'2018-05-25','Intelligence Services Act','Committee I oversight',1.32,true,true,'low','2025-01-01'),
  ('IT','Italy',true,'2018-05-25','Intelligence System Reform Act','COPASIR parliamentary committee',0.27,true,true,'low','2025-01-01'),
  ('ES','Spain',true,'2018-05-25','CNI Organic Law','Judicial authorization required',0.95,true,true,'low','2025-01-01'),
  ('PT','Portugal',true,'2018-05-25','SIRP Framework Law','Parliamentary oversight',1.04,true,true,'low','2025-01-01'),
  ('IE','Ireland',true,'2018-05-25','Communications Act 2011','High Court authorization',1.38,true,true,'low','2025-01-01'),
  ('SE','Sweden',true,'2018-05-25','Signals Intelligence Act','SIUN oversight',1.84,true,true,'low','2025-01-01'),
  ('FI','Finland',true,'2018-05-25','Intelligence Legislation 2019','Parliamentary oversight',1.88,true,true,'low','2025-01-01'),
  ('DK','Denmark',true,'2018-05-25','Intelligence Services Act','IBAT oversight',1.81,true,true,'low','2025-01-01'),
  ('PL','Poland',true,'2018-05-25','Internal Security Agency Act','Limited oversight concerns',0.51,true,true,'low','2025-01-01'),
  ('CZ','Czech Republic',true,'2018-05-25','Intelligence Services Act','Parliamentary committee',0.96,true,true,'low','2025-01-01'),
  ('RO','Romania',true,'2018-05-25','National Security Law','CSAT oversight',0.37,true,true,'low','2025-01-01'),
  ('BG','Bulgaria',true,'2018-05-25','DANS Act','Parliamentary oversight',0.03,true,true,'low','2025-01-01'),
  ('HR','Croatia',true,'2018-05-25','Security Intelligence Act','Parliamentary committee',0.27,true,true,'low','2025-01-01'),
  ('EE','Estonia',true,'2018-05-25','Security Authorities Act','Judicial authorization',1.15,true,true,'low','2025-01-01'),
  ('LV','Latvia',true,'2018-05-25','State Security Institutions Law','Parliamentary oversight',0.82,true,true,'low','2025-01-01'),
  ('LT','Lithuania',true,'2018-05-25','Intelligence Act','Parliamentary committee',0.86,true,true,'low','2025-01-01'),
  ('LU','Luxembourg',true,'2018-05-25','SREL Law','Parliamentary control committee',1.74,true,true,'low','2025-01-01'),
  ('SI','Slovenia',true,'2018-05-25','Slovene Intelligence Agency Act','Parliamentary oversight',0.97,true,true,'low','2025-01-01'),
  ('SK','Slovakia',true,'2018-05-25','SIS Act','Parliamentary committee',0.55,true,true,'low','2025-01-01'),
  ('MT','Malta',true,'2018-05-25','Security Service Act','Prime Minister oversight',0.86,true,true,'low','2025-01-01'),
  ('CY','Cyprus',true,'2018-05-25','KYP Law','Attorney General oversight',0.63,true,true,'low','2025-01-01'),
  ('GR','Greece',true,'2018-05-25','EYP Law 2019','ADAE authority',0.36,true,true,'low','2025-01-01'),
  ('NO','Norway',true,'2018-05-25','Intelligence Services Act','EOS committee',1.86,true,true,'low','2025-01-01'),
  ('IS','Iceland',true,'2018-05-25','No dedicated intelligence agency','N/A',1.67,true,true,'low','2025-01-01'),
  ('LI','Liechtenstein',true,'2018-05-25','Minimal surveillance','N/A',1.67,true,true,'low','2025-01-01'),
  ('GB','United Kingdom',false,'2021-06-28','IPA 2016 (Investigatory Powers)','Judicial Commissioners',1.37,true,true,'low','2025-01-01'),
  ('CH','Switzerland',false,'2022-12-15','Federal Intelligence Service Act','Independent oversight',1.85,true,true,'low','2025-01-01'),
  ('JP','Japan',false,'2019-01-23','Act on Protection of SCI','Independent PPC',1.31,true,true,'low','2025-01-01'),
  ('KR','South Korea',false,'2022-12-17','National Intelligence Service Act','PIPC oversight',0.95,true,true,'low','2025-01-01'),
  ('NZ','New Zealand',false,'2013-01-01','GCSB Act 2013','IGIS oversight',1.79,true,true,'low','2025-01-01'),
  ('CA','Canada',false,'2002-01-01','CSIS Act, CSE Act','NSIRA oversight',1.64,true,true,'low','2025-01-01'),
  ('IL','Israel',false,'2012-01-01','ISA Law, Unit 8200','Knesset committee',0.74,true,true,'low','2025-01-01'),
  ('AR','Argentina',false,'2012-01-01','Intelligence Act 2015','Judicial oversight',0.04,true,true,'low','2025-01-01'),
  ('UY','Uruguay',false,'2012-01-01','Data Protection Act 2008','URCDP oversight',0.60,true,true,'low','2025-01-01'),
  ('US','United States',false,'2023-07-10','FISA Section 702, EO 12333, CLOUD Act','FISC, DPF redress mechanism',1.42,true,true,'medium','2025-01-01'),
  ('BR','Brazil',false,NULL,'ABIN Framework Law','Limited judicial oversight',0.02,true,true,'medium','2025-01-01'),
  ('AU','Australia',false,NULL,'TIA Act, AA Act','IGIS oversight',1.54,true,true,'medium','2025-01-01'),
  ('IN','India',false,NULL,'IT Act 2000 Section 69, Telegraph Act','Limited judicial oversight',-0.07,false,false,'high','2025-01-01'),
  ('ZA','South Africa',false,NULL,'RICA Act, NIA Act','JSCI oversight',0.05,true,true,'medium','2025-01-01'),
  ('SG','Singapore',false,NULL,'ISA, Computer Misuse Act','No independent oversight',1.73,false,false,'medium','2025-01-01'),
  ('TH','Thailand',false,NULL,'Computer Crime Act 2017','MDES oversight',-0.12,false,false,'high','2025-01-01'),
  ('PH','Philippines',false,NULL,'Anti-Terror Act 2020','Court of Appeals oversight',-0.30,true,false,'high','2025-01-01'),
  ('CN','China',false,NULL,'Cybersecurity Law, National Security Law, Data Security Law','State access without meaningful oversight',-0.20,false,false,'very_high','2025-01-01'),
  ('RU','Russia',false,NULL,'SORM, Yarovaya Law','FSB direct access without judicial oversight',-0.68,false,false,'very_high','2025-01-01'),
  ('HK','Hong Kong',false,NULL,'National Security Law 2020','Limited judicial independence post-2020',0.97,false,false,'very_high','2025-01-01'),
  ('TR','Turkey',false,NULL,'MIT Law, Anti-Terror Law','Limited judicial independence',-0.18,false,false,'high','2025-01-01'),
  ('EG','Egypt',false,NULL,'Anti-Cyber Crime Law 2018','No independent oversight',-0.42,false,false,'very_high','2025-01-01'),
  ('SA','Saudi Arabia',false,NULL,'Anti-Cyber Crime Law, Anti-Terror Law','No independent oversight',-0.02,false,false,'very_high','2025-01-01'),
  ('AE','United Arab Emirates',false,NULL,'Cybercrime Law, Anti-Terror Law','No independent oversight',0.49,false,false,'high','2025-01-01'),
  ('MX','Mexico',false,NULL,'CISEN Law, Telecom Reform','Limited oversight',-0.47,true,false,'high','2025-01-01'),
  ('CO','Colombia',false,NULL,'Intelligence Act 2013','Congressional committee',-0.09,true,true,'medium','2025-01-01')
ON CONFLICT (country_code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- Seed: Art. 28(3) Checklist Items
-- ═══════════════════════════════════════════════════════════
-- Stored as reference data comment; initialized in API on agreement creation

-- ═══════════════════════════════════════════════════════════
-- Seed: DPIA Trigger Criteria (EDPB wp248)
-- ═══════════════════════════════════════════════════════════
-- Stored in application code constants (not DB table)

-- ═══════════════════════════════════════════════════════════
-- Seed: Retention Templates
-- ═══════════════════════════════════════════════════════════
-- Application will offer these as templates users can adopt
COMMENT ON TABLE retention_schedule IS 'Common DE retention: §257 HGB (10y commercial), §147 AO (6/10y tax), §195 BGB (3y claims), Art.17 GDPR (on request)';
