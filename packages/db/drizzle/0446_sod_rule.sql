-- 0446_sod_rule.sql
--
-- Migration: 0446_sod_rule
-- Breaking: no
-- Estimated-Duration: 5
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [STUFE2-E · Schema fuer die zehn leeren GRC-Layer,
--  docs/bpmn-engine/STUFE2-E-SCHEMA.md; Bedarf: STUFE2-A2-GRC.md §5.1]
--
-- ── Was hier fehlt und warum es nirgends sonst steht ─────────────────
-- Die Regelmenge fuer Aufgabentrennung (F3, Layer `sod`). Im Schema gibt es
-- dafuer nichts: `abac_policy` und `access_review` beschreiben ZUGRIFFSRECHTE
-- (wer darf welchen Datensatz sehen), nicht die Unvertraeglichkeit zweier
-- FACHLICHER AUFGABEN im selben Prozesspfad. Beides zu vermischen waere ein
-- Kategorienfehler: dass eine Rolle beide Bildschirme oeffnen darf, ist eine
-- andere Frage als dass sie beide Schritte verantwortet.
--
-- ── Die eine Bedingung, die diese Tabelle NICHT bekommen darf ────────
-- `CHECK (role_a_id <> role_b_id)` ist ausdruecklich verboten
-- (STUFE2-A2-GRC.md §7.3). Der eigentliche Verstoss, den ein IKS-Pruefer
-- sucht, ist "dieselbe Rolle verantwortet beide unvertraeglichen Aufgaben" —
-- also genau die Selbstpaarung. Dass zwei verschiedene Rollen die beiden
-- Aufgaben wahrnehmen, ist der GEWUENSCHTE Zustand. `computeSod` in
-- packages/bpmn/src/grc/sod.ts findet die Selbstpaarung und ist darauf
-- getestet; eine CHECK-Bedingung hier haette die Funktion stumm entwertet.
--
-- ── Entscheidungen, die die Vorlage offen laesst ─────────────────────
-- 1. `severity` als CHECK-Werteliste ueber die vier Vertragsstufen
--    (low/medium/high/critical) und NICHT ueber den vorhandenen Enum
--    `finding_severity`. Begruendung: `finding_severity` ist seit 0293
--    ISO-19011-konform und kennt zehn Werte (`major_nonconformity`,
--    `opportunity_for_improvement`, …), von denen keiner `low`/`medium`/
--    `high`/`critical` heisst. Der Overlay-Endpunkt musste dafuer bereits
--    eine verlustbehaftete Zuordnungstabelle bauen (STUFE2-D §1.3). Eine
--    SoD-Regel ist keine Auditfeststellung nach ISO 19011, sondern eine
--    Regelwerkseinstufung — sie hier gleich in der Vertragsform zu fuehren
--    erspart eine zweite solche Uebersetzung und die Fehlerklasse, die dabei
--    entsteht.
-- 2. Eindeutigkeit ueber das UNGEORDNETE Paar:
--    `UNIQUE(org_id, LEAST(a,b), GREATEST(a,b))`. Ohne das liessen sich (A,B)
--    und (B,A) beide anlegen, und `computeSod` fande jeden Konflikt zweimal —
--    die Kopfzeile meldete "2 Aufgabentrennungskonflikte" fuer einen. Eine
--    doppelte Zaehlung in einem Pruefungswerkzeug ist ein Befund fuer sich.
-- 3. Beide Rollen-Fremdschluessel mit ON DELETE RESTRICT (S09-10). Eine
--    Regel, die durch das Loeschen einer Rolle verschwindet, nimmt eine
--    Kontrolle mit — und niemand erfaehrt davon. Wer eine Rolle abschaffen
--    will, muss ihre SoD-Regeln zuvor bewusst deaktivieren (`is_active`) oder
--    entfernen.
-- 4. `is_active` statt Loeschen als Regelbetrieb: eine ausser Kraft gesetzte
--    Regel bleibt mit ihrer Begruendung stehen, und der Audit-Trigger haelt
--    fest, wer sie wann ausgeschaltet hat.
--
-- ── Audit-Trigger: ja, und hier am staerksten (S03-13) ───────────────
-- Diese Tabelle IST die Kontrolle. Wer eine Regel deaktiviert, laesst einen
-- Konflikt aus dem Diagramm verschwinden; ohne Nachweis waere das der
-- lohnendste stille Eingriff des ganzen Moduls.

CREATE TABLE IF NOT EXISTS sod_rule (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organization(id),
  role_a_id     uuid NOT NULL REFERENCES custom_role(id) ON DELETE RESTRICT,
  role_b_id     uuid NOT NULL REFERENCES custom_role(id) ON DELETE RESTRICT,
  severity      varchar(10) NOT NULL DEFAULT 'high'
                  CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  rationale     text,
  framework_ref varchar(80),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_by    uuid
);

CREATE INDEX IF NOT EXISTS sod_rule_org_idx ON sod_rule (org_id);
CREATE INDEX IF NOT EXISTS sod_rule_role_a_idx ON sod_rule (role_a_id);
CREATE INDEX IF NOT EXISTS sod_rule_role_b_idx ON sod_rule (role_b_id);
CREATE INDEX IF NOT EXISTS sod_rule_active_idx ON sod_rule (org_id, is_active);

-- Ungeordnetes Paar: (A,B) und (B,A) sind dieselbe Regel.
CREATE UNIQUE INDEX IF NOT EXISTS sod_rule_pair_uniq
  ON sod_rule (org_id, LEAST(role_a_id, role_b_id), GREATEST(role_a_id, role_b_id));

COMMENT ON TABLE sod_rule IS
  'STUFE2-E: Regelmenge der Aufgabentrennung (F3). Die Selbstpaarung role_a_id = role_b_id ist ausdruecklich zulaessig — sie ist der eigentliche Verstoss (STUFE2-A2-GRC.md §7.3).';
COMMENT ON COLUMN sod_rule.severity IS
  'Vertragsstufe (low/medium/high/critical), nicht der ISO-19011-Enum finding_severity — siehe Kopfkommentar der Migration.';

ALTER TABLE sod_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE sod_rule FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sod_rule_org_isolation ON sod_rule;
CREATE POLICY sod_rule_org_isolation ON sod_rule FOR ALL
  USING      (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid)
  WITH CHECK (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid);

DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON sod_rule TO grc_app;
  END IF;
END $g$;

DROP TRIGGER IF EXISTS set_updated_at ON sod_rule;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON sod_rule
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS audit_trigger ON sod_rule;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON sod_rule
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
