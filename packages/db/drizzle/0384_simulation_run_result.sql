-- Migration 0384: simulation_run_result nachziehen
--
-- Migration: 0384_simulation_run_result
-- Breaking: no
-- Estimated-Duration: 1
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP1 · S09-01] Auflösung des Zyklus zwischen
-- 0099_phase2_missing_tables.sql (erzeugt den Enum-Typ `simulation_status`)
-- und 0278_create_simulation_run.sql (erzeugt `simulation_run`, braucht den
-- Typ). 0099 legte zusätzlich `simulation_run_result` mit einem
-- Fremdschlüssel auf `simulation_run` an — eine Abhängigkeit in die andere
-- Richtung. Der Block läuft jetzt nach beiden Dateien.
-- Definition unverändert aus 0099 übernommen.

-- Spaltenbild exakt nach src/schema/simulation.ts (simulationRunResult) —
-- die Definition in 0099 wich davon ab (entity_type/entity_id/baseline_value/
-- simulated_value/delta_* statt metric_name/mean_value/…), was 10 der 48
-- Spalten-Drifts aus S09-09 erklaerte.
CREATE TABLE IF NOT EXISTS simulation_run_result (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organization(id),
  run_id          UUID NOT NULL REFERENCES simulation_run(id) ON DELETE CASCADE,
  metric_key      VARCHAR(200) NOT NULL,
  metric_name     VARCHAR(300) NOT NULL,
  mean_value      NUMERIC(20,6),
  median_value    NUMERIC(20,6),
  p5_value        NUMERIC(20,6),
  p95_value       NUMERIC(20,6),
  min_value       NUMERIC(20,6),
  max_value       NUMERIC(20,6),
  std_dev         NUMERIC(20,6),
  histogram_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  unit            VARCHAR(50),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sres_org_idx ON simulation_run_result(org_id);
CREATE INDEX IF NOT EXISTS sres_run_idx ON simulation_run_result(run_id);

ALTER TABLE simulation_run_result ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='simulation_run_result'
                 AND policyname='simulation_run_result_org_isolation') THEN
    CREATE POLICY simulation_run_result_org_isolation ON simulation_run_result
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
END $$;
