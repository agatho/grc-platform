-- ============================================================================
-- Programme Cockpit — Subtasks und polymorphe Step-Verknüpfungen
--
-- Erweiterungen für granulare Projektplan-Ausführung:
--   - programme_template_subtask  : Vorlage-Subtasks pro Template-Schritt
--   - programme_journey_subtask   : Instanz-Subtasks pro Journey-Schritt
--   - programme_step_link         : Polymorphe Verknüpfungen vom Schritt
--                                    zu Risiken, Kontrollen, Dokumenten,
--                                    Maßnahmen, Findings, Assets, etc.
--
-- Bezug: ISO/IEC 27001:2022 Einführungsplan, granulare Tasks und
--        Cross-Modul-Verknüpfungen.
-- ============================================================================

-- ── Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE programme_subtask_status AS ENUM (
    'pending', 'in_progress', 'completed', 'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE programme_link_kind AS ENUM (
    'risk',
    'control',
    'document',
    'asset',
    'incident',
    'treatment',
    'finding',
    'process',
    'work_item',
    'catalog_entry',
    'url'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE programme_link_type AS ENUM (
    'related',
    'mitigates',
    'evidences',
    'deliverable',
    'reference'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── programme_template_subtask ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS programme_template_subtask (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_step_id      uuid NOT NULL REFERENCES programme_template_step(id) ON DELETE CASCADE,
  sequence              integer NOT NULL,
  title                 varchar(300) NOT NULL,
  description           text,
  default_owner_role    varchar(50),
  default_duration_days integer NOT NULL DEFAULT 1,
  deliverable_type      varchar(80),
  is_mandatory          boolean NOT NULL DEFAULT true,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS programme_template_subtask_step_idx
  ON programme_template_subtask(template_step_id, sequence);

-- ── programme_journey_subtask ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS programme_journey_subtask (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organization(id),
  journey_step_id     uuid NOT NULL REFERENCES programme_journey_step(id) ON DELETE CASCADE,
  template_subtask_id uuid REFERENCES programme_template_subtask(id),
  sequence            integer NOT NULL,
  title               varchar(300) NOT NULL,
  description         text,
  status              programme_subtask_status NOT NULL DEFAULT 'pending',
  owner_id            uuid REFERENCES "user"(id),
  due_date            date,
  started_at          timestamptz,
  completed_at        timestamptz,
  completion_notes    text,
  is_mandatory        boolean NOT NULL DEFAULT true,
  deliverable_type    varchar(80),
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid REFERENCES "user"(id)
);

CREATE INDEX IF NOT EXISTS programme_journey_subtask_step_idx
  ON programme_journey_subtask(journey_step_id, sequence);
CREATE INDEX IF NOT EXISTS programme_journey_subtask_owner_idx
  ON programme_journey_subtask(owner_id, status);
CREATE INDEX IF NOT EXISTS programme_journey_subtask_org_idx
  ON programme_journey_subtask(org_id);

ALTER TABLE programme_journey_subtask ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_programme_journey_subtask ON programme_journey_subtask;
CREATE POLICY rls_programme_journey_subtask ON programme_journey_subtask
  USING (org_id::text = current_setting('app.current_org_id', true));

DROP TRIGGER IF EXISTS audit_programme_journey_subtask ON programme_journey_subtask;
CREATE TRIGGER audit_programme_journey_subtask
  AFTER INSERT OR UPDATE OR DELETE ON programme_journey_subtask
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ── programme_step_link ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS programme_step_link (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organization(id),
  journey_step_id uuid NOT NULL REFERENCES programme_journey_step(id) ON DELETE CASCADE,
  target_kind     programme_link_kind NOT NULL,
  target_id       uuid,
  target_label    varchar(300) NOT NULL,
  target_url      varchar(1000),
  link_type       programme_link_type NOT NULL DEFAULT 'related',
  notes           text,
  created_by      uuid REFERENCES "user"(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS programme_step_link_step_idx
  ON programme_step_link(journey_step_id);
CREATE INDEX IF NOT EXISTS programme_step_link_org_idx
  ON programme_step_link(org_id);
CREATE INDEX IF NOT EXISTS programme_step_link_target_idx
  ON programme_step_link(target_kind, target_id);

ALTER TABLE programme_step_link ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_programme_step_link ON programme_step_link;
CREATE POLICY rls_programme_step_link ON programme_step_link
  USING (org_id::text = current_setting('app.current_org_id', true));

DROP TRIGGER IF EXISTS audit_programme_step_link ON programme_step_link;
CREATE TRIGGER audit_programme_step_link
  AFTER INSERT OR UPDATE OR DELETE ON programme_step_link
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
