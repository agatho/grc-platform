-- Sprint 41: BCMS Advanced — Crisis Communication, Exercise Management, Recovery Procedures, Resilience Score
-- Migrations 566–588

-- ═══════════════════════════════════════════════════════════
-- crisis_contact_tree
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS crisis_contact_tree (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organization(id),
  name               VARCHAR(500) NOT NULL,
  crisis_type        VARCHAR(30) NOT NULL,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  last_reviewed_at   TIMESTAMPTZ,
  next_review_at     DATE,
  review_cycle_months INTEGER DEFAULT 6,
  created_by         UUID REFERENCES "user"(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cct_org_idx ON crisis_contact_tree(org_id);
CREATE INDEX IF NOT EXISTS cct_type_idx ON crisis_contact_tree(org_id, crisis_type);

-- ═══════════════════════════════════════════════════════════
-- crisis_contact_node
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS crisis_contact_node (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id            UUID NOT NULL REFERENCES crisis_contact_tree(id) ON DELETE CASCADE,
  parent_node_id     UUID,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  user_id            UUID REFERENCES "user"(id),
  role_title         VARCHAR(200) NOT NULL,
  name               VARCHAR(300),
  phone              VARCHAR(50),
  email              VARCHAR(255),
  escalation_minutes INTEGER NOT NULL DEFAULT 15,
  deputy_user_id     UUID REFERENCES "user"(id),
  deputy_name        VARCHAR(300),
  deputy_phone       VARCHAR(50),
  deputy_email       VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS ccn_tree_idx ON crisis_contact_node(tree_id);
CREATE INDEX IF NOT EXISTS ccn_parent_idx ON crisis_contact_node(parent_node_id);

-- ═══════════════════════════════════════════════════════════
-- crisis_communication_log (IMMUTABLE)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS crisis_communication_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organization(id),
  crisis_id            UUID NOT NULL,
  tree_id              UUID REFERENCES crisis_contact_tree(id),
  node_id              UUID REFERENCES crisis_contact_node(id),
  channel              VARCHAR(20) NOT NULL,
  message_template_key VARCHAR(100),
  message_content      TEXT NOT NULL,
  recipient_name       VARCHAR(300),
  recipient_contact    VARCHAR(255),
  sent_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at         TIMESTAMPTZ,
  acknowledged_at      TIMESTAMPTZ,
  escalated_at         TIMESTAMPTZ,
  escalated_to_node_id UUID REFERENCES crisis_contact_node(id),
  status               VARCHAR(20) NOT NULL DEFAULT 'sent',
  failure_reason       TEXT
);
CREATE INDEX IF NOT EXISTS ccl_crisis_idx ON crisis_communication_log(crisis_id);
CREATE INDEX IF NOT EXISTS ccl_org_idx ON crisis_communication_log(org_id);
CREATE INDEX IF NOT EXISTS ccl_sent_idx ON crisis_communication_log(crisis_id, sent_at);

-- Prevent updates on crisis_communication_log (immutable)
CREATE OR REPLACE FUNCTION prevent_ccl_update() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'crisis_communication_log is immutable — updates are not permitted';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS prevent_ccl_update ON crisis_communication_log;
CREATE TRIGGER prevent_ccl_update BEFORE UPDATE ON crisis_communication_log
  FOR EACH ROW EXECUTE FUNCTION prevent_ccl_update();

-- ═══════════════════════════════════════════════════════════
-- bc_exercise_scenario (shared templates, no org_id)
-- ═══════════════════════════════════════════════════════════
DO $$ BEGIN
  CREATE TYPE bc_exercise_type AS ENUM ('tabletop','walkthrough','functional','full_scale');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS bc_exercise_scenario (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           JSONB NOT NULL,
  description    JSONB NOT NULL,
  crisis_type    VARCHAR(30) NOT NULL,
  duration_hours INTEGER NOT NULL,
  difficulty     VARCHAR(20) NOT NULL,
  injects        JSONB NOT NULL,
  is_template    BOOLEAN NOT NULL DEFAULT true
);

-- ═══════════════════════════════════════════════════════════
-- bc_exercise
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bc_exercise (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      UUID NOT NULL REFERENCES organization(id),
  title                       VARCHAR(500) NOT NULL,
  description                 TEXT,
  exercise_type               bc_exercise_type NOT NULL,
  scenario_id                 UUID REFERENCES bc_exercise_scenario(id),
  custom_scenario_description TEXT,
  scope_bcp_ids               JSONB DEFAULT '[]',
  scope_team_ids              JSONB DEFAULT '[]',
  participant_ids             JSONB DEFAULT '[]',
  scheduled_date              DATE NOT NULL,
  actual_start                TIMESTAMPTZ,
  actual_end                  TIMESTAMPTZ,
  status                      VARCHAR(20) NOT NULL DEFAULT 'planned',
  objectives                  JSONB DEFAULT '[]',
  facilitator_id              UUID REFERENCES "user"(id),
  overall_score               INTEGER,
  created_by                  UUID REFERENCES "user"(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bce_org_idx ON bc_exercise(org_id);
CREATE INDEX IF NOT EXISTS bce_status_idx ON bc_exercise(org_id, status);
CREATE INDEX IF NOT EXISTS bce_date_idx ON bc_exercise(org_id, scheduled_date);

-- ═══════════════════════════════════════════════════════════
-- bc_exercise_inject_log
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bc_exercise_inject_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id   UUID NOT NULL REFERENCES bc_exercise(id) ON DELETE CASCADE,
  inject_index  INTEGER NOT NULL,
  triggered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  team_response TEXT,
  observer_notes TEXT,
  scores        JSONB DEFAULT '{}',
  responded_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS beil_exercise_idx ON bc_exercise_inject_log(exercise_id);

-- ═══════════════════════════════════════════════════════════
-- bc_exercise_lesson
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bc_exercise_lesson (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id        UUID NOT NULL REFERENCES bc_exercise(id) ON DELETE CASCADE,
  org_id             UUID NOT NULL REFERENCES organization(id),
  lesson             TEXT NOT NULL,
  category           VARCHAR(30),
  severity           VARCHAR(20) DEFAULT 'medium',
  improvement_action TEXT,
  action_owner_id    UUID REFERENCES "user"(id),
  action_deadline    DATE,
  task_id            UUID REFERENCES task(id),
  status             VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bel_exercise_idx ON bc_exercise_lesson(exercise_id);
CREATE INDEX IF NOT EXISTS bel_org_idx ON bc_exercise_lesson(org_id);

-- ═══════════════════════════════════════════════════════════
-- recovery_procedure + recovery_procedure_step
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS recovery_procedure (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      UUID NOT NULL REFERENCES organization(id),
  title                       VARCHAR(500) NOT NULL,
  description                 TEXT,
  entity_type                 VARCHAR(50) NOT NULL,
  entity_id                   UUID NOT NULL,
  version                     INTEGER NOT NULL DEFAULT 1,
  status                      VARCHAR(20) NOT NULL DEFAULT 'draft',
  review_cycle_months         INTEGER NOT NULL DEFAULT 6,
  next_review_date            DATE,
  approved_by                 UUID REFERENCES "user"(id),
  approved_at                 TIMESTAMPTZ,
  last_validated_at           TIMESTAMPTZ,
  last_validated_exercise_id  UUID REFERENCES bc_exercise(id),
  created_by                  UUID REFERENCES "user"(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rp_org_idx ON recovery_procedure(org_id);
CREATE INDEX IF NOT EXISTS rp_entity_idx ON recovery_procedure(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS rp_review_idx ON recovery_procedure(org_id, next_review_date);

CREATE TABLE IF NOT EXISTS recovery_procedure_step (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id               UUID NOT NULL REFERENCES recovery_procedure(id) ON DELETE CASCADE,
  sort_order                 INTEGER NOT NULL,
  title                      VARCHAR(500) NOT NULL,
  description                TEXT,
  responsible_role           VARCHAR(100),
  estimated_duration_minutes INTEGER,
  required_resources         TEXT,
  depends_on_step_id         UUID,
  is_completed               BOOLEAN NOT NULL DEFAULT false,
  completed_at               TIMESTAMPTZ,
  actual_duration_minutes    INTEGER,
  execution_notes            TEXT
);
CREATE INDEX IF NOT EXISTS rps_procedure_idx ON recovery_procedure_step(procedure_id);

-- ═══════════════════════════════════════════════════════════
-- resilience_score_snapshot
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS resilience_score_snapshot (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   UUID NOT NULL REFERENCES organization(id),
  overall_score            INTEGER NOT NULL,
  bia_completeness         INTEGER NOT NULL,
  bcp_currency             INTEGER NOT NULL,
  exercise_completion      INTEGER NOT NULL,
  recover_capability       INTEGER NOT NULL,
  communication_readiness  INTEGER NOT NULL,
  procedure_completeness   INTEGER NOT NULL,
  supply_chain_resilience  INTEGER NOT NULL,
  snapshot_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rss_org_idx ON resilience_score_snapshot(org_id, snapshot_at);

-- ═══════════════════════════════════════════════════════════
-- RLS (all except bc_exercise_scenario which is shared)
-- ═══════════════════════════════════════════════════════════
ALTER TABLE crisis_contact_tree ENABLE ROW LEVEL SECURITY;
ALTER TABLE crisis_communication_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE bc_exercise ENABLE ROW LEVEL SECURITY;
ALTER TABLE bc_exercise_lesson ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_procedure ENABLE ROW LEVEL SECURITY;
ALTER TABLE resilience_score_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY cct_org_isolation ON crisis_contact_tree USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY ccl_org_isolation ON crisis_communication_log USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY bce_org_isolation ON bc_exercise USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY bel_org_isolation ON bc_exercise_lesson USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY rp_org_isolation ON recovery_procedure USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY rss_org_isolation ON resilience_score_snapshot USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Audit triggers (on all mutable tables)
DROP TRIGGER IF EXISTS audit_crisis_contact_tree ON crisis_contact_tree;
CREATE TRIGGER audit_crisis_contact_tree AFTER INSERT OR UPDATE OR DELETE ON crisis_contact_tree FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_crisis_contact_node ON crisis_contact_node;
CREATE TRIGGER audit_crisis_contact_node AFTER INSERT OR UPDATE OR DELETE ON crisis_contact_node FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_bc_exercise ON bc_exercise;
CREATE TRIGGER audit_bc_exercise AFTER INSERT OR UPDATE OR DELETE ON bc_exercise FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_bc_exercise_inject_log ON bc_exercise_inject_log;
CREATE TRIGGER audit_bc_exercise_inject_log AFTER INSERT OR DELETE ON bc_exercise_inject_log FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_bc_exercise_lesson ON bc_exercise_lesson;
CREATE TRIGGER audit_bc_exercise_lesson AFTER INSERT OR UPDATE OR DELETE ON bc_exercise_lesson FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_recovery_procedure ON recovery_procedure;
CREATE TRIGGER audit_recovery_procedure AFTER INSERT OR UPDATE OR DELETE ON recovery_procedure FOR EACH ROW EXECUTE FUNCTION audit_trigger();
DROP TRIGGER IF EXISTS audit_recovery_procedure_step ON recovery_procedure_step;
CREATE TRIGGER audit_recovery_procedure_step AFTER INSERT OR UPDATE OR DELETE ON recovery_procedure_step FOR EACH ROW EXECUTE FUNCTION audit_trigger();
-- crisis_communication_log: INSERT-only audit
DROP TRIGGER IF EXISTS audit_crisis_communication_log ON crisis_communication_log;
CREATE TRIGGER audit_crisis_communication_log AFTER INSERT ON crisis_communication_log FOR EACH ROW EXECUTE FUNCTION audit_trigger();
