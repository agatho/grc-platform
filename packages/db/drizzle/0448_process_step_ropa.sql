-- 0448_process_step_ropa.sql
--
-- Migration: 0448_process_step_ropa
-- Breaking: no
-- Estimated-Duration: 10
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [STUFE2-E · Schema fuer die zehn leeren GRC-Layer,
--  docs/bpmn-engine/STUFE2-E-SCHEMA.md; Bedarf: STUFE2-A2-GRC.md §5.1]
--
-- Drei Tabellen in einer Migration, weil sie fachlich eine Einheit sind: der
-- Verarbeitungsbezug eines Prozessschritts, seine Datenkategorien und seine
-- Empfaenger. Sie schalten VIER der zehn leeren Layer frei — `privacy`
-- (Formkodierung Personenbezug), die Kategoriechips desselben Layers, `dpia`
-- (Slot BL) und `retention` (F10, Gutter + Slot BR) — und liefern zusaetzlich
-- die Personenbezugspruefung, ohne die F5 nur "Uebergang ohne hinterlegten
-- Personenbezug" melden kann.
--
-- ── Warum je Schritt und nicht je Prozess ───────────────────────────
-- `process_ropa_profile` gibt es seit 0333, aber 1:1 je Prozess
-- (`process_ropa_profile_process_uniq`). Eine Prozessaussage an jedes Element
-- zu haengen waere falsch und zugleich nutzlos: die Sicht "Datenschutz"
-- beantwortet gerade die Frage, WELCHER Schritt personenbezogene Daten
-- verarbeitet — faerbte man alle gleich, waere die Antwort immer "alle". Das
-- BPMN-XML modelliert den Personenbezug ohnehin je Flow-Node.
--
-- Der Prozessbezug bleibt bestehen und bleibt gueltig: `process_ropa_profile`
-- ist die Aussage fuer den ganzen Prozess (und die Quelle der VVT-Meldung),
-- `process_step_ropa` die Verfeinerung fuer einzelne Schritte. Der
-- Overlay-Endpunkt liest ausschliesslich die Schrittebene — sonst waere er
-- wieder bei "alle gleich".
--
-- ── Entscheidungen, die die Vorlage offen laesst ─────────────────────
-- 1. `legal_basis` benutzt den vorhandenen Enum `ropa_legal_basis` und nicht
--    ein freies varchar. Der Enum ist die Art.-6-Liste der DSGVO; ein
--    Freitextfeld daneben haette eine zweite, unvollstaendige Liste erzeugt.
--    Der Vertrag fuehrt `legalBasis` als String und nimmt das Enumliteral
--    unveraendert entgegen.
-- 2. `UNIQUE(process_step_id)` — 1:1 je Schritt. Der Vertrag fuehrt `ropa`
--    als Einzelobjekt (`GrcElementData.ropa?: GrcRopa`), nicht als Liste;
--    zwei widerspruechliche Verarbeitungsaussagen zu demselben Schritt sind
--    kein Modellierungsfall, sondern ein Datenfehler.
-- 3. `retention_months integer` und nicht ein Intervall: F10 rechnet in
--    Monaten, die Filterschwelle der Sicht ist "< 12 Monate", und ein
--    Intervall waere an genau dieser Stelle wieder umzurechnen. CHECK >= 0.
-- 4. `dpia_id` mit ON DELETE RESTRICT (S09-10) — dieselbe Regel, die
--    `process_ropa_profile.dpia_id` seit 0333 faktisch hat (NO ACTION). Eine
--    DPIA ist Nachweis; verschwindet sie, kippt der Badge von "DPIA" auf
--    "DPIA!" ("erforderlich, aber nicht verknuepft") — ein Befund, der
--    entstuende, ohne dass jemand etwas an der Verarbeitung geaendert hat.
-- 5. `transfer_country char(2)` als ISO-3166-1 alpha-2, identisch zu
--    `process_lane.third_country`, damit F5 beide Quellen ohne Umrechnung
--    gegeneinander stellen kann.
-- 6. `process_step_data_category.is_special_category` wird REDUNDANT zur
--    Kategorie gefuehrt und nicht aus ihr abgeleitet. Grund: `ropa_data_category`
--    kennt nur `category varchar` als Freitext und keine Art.-9-Markierung.
--    Sie aus dem Text zu erraten ("Gesundheit" enthaelt "…") waere eine
--    Erfindung; die Markierung gehoert an die Zuordnung, wo ein Mensch sie
--    setzt.
-- 7. `process_step_data_category.ropa_data_category_id` mit ON DELETE CASCADE
--    — die einzige Stelle dieser Arbeit, an der CASCADE steht, und deshalb
--    ausdruecklich begruendet: die Kategorie ist ein Stammsatz des VVT, die
--    Zuordnung nur ein Verweis darauf. Ohne den Stammsatz hat der
--    Kategoriechip keinen Titel und ist nicht darstellbar; eine Zeile
--    stehenzulassen, die nichts zeigen kann, waere kein Nachweis, sondern
--    Muell. Was verschwindet, haelt der Audit-Trigger fest — er feuert auch
--    bei einem kaskadierten DELETE.
-- 8. `process_step_recipient` ist polymorph (`kind` = vendor | org_unit) und
--    kann deshalb keinen Fremdschluessel auf `recipient_id` tragen. Statt
--    dessen: CHECK auf die Werteliste, Index auf `(org_id, kind,
--    recipient_id)` und die Aufloesung des Namens im Endpunkt ueber genau
--    zwei Joins. Zwei getrennte nullable FK-Spalten waeren die Alternative
--    gewesen; sie haetten eine XOR-Bedingung gebraucht und jede Abfrage um
--    ein COALESCE erweitert, ohne mehr zu garantieren.
--
-- ── Audit-Trigger: ja, auf allen dreien (S03-13) ────────────────────
-- Art. 30 DSGVO verlangt ein Verzeichnis der Verarbeitungstaetigkeiten und
-- Art. 5(2) die Rechenschaft darueber. Zweck, Rechtsgrundlage,
-- Aufbewahrungsfrist, Drittlandsuebermittlung, Kategorien und Empfaenger sind
-- genau die Angaben, deren Aenderungsgeschichte eine Aufsichtsbehoerde sehen
-- will.

