-- [ARCTOS-FULL-2026-08-31 / WP1 · S09-18] In-place repariert.
-- Diese Migration ist gegen eine leere Datenbank nie erfolgreich gelaufen
-- (Audit-Finding S09-01) und gilt nach ADR-014 als nicht ausgeliefert; die
-- Änderung an der bestehenden Datei ist daher zulässig.
-- Änderung: create_hypertable()-Block fuer usage_record entfernt (TS103 bei vorhandener TimescaleDB-Extension); Tabelle bleibt eine gewoehnliche Postgres-Tabelle.
-- Sprint 61: Usage Metering
-- Migration 923: Create usage_meter and usage_record tables

CREATE TABLE IF NOT EXISTS usage_meter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  unit VARCHAR(50) NOT NULL,
  aggregation_type VARCHAR(20) NOT NULL DEFAULT 'sum',
  reset_interval VARCHAR(20) NOT NULL DEFAULT 'monthly',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX usage_meter_active_idx ON usage_meter(is_active);

-- Seed meters
INSERT INTO usage_meter (key, name, unit, aggregation_type) VALUES
  ('api_calls', 'API Calls', 'requests', 'sum'),
  ('storage', 'Storage Used', 'bytes', 'max'),
  ('active_users', 'Active Users', 'users', 'max'),
  ('organizations', 'Organizations', 'orgs', 'max'),
  ('risks_created', 'Risks Created', 'entities', 'sum'),
  ('controls_created', 'Controls Created', 'entities', 'sum'),
  ('documents_stored', 'Documents Stored', 'files', 'sum'),
  ('plugin_executions', 'Plugin Executions', 'executions', 'sum'),
  ('report_generations', 'Report Generations', 'reports', 'sum'),
  ('ai_tokens', 'AI Token Usage', 'tokens', 'sum')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS usage_record (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  meter_id UUID NOT NULL REFERENCES usage_meter(id),
  quantity NUMERIC(18, 4) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX usage_record_org_idx ON usage_record(org_id);
CREATE INDEX usage_record_meter_idx ON usage_record(meter_id);
CREATE INDEX usage_record_period_idx ON usage_record(org_id, meter_id, period_start);

-- RLS
ALTER TABLE usage_record ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_record_org_isolation ON usage_record
  USING (org_id::text = current_setting('app.current_org_id', true));

-- [ARCTOS-FULL-2026-08-31 / S09-18] create_hypertable() entfernt.
-- Der DO-Guard prueft nur, ob die Extension vorhanden ist. Ist sie es —
-- und das Produktions-Image timescale/timescaledb:2.26.3-pg16 bringt sie
-- mit — scheitert der Aufruf mit
--   TS103 cannot create a unique index without the column "created_at"
--         (used in partitioning)
-- weil usage_record einen einspaltigen Primaerschluessel auf id hat. Die Datei
-- war damit ueberall dort gruen, wo TimescaleDB fehlt, und genau dann rot,
-- wenn jemand die Extension aktiviert.
--
-- Entscheidung (S09-18): Die TimescaleDB-Abhaengigkeit wird entfernt statt
-- den Primaerschluessel auf (id, created_at) umzustellen. Gruende:
--   * In keiner Umgebung existiert eine einzige Hypertable oder eine
--     anwendungsbezogene Retention-/Compression-Policy — es gibt nichts,
--     was hier weitergefuehrt wuerde.
--   * Der zusammengesetzte PK widerspraeche der pgTable-Definition
--     (id als alleiniger Primaerschluessel) und erzeugte genau den
--     Schema-Drift, den ADR-014 verhindern soll.
-- usage_record bleibt eine gewoehnliche Tabelle; der btree-Index auf created_at
-- deckt die Zeitbereichsabfragen ab. Eine spaetere Partitionierung gehoert
-- in eine eigene, bewusst geplante Migration mit PK-Wechsel.

