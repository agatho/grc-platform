-- Sprint 46: Whistleblowing Advanced — Investigation, Protection,
-- Multi-Channel, Routing, Ombudsperson Portal
-- Migrations 686–705

-- ═══════════════════════════════════════════════════════════
-- wb_investigation — Investigation lifecycle per case
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wb_investigation (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES organization(id),
  case_id                   UUID NOT NULL REFERENCES wb_case(id),
  phase                     VARCHAR(20) NOT NULL DEFAULT 'intake',
  priority                  VARCHAR(20) NOT NULL DEFAULT 'medium',
  assigned_investigator_id  UUID REFERENCES "user"(id),
  assigned_team_id          UUID,
  triage_date               TIMESTAMPTZ,
  investigation_start       TIMESTAMPTZ,
  decision_date             TIMESTAMPTZ,
  resolution_date           TIMESTAMPTZ,
  closed_date               TIMESTAMPTZ,
  decision_outcome          VARCHAR(30),
  recommended_actions       TEXT,
  final_report_document_id  UUID,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wbi_org_idx ON wb_investigation(org_id);
CREATE INDEX IF NOT EXISTS wbi_case_idx ON wb_investigation(case_id);
CREATE INDEX IF NOT EXISTS wbi_phase_idx ON wb_investigation(org_id, phase);
CREATE INDEX IF NOT EXISTS wbi_investigator_idx ON wb_investigation(assigned_investigator_id);

-- ═══════════════════════════════════════════════════════════
-- wb_evidence — Secure evidence (NO DELETE trigger)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wb_evidence (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id  UUID NOT NULL REFERENCES wb_investigation(id),
  org_id            UUID NOT NULL,
  title             VARCHAR(500) NOT NULL,
  description       TEXT,
  file_url          VARCHAR(2000),
  file_type         VARCHAR(50),
  file_size_bytes   INTEGER,
  source_type       VARCHAR(30) NOT NULL,
  tags              TEXT[] DEFAULT '{}',
  uploaded_by       UUID REFERENCES "user"(id),
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  accessed_log      JSONB DEFAULT '[]',
  is_superseded     BOOLEAN NOT NULL DEFAULT false,
  superseded_by     UUID
);
CREATE INDEX IF NOT EXISTS wbe_investigation_idx ON wb_evidence(investigation_id);
CREATE INDEX IF NOT EXISTS wbe_org_idx ON wb_evidence(org_id);

-- ═══════════════════════════════════════════════════════════
-- wb_interview — Interview documentation
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wb_interview (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id       UUID NOT NULL REFERENCES wb_investigation(id),
  org_id                 UUID NOT NULL,
  interviewee_reference  VARCHAR(200),
  interviewer_id         UUID REFERENCES "user"(id),
  interview_date         DATE NOT NULL,
  questions_asked        TEXT,
  responses              TEXT,
  observations           TEXT,
  consent_documented     BOOLEAN DEFAULT false,
  recording_reference    VARCHAR(500),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wbint_investigation_idx ON wb_interview(investigation_id);

-- ═══════════════════════════════════════════════════════════
-- wb_investigation_log — IMMUTABLE activity timeline
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wb_investigation_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id  UUID NOT NULL REFERENCES wb_investigation(id),
  activity_type     VARCHAR(30) NOT NULL,
  description       TEXT,
  performed_by      UUID REFERENCES "user"(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wbil_investigation_idx ON wb_investigation_log(investigation_id);

-- ═══════════════════════════════════════════════════════════
-- wb_protection_case — Reporter protection monitoring
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wb_protection_case (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organization(id),
  case_id               UUID NOT NULL REFERENCES wb_case(id),
  reporter_reference    VARCHAR(200),
  reporter_user_id      UUID,
  protection_start_date DATE NOT NULL,
  protection_status     VARCHAR(20) NOT NULL DEFAULT 'active',
  monitoring_frequency  VARCHAR(20) NOT NULL DEFAULT 'monthly',
  next_review_date      DATE,
  concluded_at          TIMESTAMPTZ,
  conclusion_reason     TEXT,
  created_by            UUID REFERENCES "user"(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wbpc_org_idx ON wb_protection_case(org_id);
CREATE INDEX IF NOT EXISTS wbpc_case_idx ON wb_protection_case(case_id);
CREATE INDEX IF NOT EXISTS wbpc_status_idx ON wb_protection_case(org_id, protection_status);

-- ═══════════════════════════════════════════════════════════
-- wb_protection_event — Employment change tracking
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wb_protection_event (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protection_case_id UUID NOT NULL REFERENCES wb_protection_case(id),
  org_id             UUID NOT NULL,
  event_type         VARCHAR(30) NOT NULL,
  event_date         DATE NOT NULL,
  description        TEXT,
  flag               VARCHAR(20) NOT NULL DEFAULT 'normal',
  reviewed_by        UUID REFERENCES "user"(id),
  review_notes       TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wbpe_case_idx ON wb_protection_event(protection_case_id);
CREATE INDEX IF NOT EXISTS wbpe_flag_idx ON wb_protection_event(org_id, flag);

-- ═══════════════════════════════════════════════════════════
-- wb_ombudsperson_assignment
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wb_ombudsperson_assignment (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL,
  ombudsperson_user_id  UUID NOT NULL REFERENCES "user"(id),
  case_id               UUID NOT NULL REFERENCES wb_case(id),
  scope                 VARCHAR(30) NOT NULL,
  assigned_by           UUID REFERENCES "user"(id),
  assigned_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at            TIMESTAMPTZ NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  revoked_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS wboa_ombudsperson_idx ON wb_ombudsperson_assignment(ombudsperson_user_id);
CREATE INDEX IF NOT EXISTS wboa_case_idx ON wb_ombudsperson_assignment(case_id);
CREATE INDEX IF NOT EXISTS wboa_expiry_idx ON wb_ombudsperson_assignment(expires_at, is_active);

-- ═══════════════════════════════════════════════════════════
-- wb_ombudsperson_activity — IMMUTABLE activity log
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wb_ombudsperson_activity (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL,
  ombudsperson_user_id  UUID NOT NULL,
  action                VARCHAR(30) NOT NULL,
  case_id               UUID,
  detail                JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- Add channel field to wb_case
-- ═══════════════════════════════════════════════════════════
ALTER TABLE wb_case ADD COLUMN IF NOT EXISTS channel VARCHAR(20) DEFAULT 'web_form';

-- ═══════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════
ALTER TABLE wb_investigation ENABLE ROW LEVEL SECURITY;
CREATE POLICY wb_investigation_org ON wb_investigation USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE wb_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY wb_evidence_org ON wb_evidence USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE wb_interview ENABLE ROW LEVEL SECURITY;
CREATE POLICY wb_interview_org ON wb_interview USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE wb_investigation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY wb_investigation_log_org ON wb_investigation_log USING (
  investigation_id IN (SELECT id FROM wb_investigation WHERE org_id = current_setting('app.current_org_id')::uuid)
);

ALTER TABLE wb_protection_case ENABLE ROW LEVEL SECURITY;
CREATE POLICY wb_protection_case_org ON wb_protection_case USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE wb_protection_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY wb_protection_event_org ON wb_protection_event USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE wb_ombudsperson_assignment ENABLE ROW LEVEL SECURITY;
CREATE POLICY wb_ombudsperson_assignment_org ON wb_ombudsperson_assignment USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE wb_ombudsperson_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY wb_ombudsperson_activity_org ON wb_ombudsperson_activity USING (org_id = current_setting('app.current_org_id')::uuid);

-- ═══════════════════════════════════════════════════════════
-- Audit triggers (skip immutable: wb_investigation_log, wb_ombudsperson_activity)
-- wb_evidence: INSERT + UPDATE only (no DELETE)
-- ═══════════════════════════════════════════════════════════
CREATE TRIGGER wb_investigation_audit AFTER INSERT OR UPDATE OR DELETE ON wb_investigation FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER wb_evidence_audit AFTER INSERT OR UPDATE ON wb_evidence FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER wb_interview_audit AFTER INSERT OR UPDATE ON wb_interview FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER wb_protection_case_audit AFTER INSERT OR UPDATE OR DELETE ON wb_protection_case FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER wb_protection_event_audit AFTER INSERT OR UPDATE ON wb_protection_event FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER wb_ombudsperson_assignment_audit AFTER INSERT OR UPDATE ON wb_ombudsperson_assignment FOR EACH ROW EXECUTE FUNCTION audit_trigger();
