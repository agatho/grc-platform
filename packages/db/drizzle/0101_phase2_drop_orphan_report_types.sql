-- Phase 2 Second Retry: Orphan-Types entfernen.
--
-- Befund aus manuellem psql-Run nach 0100:
--   ERROR: type "report_template" already exists
--   HINT:  A relation has an associated type of the same name, so you must
--          use a name that doesn't conflict with any existing type.
--
-- Heisst: Ein pg_type-Eintrag namens "report_template" existiert, aber
-- keine Tabelle dazu (der drift-Endpoint listete sie als missingInDb).
-- Verwaist durch eine fruehere abgebrochene Migration.
--
-- Loesung: DROP TYPE CASCADE nur wenn kein relation-Eintrag existiert
-- (also wirklich orphaned). Wenn eine Tabelle mit dem Namen da waere,
-- wuerde CASCADE sie droppen -- das wollen wir auf keinen Fall, deshalb
-- der explizite pg_class-Check im DO-Block.

DO $$
DECLARE
  tname text;
  table_exists boolean;
BEGIN
  FOREACH tname IN ARRAY ARRAY['report_template','report_generation_log','report_schedule']::text[]
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM pg_class
      WHERE relname = tname AND relkind IN ('r','p')
    ) INTO table_exists;

    IF NOT table_exists THEN
      EXECUTE format('DROP TYPE IF EXISTS %I CASCADE', tname);
      RAISE NOTICE 'Dropped orphan type %', tname;
    ELSE
      RAISE NOTICE 'Table % exists, leaving associated type alone', tname;
    END IF;
  END LOOP;
END $$;

-- ──────────────────────────────────────────────────────────────
-- Tabellen (Enums + Werte existieren bereits aus 0099/0100)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_template (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organization(id),
  name             VARCHAR(500) NOT NULL,
  description      TEXT,
  module_scope     report_module_scope NOT NULL DEFAULT 'all',
  sections_json    JSONB NOT NULL DEFAULT '[]'::jsonb,
  parameters_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  branding_json    JSONB,
  is_default       BOOLEAN NOT NULL DEFAULT false,
  created_by       UUID REFERENCES "user"(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rt_org_idx ON report_template(org_id);
CREATE INDEX IF NOT EXISTS rt_scope_idx ON report_template(org_id, module_scope);

CREATE TABLE IF NOT EXISTS report_generation_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organization(id),
  template_id         UUID NOT NULL REFERENCES report_template(id),
  status              report_generation_status NOT NULL DEFAULT 'queued',
  parameters_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_format       report_output_format NOT NULL DEFAULT 'pdf',
  file_path           VARCHAR(1000),
  file_size           INT,
  generation_time_ms  INT,
  error               TEXT,
  generated_by        UUID REFERENCES "user"(id),
  schedule_id         UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS rgl_org_idx ON report_generation_log(org_id);
CREATE INDEX IF NOT EXISTS rgl_status_idx ON report_generation_log(org_id, status);
CREATE INDEX IF NOT EXISTS rgl_template_idx ON report_generation_log(template_id);

CREATE TABLE IF NOT EXISTS report_schedule (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organization(id),
  template_id       UUID NOT NULL REFERENCES report_template(id),
  name              VARCHAR(500),
  cron_expression   VARCHAR(100) NOT NULL,
  parameters_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipient_emails  JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_format     report_output_format NOT NULL DEFAULT 'pdf',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  last_run_at       TIMESTAMPTZ,
  next_run_at       TIMESTAMPTZ,
  created_by        UUID REFERENCES "user"(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rsched_org_idx ON report_schedule(org_id);
CREATE INDEX IF NOT EXISTS rs_next_run_idx ON report_schedule(is_active, next_run_at);
