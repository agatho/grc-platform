-- 0454_element_level_links.sql
--
-- Migration: 0454_element_level_links
-- Breaking: no
-- Estimated-Duration: 20
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [STUFE2-E · Schema fuer die zehn leeren GRC-Layer,
--  docs/bpmn-engine/STUFE2-E-SCHEMA.md; Bedarf: STUFE2-A2-GRC.md §5.2]
--
-- Die restlichen Erweiterungen der Bedarfsliste: fuenf Tabellen bekommen
-- einen Elementbezug, den sie heute nicht haben. Alle nach demselben Muster —
-- eine nullable `process_step_id`-Spalte mit ON DELETE SET NULL, ein Index,
-- ein Spaltenkommentar.
--
-- ── Warum ausnahmslos SET NULL und nirgends CASCADE (S09-10) ─────────
-- Die Regel dieser ganzen Arbeit, zum vierten Mal angewandt: der
-- Elementbezug ist eine VERFEINERUNG einer Aussage, die auch ohne ihn gilt.
-- Ein Sicherheitsvorfall bleibt ein Vorfall, wenn der Schritt aus dem
-- Diagramm verschwindet; eine offene Massnahme bleibt offen; eine DPIA bleibt
-- eine DPIA. CASCADE haette aus dem Umbau eines Diagramms — einer taeglichen,
-- folgenlosen Handlung — einen Loeschvorgang in der Pruefungsspur gemacht.
--
-- ── Die eine Zeile der Vorlage, die NICHT umgesetzt wird ─────────────
-- §5.2 nennt `finding.due_at timestamptz null` mit der Begruendung, A3 sei
-- dreistufig (offen / ≤14 T / ueberfaellig) und es gebe heute nur die Anzahl.
-- Die Begruendung stimmt, die Schlussfolgerung nicht: `finding` traegt seit
-- jeher `remediation_due_date date`, und das IST die Faelligkeit der
-- Massnahme, die A3 meint. Der Overlay-Endpunkt liest sie seit STUFE2-D §1.3
-- und die dreistufige Ampel ist damit befuellt. Eine zweite Spalte daneben
-- waere eine zweite Wahrheit ueber dieselbe Frist — und die erste Anwendung,
-- die nur eine der beiden pflegt, macht die Ampel unbrauchbar. Statt der
-- Spalte kommt deshalb ein Kommentar, der die vorhandene benennt, damit die
-- naechste Lesung der Bedarfsliste nicht wieder an derselben Stelle stolpert.
--
-- ── Wozu die einzelnen Bezuege dienen ───────────────────────────────
-- `dpia.process_step_id`               — Regel G: der DPIA-Ausloeser ist
--                                        meist EIN Schritt. Traegt den
--                                        Rueckweg des dpia-Layers vom Badge
--                                        zur Akte.
-- `security_incident.process_step_id`  — F14 (`GrcElementData.incidents`),
--                                        Vertrag vorbereitet, Layer bewusst
--                                        nicht gebaut.
-- `work_item.process_step_id`          — F16 (`GrcElementData.workItems`),
--                                        dito.
-- `process_kpi_definition.process_step_id` / `.sequence_flow_id`
--                                      — Durchlaufzeit an einem Schritt bzw.
--                                        zwischen zweien (Gutter/Kante).
--                                        `sequence_flow_id` ist eine
--                                        BPMN-Kanten-ID und deshalb varchar,
--                                        kein Fremdschluessel: Kanten haben
--                                        im Schema keine Zeile.
-- `eam_bpmn_element_placement.*`       — F12 (zweite Zeichenebene), nicht
--                                        gebaut; die Spalten stehen, damit
--                                        der Arbeitsstrang Modellierung sie
--                                        nicht selbst erfinden muss.
--
-- ── Audit-Trigger ───────────────────────────────────────────────────
-- Kein neuer. `dpia`, `security_incident`, `work_item` und `finding` tragen
-- bereits die Trigger ihrer Module; die neuen Spalten laufen automatisch mit.
-- `process_kpi_definition` und `eam_bpmn_element_placement` tragen keinen und
-- bekommen auch keinen: eine Kennzahlendefinition und eine Zeichenposition
-- sind Konfiguration, kein Nachweis. Diese Migration ist nicht der Ort, die
-- Auditabdeckung fremder Module zu aendern.

-- ── 1. DPIA ─────────────────────────────────────────────────────────
ALTER TABLE dpia ADD COLUMN IF NOT EXISTS process_step_id uuid;

DO $fk$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dpia_process_step_fk') THEN
    ALTER TABLE dpia ADD CONSTRAINT dpia_process_step_fk
      FOREIGN KEY (process_step_id) REFERENCES process_step(id) ON DELETE SET NULL;
  END IF;
END $fk$;

CREATE INDEX IF NOT EXISTS dpia_process_step_idx ON dpia (process_step_id);

COMMENT ON COLUMN dpia.process_step_id IS
  'STUFE2-E: ausloesender Prozessschritt. NULL = die DPIA gilt fuer den ganzen Prozess (dpia.process_id) oder unabhaengig davon.';

