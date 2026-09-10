-- 0452_user_diagram_preference.sql
--
-- Migration: 0452_user_diagram_preference
-- Breaking: no
-- Estimated-Duration: 5
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [STUFE2-E · Schema fuer die zehn leeren GRC-Layer,
--  docs/bpmn-engine/STUFE2-E-SCHEMA.md; Bedarf: STUFE2-A2-GRC.md §5.1]
--
-- Die zehnte Tabelle der Bedarfsliste und die einzige, die keinen Layer
-- freischaltet: sie merkt sich die zuletzt gewaehlte GRC-Sicht je Nutzer und
-- Bezugsraum (§3.3.4). Heute steht die Wahl in einem React-`useState` und ist
-- nach jedem Seitenwechsel weg — bei neun Sichten und zwoelf
-- Rollenvoreinstellungen ist das der Unterschied zwischen einem Werkzeug und
-- einer Demo.
--
-- ── Entscheidungen, die die Vorlage offen laesst ─────────────────────
-- 1. `org_id NOT NULL`, obwohl die Vorlage die Spalte nicht nennt. Ein Nutzer
--    kann Mitglied mehrerer Organisationen sein, und die passende Sicht haengt
--    an der Rolle, die er DORT hat — ein Auditor in Mandant A und ein
--    Prozesseigner in Mandant B wollen nicht dieselbe Voreinstellung. Ohne
--    `org_id` waere die Tabelle ausserdem eine mandantenlose Ablage in einem
--    Produkt, dessen tragende Zusage die Mandantentrennung ist (ADR-001).
-- 2. Zwei Policies, und zwar mit unterschiedlichem Zuschnitt statt der
--    Verdopplung, die `user_nav_preference` traegt. Dort stehen eine
--    org-weite FOR-ALL-Policy und eine nutzerbezogene FOR-ALL-Policy
--    nebeneinander — beide PERMISSIVE, also per OR verknuepft, womit die
--    engere folgenlos bleibt. Hier deckt `…_org_read` nur SELECT ab (eine
--    fremde Sichtvoreinstellung zu lesen ist kein Datenleck von Gewicht) und
--    `…_own_write` alles uebrige, aber ausschliesslich fuer die eigenen
--    Zeilen. Damit ist die Schreibbeschraenkung tatsaechlich wirksam:
--    einem Kollegen die Sicht umzustellen, geht nicht.
-- 3. `scope varchar(40)`: der Bezugsraum, fuer den die Wahl gilt — die
--    Prozessart bzw. `'default'`. Bewusst ein freies Kuerzel und kein
--    Fremdschluessel auf einen einzelnen Prozess: eine Voreinstellung, die
--    nur fuer genau ein Diagramm gilt, hilft niemandem, und ein Prozess, den
--    jemand loescht, duerfte keine Voreinstellung mitnehmen.
-- 4. `layers jsonb` mit Vorgabewert `[]` — die abgewaehlten Layergruppen, in
--    derselben Schreibweise wie der `?layers=`-Parameter des Endpunkts.
--
-- ── Audit-Trigger: NEIN, und zwar ohne Abwaegung (S03-13) ────────────
-- Eine Anzeigevoreinstellung ist kein Nachweis. Sie aendert nichts an den
-- Daten, ueber die geprueft wird, und ein Eintrag je Sichtwechsel in einer
-- hashverketteten Nachweistabelle waere reines Rauschen.

CREATE TABLE IF NOT EXISTS user_diagram_preference (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organization(id),
  user_id     uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  scope       varchar(40) NOT NULL DEFAULT 'default',
  active_view varchar(32),
  layers      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS udp_org_idx ON user_diagram_preference (org_id);
CREATE INDEX IF NOT EXISTS udp_user_idx ON user_diagram_preference (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS udp_user_scope_uniq
  ON user_diagram_preference (org_id, user_id, scope);

COMMENT ON TABLE user_diagram_preference IS
  'STUFE2-E: zuletzt gewaehlte GRC-Sicht je Nutzer, Mandant und Bezugsraum (§3.3.4). Bewusst ohne Audit-Trigger — eine Anzeigevoreinstellung ist kein Nachweis.';

ALTER TABLE user_diagram_preference ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_diagram_preference FORCE  ROW LEVEL SECURITY;

-- Die vom Event-Trigger 0397 beim CREATE TABLE angelegte Vorgabe-Policy wird
-- hier durch die beiden zugeschnittenen ersetzt.
DROP POLICY IF EXISTS user_diagram_preference_org_isolation ON user_diagram_preference;

DROP POLICY IF EXISTS user_diagram_preference_org_read ON user_diagram_preference;
CREATE POLICY user_diagram_preference_org_read ON user_diagram_preference FOR SELECT
  USING (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid);

DROP POLICY IF EXISTS user_diagram_preference_own_write ON user_diagram_preference;
CREATE POLICY user_diagram_preference_own_write ON user_diagram_preference FOR ALL
  USING      (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid
              AND user_id = (NULLIF(current_setting('app.current_user_id', true), ''))::uuid)
  WITH CHECK (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid
              AND user_id = (NULLIF(current_setting('app.current_user_id', true), ''))::uuid);

DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON user_diagram_preference TO grc_app;
  END IF;
END $g$;

DROP TRIGGER IF EXISTS set_updated_at ON user_diagram_preference;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_diagram_preference
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
