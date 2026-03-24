-- ============================================================================
-- GRC & BPM SaaS Platform — Complete PostgreSQL Schema
-- Generated from: Datenmodell v1.0 (47 Entities + 10 Join-Tabellen)
-- ADR-001 (RLS), ADR-005 (PostgreSQL + pgvector + TimescaleDB), ADR-011 (Audit)
-- Date: 2026-03-22
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";        -- pgvector
-- CREATE EXTENSION IF NOT EXISTS "timescaledb";  -- Enable on TimescaleDB-capable instances

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Platform
CREATE TYPE org_type AS ENUM ('subsidiary', 'holding', 'joint_venture', 'branch');
CREATE TYPE user_role AS ENUM ('admin', 'risk_manager', 'control_owner', 'auditor', 'dpo', 'viewer', 'process_owner');
CREATE TYPE line_of_defense AS ENUM ('first', 'second', 'third');
CREATE TYPE notification_type AS ENUM ('task_assigned', 'deadline_approaching', 'escalation', 'approval_request', 'status_change', 'invitation', 'role_change');
CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'teams');

-- Audit
CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'restore', 'status_change', 'approve', 'reject', 'assign', 'unassign', 'upload_evidence', 'delete_evidence', 'acknowledge', 'export', 'bulk_update', 'comment', 'link', 'unlink');
CREATE TYPE access_event_type AS ENUM ('login_success', 'login_failed', 'logout', 'token_refresh', 'password_change', 'mfa_challenge', 'mfa_success', 'mfa_failed', 'account_locked', 'sso_login', 'api_key_used', 'session_expired');
CREATE TYPE auth_method AS ENUM ('password', 'sso_azure_ad', 'sso_oidc', 'api_key', 'mfa_totp', 'mfa_webauthn');
CREATE TYPE export_type AS ENUM ('pdf_report', 'excel_export', 'csv_export', 'evidence_download', 'bulk_export', 'api_extract', 'audit_report', 'emergency_handbook');

-- BPM
CREATE TYPE process_notation AS ENUM ('bpmn', 'value_chain', 'epc');
CREATE TYPE process_status AS ENUM ('draft', 'in_review', 'approved', 'published', 'archived');
CREATE TYPE step_type AS ENUM ('task', 'gateway', 'event', 'subprocess');

-- Frameworks
CREATE TYPE framework_category AS ENUM ('isms', 'bcms', 'privacy', 'erm', 'ics', 'esg', 'other');
CREATE TYPE mapping_type AS ENUM ('equivalent', 'partial', 'related', 'superset', 'subset');
CREATE TYPE mapping_source AS ENUM ('olir', 'manual', 'ai_suggested');
CREATE TYPE compliance_status AS ENUM ('applicable', 'not_applicable', 'implemented', 'partially_implemented', 'planned', 'not_implemented');

-- Assets
CREATE TYPE asset_type AS ENUM ('hardware', 'software', 'data', 'person', 'location', 'service', 'network');
CREATE TYPE classification AS ENUM ('public', 'internal', 'confidential', 'strictly_confidential');
CREATE TYPE asset_status AS ENUM ('active', 'retired', 'planned');
CREATE TYPE severity_level AS ENUM ('critical', 'high', 'medium', 'low', 'info');
CREATE TYPE vuln_status AS ENUM ('open', 'in_remediation', 'mitigated', 'accepted', 'false_positive');

-- Risk
CREATE TYPE risk_category AS ENUM ('strategic', 'operational', 'financial', 'compliance', 'cyber', 'reputational', 'esg');
CREATE TYPE risk_source AS ENUM ('isms', 'erm', 'bcm', 'project', 'process');
CREATE TYPE risk_status AS ENUM ('identified', 'assessed', 'treated', 'accepted', 'closed');
CREATE TYPE treatment_strategy AS ENUM ('mitigate', 'accept', 'transfer', 'avoid');
CREATE TYPE treatment_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE trend AS ENUM ('improving', 'stable', 'worsening');
CREATE TYPE measurement_freq AS ENUM ('daily', 'weekly', 'monthly', 'quarterly');
CREATE TYPE measurement_source AS ENUM ('manual', 'api_import', 'calculated');
CREATE TYPE simulation_type AS ENUM ('monte_carlo', 'fair', 'scenario');
CREATE TYPE criticality AS ENUM ('low', 'medium', 'high', 'critical');

