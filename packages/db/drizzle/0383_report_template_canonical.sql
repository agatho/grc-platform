-- Migration 0383: report_template auf genau eine kanonische Gestalt bringen
--
-- Migration: 0383_report_template_canonical
-- Breaking: yes-breaking
-- Estimated-Duration: 2
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP1 · S09-16 / S09-02]
-- Vier Migrationen legen `report_template` per CREATE TABLE IF NOT EXISTS in
-- vier verschiedenen Gestalten an (0042, 0081, 0099, 0100 — plus 0101 als
-- fuenfter Reparaturversuch). `IF NOT EXISTS` prueft nur die Existenz, also
-- gewann bisher die zufaellig erste erfolgreiche Datei; CI und migrate-all
-- erhielten dadurch zwei disjunkte Spaltenmengen derselben Tabelle
-- (evidence/S09-schema-drift-ci-vs-migrateall.txt).
--
-- Kanonisch ist die Gestalt von `src/schema/reporting.ts` (reportTemplate).
-- Diese Migration stellt sie unabhaengig davon her, welche Definition in
-- einer bereits deployten Datenbank gewonnen hat:
--   1. fehlende kanonische Spalten additiv ergaenzen,
--   2. die Uebergangsspalte `category` und ihren Index entfernen,
--   3. die Legacy-Spalten der 0081-Gestalt entfernen, falls vorhanden,
--   4. die kanonischen Indizes sicherstellen.
--
-- Breaking: Schritt 2/3 entfernen Spalten. Auf einer frischen Datenbank ist
-- die Tabelle leer. Auf einer bereits deployten Datenbank ist vor dem Deploy
-- `deploy/db-backup.sh --pre-breaking-0383` zu fahren (ADR-023 §2).

DO $$
DECLARE
  legacy text;
BEGIN
  IF to_regclass('public.report_template') IS NULL THEN
    RAISE NOTICE '0383: report_template nicht vorhanden - uebersprungen';
    RETURN;
  END IF;

  -- 1. Kanonische Spalten sicherstellen -------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_module_scope') THEN
    CREATE TYPE report_module_scope AS ENUM
      ('erm','ics','isms','audit','dpms','esg','bcms','tprm','all');
  END IF;

  ALTER TABLE report_template
    ADD COLUMN IF NOT EXISTS module_scope report_module_scope NOT NULL DEFAULT 'all';
  ALTER TABLE report_template
    ADD COLUMN IF NOT EXISTS sections_json JSONB NOT NULL DEFAULT '[]'::jsonb;
  ALTER TABLE report_template
    ADD COLUMN IF NOT EXISTS parameters_json JSONB NOT NULL DEFAULT '[]'::jsonb;
  ALTER TABLE report_template ADD COLUMN IF NOT EXISTS branding_json JSONB;
  ALTER TABLE report_template
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE report_template
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  ALTER TABLE report_template ADD COLUMN IF NOT EXISTS created_by UUID;

  -- 2./3. Uebergangs- und Legacy-Spalten entfernen ---------------------
  DROP INDEX IF EXISTS rt_category_idx;
  FOREACH legacy IN ARRAY ARRAY[
    'category','framework','content_schema','sections','placeholders',
    'output_format','language','is_system','is_active','version'
  ]::text[] LOOP
    EXECUTE format('ALTER TABLE report_template DROP COLUMN IF EXISTS %I', legacy);
  END LOOP;

  -- org_id ist in der kanonischen Gestalt NOT NULL; die 0081-Gestalt liess
  -- sie zu. Nur verschaerfen, wenn keine Zeile das verletzt.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'report_template'
      AND column_name = 'org_id' AND is_nullable = 'YES'
  ) AND NOT EXISTS (SELECT 1 FROM report_template WHERE org_id IS NULL) THEN
    ALTER TABLE report_template ALTER COLUMN org_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS rt_org_idx ON report_template(org_id);
CREATE INDEX IF NOT EXISTS rt_scope_idx ON report_template(org_id, module_scope);
