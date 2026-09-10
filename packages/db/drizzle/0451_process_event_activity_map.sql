-- 0451_process_event_activity_map.sql
--
-- Migration: 0451_process_event_activity_map
-- Breaking: no
-- Estimated-Duration: 5
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [STUFE2-E · Schema fuer die zehn leeren GRC-Layer,
--  docs/bpmn-engine/STUFE2-E-SCHEMA.md; Bedarf: STUFE2-A2-GRC.md §5.1]
--
-- ── Der Torwaechter, den diese Tabelle bedient ──────────────────────
-- `process_event.activity` ist ein NAME aus einem Fremdsystem
-- ("Rechnung pruefen", "RECHN_PRUEF", "Invoice check"), keine BPMN-Element-ID.
-- Ohne eine Zuordnung laesst sich nicht sagen, welcher Anteil der Ereignisse
-- ueberhaupt auf dem Modell landet — und `conformanceGate` in
-- packages/bpmn/src/grc/analysis.ts VERWEIGERT die Heatmap ohne diese Quote
-- ausdruecklich: "eine Heatmap, die stumm falsch ist, ist schlimmer als keine
-- Heatmap". Diese Tabelle ist die einzige fehlende Zutat des `conformance`-
-- Layers (F7).
--
-- ── Entscheidungen, die die Vorlage offen laesst ─────────────────────
-- 1. `event_log_id` mit ON DELETE CASCADE. Die Zuordnung ist eine Ableitung
--    AUS dem Ereignisprotokoll; ohne das Protokoll gibt es keine
--    Aktivitaetsnamen mehr, denen sie gelten koennte. Sie ist kein
--    eigenstaendiger Nachweis, und eine verwaiste Zuordnung waere ein Rest,
--    kein Beleg.
-- 2. `process_step_id` dagegen mit ON DELETE SET NULL — dieselbe Regel wie in
--    0443: verschwindet der Schritt, ist die Aktivitaet NICHT ZUGEORDNET, und
--    genau das ist die wahre Aussage. Der Zeile wird dann `match_kind =
--    'unmapped'` nicht automatisch nachgezogen; der Endpunkt liest die
--    Zuordnung ueber `process_step_id IS NULL`, nicht ueber `match_kind`, und
--    kann deshalb nicht auseinanderlaufen.
-- 3. `UNIQUE(event_log_id, activity_name)` wie in der Vorlage. Ein
--    Aktivitaetsname kann je Protokoll genau einmal zugeordnet sein — zwei
--    widersprechende Zuordnungen wuerden die Abdeckungsquote ueber 100 %
--    treiben.
-- 4. `confidence numeric(5,4)` mit CHECK 0…1. Eine Zahl ohne Grenzen waere
--    nicht vergleichbar, und ein Prozentwert (0…100) haette sich mit dem
--    0…1-Vertrag der Diagrammschicht gebissen.
-- 5. `mapped_by` mit ON DELETE SET NULL: wer die Zuordnung von Hand gesetzt
--    hat, ist eine Zusatzangabe; ein geloeschter Benutzer darf die Zuordnung
--    nicht mitnehmen.
--
-- ── Audit-Trigger: NEIN, und das ist die begruendete Ausnahme (S03-13) ─
-- Diese Tabelle wird im Regelfall MASCHINELL und in EINEM ZUG befuellt: ein
-- Ereignisimport mit 400 verschiedenen Aktivitaetsnamen erzeugt 400 Zeilen.
-- Ein Audit-Trigger schriebe dafuer 400 Eintraege mit vollstaendigem
-- Zeilenabbild in `audit_log` — in eine hashverkettete Tabelle, deren Zweck
-- es ist, seltene und bedeutsame Aenderungen nachweisbar zu halten. Das
-- verduennt den Nachweis, statt ihn zu staerken.
--
-- Was statt dessen den Nachweis traegt: (a) `process_event_log.imported_by` /
-- `imported_at` — der Import ist das Ereignis, das jemand ausgeloest hat, und
-- er ist bereits belegt; (b) `mapped_by` / `mapped_at` an der Zeile selbst,
-- das die HAENDISCHE Zuordnung (`match_kind = 'manual'`) namentlich festhaelt
-- — und genau die ist die Ermessensentscheidung, die eine Abdeckungsquote
-- verschieben kann. Die Angabe ist damit nicht weg, sie steht nur dort, wo
-- sie ohne Verduennung ablesbar ist.

CREATE TABLE IF NOT EXISTS process_event_activity_map (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organization(id),
  event_log_id    uuid NOT NULL REFERENCES process_event_log(id) ON DELETE CASCADE,
  activity_name   varchar(500) NOT NULL,
  process_step_id uuid REFERENCES process_step(id) ON DELETE SET NULL,
  match_kind      varchar(12) NOT NULL DEFAULT 'unmapped'
                    CHECK (match_kind IN ('exact', 'normalized', 'fuzzy',
                                          'manual', 'unmapped')),
  confidence      numeric(5, 4)
                    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  mapped_by       uuid REFERENCES "user"(id) ON DELETE SET NULL,
  mapped_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS peam_org_idx ON process_event_activity_map (org_id);
CREATE INDEX IF NOT EXISTS peam_log_idx ON process_event_activity_map (event_log_id);
CREATE INDEX IF NOT EXISTS peam_step_idx ON process_event_activity_map (process_step_id);
CREATE INDEX IF NOT EXISTS peam_mapped_by_idx ON process_event_activity_map (mapped_by);
CREATE UNIQUE INDEX IF NOT EXISTS peam_log_activity_uniq
  ON process_event_activity_map (event_log_id, activity_name);

COMMENT ON TABLE process_event_activity_map IS
  'STUFE2-E: Zuordnung Aktivitaetsname des Ereignisprotokolls -> Prozessschritt. Liefert die Abdeckungsquote, ohne die conformanceGate die Heatmap F7 verweigert. Bewusst ohne Audit-Trigger — Begruendung im Kopfkommentar der Migration.';
COMMENT ON COLUMN process_event_activity_map.mapped_by IS
  'Wer die Zuordnung gesetzt hat. Traegt zusammen mit process_event_log.imported_by den Nachweis, den diese Tabelle bewusst nicht ueber audit_log fuehrt.';

ALTER TABLE process_event_activity_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_event_activity_map FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS process_event_activity_map_org_isolation ON process_event_activity_map;
CREATE POLICY process_event_activity_map_org_isolation ON process_event_activity_map FOR ALL
  USING      (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid)
  WITH CHECK (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid);

DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON process_event_activity_map TO grc_app;
  END IF;
END $g$;