-- Controls
CREATE TYPE control_type AS ENUM ('preventive', 'detective', 'corrective');
CREATE TYPE control_freq AS ENUM ('continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'annually', 'ad_hoc');
CREATE TYPE automation_level AS ENUM ('manual', 'semi_automated', 'fully_automated');
CREATE TYPE control_status AS ENUM ('designed', 'implemented', 'effective', 'ineffective', 'retired');
CREATE TYPE test_type AS ENUM ('design_effectiveness', 'operating_effectiveness');
CREATE TYPE test_result AS ENUM ('effective', 'ineffective', 'partially_effective', 'not_tested');
CREATE TYPE test_status AS ENUM ('planned', 'in_progress', 'completed');
CREATE TYPE evidence_category AS ENUM ('screenshot', 'document', 'log_export', 'email', 'certificate', 'report', 'photo', 'config_export', 'other');
CREATE TYPE effectiveness_rating AS ENUM ('strong', 'adequate', 'weak');
CREATE TYPE implementation_status AS ENUM ('implemented', 'partial', 'planned');

-- Audit Management
CREATE TYPE audit_type AS ENUM ('internal', 'external', 'certification', 'surveillance');
CREATE TYPE audit_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE checklist_result AS ENUM ('conforming', 'non_conforming', 'observation', 'not_applicable');
CREATE TYPE finding_source AS ENUM ('audit', 'control_test', 'incident', 'self_assessment', 'external');
CREATE TYPE finding_severity AS ENUM ('critical', 'major', 'minor', 'observation');
CREATE TYPE finding_status AS ENUM ('open', 'in_remediation', 'verified', 'closed');

-- BCMS
CREATE TYPE bia_criticality AS ENUM ('critical', 'essential', 'important', 'normal');
CREATE TYPE four_status AS ENUM ('draft', 'in_review', 'approved', 'archived');
CREATE TYPE plan_type AS ENUM ('bcp', 'drp', 'crisis_communication');
CREATE TYPE exercise_type AS ENUM ('tabletop', 'walkthrough', 'simulation', 'full_scale');
CREATE TYPE exercise_status AS ENUM ('planned', 'completed', 'cancelled');

-- DPMS
CREATE TYPE legal_basis AS ENUM ('consent', 'contract', 'legal_obligation', 'vital_interest', 'public_interest', 'legitimate_interest');
CREATE TYPE processing_type AS ENUM ('controller', 'processor', 'joint_controller');
CREATE TYPE dpms_status AS ENUM ('new', 'in_progress', 'reviewed', 'inactive');
CREATE TYPE dsr_type AS ENUM ('access', 'rectification', 'erasure', 'restriction', 'portability', 'objection');
CREATE TYPE dsr_status AS ENUM ('in_progress', 'priority', 'completed');
CREATE TYPE breach_risk AS ENUM ('no_risk', 'risk', 'high_risk');
CREATE TYPE transfer_mechanism AS ENUM ('adequacy_decision', 'scc', 'bcr', 'derogation', 'other');
CREATE TYPE tom_category AS ENUM ('access_control', 'encryption', 'pseudonymization', 'availability', 'resilience', 'recoverability', 'evaluation');

-- Incidents
CREATE TYPE incident_type AS ENUM ('security', 'data_breach', 'operational', 'it_failure', 'physical');
CREATE TYPE incident_status AS ENUM ('detected', 'investigating', 'contained', 'resolved', 'closed');

-- Supplier
CREATE TYPE supplier_role AS ENUM ('processor', 'joint_controller', 'controller', 'sub_processor');
CREATE TYPE supplier_status AS ENUM ('active', 'inactive', 'terminated');
CREATE TYPE dpa_status AS ENUM ('draft', 'active', 'expired', 'terminated');

-- Documents
CREATE TYPE doc_category AS ENUM ('policy', 'procedure', 'guideline', 'template', 'record', 'tom', 'dpa', 'bcp', 'other');
CREATE TYPE doc_status AS ENUM ('draft', 'in_review', 'approved', 'published', 'archived', 'expired');

-- Contracts
CREATE TYPE contract_type AS ENUM ('service', 'license', 'dpa', 'nda', 'sla', 'maintenance', 'other');
CREATE TYPE contract_status AS ENUM ('draft', 'active', 'expired', 'terminated');
CREATE TYPE obligation_status AS ENUM ('pending', 'completed', 'overdue');

-- Actions
CREATE TYPE action_source AS ENUM ('finding', 'risk_treatment', 'incident', 'audit', 'dsr', 'data_breach', 'control_test', 'manual');
CREATE TYPE action_type AS ENUM ('corrective', 'preventive', 'improvement');
CREATE TYPE action_priority AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE action_status AS ENUM ('open', 'in_progress', 'completed', 'verified', 'cancelled');

-- Budget
CREATE TYPE budget_area AS ENUM ('risk_management', 'isms', 'bcm', 'audit', 'privacy', 'compliance', 'general');
CREATE TYPE budget_item_cat AS ENUM ('personnel', 'tools', 'consulting', 'training', 'certification', 'other');

-- Training
CREATE TYPE training_type AS ENUM ('awareness', 'phishing_simulation', 'certification', 'workshop');
CREATE TYPE training_status AS ENUM ('planned', 'active', 'completed');
CREATE TYPE training_record_status AS ENUM ('assigned', 'started', 'completed', 'overdue');

-- Compliance Checkpoint
CREATE TYPE checkpoint_result AS ENUM ('pass', 'fail', 'warning', 'error', 'not_applicable');

-- AI Usage
CREATE TYPE ai_provider AS ENUM ('claude_api', 'ollama_local', 'other');

-- ============================================================================
-- 1. PLATFORM CORE
-- ============================================================================

CREATE TABLE organization (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            varchar(255) NOT NULL,
  short_name      varchar(50),
  type            org_type NOT NULL DEFAULT 'subsidiary',
  country         varchar(3) NOT NULL DEFAULT 'DEU',
  is_eu           boolean NOT NULL DEFAULT true,
  parent_org_id   uuid REFERENCES organization(id),
  legal_form      varchar(100),
  dpo_name        varchar(255),
  dpo_email       varchar(255),
  settings        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,  -- FK added after user table
  updated_by      uuid,
  deleted_at      timestamptz,
  deleted_by      uuid
);

CREATE TABLE "user" (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id        varchar(255) UNIQUE,
  email           varchar(255) NOT NULL UNIQUE,
  name            varchar(255) NOT NULL,
  avatar_url      varchar(1000),
  sso_provider_id varchar(255),
  language        varchar(5) NOT NULL DEFAULT 'de',
  is_active       boolean NOT NULL DEFAULT true,
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- Add FK from organization to user
ALTER TABLE organization ADD CONSTRAINT fk_org_created_by FOREIGN KEY (created_by) REFERENCES "user"(id);
ALTER TABLE organization ADD CONSTRAINT fk_org_updated_by FOREIGN KEY (updated_by) REFERENCES "user"(id);
ALTER TABLE organization ADD CONSTRAINT fk_org_deleted_by FOREIGN KEY (deleted_by) REFERENCES "user"(id);

CREATE TABLE user_organization_role (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES "user"(id),
  org_id          uuid NOT NULL REFERENCES organization(id),
  role            user_role NOT NULL,
  department      varchar(255),
  line_of_defense line_of_defense,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, org_id, role)
);

-- ── Audit & Log Tables (append-only) ──

CREATE TABLE audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES organization(id),
  user_id         uuid REFERENCES "user"(id),
  user_email      varchar(255),
  user_name       varchar(255),
  entity_type     varchar(100) NOT NULL,
  entity_id       uuid,
  entity_title    varchar(500),
  action          audit_action NOT NULL,
  action_detail   varchar(500),
  changes         jsonb,
  metadata        jsonb,
  ip_address      inet,
  user_agent      varchar(500),
  session_id      varchar(255),
  previous_hash   varchar(64),
  entry_hash      varchar(64),
  created_at      timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions (example for 2026)
CREATE TABLE audit_log_2026_q1 PARTITION OF audit_log FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
CREATE TABLE audit_log_2026_q2 PARTITION OF audit_log FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');
CREATE TABLE audit_log_2026_q3 PARTITION OF audit_log FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');
CREATE TABLE audit_log_2026_q4 PARTITION OF audit_log FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');

-- Prevent UPDATE/DELETE on audit_log
CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;

CREATE TABLE access_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES "user"(id),
  email_attempted varchar(255),
  event_type      access_event_type NOT NULL,
  auth_method     auth_method,
  ip_address      inet,
  user_agent      varchar(500),
  geo_location    varchar(255),
  failure_reason  varchar(255),
  session_id      varchar(255),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE RULE access_log_no_update AS ON UPDATE TO access_log DO INSTEAD NOTHING;
CREATE RULE access_log_no_delete AS ON DELETE TO access_log DO INSTEAD NOTHING;

CREATE TABLE data_export_log (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid REFERENCES organization(id),
  user_id                uuid REFERENCES "user"(id),
  export_type            export_type NOT NULL,
  entity_type            varchar(100),
  entity_id              uuid,
  description            varchar(500),
  record_count           int,
  contains_personal_data boolean DEFAULT false,
  file_name              varchar(255),
  file_size_bytes        bigint,
  ip_address             inet,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES "user"(id),
  org_id          uuid NOT NULL REFERENCES organization(id),
  type            notification_type NOT NULL,
  entity_type     varchar(100),
  entity_id       uuid,
  title           varchar(500) NOT NULL,
  message         text,
  is_read         boolean NOT NULL DEFAULT false,
  channel         notification_channel NOT NULL DEFAULT 'in_app',
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES "user"(id),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- ============================================================================
-- 2. BPM / PROCESSES
-- ============================================================================

CREATE TABLE process (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organization(id),
  parent_process_id   uuid REFERENCES process(id),
  name                varchar(500) NOT NULL,
  description         text,
  level               int NOT NULL DEFAULT 1,
  notation            process_notation NOT NULL DEFAULT 'bpmn',
  status              process_status NOT NULL DEFAULT 'draft',
  process_owner_id    uuid REFERENCES "user"(id),
  reviewer_id         uuid REFERENCES "user"(id),
  department          varchar(255),
  current_version     int DEFAULT 1,
  published_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES "user"(id),
  updated_by          uuid REFERENCES "user"(id),
  deleted_at          timestamptz,
  deleted_by          uuid REFERENCES "user"(id)
);

CREATE TABLE process_version (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id      uuid NOT NULL REFERENCES process(id),
  version_number  int NOT NULL,
  bpmn_xml        text,
  diagram_json    jsonb,
  change_summary  text,
  created_by      uuid REFERENCES "user"(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(process_id, version_number)
);

CREATE TABLE process_step (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id      uuid NOT NULL REFERENCES process(id),
  bpmn_element_id varchar(255),
  name            varchar(500) NOT NULL,
  description     text,
  step_type       step_type NOT NULL DEFAULT 'task',
  responsible_role varchar(255),
  sequence_order  int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. FRAMEWORKS & COMPLIANCE
-- ============================================================================

CREATE TABLE framework (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(255) NOT NULL,
  version     varchar(50),
  source      varchar(255),
  category    framework_category NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE requirement (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id           uuid NOT NULL REFERENCES framework(id),
  parent_requirement_id  uuid REFERENCES requirement(id),
  reference_code         varchar(100),
  title                  varchar(500) NOT NULL,
  description            text,
  category               varchar(255),
  sequence_order         int DEFAULT 0,
  embedding              vector(1536)  -- pgvector for semantic search
);

CREATE TABLE framework_mapping (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_requirement_id   uuid NOT NULL REFERENCES requirement(id),
  target_requirement_id   uuid NOT NULL REFERENCES requirement(id),
  mapping_type            mapping_type NOT NULL,
  confidence              decimal(3,2) DEFAULT 0.00,
  source                  mapping_source NOT NULL DEFAULT 'manual'
);

CREATE TABLE compliance_assessment (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organization(id),
  requirement_id  uuid NOT NULL REFERENCES requirement(id),
  status          compliance_status NOT NULL DEFAULT 'not_implemented',
  justification   text,
  responsible_id  uuid REFERENCES "user"(id),
  target_date     date,
  last_assessed_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES "user"(id),
  updated_by      uuid REFERENCES "user"(id),
  deleted_at      timestamptz
);

-- ============================================================================
-- 4. ASSETS
-- ============================================================================

CREATE TABLE asset (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organization(id),
  name            varchar(500) NOT NULL,
  asset_type      asset_type NOT NULL,
  description     text,
  owner_id        uuid REFERENCES "user"(id),
  classification  classification NOT NULL DEFAULT 'internal',
  location        varchar(255),
  criticality     criticality NOT NULL DEFAULT 'medium',
  status          asset_status NOT NULL DEFAULT 'active',
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES "user"(id),
  updated_by      uuid REFERENCES "user"(id),
  deleted_at      timestamptz
);

CREATE TABLE vulnerability (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        uuid NOT NULL REFERENCES asset(id),
  scanner_source  varchar(50),
  cve_id          varchar(50),
  title           varchar(500) NOT NULL,
  severity        severity_level NOT NULL,
  cvss_score      decimal(3,1),
  status          vuln_status NOT NULL DEFAULT 'open',
  detected_at     timestamptz NOT NULL DEFAULT now(),
  remediated_at   timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. RISK MANAGEMENT
-- ============================================================================

CREATE TABLE risk (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL REFERENCES organization(id),
  title                    varchar(500) NOT NULL,
  description              text,
  risk_category            risk_category NOT NULL,
  risk_source              risk_source NOT NULL DEFAULT 'erm',
  status                   risk_status NOT NULL DEFAULT 'identified',
  owner_id                 uuid REFERENCES "user"(id),
  department               varchar(255),
  inherent_likelihood      int CHECK (inherent_likelihood BETWEEN 1 AND 5),
  inherent_impact          int CHECK (inherent_impact BETWEEN 1 AND 5),
  residual_likelihood      int CHECK (residual_likelihood BETWEEN 1 AND 5),
  residual_impact          int CHECK (residual_impact BETWEEN 1 AND 5),
  risk_score_inherent      decimal(5,2) GENERATED ALWAYS AS (inherent_likelihood * inherent_impact) STORED,
  risk_score_residual      decimal(5,2) GENERATED ALWAYS AS (residual_likelihood * residual_impact) STORED,
  treatment_strategy       treatment_strategy,
  financial_impact_min     decimal(15,2),
  financial_impact_max     decimal(15,2),
  financial_impact_expected decimal(15,2),
  risk_appetite_exceeded   boolean DEFAULT false,
  review_date              date,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  created_by               uuid REFERENCES "user"(id),
  updated_by               uuid REFERENCES "user"(id),
  deleted_at               timestamptz
);

CREATE TABLE risk_treatment (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id                 uuid NOT NULL REFERENCES risk(id),
  action_id               uuid,  -- FK added later after action table
  description             text,
  expected_risk_reduction decimal(5,2),
  cost_estimate           decimal(15,2),
  status                  treatment_status NOT NULL DEFAULT 'planned',
  due_date                date,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE kri (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organization(id),
  risk_id               uuid REFERENCES risk(id),
  name                  varchar(255) NOT NULL,
  description           text,
  unit                  varchar(50),
  threshold_green       decimal(15,2),
  threshold_yellow      decimal(15,2),
  threshold_red         decimal(15,2),
  current_value         decimal(15,2),
  trend                 trend,
  measurement_frequency measurement_freq,
  last_measured_at      timestamptz,
  alert_enabled         boolean DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- TimescaleDB Hypertable
CREATE TABLE kri_measurement (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kri_id      uuid NOT NULL REFERENCES kri(id),
  value       decimal(15,2) NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  source      measurement_source NOT NULL DEFAULT 'manual'
);
-- SELECT create_hypertable('kri_measurement', 'measured_at', chunk_time_interval => INTERVAL '1 month');

-- TimescaleDB Hypertable
CREATE TABLE simulation_result (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organization(id),
  risk_id             uuid NOT NULL REFERENCES risk(id),
  simulation_type     simulation_type NOT NULL,
  iterations          int NOT NULL DEFAULT 10000,
  p5                  decimal(15,2),
  p25                 decimal(15,2),
  p50                 decimal(15,2),
  p75                 decimal(15,2),
  p95                 decimal(15,2),
  expected_value      decimal(15,2),
  standard_deviation  decimal(15,2),
  parameters          jsonb,
  simulated_at        timestamptz NOT NULL DEFAULT now(),
  simulated_by        uuid REFERENCES "user"(id)
);
-- SELECT create_hypertable('simulation_result', 'simulated_at', chunk_time_interval => INTERVAL '3 months');

-- ============================================================================
-- 6. CONTROLS & IKS
-- ============================================================================

CREATE TABLE control (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organization(id),
  title            varchar(500) NOT NULL,
  description      text,
  control_type     control_type NOT NULL,
  frequency        control_freq NOT NULL DEFAULT 'monthly',
  automation_level automation_level NOT NULL DEFAULT 'manual',
  line_of_defense  line_of_defense,
  owner_id         uuid REFERENCES "user"(id),
  status           control_status NOT NULL DEFAULT 'designed',
  last_tested_at   timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES "user"(id),
  updated_by       uuid REFERENCES "user"(id),
  deleted_at       timestamptz
);

CREATE TABLE control_test (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id    uuid NOT NULL REFERENCES control(id),
  test_type     test_type NOT NULL,
  description   text,
  tester_id     uuid REFERENCES "user"(id),
  planned_date  date,
  executed_date date,
  result        test_result NOT NULL DEFAULT 'not_tested',
  notes         text,
  status        test_status NOT NULL DEFAULT 'planned',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE evidence (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organization(id),
  entity_type     varchar(100) NOT NULL,
  entity_id       uuid NOT NULL,
  title           varchar(500) NOT NULL,
  description     text,
  category        evidence_category NOT NULL DEFAULT 'other',
  file_path       varchar(1000),
  file_name       varchar(255),
  file_type       varchar(50),
  file_size_bytes bigint,
  uploaded_by     uuid REFERENCES "user"(id),
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  valid_from      date,
  valid_until     date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- TimescaleDB Hypertable (Phase 2)
CREATE TABLE compliance_checkpoint (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organization(id),
  control_id         uuid NOT NULL REFERENCES control(id),
  integration_source varchar(100) NOT NULL,
  check_name         varchar(500) NOT NULL,
  result             checkpoint_result NOT NULL,
  details            jsonb,
  checked_at         timestamptz NOT NULL DEFAULT now()
);
-- SELECT create_hypertable('compliance_checkpoint', 'checked_at', chunk_time_interval => INTERVAL '1 week');

-- ============================================================================
-- 7. AUDIT MANAGEMENT
-- ============================================================================

CREATE TABLE audit (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organization(id),
  title            varchar(500) NOT NULL,
  audit_type       audit_type NOT NULL,
  framework_id     uuid REFERENCES framework(id),
  status           audit_status NOT NULL DEFAULT 'planned',
  lead_auditor_id  uuid REFERENCES "user"(id),
  planned_start    date,
  planned_end      date,
  actual_start     date,
  actual_end       date,
  scope            text,
  conclusion       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES "user"(id),
  updated_by       uuid REFERENCES "user"(id),
  deleted_at       timestamptz
);

CREATE TABLE audit_checklist (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id        uuid NOT NULL REFERENCES audit(id),
  requirement_id  uuid REFERENCES requirement(id),
  question        text NOT NULL,
  response        text,
  result          checklist_result,
  notes           text,
  sequence_order  int DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE finding (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organization(id),
  source_type         finding_source NOT NULL,
  source_id           uuid,
  title               varchar(500) NOT NULL,
  description         text,
  severity            finding_severity NOT NULL,
  root_cause          text,
  recommendation      text,
  management_response text,
  status              finding_status NOT NULL DEFAULT 'open',
  owner_id            uuid REFERENCES "user"(id),
  due_date            date,
  closed_at           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES "user"(id),
  updated_by          uuid REFERENCES "user"(id),
  deleted_at          timestamptz
);

-- ============================================================================
-- 8. BCMS / BIA
-- ============================================================================

CREATE TABLE bia (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES organization(id),
  process_id              uuid REFERENCES process(id),
  criticality             bia_criticality NOT NULL,
  rto_hours               int,
  rpo_hours               int,
  mtpd_hours              int,
  financial_impact_per_day decimal(15,2),
  dependencies            text,
  assumptions             text,
  notes                   text,
  status                  four_status NOT NULL DEFAULT 'draft',
  last_reviewed_at        timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid REFERENCES "user"(id),
  deleted_at              timestamptz
);

CREATE TABLE supplier (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organization(id),
  name                 varchar(500) NOT NULL,
  description          text,
  role                 supplier_role NOT NULL DEFAULT 'processor',
  is_external          boolean DEFAULT true,
  is_eu                boolean DEFAULT true,
  country              varchar(3),
  risk_rating          criticality DEFAULT 'medium',
  contact_name         varchar(255),
  contact_email        varchar(255),
  contract_status      dpms_status DEFAULT 'new',
  last_assessment_date date,
  next_assessment_date date,
  status               supplier_status NOT NULL DEFAULT 'active',
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid REFERENCES "user"(id),
  updated_by           uuid REFERENCES "user"(id),
  deleted_at           timestamptz
);

CREATE TABLE bia_supplier_dependency (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bia_id              uuid NOT NULL REFERENCES bia(id),
  supplier_id         uuid NOT NULL REFERENCES supplier(id),
  criticality         bia_criticality NOT NULL DEFAULT 'normal',
  substitute_available boolean DEFAULT false,
  switch_time_days    int
);

CREATE TABLE bcp (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organization(id),
  bia_id           uuid REFERENCES bia(id),
  title            varchar(500) NOT NULL,
  plan_type        plan_type NOT NULL DEFAULT 'bcp',
  content          text,
  contact_tree     jsonb,
  status           four_status NOT NULL DEFAULT 'draft',
  last_tested_at   timestamptz,
  next_review_date date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES "user"(id),
  deleted_at       timestamptz
);

CREATE TABLE exercise (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organization(id),
  bcp_id          uuid REFERENCES bcp(id),
  title           varchar(500) NOT NULL,
  exercise_type   exercise_type NOT NULL,
  planned_date    date,
  executed_date   date,
  result          text,
  lessons_learned text,
  status          exercise_status NOT NULL DEFAULT 'planned',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 9. DPMS (Datenschutz)
-- ============================================================================

CREATE TABLE ropa (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organization(id),
  lfd_nr            serial,
  name              varchar(500) NOT NULL,
  purpose           text,
  legal_basis       legal_basis NOT NULL,
  legal_basis_detail text,
  data_categories   jsonb,
  data_subjects     jsonb,
  recipients        jsonb,
  retention_period  varchar(255),
  processing_type   processing_type NOT NULL DEFAULT 'controller',
  department        varchar(255),
  status            dpms_status NOT NULL DEFAULT 'new',
  is_eu             boolean DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid REFERENCES "user"(id),
  updated_by        uuid REFERENCES "user"(id),
  deleted_at        timestamptz
);

CREATE TABLE dpia (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organization(id),
  ropa_id               uuid REFERENCES ropa(id),
  lfd_nr                serial,
  title                 varchar(500) NOT NULL,
  description           text,
  necessity_assessment  text,
  risk_assessment       text,
  measures              text,
  dpo_opinion           text,
  status                dpms_status NOT NULL DEFAULT 'new',
  attachments           jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES "user"(id),
  deleted_at            timestamptz
);

CREATE TABLE incident (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organization(id),
  title           varchar(500) NOT NULL,
  description     text,
  incident_type   incident_type NOT NULL,
  severity        severity_level NOT NULL,
  status          incident_status NOT NULL DEFAULT 'detected',
  detected_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  reporter_id     uuid REFERENCES "user"(id),
  assigned_to     uuid REFERENCES "user"(id),
  root_cause      text,
  timeline        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES "user"(id),
  deleted_at      timestamptz
);

CREATE TABLE data_subject_request (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organization(id),
  request_type         dsr_type NOT NULL,
  data_subject_name    varchar(255),
  data_subject_email   varchar(255),
  received_date        date NOT NULL,
  deadline             date NOT NULL,
  status               dsr_status NOT NULL DEFAULT 'in_progress',
  assigned_to          uuid REFERENCES "user"(id),
  response_text        text,
  response_template_id uuid,
  completed_date       date,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid REFERENCES "user"(id),
  deleted_at           timestamptz
);

CREATE TABLE data_breach (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL REFERENCES organization(id),
  incident_id              uuid REFERENCES incident(id),
  title                    varchar(500) NOT NULL,
  description              text,
  detected_at              timestamptz NOT NULL,
  notification_deadline    timestamptz NOT NULL,
  authority_notified       boolean DEFAULT false,
  authority_notified_at    timestamptz,
  data_subjects_notified   boolean DEFAULT false,
  risk_level               breach_risk NOT NULL DEFAULT 'risk',
  affected_data_categories jsonb,
  affected_count_estimate  int,
  measures_taken           text,
  status                   dsr_status NOT NULL DEFAULT 'in_progress',
  assigned_to              uuid REFERENCES "user"(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  created_by               uuid REFERENCES "user"(id),
  deleted_at               timestamptz
);

CREATE TABLE transfer_assessment (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organization(id),
  ropa_id             uuid REFERENCES ropa(id),
  supplier_id         uuid REFERENCES supplier(id),
  third_country       varchar(3) NOT NULL,
  transfer_mechanism  transfer_mechanism NOT NULL,
  assessment_result   text,
  status              dpms_status NOT NULL DEFAULT 'new',
  next_review_date    date,
  lfd_nr              serial,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tom (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organization(id),
  category              tom_category NOT NULL,
  title                 varchar(500) NOT NULL,
  description           text,
  implementation_status implementation_status NOT NULL DEFAULT 'planned',
  document_id           uuid, -- FK added after document table
  status                dpms_status NOT NULL DEFAULT 'new',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES "user"(id),
  deleted_at            timestamptz
);

-- ============================================================================
-- 11. SUPPLIER & DPA
-- ============================================================================

CREATE TABLE dpa (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     uuid NOT NULL REFERENCES supplier(id),
  org_id          uuid NOT NULL REFERENCES organization(id),
  contract_id     uuid, -- FK added after contract table
  dpa_date        date,
  subject_matter  text,
  data_categories jsonb,
  sub_processors  jsonb,
  status          dpa_status NOT NULL DEFAULT 'draft',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 12. DOCUMENTS
-- ============================================================================

CREATE TABLE document (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES organization(id),
  title                   varchar(500) NOT NULL,
  category                doc_category NOT NULL DEFAULT 'other',
  content                 text,
  file_path               varchar(1000),
  status                  doc_status NOT NULL DEFAULT 'draft',
  current_version         int DEFAULT 1,
  owner_id                uuid REFERENCES "user"(id),
  reviewer_id             uuid REFERENCES "user"(id),
  approved_by             uuid REFERENCES "user"(id),
  approved_at             timestamptz,
  published_at            timestamptz,
  expires_at              timestamptz,
  requires_acknowledgment boolean DEFAULT false,
  tags                    text[],
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid REFERENCES "user"(id),
  updated_by              uuid REFERENCES "user"(id),
  deleted_at              timestamptz
);

ALTER TABLE tom ADD CONSTRAINT fk_tom_document FOREIGN KEY (document_id) REFERENCES document(id);

CREATE TABLE document_version (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid NOT NULL REFERENCES document(id),
  version_number  int NOT NULL,
  content         text,
  change_summary  text,
  created_by      uuid REFERENCES "user"(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, version_number)
);

CREATE TABLE acknowledgment (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id           uuid NOT NULL REFERENCES document(id),
  user_id               uuid NOT NULL REFERENCES "user"(id),
  acknowledged_at       timestamptz NOT NULL DEFAULT now(),
  version_acknowledged  int NOT NULL
);

-- ============================================================================
-- 13. CONTRACTS
-- ============================================================================

CREATE TABLE contract (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organization(id),
  supplier_id      uuid REFERENCES supplier(id),
  title            varchar(500) NOT NULL,
  contract_type    contract_type NOT NULL,
  reference_number varchar(100),
  start_date       date,
  end_date         date,
  auto_renewal     boolean DEFAULT false,
  notice_period_days int,
  value            decimal(15,2),
  currency         varchar(3) DEFAULT 'EUR',
  status           contract_status NOT NULL DEFAULT 'draft',
  responsible_id   uuid REFERENCES "user"(id),
  document_id      uuid REFERENCES document(id),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES "user"(id),
  updated_by       uuid REFERENCES "user"(id),
  deleted_at       timestamptz
);

ALTER TABLE dpa ADD CONSTRAINT fk_dpa_contract FOREIGN KEY (contract_id) REFERENCES contract(id);

CREATE TABLE contract_obligation (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id        uuid NOT NULL REFERENCES contract(id),
  title              varchar(500) NOT NULL,
  description        text,
  due_date           date,
  recurring          boolean DEFAULT false,
  recurrence_pattern varchar(100),
  status             obligation_status NOT NULL DEFAULT 'pending',
  responsible_id     uuid REFERENCES "user"(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 14. ACTIONS (Cross-Module)
-- ============================================================================

CREATE TABLE action (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organization(id),
  title           varchar(500) NOT NULL,
  description     text,
  source_type     action_source NOT NULL,
  source_id       uuid,
  action_type     action_type NOT NULL DEFAULT 'corrective',
  priority        action_priority NOT NULL DEFAULT 'medium',
  status          action_status NOT NULL DEFAULT 'open',
  assigned_to     uuid REFERENCES "user"(id),
  due_date        date,
  completed_date  date,
  verified_by     uuid REFERENCES "user"(id),
  verified_date   date,
  effort_hours    decimal(8,2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES "user"(id),
  updated_by      uuid REFERENCES "user"(id),
  deleted_at      timestamptz
);

ALTER TABLE risk_treatment ADD CONSTRAINT fk_rt_action FOREIGN KEY (action_id) REFERENCES action(id);

-- ============================================================================
-- 15. BUDGET
-- ============================================================================

CREATE TABLE budget (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organization(id),
  area            budget_area NOT NULL,
  fiscal_year     int NOT NULL,
  planned_amount  decimal(15,2) NOT NULL DEFAULT 0,
  actual_amount   decimal(15,2) NOT NULL DEFAULT 0,
  currency        varchar(3) DEFAULT 'EUR',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, area, fiscal_year)
);

CREATE TABLE budget_item (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id       uuid NOT NULL REFERENCES budget(id),
  title           varchar(500) NOT NULL,
  category        budget_item_cat NOT NULL,
  planned_amount  decimal(15,2),
  actual_amount   decimal(15,2),
  action_id       uuid REFERENCES action(id),
  date            date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 16. TRAINING
-- ============================================================================

CREATE TABLE training_campaign (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organization(id),
  title           varchar(500) NOT NULL,
  description     text,
  training_type   training_type NOT NULL,
  due_date        date,
  status          training_status NOT NULL DEFAULT 'planned',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES "user"(id)
);

CREATE TABLE training_record (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id            uuid NOT NULL REFERENCES training_campaign(id),
  user_id                uuid NOT NULL REFERENCES "user"(id),
  status                 training_record_status NOT NULL DEFAULT 'assigned',
  completed_at           timestamptz,
  score                  decimal(5,2),
  certificate_valid_until date,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- AI USAGE LOG (TimescaleDB Hypertable)
-- ============================================================================

CREATE TABLE ai_usage_log (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL REFERENCES organization(id),
  user_id                uuid REFERENCES "user"(id),
  provider               ai_provider NOT NULL,
  model                  varchar(100) NOT NULL,
  use_case               varchar(100) NOT NULL,
  prompt_tokens          int,
  completion_tokens      int,
  cost_eur               decimal(10,4),
  latency_ms             int,
  contains_personal_data boolean DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now()
);
-- SELECT create_hypertable('ai_usage_log', 'created_at', chunk_time_interval => INTERVAL '1 month');

-- ============================================================================
-- COMMENT (Generic, polymorphic)
-- ============================================================================

CREATE TABLE comment (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organization(id),
  entity_type        varchar(100) NOT NULL,
  entity_id          uuid NOT NULL,
  parent_comment_id  uuid REFERENCES comment(id),
  author_id          uuid NOT NULL REFERENCES "user"(id),
  content            text NOT NULL,
  is_internal        boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

-- ============================================================================
-- JOIN TABLES (m:n)
-- ============================================================================

CREATE TABLE process_risk (
  process_id   uuid NOT NULL REFERENCES process(id) ON DELETE CASCADE,
  risk_id      uuid NOT NULL REFERENCES risk(id) ON DELETE CASCADE,
  risk_context text,
  PRIMARY KEY (process_id, risk_id)
);

CREATE TABLE process_control (
  process_id      uuid NOT NULL REFERENCES process(id) ON DELETE CASCADE,
  control_id      uuid NOT NULL REFERENCES control(id) ON DELETE CASCADE,
  control_context text,
  PRIMARY KEY (process_id, control_id)
);

CREATE TABLE process_step_risk (
  process_step_id uuid NOT NULL REFERENCES process_step(id) ON DELETE CASCADE,
  risk_id         uuid NOT NULL REFERENCES risk(id) ON DELETE CASCADE,
  risk_context    text,
  PRIMARY KEY (process_step_id, risk_id)
);

CREATE TABLE process_step_control (
  process_step_id uuid NOT NULL REFERENCES process_step(id) ON DELETE CASCADE,
  control_id      uuid NOT NULL REFERENCES control(id) ON DELETE CASCADE,
  control_context text,
  PRIMARY KEY (process_step_id, control_id)
);

CREATE TABLE risk_control (
  risk_id              uuid NOT NULL REFERENCES risk(id) ON DELETE CASCADE,
  control_id           uuid NOT NULL REFERENCES control(id) ON DELETE CASCADE,
  effectiveness_rating effectiveness_rating,
  PRIMARY KEY (risk_id, control_id)
);

CREATE TABLE risk_asset (
  risk_id  uuid NOT NULL REFERENCES risk(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES asset(id) ON DELETE CASCADE,
  PRIMARY KEY (risk_id, asset_id)
);

CREATE TABLE control_requirement (
  control_id            uuid NOT NULL REFERENCES control(id) ON DELETE CASCADE,
  requirement_id        uuid NOT NULL REFERENCES requirement(id) ON DELETE CASCADE,
  implementation_status implementation_status DEFAULT 'planned',
  PRIMARY KEY (control_id, requirement_id)
);

CREATE TABLE document_link (
  document_id uuid NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  entity_type varchar(100) NOT NULL,
  entity_id   uuid NOT NULL,
  link_type   varchar(50),
  PRIMARY KEY (document_id, entity_type, entity_id)
);

CREATE TABLE ropa_supplier (
  ropa_id     uuid NOT NULL REFERENCES ropa(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES supplier(id) ON DELETE CASCADE,
  role        varchar(100),
  PRIMARY KEY (ropa_id, supplier_id)
);

CREATE TABLE asset_bia (
  asset_id        uuid NOT NULL REFERENCES asset(id) ON DELETE CASCADE,
  bia_id          uuid NOT NULL REFERENCES bia(id) ON DELETE CASCADE,
  dependency_type varchar(100),
  PRIMARY KEY (asset_id, bia_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Composite indexes for RLS performance (org_id + common filters)
CREATE INDEX idx_risk_org_status ON risk(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_control_org_status ON control(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_process_org_status ON process(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_finding_org_status ON finding(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_action_org_status ON action(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_ropa_org_status ON ropa(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_document_org_status ON document(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_contract_org_status ON contract(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_org_status ON supplier(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_audit_org_status ON audit(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_incident_org_status ON incident(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_asset_org_status ON asset(org_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_evidence_entity ON evidence(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comment_entity ON comment(entity_type, entity_id) WHERE deleted_at IS NULL;

-- Audit log indexes
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_org ON audit_log(org_id, created_at DESC);
CREATE INDEX idx_access_log_user ON access_log(user_id, created_at DESC);

-- User lookups
CREATE INDEX idx_user_clerk ON "user"(clerk_id) WHERE clerk_id IS NOT NULL;
CREATE INDEX idx_user_org_role ON user_organization_role(org_id, role);
CREATE INDEX idx_notification_user ON notification(user_id, is_read, created_at DESC);

-- Full-text search
CREATE INDEX idx_risk_title_fts ON risk USING gin(to_tsvector('german', title || ' ' || COALESCE(description, '')));
CREATE INDEX idx_document_title_fts ON document USING gin(to_tsvector('german', title || ' ' || COALESCE(content, '')));
CREATE INDEX idx_process_name_fts ON process USING gin(to_tsvector('german', name || ' ' || COALESCE(description, '')));

-- pgvector for semantic search
CREATE INDEX idx_requirement_embedding ON requirement USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- ROW-LEVEL SECURITY (ADR-001)
-- ============================================================================

-- Helper: Enable RLS on all business tables
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'organization', 'process', 'process_step', 'compliance_assessment',
    'asset', 'vulnerability', 'risk', 'risk_treatment', 'kri',
    'control', 'control_test', 'evidence', 'audit', 'audit_checklist', 'finding',
    'bia', 'bcp', 'exercise', 'ropa', 'dpia', 'data_subject_request',
    'data_breach', 'transfer_assessment', 'tom', 'incident',
    'supplier', 'dpa', 'document', 'acknowledgment', 'contract', 'contract_obligation',
    'action', 'budget', 'budget_item', 'training_campaign',
    'notification', 'comment', 'simulation_result', 'compliance_checkpoint', 'ai_usage_log'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    -- Policy: users see only their org
    IF t NOT IN ('organization', 'vulnerability', 'audit_checklist', 'acknowledgment',
                 'budget_item', 'process_step', 'bia_supplier_dependency', 'contract_obligation') THEN
      EXECUTE format(
        'CREATE POLICY org_isolation ON %I FOR ALL USING (org_id = current_setting(''app.current_org_id'', true)::uuid)',
        t
      );
    END IF;
  END LOOP;
END $$;

-- Special RLS for organization (users see orgs they belong to)
CREATE POLICY org_self_isolation ON organization FOR ALL
  USING (id = current_setting('app.current_org_id', true)::uuid
    OR id IN (SELECT org_id FROM user_organization_role WHERE user_id = current_setting('app.current_user_id', true)::uuid));

-- ============================================================================
-- AUDIT TRIGGER (ADR-011)
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_trigger_fn() RETURNS trigger AS $$
DECLARE
  _changes jsonb;
  _action audit_action;
  _entity_title text;
  _prev_hash varchar(64);
  _hash_input text;
  _user_id uuid;
  _user_email text;
  _user_name text;
  _org_id uuid;
BEGIN
  -- Get current user context
  _user_id := current_setting('app.current_user_id', true)::uuid;
  
  SELECT email, name INTO _user_email, _user_name
  FROM "user" WHERE id = _user_id;
  
  -- Determine action and build changes
  IF TG_OP = 'INSERT' THEN
    _action := 'create';
    _changes := to_jsonb(NEW);
    _entity_title := COALESCE(NEW.title, NEW.name, NEW.id::text);
    _org_id := NEW.org_id;
  ELSIF TG_OP = 'UPDATE' THEN
    _action := CASE
      WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status_change'
      WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN 'delete'
      ELSE 'update'
    END;
    -- Build diff: only changed fields
    SELECT jsonb_object_agg(key, jsonb_build_object('old', old_val, 'new', new_val))
    INTO _changes
    FROM (
      SELECT key, old_row.value AS old_val, new_row.value AS new_val
      FROM jsonb_each(to_jsonb(OLD)) AS old_row(key, value)
      JOIN jsonb_each(to_jsonb(NEW)) AS new_row(key, value) USING (key)
      WHERE old_row.value IS DISTINCT FROM new_row.value
        AND key NOT IN ('updated_at', 'updated_by')
    ) diffs;
    _entity_title := COALESCE(NEW.title, NEW.name, NEW.id::text);
    _org_id := NEW.org_id;
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'delete';
    _changes := to_jsonb(OLD);
    _entity_title := COALESCE(OLD.title, OLD.name, OLD.id::text);
    _org_id := OLD.org_id;
  END IF;
  
  -- Skip if no actual changes on UPDATE
  IF TG_OP = 'UPDATE' AND _changes IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get previous hash for chain
  SELECT entry_hash INTO _prev_hash FROM audit_log ORDER BY created_at DESC LIMIT 1;
  
  -- Compute hash
  _hash_input := COALESCE(_prev_hash, '0') || TG_TABLE_NAME || COALESCE((NEW).id::text, (OLD).id::text) || _action::text || now()::text;
  
  INSERT INTO audit_log (org_id, user_id, user_email, user_name, entity_type, entity_id, entity_title, action, changes, previous_hash, entry_hash)
  VALUES (
    _org_id, _user_id, _user_email, _user_name,
    TG_TABLE_NAME, COALESCE((NEW).id, (OLD).id), _entity_title,
    _action, _changes, _prev_hash,
    encode(digest(_hash_input, 'sha256'), 'hex')
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to all business tables
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'organization', 'process', 'risk', 'control', 'finding', 'action',
    'audit', 'ropa', 'dpia', 'incident', 'data_breach', 'data_subject_request',
    'supplier', 'contract', 'document', 'bcp', 'bia', 'asset',
    'evidence', 'comment', 'notification'
  ])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn()',
      t
    );
  END LOOP;
END $$;

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'organization', 'process', 'risk', 'control', 'finding', 'action',
    'audit', 'ropa', 'dpia', 'incident', 'data_breach', 'data_subject_request',
    'supplier', 'contract', 'document', 'bcp', 'bia', 'asset',
    'evidence', 'comment', 'notification', 'kri', 'transfer_assessment', 'tom'
  ])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t
    );
  END LOOP;
END $$;

-- ============================================================================
-- SEED: Demo Organization
-- ============================================================================

INSERT INTO organization (id, name, short_name, type, country, is_eu) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Meridian Holdings GmbH', 'Meridian', 'holding', 'DEU', true),
  ('00000000-0000-0000-0000-000000000002', 'NovaTec Services GmbH', 'NovaTec', 'subsidiary', 'DEU', true),
  ('00000000-0000-0000-0000-000000000003', 'AuraTech Solutions AG', 'AuraTech', 'subsidiary', 'DEU', true),
  ('00000000-0000-0000-0000-000000000004', 'VantaGuard BV', 'VantaGuard', 'subsidiary', 'NLD', true),
  ('00000000-0000-0000-0000-000000000005', 'SteelBridge Safety BV', 'SteelBridge', 'subsidiary', 'NLD', true);

-- Set parent org
UPDATE organization SET parent_org_id = '00000000-0000-0000-0000-000000000001'
WHERE id IN ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003',
             '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005');

-- ============================================================================
-- Done. Schema: 47 tables + 10 join tables + RLS + Audit Triggers + Indexes
-- ============================================================================
