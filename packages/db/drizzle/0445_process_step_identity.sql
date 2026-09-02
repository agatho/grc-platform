-- 0445_process_step_identity.sql
--
-- Migration: 0445_process_step_identity
-- Breaking: no
-- Estimated-Duration: 30
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [STUFE2-E · Schema fuer die zehn leeren GRC-Layer,
--  docs/bpmn-engine/STUFE2-E-SCHEMA.md; Bedarf: STUFE2-A2-GRC.md §5.2]
--
-- Drei Spalten an `process_step`, die die Vorlage als erste drei Zeilen ihrer
-- Erweiterungsliste fuehrt.
--
-- ── `step_key`: warum NOT NULL und nicht nullable ────────────────────
-- Die BPMN-Element-ID ist der heutige Schluessel des Overlay-Datensatzes. Sie
-- ist aber die ID, die im XML steht — ein fremder Editor (Signavio, Camunda
-- Modeler, BIC) darf sie beim Re-Export neu vergeben, und dann haengen
-- Risiken, Kontrollen und Feststellungen an Schritten, die es nicht mehr gibt.
-- Ein nullable `step_key` haette dieses Problem nur verschoben: die eine
-- Zeile ohne Schluessel ist genau die, an der die Zuordnung reisst. Deshalb
-- NOT NULL mit `DEFAULT gen_random_uuid()`; der Bestand wird im selben Zug
-- befuellt. Additiv und ohne Datenverlustrisiko — der Vorgabewert erzeugt
-- fuer jede vorhandene Zeile einen Wert, den vorher niemand kannte und den
-- deshalb auch niemand verliert.
--
-- `UNIQUE(process_id, step_key)` und nicht global eindeutig: derselbe
-- Schluessel darf in einer Prozesskopie wieder vorkommen, sonst waere das
-- Kopieren eines Prozesses ein Fehlerfall.
--
-- ── `parent_step_id`: ON DELETE SET NULL, nicht CASCADE (S09-10) ─────
-- Die Vorlage nennt die Spalte, nicht die Loeschregel. CASCADE waere hier
-- besonders teuer: ein Subprozess-Schritt traegt Kinder, und diese Kinder
-- tragen Risiken, Kontrollen, Feststellungen und Nachweise. Wer im Editor
-- einen aufgeklappten Subprozess loescht, loeschte damit still die
-- Pruefungsspur mehrerer Aktivitaeten. SET NULL faellt statt dessen auf die
-- Prozessebene zurueck — dieselbe Entscheidung und dieselbe Begruendung wie
-- bei `process_framework_mapping.process_step_id` (0443).
--
-- ── `lane_step_id`: zeigt auf `process_lane`, nicht auf `process_step` ─
-- Die Vorlage nennt die Spalte im Abschnitt `process_step` und laesst offen,
-- worauf sie zeigt — was folgerichtig ist, solange nicht entschieden ist, ob
-- Lanes eigene Zeilen in `process_step` sind. 0444 hat das entschieden
-- (`process_lane` separat), also zeigt `lane_step_id` dorthin. Der Name
-- bleibt der der Vorlage, damit die Bedarfsliste nachvollziehbar bleibt; der
-- Kommentar an der Spalte nennt das Ziel.
--
-- ON DELETE SET NULL: verschwindet die Lane, ist der Schritt lane-los — das
-- ist der Zustand, den die Diagrammschicht heute schon geometrisch ermittelt
-- (engster umschliessender Rahmen). Sie faellt sauber dorthin zurueck.
--
-- Kein eigener Audit-Trigger: `process_step` traegt seit 0332 keinen, und
-- diese Migration aendert daran nichts — die drei Spalten sind Struktur, und
-- die fachlich nachweisrelevanten Aussagen ueber einen Schritt (RACI, ROPA,
-- BIA, Dokumente) stehen ab 0446ff. in eigenen, auditierten Tabellen.

ALTER TABLE process_step
  ADD COLUMN IF NOT EXISTS step_key uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE process_step
  ADD COLUMN IF NOT EXISTS parent_step_id uuid;

ALTER TABLE process_step
  ADD COLUMN IF NOT EXISTS lane_step_id uuid;

DO $fk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'process_step_parent_fk') THEN
    ALTER TABLE process_step
      ADD CONSTRAINT process_step_parent_fk
      FOREIGN KEY (parent_step_id) REFERENCES process_step(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'process_step_lane_fk') THEN
    ALTER TABLE process_step
      ADD CONSTRAINT process_step_lane_fk
      FOREIGN KEY (lane_step_id) REFERENCES process_lane(id) ON DELETE SET NULL;
  END IF;
END
$fk$;

-- S09-13: Index auf jedem Fremdschluessel.
CREATE INDEX IF NOT EXISTS process_step_parent_idx ON process_step (parent_step_id);
CREATE INDEX IF NOT EXISTS process_step_lane_idx   ON process_step (lane_step_id);
CREATE UNIQUE INDEX IF NOT EXISTS process_step_step_key_uniq
  ON process_step (process_id, step_key);

COMMENT ON COLUMN process_step.step_key IS
  'STUFE2-E: stabile Identitaet ueber Round-Trips durch fremde Editoren (Plan §3.2). Die BPMN-Element-ID darf ein fremder Editor neu vergeben, dieser Schluessel nicht.';
COMMENT ON COLUMN process_step.parent_step_id IS
  'STUFE2-E: umschliessender Schritt (Subprozess/Transaktion). NULL = auf der Wurzelebene. ON DELETE SET NULL, damit ein geloeschter Container nicht die Pruefungsspur seiner Kinder mitnimmt.';
COMMENT ON COLUMN process_step.lane_step_id IS
  'STUFE2-E: Lane-Zugehoerigkeit; zeigt auf process_lane(id) (siehe 0444). NULL = keine Lane hinterlegt, die Diagrammschicht ermittelt sie dann geometrisch.';

-- ── `simulation_activity_param.step_key` ────────────────────────────
-- Die Vorlage schreibt "`activity_id` → `step_key`". Woertlich waere das ein
-- Typwechsel von varchar auf uuid an einer Spalte, die HEUTE der einzige
-- funktionierende Traeger des `operations`-Layers ist: sie haelt die
-- BPMN-Element-ID und wird vom Overlay-Endpunkt direkt als Elementschluessel
-- gelesen. Ein Typwechsel haette diesen einen funktionierenden Layer
-- abgeschaltet, um einen Round-Trip-Fall abzusichern, den es heute nicht gibt.
--
-- Entscheidung: `step_key` kommt als zusaetzliche, nullable Spalte daneben.
-- `activity_id` bleibt unveraendert die Anzeige- und Zuordnungsquelle;
-- `step_key` ist die Zuordnung, die einen Re-Export durch ein fremdes
-- Werkzeug ueberlebt. Sobald sie flaechendeckend gepflegt ist, kann eine
-- spaetere Migration die Reihenfolge umdrehen — in die andere Richtung ginge
-- es nicht mehr.
ALTER TABLE simulation_activity_param
  ADD COLUMN IF NOT EXISTS step_key uuid;

CREATE INDEX IF NOT EXISTS sap_step_key_idx
  ON simulation_activity_param (org_id, step_key);

COMMENT ON COLUMN simulation_activity_param.step_key IS
  'STUFE2-E: process_step.step_key des Schritts. Ueberlebt den Re-Export durch ein fremdes Werkzeug, im Gegensatz zu activity_id (BPMN-Element-ID).';
