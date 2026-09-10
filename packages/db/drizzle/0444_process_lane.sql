-- 0444_process_lane.sql
--
-- Migration: 0444_process_lane
-- Breaking: no
-- Estimated-Duration: 5
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [STUFE2-E · Schema fuer die zehn leeren GRC-Layer,
--  docs/bpmn-engine/STUFE2-E-SCHEMA.md; Bedarf: STUFE2-A2-GRC.md §5.1]
--
-- ── Warum diese Tabelle zuerst kommt ────────────────────────────────
-- Von den zehn Layern, die der Overlay-Endpunkt heute leer laesst
-- (STUFE2-D §1.5), haengen drei unmittelbar an einer Lane-Heimat, die es im
-- Schema nicht gibt: F5 (Vertrauensgrenzen, `trust-boundary`), F17
-- (Lane-Traeger und Quoten, `lane`) und der Lane-Bezug von F3 (`sod`, die
-- Rueckfallrolle eines Schritts ohne eigene RACI-Zuordnung ist die Rolle
-- seiner Lane). Sie hat damit die groesste Hebelwirkung der Bedarfsliste.
--
-- ── Die offene Frage der Vorlage: Lane als `process_step` oder eigene
--    Tabelle? ───────────────────────────────────────────────────────
-- §5.2 stellt beides zur Wahl (`process_step.step_type` um `lane`/`pool`
-- erweitern ODER `process_lane` separat) und empfiehlt die zweite Form.
-- Diese Migration folgt der Empfehlung, und zwar aus einem Grund, der in der
-- Vorlage nur angedeutet ist: eine Lane traegt Attribute, die an einem
-- Prozessschritt fachlich falsch waeren — einen Dienstleister, ein Drittland,
-- eine Organisationseinheit. Haengte man sie an `process_step`, truege JEDE
-- Aktivitaet diese Spalten, und die 23 Layer muessten bei jedem Schritt
-- pruefen, ob er "eigentlich" eine Lane ist. Umgekehrt wuerde `process_step`
-- mit `step_type = 'lane'` in jede bestehende Abfrage ueber Schritte geraten,
-- die heute richtig ist — Risikoanzahl je Schritt, Kontrollabdeckung,
-- Conformance-Quote. Das waere eine stille Verfaelschung von Bestandszahlen,
-- und die ist teurer als eine zusaetzliche Tabelle.
--
-- ── Entscheidungen, die die Vorlage offen laesst ─────────────────────
-- 1. `org_unit_id` zeigt auf `eam_org_unit`. Das ist die einzige
--    Organisationseinheiten-Tabelle im Schema; eine zweite anzulegen haette
--    zwei Wahrheiten ueber dieselbe Aufbauorganisation geschaffen.
-- 2. `vendor_id` mit ON DELETE RESTRICT (S09-10). Der Dienstleister an einer
--    Lane IST die Vertrauensgrenze: verschwindet er still, verschwindet die
--    Doppelkante aus dem Diagramm und mit ihr der Befund "hier verlassen
--    personenbezogene Daten den Verantwortungsbereich". Ein Loeschvorgang,
--    der einen Compliance-Befund mitnimmt, muss laut scheitern und nicht
--    leise gelingen. Dasselbe gilt fuer `custom_role_id` — die Lane-Rolle ist
--    die Rueckfallrolle der SoD-Pruefung.
-- 3. `org_unit_id` dagegen mit ON DELETE SET NULL: die Organisationseinheit
--    ist eine Beschriftung, kein Befund. Faellt sie weg, zeigt die Lane
--    weiterhin Rolle und Dienstleister.
-- 4. `process_id` mit ON DELETE CASCADE — genau wie `process_step`. Eine Lane
--    ist Diagrammstruktur; ohne ihr Diagramm hat sie keine Bedeutung.
-- 5. `parent_lane_id` mit ON DELETE CASCADE: eine Lane in einem geloeschten
--    Pool ist kein Rest, sie ist ein Widerspruch.
-- 6. `step_key` als stabile Identitaet ueber Round-Trips durch fremde
--    Editoren, spiegelbildlich zu `process_step.step_key` (0445).
--
-- ── Audit-Trigger: ja (S03-13) ──────────────────────────────────────
-- Wer eine Lane von der eigenen Organisationseinheit auf einen Dienstleister
-- im Drittland umschreibt, veraendert damit eine Datenschutzaussage ueber den
-- ganzen Prozess. Das ist nachweisrelevant.

