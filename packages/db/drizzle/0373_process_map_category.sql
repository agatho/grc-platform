-- Migration 0373: Grafische Prozesslandkarte — Wertschöpfungsketten-
-- Kategorisierung auf process.
--
-- process.map_category: welches Band der Prozesslandkarte ein Prozess
-- belegt (Management- / Kern- / Supportprozess). Nullable — Prozesse
-- ohne Kategorie erben in der Landkarte das Band ihres Parents bzw.
-- landen auf Root-Ebene im "Nicht zugeordnet"-Streifen.
-- Idempotent (ADD COLUMN IF NOT EXISTS pattern, cf. 0363).

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'process_map_category'
  ) THEN
    CREATE TYPE process_map_category AS ENUM (
      'management',
      'core',
      'support'
    );
  END IF;
END$$;

ALTER TABLE process
  ADD COLUMN IF NOT EXISTS map_category process_map_category;

CREATE INDEX IF NOT EXISTS process_map_category_idx
  ON process(org_id, map_category);

COMMIT;
