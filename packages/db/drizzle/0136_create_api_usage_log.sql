-- [ARCTOS-FULL-2026-08-31 / WP1 · S09-18] In-place repariert.
-- Diese Migration ist gegen eine leere Datenbank nie erfolgreich gelaufen
-- (Audit-Finding S09-01) und gilt nach ADR-014 als nicht ausgeliefert; die
-- Änderung an der bestehenden Datei ist daher zulässig.
-- Änderung: create_hypertable()-Block fuer api_usage_log entfernt (TS103 bei vorhandener TimescaleDB-Extension); Tabelle bleibt eine gewoehnliche Postgres-Tabelle.
-- Sprint 57: API Usage Tracking
-- Migration 893: Create api_usage_log table

CREATE TABLE IF NOT EXISTS api_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  api_key_id UUID REFERENCES api_key(id),
  method VARCHAR(10) NOT NULL,
  path VARCHAR(500) NOT NULL,
  status_code INT NOT NULL,
  response_time_ms INT,
  request_size INT,
  response_size INT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  error_code VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX api_usage_org_idx ON api_usage_log(org_id);
CREATE INDEX api_usage_key_idx ON api_usage_log(api_key_id);
CREATE INDEX api_usage_created_idx ON api_usage_log(created_at);
CREATE INDEX api_usage_path_idx ON api_usage_log(org_id, path);

-- RLS
ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_usage_log_org_isolation ON api_usage_log
  USING (org_id::text = current_setting('app.current_org_id', true));

-- [ARCTOS-FULL-2026-08-31 / S09-18] create_hypertable() entfernt.
-- Der DO-Guard prueft nur, ob die Extension vorhanden ist. Ist sie es —
-- und das Produktions-Image timescale/timescaledb:2.26.3-pg16 bringt sie
-- mit — scheitert der Aufruf mit
--   TS103 cannot create a unique index without the column "created_at"
--         (used in partitioning)
-- weil api_usage_log einen einspaltigen Primaerschluessel auf id hat. Die Datei
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
-- api_usage_log bleibt eine gewoehnliche Tabelle; der btree-Index auf created_at
-- deckt die Zeitbereichsabfragen ab. Eine spaetere Partitionierung gehoert
-- in eine eigene, bewusst geplante Migration mit PK-Wechsel.

