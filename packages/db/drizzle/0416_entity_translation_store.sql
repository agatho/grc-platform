-- Migration 0416: Übersetzungen in einer eigenen Tabelle statt im Stammdatenfeld
--
-- Migration: 0416_entity_translation_store
-- Breaking: no
-- Estimated-Duration: 10
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP6 · S05-04 (High, Datenverlust), S05-18, S05-19]
--
-- ==========================================================================
-- DER DEFEKT
-- ==========================================================================
-- `POST /api/v1/translations/ai-translate` und `PUT /api/v1/translations/
-- :entityType/:entityId` schrieben beide ein JSONB-Objekt in die
-- FACHSPALTE:
--
--     UPDATE "control" SET "title" = '{"en":"…"}'::jsonb WHERE …
--
-- Alle zehn adressierten Spalten sind `varchar`/`text` (gegen
-- `information_schema.columns` geprüft, keine ist `jsonb`). Postgres
-- castet im Assignment-Kontext still, und `mergeTranslation()` bekam
-- einen String statt eines Objekts, verwarf ihn (`base = {}`) und legte
-- nur die Übersetzung hinein. Ergebnis: der deutsche Originaltitel eines
-- Risikos, einer Kontrolle, einer Feststellung oder eines
-- Sicherheitsvorfalls war nach einem einzigen regulären Klick weg, und in
-- jeder Liste stand der JSON-Blob.
--
-- ==========================================================================
-- DIE ENTSCHEIDUNG
-- ==========================================================================
-- Zwei Wege wären denkbar gewesen:
--
--  (a) Die zehn Fachspalten auf `jsonb` migrieren. Verworfen: sie werden
--      von ~1.300 Routen, allen Exporten, allen Reports und den
--      Drizzle-Schemata als String gelesen. Der Typwechsel wäre ein
--      Umbau des halben Produkts und würde denselben Defekt nur
--      verschieben — der Originaltext bliebe in derselben Zelle wie die
--      Übersetzung und damit gemeinsam überschreibbar.
--
--  (b) Übersetzungen als eigene Zeilen führen. Gewählt. Die Fachspalte
--      bleibt der Originaltext und wird vom Übersetzungspfad NIE
--      geschrieben. Ein Datenverlust durch Übersetzen ist damit
--      strukturell ausgeschlossen, nicht bloss abgefangen.
--
-- `source_value` hält zusätzlich den Text, AUS DEM übersetzt wurde. Damit
-- ist erkennbar, ob eine Übersetzung veraltet ist, ohne den Audit-Trail
-- zu durchsuchen — und der Original­text existiert selbst dann noch, wenn
-- die Fachspalte später fachlich geändert wird.
--
-- ==========================================================================
-- S05-19 (latenter Cross-Tenant-Write) fällt hierdurch ebenfalls weg
-- ==========================================================================
-- Die alte Implementierung schaltete für `risk_catalog_entry` und
-- `control_catalog_entry` — global, ohne `org_id`, ohne RLS — den
-- Org-Filter AB und schrieb die KI-Ausgabe in den mandantenübergreifend
-- genutzten Katalogtext. Der Pfad war nur durch einen Schema-Drift
-- blockiert (`column "title" does not exist`) und wäre bei dessen
-- Behebung aufgerissen. In dieser Tabelle trägt JEDE Zeile eine
-- `org_id` — auch die zu Katalogeinträgen. Ein Mandant übersetzt den
-- Katalog damit für sich, nicht für alle.
--
-- ==========================================================================

