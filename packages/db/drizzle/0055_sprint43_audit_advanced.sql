-- Sprint 43: Audit Advanced — Working Papers, Resource Planning,
-- Continuous Auditing, QA Review, External Auditor Portal
-- Migrations 613–638

-- ═══════════════════════════════════════════════════════════
-- audit_wp_folder — Self-referencing hierarchy per audit
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_wp_folder (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organization(id),
  audit_id        UUID NOT NULL REFERENCES audit(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES audit_wp_folder(id),
  code            VARCHAR(20) NOT NULL,
  title           VARCHAR(500) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES "user"(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS awf_audit_idx ON audit_wp_folder(audit_id);
CREATE INDEX IF NOT EXISTS awf_parent_idx ON audit_wp_folder(parent_folder_id);
CREATE UNIQUE INDEX IF NOT EXISTS awf_unique_code_idx ON audit_wp_folder(audit_id, code);

-- ═══════════════════════════════════════════════════════════
-- audit_working_paper — Core WP entity with 5 content sections
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_working_paper (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                     UUID NOT NULL REFERENCES organization(id),
  audit_id                   UUID NOT NULL REFERENCES audit(id) ON DELETE CASCADE,
  folder_id                  UUID NOT NULL REFERENCES audit_wp_folder(id),
  reference                  VARCHAR(30) NOT NULL,
  title                      VARCHAR(500) NOT NULL,
  objective                  TEXT,
  scope                      TEXT,
  procedure_performed        TEXT,
  results                    TEXT,
  conclusion                 TEXT,
  evidence_document_ids      UUID[] DEFAULT '{}',
  cross_reference_wp_ids     UUID[] DEFAULT '{}',
  cross_reference_finding_ids UUID[] DEFAULT '{}',
  status                     VARCHAR(20) NOT NULL DEFAULT 'draft',
  prepared_by                UUID REFERENCES "user"(id),
  prepared_at                TIMESTAMPTZ,
  reviewed_by                UUID REFERENCES "user"(id),
  reviewed_at                TIMESTAMPTZ,
  approved_by                UUID REFERENCES "user"(id),
  approved_at                TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS awp_audit_idx ON audit_working_paper(audit_id);
CREATE INDEX IF NOT EXISTS awp_folder_idx ON audit_working_paper(folder_id);
CREATE UNIQUE INDEX IF NOT EXISTS awp_unique_ref_idx ON audit_working_paper(audit_id, reference);
CREATE INDEX IF NOT EXISTS awp_status_idx ON audit_working_paper(audit_id, status);

-- ═══════════════════════════════════════════════════════════
-- audit_wp_review_note — Inline review comments per section
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_wp_review_note (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  working_paper_id UUID NOT NULL REFERENCES audit_working_paper(id) ON DELETE CASCADE,
  section          VARCHAR(30) NOT NULL,
  note_text        TEXT NOT NULL,
  severity         VARCHAR(20) NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'open',
  created_by       UUID REFERENCES "user"(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by      UUID REFERENCES "user"(id),
  resolved_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS awrn_wp_idx ON audit_wp_review_note(working_paper_id);
CREATE INDEX IF NOT EXISTS awrn_status_idx ON audit_wp_review_note(working_paper_id, status);

-- ═══════════════════════════════════════════════════════════
-- audit_wp_review_note_reply — Threaded replies
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_wp_review_note_reply (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_note_id UUID NOT NULL REFERENCES audit_wp_review_note(id) ON DELETE CASCADE,
  reply_text     TEXT NOT NULL,
  created_by     UUID REFERENCES "user"(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- auditor_profile — Skills, certs, capacity, hourly rate
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS auditor_profile (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organization(id),
  user_id              UUID NOT NULL REFERENCES "user"(id),
  seniority            VARCHAR(20) NOT NULL,
  certifications       JSONB DEFAULT '[]',
  skills               TEXT[] DEFAULT '{}',
  available_hours_year INTEGER NOT NULL DEFAULT 1600,
  hourly_rate          NUMERIC(8,2),
  team                 VARCHAR(100),
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ap_org_idx ON auditor_profile(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS ap_user_idx ON auditor_profile(user_id);

-- ═══════════════════════════════════════════════════════════
-- audit_resource_allocation — Auditor-to-audit assignment
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_resource_allocation (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL,
  audit_id      UUID NOT NULL REFERENCES audit(id) ON DELETE CASCADE,
  auditor_id    UUID NOT NULL REFERENCES auditor_profile(id),
  role          VARCHAR(20) NOT NULL,
  planned_hours NUMERIC(8,2) NOT NULL,
  actual_hours  NUMERIC(8,2) DEFAULT 0,
  start_date    DATE,
  end_date      DATE
);
CREATE INDEX IF NOT EXISTS ara_audit_idx ON audit_resource_allocation(audit_id);
CREATE INDEX IF NOT EXISTS ara_auditor_idx ON audit_resource_allocation(auditor_id);
CREATE UNIQUE INDEX IF NOT EXISTS ara_unique_idx ON audit_resource_allocation(audit_id, auditor_id);

-- ═══════════════════════════════════════════════════════════
-- audit_time_entry — Daily time logging (self-service)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_time_entry (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL,
  auditor_id  UUID NOT NULL REFERENCES auditor_profile(id),
  audit_id    UUID NOT NULL REFERENCES audit(id),
  work_date   DATE NOT NULL,
  hours       NUMERIC(5,2) NOT NULL,
  description TEXT,
  created_by  UUID REFERENCES "user"(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ate_auditor_date_idx ON audit_time_entry(auditor_id, work_date);
CREATE INDEX IF NOT EXISTS ate_audit_idx ON audit_time_entry(audit_id);

-- ═══════════════════════════════════════════════════════════
-- continuous_audit_rule — Rule definitions
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS continuous_audit_rule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organization(id),
  name            VARCHAR(500) NOT NULL,
  description     TEXT,
  rule_type       VARCHAR(20) NOT NULL,
  data_source     JSONB NOT NULL,
  condition       JSONB NOT NULL,
  schedule        VARCHAR(20) NOT NULL DEFAULT 'daily',
  severity        VARCHAR(20) NOT NULL DEFAULT 'medium',
  risk_area       VARCHAR(100),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_executed_at TIMESTAMPTZ,
  created_by      UUID REFERENCES "user"(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS car_org_idx ON continuous_audit_rule(org_id);
CREATE INDEX IF NOT EXISTS car_active_idx ON continuous_audit_rule(org_id, is_active);

-- ═══════════════════════════════════════════════════════════
-- continuous_audit_result — IMMUTABLE execution log
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS continuous_audit_result (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id          UUID NOT NULL REFERENCES continuous_audit_rule(id),
  org_id           UUID NOT NULL,
  executed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  result_status    VARCHAR(20) NOT NULL,
  exception_count  INTEGER NOT NULL DEFAULT 0,
  execution_time_ms INTEGER,
  error_message    TEXT
);
CREATE INDEX IF NOT EXISTS caresult_rule_idx ON continuous_audit_result(rule_id, executed_at);

-- IMMUTABLE: no UPDATE trigger on continuous_audit_result

-- ═══════════════════════════════════════════════════════════
-- continuous_audit_exception — Exception lifecycle
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS continuous_audit_exception (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id                     UUID NOT NULL REFERENCES continuous_audit_result(id),
  rule_id                       UUID NOT NULL,
  org_id                        UUID NOT NULL,
  description                   TEXT NOT NULL,
  entity_type                   VARCHAR(50),
  entity_id                     UUID,
  detail                        JSONB DEFAULT '{}',
  status                        VARCHAR(20) NOT NULL DEFAULT 'new',
  acknowledged_by               UUID REFERENCES "user"(id),
  acknowledgment_justification  TEXT,
  escalated_finding_id          UUID,
  false_positive_approved_by    UUID REFERENCES "user"(id),
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cae_result_idx ON continuous_audit_exception(result_id);
CREATE INDEX IF NOT EXISTS cae_status_idx ON continuous_audit_exception(org_id, status);

-- ═══════════════════════════════════════════════════════════
-- audit_qa_review — One per audit engagement
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_qa_review (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organization(id),
  audit_id      UUID NOT NULL REFERENCES audit(id),
  reviewer_id   UUID NOT NULL REFERENCES "user"(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'assigned',
  overall_score INTEGER,
  rating        VARCHAR(10),
  observations  TEXT,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  created_by    UUID REFERENCES "user"(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS aqr_audit_idx ON audit_qa_review(audit_id);
CREATE INDEX IF NOT EXISTS aqr_org_idx ON audit_qa_review(org_id);

-- ═══════════════════════════════════════════════════════════
-- audit_qa_checklist_item — 25 items across 5 sections
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_qa_checklist_item (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qa_review_id    UUID NOT NULL REFERENCES audit_qa_review(id) ON DELETE CASCADE,
  section         VARCHAR(30) NOT NULL,
  item_number     INTEGER NOT NULL,
  item_text       TEXT NOT NULL,
  compliance      VARCHAR(30),
  weight          INTEGER NOT NULL DEFAULT 3,
  reviewer_comment TEXT
);
CREATE INDEX IF NOT EXISTS aqci_review_idx ON audit_qa_checklist_item(qa_review_id);

-- ═══════════════════════════════════════════════════════════
-- external_auditor_share — Entity-level sharing
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS external_auditor_share (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organization(id),
  external_user_id UUID NOT NULL REFERENCES "user"(id),
  entity_type      VARCHAR(50) NOT NULL,
  entity_id        UUID NOT NULL,
  access_level     VARCHAR(20) NOT NULL DEFAULT 'read_only',
  expires_at       TIMESTAMPTZ NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  shared_by        UUID REFERENCES "user"(id),
  shared_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS eas_external_idx ON external_auditor_share(external_user_id);
CREATE INDEX IF NOT EXISTS eas_entity_idx ON external_auditor_share(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS eas_expiry_idx ON external_auditor_share(expires_at, is_active);

-- ═══════════════════════════════════════════════════════════
-- external_auditor_activity — IMMUTABLE activity log
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS external_auditor_activity (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL,
  external_user_id UUID NOT NULL,
  action           VARCHAR(20) NOT NULL,
  entity_type      VARCHAR(50) NOT NULL,
  entity_id        UUID NOT NULL,
  detail           JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- RLS Policies for Sprint 43 tables
-- ═══════════════════════════════════════════════════════════
ALTER TABLE audit_wp_folder ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_wp_folder_org ON audit_wp_folder USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE audit_working_paper ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_working_paper_org ON audit_working_paper USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE audit_wp_review_note ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_wp_review_note_org ON audit_wp_review_note USING (
  working_paper_id IN (SELECT id FROM audit_working_paper WHERE org_id = current_setting('app.current_org_id')::uuid)
);

ALTER TABLE audit_wp_review_note_reply ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_wp_review_note_reply_org ON audit_wp_review_note_reply USING (
  review_note_id IN (SELECT rn.id FROM audit_wp_review_note rn JOIN audit_working_paper wp ON rn.working_paper_id = wp.id WHERE wp.org_id = current_setting('app.current_org_id')::uuid)
);

ALTER TABLE auditor_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY auditor_profile_org ON auditor_profile USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE audit_resource_allocation ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_resource_allocation_org ON audit_resource_allocation USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE audit_time_entry ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_time_entry_org ON audit_time_entry USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE continuous_audit_rule ENABLE ROW LEVEL SECURITY;
CREATE POLICY continuous_audit_rule_org ON continuous_audit_rule USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE continuous_audit_result ENABLE ROW LEVEL SECURITY;
CREATE POLICY continuous_audit_result_org ON continuous_audit_result USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE continuous_audit_exception ENABLE ROW LEVEL SECURITY;
CREATE POLICY continuous_audit_exception_org ON continuous_audit_exception USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE audit_qa_review ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_qa_review_org ON audit_qa_review USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE audit_qa_checklist_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_qa_checklist_item_org ON audit_qa_checklist_item USING (
  qa_review_id IN (SELECT id FROM audit_qa_review WHERE org_id = current_setting('app.current_org_id')::uuid)
);

ALTER TABLE external_auditor_share ENABLE ROW LEVEL SECURITY;
CREATE POLICY external_auditor_share_org ON external_auditor_share USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE external_auditor_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY external_auditor_activity_org ON external_auditor_activity USING (org_id = current_setting('app.current_org_id')::uuid);

-- ═══════════════════════════════════════════════════════════
-- Audit triggers (skip immutable tables: continuous_audit_result, external_auditor_activity)
-- ═══════════════════════════════════════════════════════════
CREATE TRIGGER audit_wp_folder_audit AFTER INSERT OR UPDATE OR DELETE ON audit_wp_folder FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_working_paper_audit AFTER INSERT OR UPDATE OR DELETE ON audit_working_paper FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_wp_review_note_audit AFTER INSERT OR UPDATE OR DELETE ON audit_wp_review_note FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER auditor_profile_audit AFTER INSERT OR UPDATE OR DELETE ON auditor_profile FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_resource_allocation_audit AFTER INSERT OR UPDATE OR DELETE ON audit_resource_allocation FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_time_entry_audit AFTER INSERT OR UPDATE ON audit_time_entry FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER continuous_audit_rule_audit AFTER INSERT OR UPDATE OR DELETE ON continuous_audit_rule FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER continuous_audit_exception_audit AFTER INSERT OR UPDATE ON continuous_audit_exception FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_qa_review_audit AFTER INSERT OR UPDATE OR DELETE ON audit_qa_review FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_qa_checklist_item_audit AFTER INSERT OR UPDATE ON audit_qa_checklist_item FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER external_auditor_share_audit AFTER INSERT OR UPDATE OR DELETE ON external_auditor_share FOR EACH ROW EXECUTE FUNCTION audit_trigger();
