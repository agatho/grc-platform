-- 0450_process_step_document.sql
--
-- Migration: 0450_process_step_document
-- Breaking: no
-- Estimated-Duration: 5
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [STUFE2-E · Schema fuer die zehn leeren GRC-Layer,
--  docs/bpmn-engine/STUFE2-E-SCHEMA.md; Bedarf: STUFE2-A2-GRC.md §5.1]
--
-- Schaltet den `document`-Layer (§3.6, Slot BR in der Sicht "Verantwortung")
-- frei: "welche Arbeitsanweisung regelt diesen Schritt".
--
-- ── Warum eine eigene Tabelle ───────────────────────────────────────
-- `process_document` haengt am Prozess. Die Frage der Sicht ist aber nicht
-- "welche Dokumente gehoeren zu diesem Prozess" — die wird in der
-- Dokumentenliste beantwortet — sondern "was muss ich fuer DIESEN Schritt
-- gelesen haben". Ein Prozess mit vierzig Aktivitaeten und zwoelf SOPs zeigte
-- sonst an jeder Aktivitaet dieselben zwoelf, und der Badge waere wertlos.
-- n:m, also eigene Tabelle (Regel G der Vorlage).
--
-- ── Entscheidungen, die die Vorlage offen laesst ─────────────────────
-- 1. `document_id` mit ON DELETE RESTRICT (S09-10). Die Verknuepfung ist ein
--    Nachweis: "dieser Schritt ist durch eine freigegebene Anweisung
--    geregelt" ist genau die Aussage, die ein Auditor stichprobenartig
--    prueft. Ein DELETE, das sie stillschweigend mitnimmt, verwandelt einen
--    geregelten Schritt in einen ungeregelten, ohne dass jemand etwas
--    entschieden hat. `document` kennt ohnehin Soft-Delete (`deleted_at`) —
--    der normale Weg bleibt also offen, nur das harte Loeschen wird laut.
-- 2. `relation_type` mit fester Werteliste statt Freitext. Der Badge
--    unterscheidet heute nicht, aber die Textalternative und die spaetere
--    Panelauswahl tun es; eine Freitextspalte haette nach einem halben Jahr
--    fuenf Schreibweisen fuer "Arbeitsanweisung". Vorgabewert `sop`, weil das
--    der Fall ist, fuer den die Sicht gebaut wurde.
-- 3. `UNIQUE(process_step_id, document_id, relation_type)` und nicht nur
--    `(step, document)`: dasselbe Dokument kann fuer einen Schritt zugleich
--    die Anweisung und das Formular sein.
--
-- ── Audit-Trigger: ja (S03-13) ──────────────────────────────────────
-- Das Loesen einer Anweisung von einem Schritt ist die Umkehrung einer
-- Freigabe. Nachweisrelevant.

CREATE TABLE IF NOT EXISTS process_step_document (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organization(id),
  process_step_id uuid NOT NULL REFERENCES process_step(id) ON DELETE CASCADE,
  document_id     uuid NOT NULL REFERENCES document(id) ON DELETE RESTRICT,
  relation_type   varchar(20) NOT NULL DEFAULT 'sop'
                    CHECK (relation_type IN ('sop', 'work_instruction', 'form',
                                             'policy', 'evidence', 'other')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);

CREATE INDEX IF NOT EXISTS psdoc_org_idx ON process_step_document (org_id);
CREATE INDEX IF NOT EXISTS psdoc_step_idx ON process_step_document (process_step_id);
CREATE INDEX IF NOT EXISTS psdoc_document_idx ON process_step_document (document_id);
CREATE UNIQUE INDEX IF NOT EXISTS psdoc_uniq
  ON process_step_document (process_step_id, document_id, relation_type);

COMMENT ON TABLE process_step_document IS
  'STUFE2-E: Dokumente und Arbeitsanweisungen je Prozessschritt (Layer document, §3.6). document_id mit ON DELETE RESTRICT, weil die Verknuepfung ein Nachweis ist.';

ALTER TABLE process_step_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_step_document FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS process_step_document_org_isolation ON process_step_document;
CREATE POLICY process_step_document_org_isolation ON process_step_document FOR ALL
  USING      (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid)
  WITH CHECK (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid);

DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON process_step_document TO grc_app;
  END IF;
END $g$;

DROP TRIGGER IF EXISTS audit_trigger ON process_step_document;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process_step_document
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
