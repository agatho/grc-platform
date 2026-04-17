-- ADR-014 Phase 2 Retry: Die report_*-Tabellen blieben nach 0099 weiter
-- fehlend (report_template, report_generation_log, report_schedule), obwohl
-- die anderen 5 dieser Welle erfolgreich angelegt wurden.
--
-- Ursache (aus Pattern abgeleitet, da psql-stderr im Entrypoint gemutet ist):
-- Die drei Tabellen sind die einzigen, die die in 0099 neu geschriebenen
-- Enums (report_module_scope, report_generation_status, report_output_format)
-- verwenden. Wahrscheinlich existiert einer der Typen bereits aus einem
-- frueheren Migrationsversuch mit abweichendem Werte-Set -- der DO-Block
-- hat duplicate_object geschluckt, die CREATE TABLE stolpert dann ueber
-- einen Wert (z. B. 'all'), der im bestehenden Enum fehlt.
--
-- Defensive-by-design: ALTER TYPE ADD VALUE IF NOT EXISTS garantiert, dass
-- die Enums alle erwarteten Werte haben, auch wenn sie bereits existierten.
-- Danach CREATE TABLE IF NOT EXISTS wie in 0099.

-- ──────────────────────────────────────────────────────────────
-- Enum values absichern (ADD VALUE IF NOT EXISTS seit Postgres 9.6)
-- ──────────────────────────────────────────────────────────────

-- report_module_scope
DO $$ BEGIN CREATE TYPE report_module_scope AS ENUM ('erm'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE report_module_scope ADD VALUE IF NOT EXISTS 'erm';
ALTER TYPE report_module_scope ADD VALUE IF NOT EXISTS 'ics';
ALTER TYPE report_module_scope ADD VALUE IF NOT EXISTS 'isms';
ALTER TYPE report_module_scope ADD VALUE IF NOT EXISTS 'audit';
ALTER TYPE report_module_scope ADD VALUE IF NOT EXISTS 'dpms';
ALTER TYPE report_module_scope ADD VALUE IF NOT EXISTS 'esg';
ALTER TYPE report_module_scope ADD VALUE IF NOT EXISTS 'bcms';
ALTER TYPE report_module_scope ADD VALUE IF NOT EXISTS 'tprm';
ALTER TYPE report_module_scope ADD VALUE IF NOT EXISTS 'all';

-- report_generation_status
DO $$ BEGIN CREATE TYPE report_generation_status AS ENUM ('queued'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE report_generation_status ADD VALUE IF NOT EXISTS 'queued';
ALTER TYPE report_generation_status ADD VALUE IF NOT EXISTS 'generating';
ALTER TYPE report_generation_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE report_generation_status ADD VALUE IF NOT EXISTS 'failed';

-- report_output_format
DO $$ BEGIN CREATE TYPE report_output_format AS ENUM ('pdf'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE report_output_format ADD VALUE IF NOT EXISTS 'pdf';
ALTER TYPE report_output_format ADD VALUE IF NOT EXISTS 'xlsx';

-- ──────────────────────────────────────────────────────────────
-- Tabellen (wie in 0099, jetzt nach Enum-Check)
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