CREATE TABLE IF NOT EXISTS entity_translation (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organization(id),
  entity_type     varchar(64) NOT NULL,
  entity_id       uuid        NOT NULL,
  field           varchar(64) NOT NULL,
  language        varchar(8)  NOT NULL,
  -- Die Übersetzung. Roher Text — HTML-Escaping gehört an die Ausgabe,
  -- nicht in den Bestand (S05-18).
  value           text        NOT NULL,
  source_language varchar(8)  NOT NULL,
  -- Der Text, aus dem übersetzt wurde. Nie NULL: ohne ihn wäre nicht
  -- feststellbar, worauf sich die Übersetzung bezieht.
  source_value    text        NOT NULL,
  source_hash     varchar(64) NOT NULL,
  -- 'manual' | 'ai'
  method          varchar(32) NOT NULL DEFAULT 'manual',
  -- 'draft_translation' | 'verified'
  status          varchar(32) NOT NULL DEFAULT 'draft_translation',
  provider        varchar(32),
  model           varchar(120),
  created_by      uuid REFERENCES "user"(id),
  updated_by      uuid REFERENCES "user"(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entity_translation_unique
    UNIQUE (org_id, entity_type, entity_id, field, language)
);

CREATE INDEX IF NOT EXISTS entity_translation_lookup_idx
  ON entity_translation (org_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS entity_translation_org_idx
  ON entity_translation (org_id);

-- RLS in der 0397-Normalform (NULLIF-Guard, ENABLE + FORCE, je Kommando
-- eine Policy mit USING und WITH CHECK).
DO $$
DECLARE
  pred constant text :=
    '(org_id = (NULLIF(current_setting(''app.current_org_id'', true), ''''))::uuid)';
BEGIN
  ALTER TABLE public.entity_translation ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.entity_translation FORCE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS entity_translation_tenant_select ON public.entity_translation;
  DROP POLICY IF EXISTS entity_translation_tenant_insert ON public.entity_translation;
  DROP POLICY IF EXISTS entity_translation_tenant_update ON public.entity_translation;
  DROP POLICY IF EXISTS entity_translation_tenant_delete ON public.entity_translation;

  EXECUTE format('CREATE POLICY entity_translation_tenant_select ON public.entity_translation FOR SELECT USING %s', pred);
  EXECUTE format('CREATE POLICY entity_translation_tenant_insert ON public.entity_translation FOR INSERT WITH CHECK %s', pred);
  EXECUTE format('CREATE POLICY entity_translation_tenant_update ON public.entity_translation FOR UPDATE USING %s WITH CHECK %s', pred, pred);
  EXECUTE format('CREATE POLICY entity_translation_tenant_delete ON public.entity_translation FOR DELETE USING %s', pred);
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_translation TO grc_app;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.audit_trigger()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS entity_translation_audit_trigger ON public.entity_translation;
    CREATE TRIGGER entity_translation_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON public.entity_translation
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;

-- ==========================================================================
-- Rückholung bereits zerstörter Felder
-- ==========================================================================
-- Wo der alte Code schon zugeschlagen hat, steht in der `varchar`-Spalte
-- ein JSON-Objekt wie `{"en": "AI translated title"}`. Der deutsche
-- Originaltext ist dort nicht mehr enthalten — er ist nur noch im
-- Audit-Log. Diese Migration kann ihn nicht zurückholen (das wäre ein
-- Eingriff in die Hash-Kette und braucht eine fachliche Entscheidung je
-- Datensatz), aber sie macht die betroffenen Zeilen auffindbar, statt sie
-- stumm liegen zu lassen.
CREATE OR REPLACE VIEW entity_translation_corruption_candidates
WITH (security_invoker = true) AS
  SELECT 'risk'::text AS entity_type, id, org_id, title AS corrupted_value
    FROM risk    WHERE title ~ '^\s*\{.*\}\s*$'
  UNION ALL
  SELECT 'control', id, org_id, title FROM control WHERE title ~ '^\s*\{.*\}\s*$'
  UNION ALL
  SELECT 'process', id, org_id, name  FROM process WHERE name  ~ '^\s*\{.*\}\s*$'
  UNION ALL
  SELECT 'document', id, org_id, title FROM document WHERE title ~ '^\s*\{.*\}\s*$'
  UNION ALL
  SELECT 'finding', id, org_id, title FROM finding WHERE title ~ '^\s*\{.*\}\s*$'
  UNION ALL
  SELECT 'security_incident', id, org_id, title FROM security_incident WHERE title ~ '^\s*\{.*\}\s*$';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT SELECT ON public.entity_translation_corruption_candidates TO grc_app;
  END IF;
END $$;