-- ── 2. Sicherheitsvorfall ───────────────────────────────────────────
ALTER TABLE security_incident ADD COLUMN IF NOT EXISTS process_step_id uuid;

DO $fk$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'security_incident_process_step_fk') THEN
    ALTER TABLE security_incident ADD CONSTRAINT security_incident_process_step_fk
      FOREIGN KEY (process_step_id) REFERENCES process_step(id) ON DELETE SET NULL;
  END IF;
END $fk$;

CREATE INDEX IF NOT EXISTS security_incident_process_step_idx
  ON security_incident (process_step_id);

COMMENT ON COLUMN security_incident.process_step_id IS
  'STUFE2-E: betroffener Prozessschritt (F14, GrcElementData.incidents). Vertrag vorbereitet, Layer bewusst nicht gebaut.';

-- ── 3. Arbeitsauftrag ───────────────────────────────────────────────
ALTER TABLE work_item ADD COLUMN IF NOT EXISTS process_step_id uuid;

DO $fk$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_item_process_step_fk') THEN
    ALTER TABLE work_item ADD CONSTRAINT work_item_process_step_fk
      FOREIGN KEY (process_step_id) REFERENCES process_step(id) ON DELETE SET NULL;
  END IF;
END $fk$;

CREATE INDEX IF NOT EXISTS work_item_process_step_idx ON work_item (process_step_id);

COMMENT ON COLUMN work_item.process_step_id IS
  'STUFE2-E: betroffener Prozessschritt (F16, GrcElementData.workItems). Vertrag vorbereitet, Layer bewusst nicht gebaut.';

-- ── 4. Kennzahlendefinition ─────────────────────────────────────────
ALTER TABLE process_kpi_definition ADD COLUMN IF NOT EXISTS process_step_id uuid;
ALTER TABLE process_kpi_definition ADD COLUMN IF NOT EXISTS sequence_flow_id varchar(100);

DO $fk$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'process_kpi_definition_process_step_fk') THEN
    ALTER TABLE process_kpi_definition ADD CONSTRAINT process_kpi_definition_process_step_fk
      FOREIGN KEY (process_step_id) REFERENCES process_step(id) ON DELETE SET NULL;
  END IF;
END $fk$;

CREATE INDEX IF NOT EXISTS pkd_process_step_idx ON process_kpi_definition (process_step_id);

COMMENT ON COLUMN process_kpi_definition.process_step_id IS
  'STUFE2-E: Bezugsschritt der Kennzahl. NULL = die Kennzahl gilt fuer den ganzen Prozess.';
COMMENT ON COLUMN process_kpi_definition.sequence_flow_id IS
  'STUFE2-E: BPMN-ID der Kante, wenn die Kennzahl eine Durchlaufzeit ZWISCHEN zwei Schritten misst. Kein Fremdschluessel — Kanten haben im Schema keine Zeile.';

-- ── 5. EAM-Platzierung ──────────────────────────────────────────────
ALTER TABLE eam_bpmn_element_placement ADD COLUMN IF NOT EXISTS process_step_id uuid;
ALTER TABLE eam_bpmn_element_placement
  ADD COLUMN IF NOT EXISTS label_visible boolean NOT NULL DEFAULT true;
ALTER TABLE eam_bpmn_element_placement ADD COLUMN IF NOT EXISTS relation_type varchar(20);

DO $fk$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'eam_placement_process_step_fk') THEN
    ALTER TABLE eam_bpmn_element_placement ADD CONSTRAINT eam_placement_process_step_fk
      FOREIGN KEY (process_step_id) REFERENCES process_step(id) ON DELETE SET NULL;
  END IF;
END $fk$;

CREATE INDEX IF NOT EXISTS eam_placement_process_step_idx
  ON eam_bpmn_element_placement (process_step_id);

COMMENT ON COLUMN eam_bpmn_element_placement.process_step_id IS
  'STUFE2-E: Schritt, an dem das EAM-Element haengt (F12). bpmn_node_id bleibt die Anzeigezuordnung; diese Spalte ueberlebt einen Re-Export.';
COMMENT ON COLUMN eam_bpmn_element_placement.label_visible IS
  'STUFE2-E: ob die Beschriftung des EAM-Elements auf der zweiten Zeichenebene gezeigt wird (F12).';
COMMENT ON COLUMN eam_bpmn_element_placement.relation_type IS
  'STUFE2-E: Art der Beziehung zwischen Schritt und EAM-Element (F12).';

-- ── 6. Die nicht angelegte Spalte, benannt ──────────────────────────
COMMENT ON COLUMN finding.remediation_due_date IS
  'Faelligkeit der Massnahme. DIES ist das Feld, das STUFE2-A2-GRC.md §5.2 als "finding.due_at" fordert und der Overlay-Endpunkt als GrcFinding.dueAt liefert (STUFE2-D §1.3). Eine zweite Faelligkeitsspalte wird bewusst NICHT angelegt.';
