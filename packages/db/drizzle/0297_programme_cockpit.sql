-- Migration 0297: Programme Cockpit
-- Norm-übergreifender geführter Einführungsprozess für Managementsysteme.
-- Bezug: docs/isms-bcms/10-programme-cockpit-implementation-plan.md

-- ──────────────────────────────────────────────────────────────
-- 1. Enums
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE ms_type AS ENUM (
    'isms', 'bcms', 'dpms', 'aims', 'esg', 'tcms', 'iccs', 'other'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE pdca_phase AS ENUM (
    'plan', 'do', 'check', 'act', 'continuous'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE programme_journey_status AS ENUM (
    'planned', 'active', 'on_track', 'at_risk', 'blocked', 'completed', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE programme_step_status AS ENUM (
    'pending', 'blocked', 'in_progress', 'review', 'completed', 'skipped', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ──────────────────────────────────────────────────────────────
-- 2. programme_template — global lesbar
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS programme_template (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     varchar(50) NOT NULL,
  ms_type                  ms_type NOT NULL,
  name                     varchar(200) NOT NULL,
  description              text,
  version                  varchar(20) NOT NULL DEFAULT '1.0',
  framework_codes          jsonb NOT NULL DEFAULT '[]'::jsonb,
  locale                   varchar(10) NOT NULL DEFAULT 'de',
  estimated_duration_days  integer NOT NULL DEFAULT 365,
  published_at             timestamptz,
  deprecated_at            timestamptz,
  is_active                boolean NOT NULL DEFAULT true,
  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  created_by               uuid REFERENCES "user"(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS programme_template_code_version_idx
  ON programme_template (code, version);
CREATE INDEX IF NOT EXISTS programme_template_ms_type_idx
  ON programme_template (ms_type, is_active);

-- Templates sind global lesbar — keine RLS, aber Audit-Trigger
DROP TRIGGER IF EXISTS audit_programme_template ON programme_template;
CREATE TRIGGER audit_programme_template
  AFTER INSERT OR UPDATE OR DELETE ON programme_template
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- 3. programme_template_phase
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS programme_template_phase (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id              uuid NOT NULL REFERENCES programme_template(id) ON DELETE CASCADE,
  code                     varchar(50) NOT NULL,
  sequence                 integer NOT NULL,
  name                     varchar(200) NOT NULL,
  description              text,
  pdca_phase               pdca_phase NOT NULL,
  default_duration_days    integer NOT NULL DEFAULT 30,
  is_gate                  boolean NOT NULL DEFAULT false,
  gate_criteria            jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS programme_template_phase_seq_idx
  ON programme_template_phase (template_id, sequence);
CREATE UNIQUE INDEX IF NOT EXISTS programme_template_phase_code_idx
  ON programme_template_phase (template_id, code);

DROP TRIGGER IF EXISTS audit_programme_template_phase ON programme_template_phase;
CREATE TRIGGER audit_programme_template_phase
  AFTER INSERT OR UPDATE OR DELETE ON programme_template_phase
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- 4. programme_template_step
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS programme_template_step (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id              uuid NOT NULL REFERENCES programme_template(id) ON DELETE CASCADE,
  phase_id                 uuid NOT NULL REFERENCES programme_template_phase(id) ON DELETE CASCADE,
  code                     varchar(80) NOT NULL,
  sequence                 integer NOT NULL,
  name                     varchar(300) NOT NULL,
  description              text,
  iso_clause               varchar(50),
  default_owner_role       varchar(50),
  default_duration_days    integer NOT NULL DEFAULT 7,
  prerequisite_step_codes  jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_module_link       jsonb NOT NULL DEFAULT '{}'::jsonb,
  required_evidence_count  integer NOT NULL DEFAULT 0,
  is_mandatory             boolean NOT NULL DEFAULT true,
  is_milestone             boolean NOT NULL DEFAULT false,
  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS programme_template_step_code_idx
  ON programme_template_step (template_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS programme_template_step_phase_seq_idx
  ON programme_template_step (phase_id, sequence);
CREATE INDEX IF NOT EXISTS programme_template_step_template_idx
  ON programme_template_step (template_id);

DROP TRIGGER IF EXISTS audit_programme_template_step ON programme_template_step;
CREATE TRIGGER audit_programme_template_step
  AFTER INSERT OR UPDATE OR DELETE ON programme_template_step
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- 5. programme_journey
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS programme_journey (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL REFERENCES organization(id),
  template_id              uuid NOT NULL REFERENCES programme_template(id),
  template_code            varchar(50) NOT NULL,
  template_version         varchar(20) NOT NULL,
  ms_type                  ms_type NOT NULL,
  name                     varchar(200) NOT NULL,
  description              text,
  status                   programme_journey_status NOT NULL DEFAULT 'planned',
  health_reason            text,
  progress_percent         numeric(5,2) NOT NULL DEFAULT 0,
  owner_id                 uuid REFERENCES "user"(id),
  sponsor_id               uuid REFERENCES "user"(id),
  started_at               date,
  target_completion_date   date,
  actual_completion_date   date,
  archived_at              timestamptz,
  last_health_eval_at      timestamptz,
  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  created_by               uuid REFERENCES "user"(id),
  updated_by               uuid REFERENCES "user"(id),
  deleted_at               timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS programme_journey_org_name_idx
  ON programme_journey (org_id, name);
CREATE INDEX IF NOT EXISTS programme_journey_org_status_idx
  ON programme_journey (org_id, status);
CREATE INDEX IF NOT EXISTS programme_journey_org_ms_idx
  ON programme_journey (org_id, ms_type);
CREATE INDEX IF NOT EXISTS programme_journey_target_date_idx
  ON programme_journey (org_id, target_completion_date);

ALTER TABLE programme_journey ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_programme_journey ON programme_journey;
CREATE POLICY rls_programme_journey ON programme_journey
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

DROP TRIGGER IF EXISTS audit_programme_journey ON programme_journey;
CREATE TRIGGER audit_programme_journey
  AFTER INSERT OR UPDATE OR DELETE ON programme_journey
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- 6. programme_journey_phase
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS programme_journey_phase (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL REFERENCES organization(id),
  journey_id               uuid NOT NULL REFERENCES programme_journey(id) ON DELETE CASCADE,
  template_phase_id        uuid NOT NULL REFERENCES programme_template_phase(id),
  code                     varchar(50) NOT NULL,
  sequence                 integer NOT NULL,
  name                     varchar(200) NOT NULL,
  pdca_phase               pdca_phase NOT NULL,
  status                   varchar(30) NOT NULL DEFAULT 'pending',
  progress_percent         numeric(5,2) NOT NULL DEFAULT 0,
  planned_start_date       date,
  planned_end_date         date,
  actual_start_date        date,
  actual_end_date          date,
  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT programme_journey_phase_status_check CHECK (
    status IN ('pending', 'in_progress', 'completed', 'blocked', 'skipped')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS programme_journey_phase_journey_seq_idx
  ON programme_journey_phase (journey_id, sequence);
CREATE INDEX IF NOT EXISTS programme_journey_phase_org_idx
  ON programme_journey_phase (org_id);
CREATE INDEX IF NOT EXISTS programme_journey_phase_status_idx
  ON programme_journey_phase (org_id, status);

ALTER TABLE programme_journey_phase ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_programme_journey_phase ON programme_journey_phase;
CREATE POLICY rls_programme_journey_phase ON programme_journey_phase
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

DROP TRIGGER IF EXISTS audit_programme_journey_phase ON programme_journey_phase;
CREATE TRIGGER audit_programme_journey_phase
  AFTER INSERT OR UPDATE OR DELETE ON programme_journey_phase
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- 7. programme_journey_step
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS programme_journey_step (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL REFERENCES organization(id),
  journey_id               uuid NOT NULL REFERENCES programme_journey(id) ON DELETE CASCADE,
  phase_id                 uuid NOT NULL REFERENCES programme_journey_phase(id) ON DELETE CASCADE,
  template_step_id         uuid NOT NULL REFERENCES programme_template_step(id),
  code                     varchar(80) NOT NULL,
  sequence                 integer NOT NULL,
  name                     varchar(300) NOT NULL,
  description              text,
  iso_clause               varchar(50),
  status                   programme_step_status NOT NULL DEFAULT 'pending',
  owner_id                 uuid REFERENCES "user"(id),
  due_date                 date,
  started_at               timestamptz,
  completed_at             timestamptz,
  skip_reason              text,
  block_reason             text,
  completion_notes         text,
  evidence_links           jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_module_link       jsonb NOT NULL DEFAULT '{}'::jsonb,
  required_evidence_count  integer NOT NULL DEFAULT 0,
  is_milestone             boolean NOT NULL DEFAULT false,
  is_mandatory             boolean NOT NULL DEFAULT true,
  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               uuid REFERENCES "user"(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS programme_journey_step_journey_code_idx
  ON programme_journey_step (journey_id, code);
CREATE INDEX IF NOT EXISTS programme_journey_step_phase_idx
  ON programme_journey_step (phase_id, sequence);
CREATE INDEX IF NOT EXISTS programme_journey_step_org_status_idx
  ON programme_journey_step (org_id, status);
CREATE INDEX IF NOT EXISTS programme_journey_step_due_idx
  ON programme_journey_step (org_id, due_date);
CREATE INDEX IF NOT EXISTS programme_journey_step_owner_idx
  ON programme_journey_step (owner_id, status);

ALTER TABLE programme_journey_step ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_programme_journey_step ON programme_journey_step;
CREATE POLICY rls_programme_journey_step ON programme_journey_step
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

DROP TRIGGER IF EXISTS audit_programme_journey_step ON programme_journey_step;
CREATE TRIGGER audit_programme_journey_step
  AFTER INSERT OR UPDATE OR DELETE ON programme_journey_step
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ──────────────────────────────────────────────────────────────
-- 8. programme_journey_event — append-only
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS programme_journey_event (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL REFERENCES organization(id),
  journey_id               uuid NOT NULL REFERENCES programme_journey(id) ON DELETE CASCADE,
  step_id                  uuid,
  event_type               varchar(50) NOT NULL,
  actor_id                 uuid REFERENCES "user"(id),
  payload                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS programme_journey_event_journey_idx
  ON programme_journey_event (journey_id, occurred_at);
CREATE INDEX IF NOT EXISTS programme_journey_event_org_type_idx
  ON programme_journey_event (org_id, event_type);
CREATE INDEX IF NOT EXISTS programme_journey_event_step_idx
  ON programme_journey_event (step_id);

ALTER TABLE programme_journey_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_programme_journey_event ON programme_journey_event;
CREATE POLICY rls_programme_journey_event ON programme_journey_event
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Append-only: weder UPDATE noch DELETE erlaubt (CHECK via Trigger)
CREATE OR REPLACE FUNCTION programme_journey_event_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'programme_journey_event is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS programme_journey_event_immutable_update
  ON programme_journey_event;
CREATE TRIGGER programme_journey_event_immutable_update
  BEFORE UPDATE OR DELETE ON programme_journey_event
  FOR EACH ROW EXECUTE FUNCTION programme_journey_event_immutable();

-- ──────────────────────────────────────────────────────────────
-- 9. Module-Definition (für ModuleGate)
-- ──────────────────────────────────────────────────────────────

INSERT INTO module_definition (
  module_key,
  display_name_de,
  display_name_en,
  description_de,
  description_en,
  icon,
  nav_path,
  nav_section,
  nav_order,
  is_active_in_platform
) VALUES (
  'programme',
  'Programm-Cockpit',
  'Programme Cockpit',
  'Norm-übergreifender geführter Einführungsprozess für Managementsysteme (ISMS, BCMS, DPMS, AIMS, …).',
  'Cross-framework guided implementation programme for management systems (ISMS, BCMS, DPMS, AIMS, …).',
  'rocket',
  '/programmes',
  'platform',
  90,
  true
)
ON CONFLICT (module_key) DO UPDATE
  SET display_name_de = EXCLUDED.display_name_de,
      display_name_en = EXCLUDED.display_name_en,
      description_de = EXCLUDED.description_de,
      description_en = EXCLUDED.description_en,
      icon = EXCLUDED.icon,
      nav_path = EXCLUDED.nav_path,
      nav_section = EXCLUDED.nav_section;
