-- Migration 0382: AI-Act — Fremdschlüssel ai_incident.gpai_model_id nachziehen
--
-- Migration: 0382_ai_act_fk_closure
-- Breaking: no
-- Estimated-Duration: 1
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP1 · S09-01] Auflösung der zirkulären
-- Abhängigkeit zwischen 0085_ai_act_complete.sql (erzeugt ai_system,
-- brauchte ai_gpai_model) und 0085a_ai_act_full_compliance.sql (erzeugt
-- ai_gpai_model, braucht ai_system). Der FK wird hier — nachdem beide
-- Tabellen existieren — additiv ergänzt.

DO $$
BEGIN
  IF to_regclass('public.ai_incident') IS NULL
     OR to_regclass('public.ai_gpai_model') IS NULL THEN
    RAISE NOTICE '0382: ai_incident/ai_gpai_model nicht vorhanden - FK uebersprungen';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_incident_gpai_model_id_fkey'
      AND conrelid = 'public.ai_incident'::regclass
  ) THEN
    ALTER TABLE ai_incident
      ADD CONSTRAINT ai_incident_gpai_model_id_fkey
      FOREIGN KEY (gpai_model_id) REFERENCES ai_gpai_model(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ai_incident_gpai_model_idx ON ai_incident(gpai_model_id);
