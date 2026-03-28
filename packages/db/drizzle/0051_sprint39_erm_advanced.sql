-- Sprint 39: ERM Advanced — Bow-Tie, Treatment Tracking, Interconnections, Emerging Risks, Risk Events
-- Migrations 521–540

-- ═══════════════════════════════════════════════════════════
-- bowtie_element
-- ═══════════════════════════════════════════════════════════
DO $$ BEGIN
  CREATE TYPE bowtie_element_type AS ENUM ('cause','consequence','barrier');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS bowtie_element (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organization(id),
  risk_id       UUID NOT NULL REFERENCES risk(id) ON DELETE CASCADE,
  type          bowtie_element_type NOT NULL,
  title         VARCHAR(500) NOT NULL,
  description   TEXT,
  control_id    UUID REFERENCES control(id),
  effectiveness VARCHAR(20),
  likelihood    INTEGER,
  impact        INTEGER,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS be_risk_idx ON bowtie_element(risk_id);
CREATE INDEX IF NOT EXISTS be_org_idx ON bowtie_element(org_id);

-- ═══════════════════════════════════════════════════════════
-- bowtie_path
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bowtie_path (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id           UUID NOT NULL REFERENCES risk(id) ON DELETE CASCADE,
  source_element_id UUID NOT NULL REFERENCES bowtie_element(id) ON DELETE CASCADE,
  target_element_id UUID NOT NULL REFERENCES bowtie_element(id) ON DELETE CASCADE,
  barrier_ids       JSONB DEFAULT '[]',
  sort_order        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS bp_risk_idx ON bowtie_path(risk_id);

-- ═══════════════════════════════════════════════════════════
-- treatment_milestone
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS treatment_milestone (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id           UUID NOT NULL,
  org_id                 UUID NOT NULL REFERENCES organization(id),
  title                  VARCHAR(500) NOT NULL,
  description            TEXT,
  deadline               DATE NOT NULL,
  responsible_id         UUID REFERENCES "user"(id),
  status                 VARCHAR(20) NOT NULL DEFAULT 'planned',
  percent_complete       INTEGER NOT NULL DEFAULT 0,
  planned_effort_hours   NUMERIC(8,2),
  actual_effort_hours    NUMERIC(8,2),
  depends_on_milestone_id UUID,
  completed_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tm_treatment_idx ON treatment_milestone(treatment_id);
CREATE INDEX IF NOT EXISTS tm_org_idx ON treatment_milestone(org_id);

-- ═══════════════════════════════════════════════════════════
-- risk_interconnection
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS risk_interconnection (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organization(id),
  source_risk_id   UUID NOT NULL REFERENCES risk(id) ON DELETE CASCADE,
  target_risk_id   UUID NOT NULL REFERENCES risk(id) ON DELETE CASCADE,
  correlation_type VARCHAR(30) NOT NULL,
  strength         VARCHAR(20) NOT NULL,
  direction        VARCHAR(20) NOT NULL DEFAULT 'unidirectional',
  description      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ri_unique_idx ON risk_interconnection(source_risk_id, target_risk_id);
CREATE INDEX IF NOT EXISTS ri_org_idx ON risk_interconnection(org_id);

-- ═══════════════════════════════════════════════════════════
-- emerging_risk
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS emerging_risk (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organization(id),
  title               VARCHAR(500) NOT NULL,
  description         TEXT,
  category            VARCHAR(50) NOT NULL,
  time_horizon        VARCHAR(10) NOT NULL,
  potential_impact    VARCHAR(20) NOT NULL,
  probability_trend   VARCHAR(20) NOT NULL,
  monitoring_triggers TEXT,
  responsible_id      UUID REFERENCES "user"(id),
  next_review_date    DATE,
  status              VARCHAR(20) NOT NULL DEFAULT 'monitoring',
  promoted_to_risk_id UUID REFERENCES risk(id),
  created_by          UUID REFERENCES "user"(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS er_org_idx ON emerging_risk(org_id);
CREATE INDEX IF NOT EXISTS er_status_idx ON emerging_risk(org_id, status);

-- ═══════════════════════════════════════════════════════════
-- risk_event + risk_event_lesson
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS risk_event (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES organization(id),
  risk_id                   UUID REFERENCES risk(id),
  title                     VARCHAR(500) NOT NULL,
  description               TEXT,
  event_date                DATE NOT NULL,
  event_type                VARCHAR(20) NOT NULL,
  actual_impact_eur         NUMERIC(15,2),
  actual_impact_qualitative VARCHAR(20),
  affected_entities         JSONB DEFAULT '[]',
  root_cause                TEXT,
  response_actions          TEXT,
  duration_days             INTEGER,
  category                  VARCHAR(50),
  created_by                UUID REFERENCES "user"(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rev_org_idx ON risk_event(org_id);
CREATE INDEX IF NOT EXISTS rev_risk_idx ON risk_event(risk_id);
CREATE INDEX IF NOT EXISTS rev_date_idx ON risk_event(org_id, event_date);

CREATE TABLE IF NOT EXISTS risk_event_lesson (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES risk_event(id) ON DELETE CASCADE,
  org_id            UUID NOT NULL REFERENCES organization(id),
  lesson            TEXT NOT NULL,
  category          VARCHAR(50),
  linked_risk_ids   JSONB DEFAULT '[]',
  linked_control_ids JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rel_event_idx ON risk_event_lesson(event_id);
CREATE INDEX IF NOT EXISTS rel_org_idx ON risk_event_lesson(org_id);

-- ═══════════════════════════════════════════════════════════
-- bowtie_template — Seed data table
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bowtie_template (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          JSONB NOT NULL,
  description   JSONB NOT NULL,
  risk_category VARCHAR(50) NOT NULL,
  template_data JSONB NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true
);

-- ═══════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════
ALTER TABLE bowtie_element ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_milestone ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_interconnection ENABLE ROW LEVEL SECURITY;
ALTER TABLE emerging_risk ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_event_lesson ENABLE ROW LEVEL SECURITY;

CREATE POLICY be_org_isolation ON bowtie_element USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY tm_org_isolation ON treatment_milestone USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY ri_org_isolation ON risk_interconnection USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY er_org_isolation ON emerging_risk USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY rev_org_isolation ON risk_event USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY rel_org_isolation ON risk_event_lesson USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Audit triggers
DROP TRIGGER IF EXISTS audit_bowtie_element ON bowtie_element;
CREATE TRIGGER audit_bowtie_element AFTER INSERT OR UPDATE OR DELETE ON bowtie_element FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_treatment_milestone ON treatment_milestone;
CREATE TRIGGER audit_treatment_milestone AFTER INSERT OR UPDATE OR DELETE ON treatment_milestone FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_risk_interconnection ON risk_interconnection;
CREATE TRIGGER audit_risk_interconnection AFTER INSERT OR UPDATE OR DELETE ON risk_interconnection FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_emerging_risk ON emerging_risk;
CREATE TRIGGER audit_emerging_risk AFTER INSERT OR UPDATE OR DELETE ON emerging_risk FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_risk_event ON risk_event;
CREATE TRIGGER audit_risk_event AFTER INSERT OR UPDATE OR DELETE ON risk_event FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_risk_event_lesson ON risk_event_lesson;
CREATE TRIGGER audit_risk_event_lesson AFTER INSERT OR UPDATE OR DELETE ON risk_event_lesson FOR EACH ROW EXECUTE FUNCTION audit_trigger();
