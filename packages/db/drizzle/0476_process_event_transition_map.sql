-- 0476_process_event_transition_map.sql
--
-- Migration: 0476_process_event_transition_map
-- Breaking: no
-- Estimated-Duration: 10
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 · OP-012] Kantenkennzahlen: Haeufigkeit und
-- Verzweigungswahrscheinlichkeit je UEBERGANG.
--
-- `STUFE2-E-SCHEMA.md` §6.2: „Haeufigkeit und Verzweigungswahrscheinlichkeit je
-- Kante brauchen eine Zuordnung des Ereignisprotokolls auf Uebergaenge, nicht
-- auf Aktivitaeten. Das ist eine eigene Tabelle." 0451
-- (`process_event_activity_map`) ordnet Aktivitaetsnamen einzelnen Elementen
-- zu; ein Uebergang ist aber ein PAAR, und aus zwei Knotenzuordnungen laesst
-- sich kein Paar rekonstruieren — die Reihenfolge innerhalb eines Falls ist
-- danach weg.
--
-- ── Was hier steht und was ausdruecklich nicht ──────────────────────
-- Gespeichert wird der beobachtete Uebergang als KNOTENPAAR
-- (`from_element_id`, `to_element_id`), nicht als Kantenkennung.
--
-- Der Grund ist gemessen, nicht vorsorglich: die BPMN-Kennung eines
-- SequenceFlow steht in keiner Tabelle dieses Schemas. `process_step` fuehrt
-- Knoten (`bpmn_element_id`), Kanten fuehrt niemand — die einzige Stelle, an
-- der eine Flusskennung vorkommt, ist `process_kpi_definition.sequence_flow_id`
-- (0454), eine freie Zeichenkette ohne Fremdschluessel. Ein Cron-Job, der
-- kein BPMN parst, koennte eine Kantenkennung also nur erfinden.
--
-- Das Knotenpaar ist zudem die Form, in der die Diagrammschicht bereits
-- arbeitet: `GrcConformanceSummary.deviations` fuehrt seit 0465
-- `fromElementId`/`toElementId`, und `conformanceLayer` loest daraus die
-- Geometrie auf. Dieselbe Form heisst: ein Weg, ein Testfall, eine
-- Fehlerquelle weniger.
--
-- ── `probability` ist eine BEOBACHTETE Quote, keine Modellaussage ───
-- Sie ist `frequency` dieses Uebergangs geteilt durch die Summe aller
-- beobachteten Uebergaenge, die vom selben Knoten ausgehen. Sie sagt NICHT,
-- mit welcher Wahrscheinlichkeit ein Gateway einen Zweig waehlt — dazu
-- muesste man die modellierten Zweige kennen, und ein nie beobachteter Zweig
-- kommt in dieser Rechnung gar nicht vor. Der Spaltenkommentar sagt das,
-- damit die Zahl nicht spaeter als Modellaussage gelesen wird.
--
-- ── Lebenszyklus: wie `process_conformance_result` ──────────────────
-- Der Datensatz gehoert zu EINEM Analyselauf ueber EIN Ereignisprotokoll und
-- wird als Ganzes ersetzt (der Cron loescht und schreibt neu). Deshalb
-- `event_log_id` mit ON DELETE CASCADE: verschwindet das Protokoll,
-- verschwindet die Auswertung. Eine verwaiste Haeufigkeit ueber Spuren, die
-- niemand mehr nachvollziehen kann, waere genau die Zahl ohne Herkunft, die
-- dieser Audit an anderer Stelle beanstandet.
--
-- ── Audit-Trigger: NEIN (S03-13) ────────────────────────────────────
-- Abgeleitetes Analyseergebnis, kein Nachweis. Es entsteht maschinell aus
-- `process_event`, das seinerseits die pruefbare Quelle ist; ein zweiter
-- Hashketteneintrag je Neuberechnung waere Rauschen. Dieselbe Abwaegung wie
-- bei `process_conformance_result` und `process_event_activity_map` (0451).

CREATE TABLE IF NOT EXISTS process_event_transition_map (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organization(id),
  event_log_id     uuid NOT NULL REFERENCES process_event_log(id) ON DELETE CASCADE,
  process_id       uuid REFERENCES process(id) ON DELETE CASCADE,
  from_element_id  varchar(100) NOT NULL,
  to_element_id    varchar(100) NOT NULL,
  frequency        integer NOT NULL DEFAULT 0,
  probability      numeric(6,5),
  -- Ob das Modell die beiden Knoten unmittelbar verbindet. Ein beobachteter
  -- Uebergang OHNE Modellentsprechung ist eine Abweichung (Geisterkante), mit
  -- Modellentsprechung eine Haeufigkeit an einer vorhandenen Kante. Die
  -- Unterscheidung hier zu treffen spart der Diagrammschicht das Raten.
  is_modelled      boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT petm_frequency_nonneg CHECK (frequency >= 0),
  CONSTRAINT petm_probability_range
    CHECK (probability IS NULL OR (probability >= 0 AND probability <= 1))
);

CREATE INDEX IF NOT EXISTS petm_org_idx ON process_event_transition_map (org_id);
CREATE INDEX IF NOT EXISTS petm_log_idx ON process_event_transition_map (event_log_id);
CREATE INDEX IF NOT EXISTS petm_process_idx ON process_event_transition_map (process_id);
-- Ein Paar je Protokoll genau einmal: der Cron schreibt Aggregate, keine
-- Einzelbeobachtungen. Ohne diesen Index verdoppelte ein zweiter Lauf jede
-- Haeufigkeit, falls das Loeschen davor je ausfaellt.
CREATE UNIQUE INDEX IF NOT EXISTS petm_log_pair_uniq
  ON process_event_transition_map (event_log_id, from_element_id, to_element_id);

COMMENT ON TABLE process_event_transition_map IS
  'OP-012: beobachtete Uebergaenge je Ereignisprotokoll als Knotenpaar. Kantenkennungen stehen in keiner Tabelle dieses Schemas; die Diagrammschicht loest das Paar auf die Geometrie auf (wie bei process_conformance_result.deviation_edges).';
COMMENT ON COLUMN process_event_transition_map.probability IS
  'BEOBACHTETE Quote: frequency geteilt durch alle beobachteten Uebergaenge ab from_element_id. KEINE Aussage ueber die Zweigwahl eines Gateways — ein nie beobachteter Zweig kommt in dieser Rechnung nicht vor.';
COMMENT ON COLUMN process_event_transition_map.is_modelled IS
  'Ob das Modell die beiden Knoten unmittelbar verbindet (process_step.sequence_order aufeinanderfolgend). false = beobachtete Abweichung.';

ALTER TABLE process_event_transition_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_event_transition_map FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS process_event_transition_map_org_isolation
  ON process_event_transition_map;
CREATE POLICY process_event_transition_map_org_isolation
  ON process_event_transition_map FOR ALL
  USING      (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid)
  WITH CHECK (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid);

DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON process_event_transition_map TO grc_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_worker') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON process_event_transition_map TO grc_worker;
  END IF;
END $g$;

DROP TRIGGER IF EXISTS set_updated_at ON process_event_transition_map;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON process_event_transition_map
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
