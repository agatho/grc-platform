-- ============================================================================
-- Migration 0107: Sprint 66 Framework-Mapping tables (long-overdue)
--
-- The Drizzle schema in packages/db/src/schema/framework-mapping.ts (Sprint 66)
-- was committed without a corresponding SQL migration. As a result, the
-- /api/v1/framework-mappings/* endpoints crashed with "framework_mapping
-- relation does not exist" on any fresh DB. This migration retroactively
-- creates the 5 tables of that schema so all those endpoints work, and so
-- migration 0106 (the bridge backfill) actually has a target table.
--
-- Tables:
--   framework_mapping              — string-keyed cross-framework mappings (API)
--   framework_mapping_rule         — org-specific overrides/additions
--   control_framework_coverage     — per-control coverage across frameworks
--   framework_gap_analysis         — gap analysis snapshots
--   framework_coverage_snapshot    — point-in-time heatmap data
--
-- Idempotent (CREATE TABLE IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS framework_mapping (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  source_framework      varchar(50)  NOT NULL,
  source_control_id     varchar(100) NOT NULL,
  source_control_title  varchar(500),
  target_framework      varchar(50)  NOT NULL,
  target_control_id     varchar(100) NOT NULL,
  target_control_title  varchar(500),
  relationship_type     varchar(30)  NOT NULL,
  confidence            numeric(5,2) NOT NULL DEFAULT 0.80,
  mapping_source        varchar(30)  NOT NULL DEFAULT 'nist_olir',
  rationale             text,
  is_verified           boolean      NOT NULL DEFAULT false,
  verified_by           uuid REFERENCES "user"(id),
  verified_at           timestamptz,
  is_built_in           boolean      NOT NULL DEFAULT true,
  metadata              jsonb        DEFAULT '{}'::jsonb,
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at            timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fm_source_idx     ON framework_mapping (source_framework, source_control_id);
CREATE INDEX IF NOT EXISTS fm_target_idx     ON framework_mapping (target_framework, target_control_id);
CREATE INDEX IF NOT EXISTS fm_rel_type_idx   ON framework_mapping (relationship_type);
CREATE INDEX IF NOT EXISTS fm_confidence_idx ON framework_mapping (confidence);
CREATE UNIQUE INDEX IF NOT EXISTS fm_unique_mapping_idx
  ON framework_mapping (source_framework, source_control_id, target_framework, target_control_id);

CREATE TABLE IF NOT EXISTS framework_mapping_rule (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  org_id              uuid NOT NULL REFERENCES organization(id),
  mapping_id          uuid REFERENCES framework_mapping(id),
  source_framework    varchar(50)  NOT NULL,
  source_control_id   varchar(100) NOT NULL,
  target_framework    varchar(50)  NOT NULL,
  target_control_id   varchar(100) NOT NULL,
  rule_type           varchar(20)  NOT NULL,
  confidence          numeric(5,2),
  rationale           text,
  created_by          uuid REFERENCES "user"(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fmr_org_idx     ON framework_mapping_rule (org_id);
CREATE INDEX IF NOT EXISTS fmr_mapping_idx ON framework_mapping_rule (mapping_id);
CREATE INDEX IF NOT EXISTS fmr_source_idx  ON framework_mapping_rule (source_framework, source_control_id);
CREATE INDEX IF NOT EXISTS fmr_target_idx  ON framework_mapping_rule (target_framework, target_control_id);

CREATE TABLE IF NOT EXISTS control_framework_coverage (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  org_id                 uuid NOT NULL REFERENCES organization(id),
  control_id             uuid NOT NULL,
  framework              varchar(50)  NOT NULL,
  framework_control_id   varchar(100) NOT NULL,
  coverage_status        varchar(30)  NOT NULL,
  coverage_source        varchar(30)  NOT NULL,
  evidence_status        varchar(30)  NOT NULL DEFAULT 'missing',
  last_assessed_at       timestamptz,
  assessment_result      varchar(20),
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cfc_org_idx       ON control_framework_coverage (org_id);
CREATE INDEX IF NOT EXISTS cfc_control_idx   ON control_framework_coverage (control_id);
CREATE INDEX IF NOT EXISTS cfc_framework_idx ON control_framework_coverage (framework);
CREATE INDEX IF NOT EXISTS cfc_status_idx    ON control_framework_coverage (coverage_status);
CREATE UNIQUE INDEX IF NOT EXISTS cfc_unique_idx
  ON control_framework_coverage (org_id, control_id, framework, framework_control_id);

CREATE TABLE IF NOT EXISTS framework_gap_analysis (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  org_id                        uuid NOT NULL REFERENCES organization(id),
  framework                     varchar(50) NOT NULL,
  analysis_date                 timestamptz NOT NULL,
  total_controls                integer     NOT NULL,
  covered_controls              integer     NOT NULL,
  partially_covered_controls    integer     NOT NULL,
  not_covered_controls          integer     NOT NULL,
  not_applicable_controls       integer     NOT NULL DEFAULT 0,
  coverage_percentage           numeric(5,2) NOT NULL,
  gap_details                   jsonb DEFAULT '[]'::jsonb,
  prioritized_actions           jsonb DEFAULT '[]'::jsonb,
  risk_exposure                 varchar(20),
  estimated_effort_days         integer,
  created_by                    uuid REFERENCES "user"(id),
  created_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fga_org_idx       ON framework_gap_analysis (org_id);
CREATE INDEX IF NOT EXISTS fga_framework_idx ON framework_gap_analysis (framework);
CREATE INDEX IF NOT EXISTS fga_date_idx      ON framework_gap_analysis (analysis_date);

CREATE TABLE IF NOT EXISTS framework_coverage_snapshot (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  org_id               uuid NOT NULL REFERENCES organization(id),
  snapshot_date        timestamptz NOT NULL,
  framework_scores     jsonb       NOT NULL,
  overall_coverage     numeric(5,2) NOT NULL,
  total_frameworks     integer     NOT NULL,
  fully_compliant      integer     NOT NULL,
  partially_compliant  integer     NOT NULL,
  non_compliant        integer     NOT NULL,
  heatmap_data         jsonb       DEFAULT '{}'::jsonb,
  trend_data           jsonb       DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fcs_org_idx  ON framework_coverage_snapshot (org_id);
CREATE INDEX IF NOT EXISTS fcs_date_idx ON framework_coverage_snapshot (snapshot_date);

-- Audit trigger for change tracking (consistent with other domain tables)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN
    EXECUTE 'CREATE TRIGGER framework_mapping_audit BEFORE INSERT OR UPDATE OR DELETE ON framework_mapping FOR EACH ROW EXECUTE FUNCTION audit_trigger()';
    EXECUTE 'CREATE TRIGGER framework_mapping_rule_audit BEFORE INSERT OR UPDATE OR DELETE ON framework_mapping_rule FOR EACH ROW EXECUTE FUNCTION audit_trigger()';
    EXECUTE 'CREATE TRIGGER control_framework_coverage_audit BEFORE INSERT OR UPDATE OR DELETE ON control_framework_coverage FOR EACH ROW EXECUTE FUNCTION audit_trigger()';
    EXECUTE 'CREATE TRIGGER framework_gap_analysis_audit BEFORE INSERT OR UPDATE OR DELETE ON framework_gap_analysis FOR EACH ROW EXECUTE FUNCTION audit_trigger()';
    EXECUTE 'CREATE TRIGGER framework_coverage_snapshot_audit BEFORE INSERT OR UPDATE OR DELETE ON framework_coverage_snapshot FOR EACH ROW EXECUTE FUNCTION audit_trigger()';
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS policies (per project convention — every table has org_id + RLS)
ALTER TABLE framework_mapping_rule        ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_framework_coverage    ENABLE ROW LEVEL SECURITY;
ALTER TABLE framework_gap_analysis        ENABLE ROW LEVEL SECURITY;
ALTER TABLE framework_coverage_snapshot   ENABLE ROW LEVEL SECURITY;
-- framework_mapping is platform-wide (no org_id) — no RLS

DO $$ BEGIN
  CREATE POLICY framework_mapping_rule_org_isolation     ON framework_mapping_rule     USING (org_id = current_setting('app.current_org_id', true)::uuid);
  CREATE POLICY control_framework_coverage_org_isolation  ON control_framework_coverage USING (org_id = current_setting('app.current_org_id', true)::uuid);
  CREATE POLICY framework_gap_analysis_org_isolation      ON framework_gap_analysis     USING (org_id = current_setting('app.current_org_id', true)::uuid);
  CREATE POLICY framework_coverage_snapshot_org_isolation ON framework_coverage_snapshot USING (org_id = current_setting('app.current_org_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE framework_mapping IS
  'Sprint 66 cross-framework mapping table (string-coded). Populated by seed_cross_framework_mappings*.sql via the bridge in migration 0106. Use view framework_mapping_full for read-side joins to live catalog titles.';
