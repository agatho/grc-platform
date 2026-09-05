-- Migration 0385: Schema-Drift zwischen Drizzle-Schema und Datenbank schließen
--
-- Migration: 0385_schema_drift_closure
-- Breaking: yes-backfill
-- Estimated-Duration: 5
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP1 · S09-09 / S09-02]
-- Nachdem alle Migrationen wieder von Null durchlaufen, bleiben 37 Stellen,
-- an denen die reale Tabelle von der `pgTable`-Deklaration abweicht. Nach
-- ADR-014 ist das Drizzle-Schema die Quelle der Wahrheit, also wird die
-- Datenbank daran angeglichen. Zwei Klassen:
--
--   a) NOT-NULL-Zusagen, die der Code gibt und die Datenbank nicht hält.
--      Ein Lesevorgang liefert dort `null` in ein als non-nullable typisiertes
--      Feld — der TypeScript-Typ lügt. Verschärft wird nur, wenn keine Zeile
--      das verletzt; sonst bleibt die Spalte nullable und die Migration
--      protokolliert das, statt den Deploy zu blockieren.
--
--   b) Typabweichungen, bei denen die Datenbank falsch liegt:
--      ai_fria.{discrimination_risk,data_protection_impact,access_to_justice}
--      sind im Code jsonb, in der DB varchar (die strukturierte Bewertung
--      würde als Text abgelegt); ai_fria.mitigation_measures umgekehrt;
--      isms_nonconformity.tags / isms_corrective_action.tags sind im Code
--      jsonb, in der DB text[]; organization.country_code ist bpchar statt
--      varchar (bpchar füllt mit Leerzeichen auf und bricht Gleichheits-
--      vergleiche gegen 'DE').
--
-- NICHT angeglichen werden fünf Spalten, bei denen die DATENBANK strenger ist
-- als der Code — dort wäre eine Angleichung ein Rückschritt. Sie stehen als
-- begründete Ausnahmen in packages/db/tests/schema-drift.ts
-- (ACCEPTED_TYPE_DRIFT) und gehören inhaltlich in andere Arbeitspakete:
--   * {audit,process,vendor}_sign_off.ip_address  inet  vs varchar (WP7/S06-03)
--   * catalog_entry_mapping.{relationship,mapping_source}  Enum vs varchar

DO $$
DECLARE
  rec RECORD;
  target CONSTANT TEXT[][] := ARRAY[
    ['grc_budget','budget_type'],
    ['risk_prediction','model_id'],
    ['risk_prediction','entity_type'],
    ['risk_prediction','entity_id'],
    ['risk_prediction','prediction_type'],
    ['risk_prediction','predicted_value'],
    ['risk_prediction','confidence'],
    ['risk_prediction','early_warning'],
    ['risk_prediction','is_active'],
    ['risk_prediction','created_at'],
    ['risk_prediction_model','name'],
    ['risk_prediction_model','model_type'],
    ['risk_prediction_model','target_metric'],
    ['risk_prediction_model','input_features'],
    ['risk_prediction_model','training_samples'],
    ['risk_prediction_model','status'],
    ['risk_prediction_model','is_active'],
    ['risk_prediction_model','created_at'],
    ['risk_prediction_model','updated_at'],
    ['ai_conformity_assessment','assessment_code'],
    ['ai_framework_mapping','control_title'],
    ['ai_fria','assessment_code'],
    ['ai_fria','overall_impact'],
    ['ai_transparency_entry','title'],
    ['ai_transparency_entry','content']
  ];
  i INT;
  tbl TEXT;
  col TEXT;
  nulls BIGINT;
BEGIN
  FOR i IN 1 .. array_length(target, 1) LOOP
    tbl := target[i][1];
    col := target[i][2];

    IF to_regclass('public.' || tbl) IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl
        AND column_name = col AND is_nullable = 'YES'
    ) THEN
      CONTINUE;  -- bereits NOT NULL
    END IF;

    EXECUTE format('SELECT count(*) FROM %I WHERE %I IS NULL', tbl, col) INTO nulls;
    IF nulls > 0 THEN
      RAISE WARNING '0385: %.% keeps NULL (% rows violate the declared NOT NULL) — fix the data, then re-run this migration', tbl, col, nulls;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET NOT NULL', tbl, col);
  END LOOP;
END $$;

-- ── b) Typabweichungen ────────────────────────────────────────────────
DO $$
BEGIN
  -- organization.country_code: bpchar -> varchar(2)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='organization'
      AND column_name='country_code' AND udt_name='bpchar'
  ) THEN
    ALTER TABLE organization
      ALTER COLUMN country_code TYPE VARCHAR(2) USING btrim(country_code);
  END IF;

  -- ai_fria: drei Bewertungsfelder varchar -> jsonb
  IF to_regclass('public.ai_fria') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='ai_fria'
                 AND column_name='discrimination_risk' AND udt_name <> 'jsonb') THEN
      ALTER TABLE ai_fria ALTER COLUMN discrimination_risk TYPE JSONB
        USING CASE WHEN discrimination_risk IS NULL THEN NULL
                   ELSE to_jsonb(discrimination_risk) END;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='ai_fria'
                 AND column_name='data_protection_impact' AND udt_name <> 'jsonb') THEN
      ALTER TABLE ai_fria ALTER COLUMN data_protection_impact TYPE JSONB
        USING CASE WHEN data_protection_impact IS NULL THEN NULL
                   ELSE to_jsonb(data_protection_impact) END;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='ai_fria'
                 AND column_name='access_to_justice' AND udt_name <> 'jsonb') THEN
      ALTER TABLE ai_fria ALTER COLUMN access_to_justice TYPE JSONB
        USING CASE WHEN access_to_justice IS NULL THEN NULL
                   ELSE to_jsonb(access_to_justice) END;
    END IF;
    -- umgekehrte Richtung: mitigation_measures ist im Code Freitext
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='ai_fria'
                 AND column_name='mitigation_measures' AND udt_name = 'jsonb') THEN
      ALTER TABLE ai_fria ALTER COLUMN mitigation_measures TYPE TEXT
        USING CASE WHEN mitigation_measures IS NULL THEN NULL
                   WHEN jsonb_typeof(mitigation_measures) = 'string'
                     THEN mitigation_measures #>> '{}'
                   ELSE mitigation_measures::text END;
    END IF;
  END IF;

  -- isms_*.tags: text[] -> jsonb
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='isms_nonconformity'
               AND column_name='tags' AND udt_name = '_text') THEN
    ALTER TABLE isms_nonconformity ALTER COLUMN tags DROP DEFAULT;
    ALTER TABLE isms_nonconformity ALTER COLUMN tags TYPE JSONB USING to_jsonb(tags);
    ALTER TABLE isms_nonconformity ALTER COLUMN tags SET DEFAULT '[]'::jsonb;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='isms_corrective_action'
               AND column_name='tags' AND udt_name = '_text') THEN
    ALTER TABLE isms_corrective_action ALTER COLUMN tags DROP DEFAULT;
    ALTER TABLE isms_corrective_action ALTER COLUMN tags TYPE JSONB USING to_jsonb(tags);
    ALTER TABLE isms_corrective_action ALTER COLUMN tags SET DEFAULT '[]'::jsonb;
  END IF;
END $$;