CREATE TABLE IF NOT EXISTS process_lane (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organization(id),
  process_id        uuid NOT NULL REFERENCES process(id) ON DELETE CASCADE,
  bpmn_element_id   varchar(100) NOT NULL,
  step_key          uuid NOT NULL DEFAULT gen_random_uuid(),
  name              text,
  kind              varchar(10) NOT NULL DEFAULT 'lane'
                      CHECK (kind IN ('lane', 'pool')),
  parent_lane_id    uuid REFERENCES process_lane(id) ON DELETE CASCADE,
  org_unit_id       uuid REFERENCES eam_org_unit(id) ON DELETE SET NULL,
  custom_role_id    uuid REFERENCES custom_role(id) ON DELETE RESTRICT,
  vendor_id         uuid REFERENCES vendor(id) ON DELETE RESTRICT,
  is_external       boolean NOT NULL DEFAULT false,
  -- ISO-3166-1 alpha-2. Gesetzt = Sitz im Drittland; genau dieser Wert steht
  -- als Chip an der Doppelkante von F5.
  third_country     char(2),
  sequence_order    integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,
  updated_by        uuid
);

-- S09-14: org_id fuehrend. Ohne diesen Index wird jede RLS-gefilterte
-- Abfrage auf dieser Tabelle zum Seq Scan.
CREATE INDEX IF NOT EXISTS process_lane_org_idx ON process_lane (org_id);
-- S09-13: je ein Index auf jedem Fremdschluessel.
CREATE INDEX IF NOT EXISTS process_lane_process_idx ON process_lane (process_id);
CREATE INDEX IF NOT EXISTS process_lane_parent_idx ON process_lane (parent_lane_id);
CREATE INDEX IF NOT EXISTS process_lane_org_unit_idx ON process_lane (org_unit_id);
CREATE INDEX IF NOT EXISTS process_lane_role_idx ON process_lane (custom_role_id);
CREATE INDEX IF NOT EXISTS process_lane_vendor_idx ON process_lane (vendor_id);
CREATE UNIQUE INDEX IF NOT EXISTS process_lane_element_uniq
  ON process_lane (process_id, bpmn_element_id);
CREATE UNIQUE INDEX IF NOT EXISTS process_lane_step_key_uniq
  ON process_lane (process_id, step_key);

COMMENT ON TABLE process_lane IS
  'STUFE2-E: Lane bzw. Pool eines Prozessdiagramms mit ihrem Traeger. Schaltet F5 (Vertrauensgrenzen), F17 (Lane-Quoten) und den Lane-Bezug von F3 frei.';
COMMENT ON COLUMN process_lane.third_country IS
  'ISO-3166-1 alpha-2 des Sitzlandes, wenn der Traeger ausserhalb des EWR sitzt. Gesetzt = Ausloeser einer Vertrauensgrenze (F5).';
COMMENT ON COLUMN process_lane.step_key IS
  'Stabile Identitaet ueber Round-Trips durch fremde Editoren (Plan §3.2), spiegelbildlich zu process_step.step_key.';

ALTER TABLE process_lane ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_lane FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS process_lane_org_isolation ON process_lane;
CREATE POLICY process_lane_org_isolation ON process_lane FOR ALL
  USING      (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid)
  WITH CHECK (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid);

DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON process_lane TO grc_app;
  END IF;
END $g$;

DROP TRIGGER IF EXISTS set_updated_at ON process_lane;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON process_lane
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS audit_trigger ON process_lane;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process_lane
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