-- ── 1. Verarbeitungsbezug je Schritt ────────────────────────────────

CREATE TABLE IF NOT EXISTS process_step_ropa (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL REFERENCES organization(id),
  process_step_id        uuid NOT NULL REFERENCES process_step(id) ON DELETE CASCADE,
  is_processing_activity boolean NOT NULL DEFAULT false,
  purpose                text,
  legal_basis            ropa_legal_basis,
  legal_basis_detail     text,
  retention_months       integer CHECK (retention_months IS NULL OR retention_months >= 0),
  retention_basis        text,
  requires_dpia          boolean NOT NULL DEFAULT false,
  dpia_id                uuid REFERENCES dpia(id) ON DELETE RESTRICT,
  transfer_third_country boolean NOT NULL DEFAULT false,
  transfer_country       char(2),
  transfer_safeguard     varchar(120),
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid,
  updated_by             uuid
);

CREATE INDEX IF NOT EXISTS process_step_ropa_org_idx ON process_step_ropa (org_id);
CREATE INDEX IF NOT EXISTS process_step_ropa_dpia_idx ON process_step_ropa (dpia_id);
CREATE UNIQUE INDEX IF NOT EXISTS process_step_ropa_step_uniq
  ON process_step_ropa (process_step_id);

COMMENT ON TABLE process_step_ropa IS
  'STUFE2-E: Art.-30-Angaben je Prozessschritt. Traegt die Formkodierung Personenbezug (privacy), den DPIA-Befund (dpia), die Aufbewahrungssicht (retention, F10) und die Personenbezugspruefung von F5.';
COMMENT ON COLUMN process_step_ropa.transfer_country IS
  'ISO-3166-1 alpha-2 des Empfaengerlandes bei Drittlandsuebermittlung — dieselbe Schreibweise wie process_lane.third_country.';

