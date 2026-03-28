-- Sprint 24: NIS2 Compliance Tracker + Certification Readiness
-- Migration 339: Create tables, RLS, audit triggers, indexes, seed

-- ──────────────────────────────────────────────────────────────
-- Enums
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE nis2_report_type AS ENUM ('early_warning', 'full_notification', 'intermediate_report', 'final_report');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE nis2_report_status AS ENUM ('draft', 'submitted', 'acknowledged', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────────
-- 24.1 certification_readiness_snapshot — Immutable periodic score
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS certification_readiness_snapshot (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organization(id),
  framework    varchar(100) NOT NULL,
  score        integer NOT NULL,
  checks_json  jsonb NOT NULL,
  gap_count    integer NOT NULL DEFAULT 0,
  passed_count integer NOT NULL DEFAULT 0,
  total_checks integer NOT NULL DEFAULT 0,
  metadata     jsonb DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES "user"(id)
);

CREATE INDEX IF NOT EXISTS crs_org_idx ON certification_readiness_snapshot(org_id);
CREATE INDEX IF NOT EXISTS crs_framework_idx ON certification_readiness_snapshot(org_id, framework);
CREATE INDEX IF NOT EXISTS crs_created_idx ON certification_readiness_snapshot(org_id, created_at);

-- RLS
ALTER TABLE certification_readiness_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY crs_org_isolation ON certification_readiness_snapshot
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER certification_readiness_snapshot_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON certification_readiness_snapshot
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- 24.2 nis2_incident_report — Art. 23 Meldepflichten
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nis2_incident_report (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                       uuid NOT NULL REFERENCES organization(id),
  incident_id                  uuid NOT NULL REFERENCES security_incident(id) ON DELETE CASCADE,
  report_type                  nis2_report_type NOT NULL,
  status                       nis2_report_status NOT NULL DEFAULT 'draft',
  deadline_at                  timestamptz NOT NULL,
  submitted_at                 timestamptz,
  bsi_reference                varchar(200),
  report_content               text,
  contact_person               varchar(500),
  contact_email                varchar(500),
  contact_phone                varchar(100),
  affected_services_description text,
  cross_border_impact          text,
  estimated_impact_count       integer,
  metadata                     jsonb DEFAULT '{}',
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  created_by                   uuid REFERENCES "user"(id)
);

CREATE INDEX IF NOT EXISTS nir_org_idx ON nis2_incident_report(org_id);
CREATE INDEX IF NOT EXISTS nir_incident_idx ON nis2_incident_report(incident_id);
CREATE INDEX IF NOT EXISTS nir_type_idx ON nis2_incident_report(org_id, report_type);
CREATE INDEX IF NOT EXISTS nir_status_idx ON nis2_incident_report(org_id, status);
CREATE INDEX IF NOT EXISTS nir_deadline_idx ON nis2_incident_report(org_id, deadline_at);

-- RLS
ALTER TABLE nis2_incident_report ENABLE ROW LEVEL SECURITY;
CREATE POLICY nir_org_isolation ON nis2_incident_report
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Audit trigger
CREATE TRIGGER nis2_incident_report_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON nis2_incident_report
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
