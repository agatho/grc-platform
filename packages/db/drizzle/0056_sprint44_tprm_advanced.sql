-- Sprint 44: TPRM Advanced — Vendor Scorecards, Concentration Risk,
-- SLA Monitoring, Exit Planning, Sub-Processor Tracking
-- Migrations 639–660

-- ═══════════════════════════════════════════════════════════
-- vendor_scorecard
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS vendor_scorecard (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organization(id),
  vendor_id        UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
  overall_score    INTEGER NOT NULL,
  tier             VARCHAR(30) NOT NULL,
  dimension_scores JSONB NOT NULL,
  weights          JSONB NOT NULL,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  previous_score   INTEGER,
  previous_tier    VARCHAR(30)
);
CREATE UNIQUE INDEX IF NOT EXISTS vs_vendor_idx ON vendor_scorecard(vendor_id);
CREATE INDEX IF NOT EXISTS vs_org_idx ON vendor_scorecard(org_id);
CREATE INDEX IF NOT EXISTS vs_tier_idx ON vendor_scorecard(org_id, tier);

-- ═══════════════════════════════════════════════════════════
-- vendor_scorecard_history — IMMUTABLE quarterly snapshots
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS vendor_scorecard_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id     UUID NOT NULL REFERENCES vendor_scorecard(id) ON DELETE CASCADE,
  org_id           UUID NOT NULL,
  overall_score    INTEGER NOT NULL,
  tier             VARCHAR(30) NOT NULL,
  dimension_scores JSONB NOT NULL,
  snapshot_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- vendor_concentration_analysis
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS vendor_concentration_analysis (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organization(id),
  analysis_type VARCHAR(30) NOT NULL,
  analysis_date DATE NOT NULL,
  results       JSONB NOT NULL,
  hhi_score     INTEGER,
  risk_level    VARCHAR(20),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vca_org_idx ON vendor_concentration_analysis(org_id);
CREATE INDEX IF NOT EXISTS vca_type_idx ON vendor_concentration_analysis(org_id, analysis_type);

-- ═══════════════════════════════════════════════════════════
-- vendor_sla_definition
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS vendor_sla_definition (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organization(id),
  vendor_id          UUID NOT NULL REFERENCES vendor(id),
  contract_id        UUID,
  metric_name        VARCHAR(200) NOT NULL,
  metric_type        VARCHAR(30) NOT NULL,
  target_value       NUMERIC(10,4) NOT NULL,
  unit               VARCHAR(50) NOT NULL,
  measurement_period VARCHAR(20) NOT NULL,
  penalty_clause     TEXT,
  evidence_source    TEXT,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vsd_vendor_idx ON vendor_sla_definition(vendor_id);
CREATE INDEX IF NOT EXISTS vsd_org_idx ON vendor_sla_definition(org_id);

-- ═══════════════════════════════════════════════════════════
-- vendor_sla_measurement
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS vendor_sla_measurement (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sla_definition_id UUID NOT NULL REFERENCES vendor_sla_definition(id),
  org_id            UUID NOT NULL,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  actual_value      NUMERIC(10,4) NOT NULL,
  target_value      NUMERIC(10,4) NOT NULL,
  is_met            BOOLEAN NOT NULL,
  breach_severity   VARCHAR(20),
  evidence          TEXT,
  notes             TEXT,
  measured_by       UUID REFERENCES "user"(id),
  measured_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vsm_sla_idx ON vendor_sla_measurement(sla_definition_id);
CREATE INDEX IF NOT EXISTS vsm_period_idx ON vendor_sla_measurement(sla_definition_id, period_start);

-- ═══════════════════════════════════════════════════════════
-- vendor_exit_plan
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS vendor_exit_plan (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                          UUID NOT NULL REFERENCES organization(id),
  vendor_id                       UUID NOT NULL REFERENCES vendor(id),
  transition_approach             VARCHAR(30) NOT NULL,
  data_migration_plan             TEXT,
  knowledge_transfer_requirements TEXT,
  termination_notice_days         INTEGER,
  estimated_timeline_months       INTEGER,
  estimated_cost                  NUMERIC(15,2),
  alternative_vendor_ids          UUID[] DEFAULT '{}',
  key_risks                       TEXT,
  status                          VARCHAR(20) NOT NULL DEFAULT 'draft',
  reviewed_by                     UUID REFERENCES "user"(id),
  reviewed_at                     TIMESTAMPTZ,
  next_review_date                DATE,
  review_cycle_months             INTEGER NOT NULL DEFAULT 12,
  exit_readiness_score            INTEGER,
  created_by                      UUID REFERENCES "user"(id),
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vep_vendor_idx ON vendor_exit_plan(vendor_id);
CREATE INDEX IF NOT EXISTS vep_org_idx ON vendor_exit_plan(org_id);
CREATE INDEX IF NOT EXISTS vep_review_idx ON vendor_exit_plan(next_review_date);

-- ═══════════════════════════════════════════════════════════
-- vendor_sub_processor
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS vendor_sub_processor (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 UUID NOT NULL REFERENCES organization(id),
  vendor_id              UUID NOT NULL REFERENCES vendor(id),
  name                   VARCHAR(500) NOT NULL,
  service_description    TEXT,
  data_categories        TEXT[] DEFAULT '{}',
  hosting_country        VARCHAR(5),
  is_eu                  BOOLEAN NOT NULL DEFAULT false,
  is_adequate_country    BOOLEAN NOT NULL DEFAULT false,
  requires_tia           BOOLEAN NOT NULL DEFAULT false,
  tia_id                 UUID,
  approval_status        VARCHAR(20) NOT NULL DEFAULT 'pending_review',
  approval_justification TEXT,
  approved_by            UUID REFERENCES "user"(id),
  date_added             DATE,
  date_notified          DATE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vsp_vendor_idx ON vendor_sub_processor(vendor_id);
CREATE INDEX IF NOT EXISTS vsp_org_idx ON vendor_sub_processor(org_id);
CREATE INDEX IF NOT EXISTS vsp_approval_idx ON vendor_sub_processor(org_id, approval_status);

-- ═══════════════════════════════════════════════════════════
-- vendor_sub_processor_notification
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS vendor_sub_processor_notification (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL,
  vendor_id          UUID NOT NULL REFERENCES vendor(id),
  notification_type  VARCHAR(20) NOT NULL,
  sub_processor_name VARCHAR(500) NOT NULL,
  change_description TEXT,
  received_at        DATE NOT NULL,
  review_deadline    DATE,
  review_status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_by        UUID REFERENCES "user"(id),
  reviewed_at        TIMESTAMPTZ,
  rejection_reason   TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════
ALTER TABLE vendor_scorecard ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendor_scorecard_org ON vendor_scorecard USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE vendor_scorecard_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendor_scorecard_history_org ON vendor_scorecard_history USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE vendor_concentration_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendor_concentration_analysis_org ON vendor_concentration_analysis USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE vendor_sla_definition ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendor_sla_definition_org ON vendor_sla_definition USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE vendor_sla_measurement ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendor_sla_measurement_org ON vendor_sla_measurement USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE vendor_exit_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendor_exit_plan_org ON vendor_exit_plan USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE vendor_sub_processor ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendor_sub_processor_org ON vendor_sub_processor USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE vendor_sub_processor_notification ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendor_sub_processor_notification_org ON vendor_sub_processor_notification USING (org_id = current_setting('app.current_org_id')::uuid);

-- ═══════════════════════════════════════════════════════════
-- Audit triggers (skip immutable: vendor_scorecard_history)
-- ═══════════════════════════════════════════════════════════
CREATE TRIGGER vendor_scorecard_audit AFTER INSERT OR UPDATE OR DELETE ON vendor_scorecard FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER vendor_concentration_analysis_audit AFTER INSERT ON vendor_concentration_analysis FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER vendor_sla_definition_audit AFTER INSERT OR UPDATE OR DELETE ON vendor_sla_definition FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER vendor_sla_measurement_audit AFTER INSERT ON vendor_sla_measurement FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER vendor_exit_plan_audit AFTER INSERT OR UPDATE OR DELETE ON vendor_exit_plan FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER vendor_sub_processor_audit AFTER INSERT OR UPDATE OR DELETE ON vendor_sub_processor FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER vendor_sub_processor_notification_audit AFTER INSERT OR UPDATE ON vendor_sub_processor_notification FOR EACH ROW EXECUTE FUNCTION audit_trigger();