ALTER TABLE process_step_ropa ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_step_ropa FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS process_step_ropa_org_isolation ON process_step_ropa;
CREATE POLICY process_step_ropa_org_isolation ON process_step_ropa FOR ALL
  USING      (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid)
  WITH CHECK (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid);

-- ── 2. Datenkategorien je Schritt ───────────────────────────────────

CREATE TABLE IF NOT EXISTS process_step_data_category (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organization(id),
  process_step_id       uuid NOT NULL REFERENCES process_step(id) ON DELETE CASCADE,
  ropa_data_category_id uuid NOT NULL REFERENCES ropa_data_category(id) ON DELETE CASCADE,
  is_special_category   boolean NOT NULL DEFAULT false,
  subject_type_id       uuid REFERENCES ropa_data_subject(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid
);

CREATE INDEX IF NOT EXISTS psdc_org_idx ON process_step_data_category (org_id);
CREATE INDEX IF NOT EXISTS psdc_step_idx ON process_step_data_category (process_step_id);
CREATE INDEX IF NOT EXISTS psdc_category_idx ON process_step_data_category (ropa_data_category_id);
CREATE INDEX IF NOT EXISTS psdc_subject_idx ON process_step_data_category (subject_type_id);
CREATE UNIQUE INDEX IF NOT EXISTS psdc_step_category_uniq
  ON process_step_data_category (process_step_id, ropa_data_category_id);

COMMENT ON TABLE process_step_data_category IS
  'STUFE2-E: Datenkategorien je Schritt. is_special_category traegt die Art.-9-Stufe der Sicht Datenschutz und wird ausdruecklich gesetzt, nicht aus dem Kategorienamen erraten.';

ALTER TABLE process_step_data_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_step_data_category FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS process_step_data_category_org_isolation ON process_step_data_category;
CREATE POLICY process_step_data_category_org_isolation ON process_step_data_category FOR ALL
  USING      (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid)
  WITH CHECK (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid);

-- ── 3. Empfaenger je Schritt ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS process_step_recipient (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organization(id),
  process_step_id uuid NOT NULL REFERENCES process_step(id) ON DELETE CASCADE,
  -- Polymorph: ohne Fremdschluessel, weil das Ziel je nach `kind` in einer
  -- anderen Tabelle liegt. Die Aufloesung macht der Endpunkt ueber genau zwei
  -- Joins (vendor, eam_org_unit).
  recipient_id    uuid NOT NULL,
  kind            varchar(12) NOT NULL CHECK (kind IN ('vendor', 'org_unit')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);

CREATE INDEX IF NOT EXISTS psr_recipient_org_idx ON process_step_recipient (org_id);
CREATE INDEX IF NOT EXISTS psr_recipient_step_idx ON process_step_recipient (process_step_id);
CREATE INDEX IF NOT EXISTS psr_recipient_target_idx
  ON process_step_recipient (org_id, kind, recipient_id);
CREATE UNIQUE INDEX IF NOT EXISTS psr_recipient_uniq
  ON process_step_recipient (process_step_id, kind, recipient_id);

COMMENT ON TABLE process_step_recipient IS
  'STUFE2-E: Empfaenger je Schritt (GrcRopa.recipients). Polymorph ueber kind; recipient_id traegt bewusst keinen Fremdschluessel.';

ALTER TABLE process_step_recipient ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_step_recipient FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS process_step_recipient_org_isolation ON process_step_recipient;
CREATE POLICY process_step_recipient_org_isolation ON process_step_recipient FOR ALL
  USING      (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid)
  WITH CHECK (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid);

-- ── 4. Rechte, Zeitstempel, Nachweis ────────────────────────────────

DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON process_step_ropa, process_step_data_category, process_step_recipient
      TO grc_app;
  END IF;
END $g$;

DROP TRIGGER IF EXISTS set_updated_at ON process_step_ropa;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON process_step_ropa
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS audit_trigger ON process_step_ropa;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process_step_ropa
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

DROP TRIGGER IF EXISTS audit_trigger ON process_step_data_category;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process_step_data_category
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

DROP TRIGGER IF EXISTS audit_trigger ON process_step_recipient;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process_step_recipient
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
