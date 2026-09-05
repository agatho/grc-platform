-- 0447_process_step_raci.sql
--
-- Migration: 0447_process_step_raci
-- Breaking: no
-- Estimated-Duration: 5
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [STUFE2-E · Schema fuer die zehn leeren GRC-Layer,
--  docs/bpmn-engine/STUFE2-E-SCHEMA.md; Bedarf: STUFE2-A2-GRC.md §5.1]
--
-- ── Die Luecke ──────────────────────────────────────────────────────
-- `GrcRaci` kennt R, A, C und I. Das Schema kennt heute nur R und A, und zwar
-- als zwei denormalisierte Spalten an `process_step`
-- (`raci_responsible_role_id`, `raci_accountable_role_id`). C und I haben
-- ueberhaupt keine Heimat: `process_raci_override` fuehrt sie zwar, benennt
-- die Beteiligten aber ueber rohe BPMN-Lane-IDs (`participant_bpmn_id
-- varchar(100)`) ohne Fremdschluessel auf `custom_role`. Eine Lane-ID als
-- Rolle auszugeben waere genau die Sorte Erfindung, die der Overlay-Endpunkt
-- nicht macht (STUFE2-D §1.5).
--
-- ── Entscheidungen, die die Vorlage offen laesst ─────────────────────
-- 1. Die beiden Bestandsspalten an `process_step` bleiben stehen und werden
--    NICHT migriert. Sie sind die Quelle des heute funktionierenden
--    `raci`-Layers, und ein Umbau haette den einen Teil abgeschaltet, der
--    schon geht. Der Endpunkt liest ab jetzt beides: R und A aus den Spalten,
--    ergaenzt und uebersteuert durch Zeilen dieser Tabelle, C und I
--    ausschliesslich von hier. Die Vorrangregel steht in
--    `apps/web/src/lib/grc-overlay.ts` und ist getestet — eine Zeile hier
--    gewinnt gegen die denormalisierte Spalte, weil sie die spezifischere und
--    die pflegbare Angabe ist.
-- 2. `role_id` mit ON DELETE RESTRICT (S09-10). Wer eine Rolle loescht, die
--    fuer einen Schritt rechenschaftspflichtig ist, loeschte eine Aussage
--    darueber, wer fuer diesen Schritt geradesteht. Das muss laut scheitern.
-- 3. `process_step_id` dagegen mit ON DELETE CASCADE — wie bei
--    `process_step_control` und `process_step_risk`. Die Zuordnung ist ohne
--    ihren Schritt bedeutungslos, sie ist kein eigenstaendiger Nachweis.
-- 4. `raci_role` als varchar(1) mit Werteliste statt eines neuen Enums: vier
--    feste Buchstaben, die sich nie erweitern werden, brauchen keinen
--    eigenen Typ — und ein Enum haette die Migration nicht-transaktional
--    gemacht (ALTER TYPE … ADD VALUE, S09-05).
--    varchar(1) und nicht char(1), aus zwei gemessenen Gruenden: (a) `bpchar`
--    fuellt mit Leerzeichen auf, und jeder Leser muesste `trim()`, bevor er
--    vergleicht — eine stille Fehlerquelle in genau der Spalte, die "wer ist
--    rechenschaftspflichtig" beantwortet; (b) der typgetriebene Wertgenerator
--    des RLS-Systemtests (`_wp2_check_literal`) erkennt eine Werteliste nur in
--    der Form `((spalte)::text = ANY …)`, die PostgreSQL fuer varchar erzeugt
--    und fuer bpchar nicht. Mit char(1) waere diese Tabelle als einzige der
--    zehn nicht seedbar und damit im Systemtest NICHT geprueft gewesen —
--    nachgemessen an `_wp2_seed_errors`.
-- 5. `source` unterscheidet, woher die Zuordnung stammt: `manual` (jemand hat
--    sie gepflegt), `derived` (aus der Lane abgeleitet), `override`
--    (uebersteuert eine Ableitung). Das ist nicht Kosmetik — eine abgeleitete
--    Zuordnung darf ein Reimport ueberschreiben, eine manuelle nicht.
--
-- ── Audit-Trigger: ja (S03-13) ──────────────────────────────────────
-- "Wer ist rechenschaftspflichtig" ist in jedem Managementsystem eine
-- pruefungsrelevante Aussage. Eine stille Umschreibung waere in einer
-- Nachschau nicht mehr rekonstruierbar.

CREATE TABLE IF NOT EXISTS process_step_raci (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organization(id),
  process_step_id uuid NOT NULL REFERENCES process_step(id) ON DELETE CASCADE,
  role_id         uuid NOT NULL REFERENCES custom_role(id) ON DELETE RESTRICT,
  raci_role       varchar(1) NOT NULL CHECK (raci_role IN ('R', 'A', 'C', 'I')),
  source          varchar(12) NOT NULL DEFAULT 'manual'
                    CHECK (source IN ('manual', 'derived', 'override')),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);

CREATE INDEX IF NOT EXISTS process_step_raci_org_idx ON process_step_raci (org_id);
CREATE INDEX IF NOT EXISTS process_step_raci_step_idx ON process_step_raci (process_step_id);
CREATE INDEX IF NOT EXISTS process_step_raci_role_idx ON process_step_raci (role_id);
CREATE UNIQUE INDEX IF NOT EXISTS process_step_raci_uniq
  ON process_step_raci (process_step_id, role_id, raci_role);

COMMENT ON TABLE process_step_raci IS
  'STUFE2-E: vollstaendige RACI-Zuordnung je Schritt. Erst hierdurch sind GrcRaci.consulted und .informed befuellbar; R und A ergaenzen bzw. uebersteuern die denormalisierten Spalten an process_step.';

ALTER TABLE process_step_raci ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_step_raci FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS process_step_raci_org_isolation ON process_step_raci;
CREATE POLICY process_step_raci_org_isolation ON process_step_raci FOR ALL
  USING      (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid)
  WITH CHECK (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid);

DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON process_step_raci TO grc_app;
  END IF;
END $g$;

DROP TRIGGER IF EXISTS set_updated_at ON process_step_raci;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON process_step_raci
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS audit_trigger ON process_step_raci;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process_step_raci
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
