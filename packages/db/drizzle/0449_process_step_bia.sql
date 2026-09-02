-- 0449_process_step_bia.sql
--
-- Migration: 0449_process_step_bia
-- Breaking: no
-- Estimated-Duration: 5
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [STUFE2-E · Schema fuer die zehn leeren GRC-Layer,
--  docs/bpmn-engine/STUFE2-E-SCHEMA.md; Bedarf: STUFE2-A2-GRC.md §5.1]
--
-- Schaltet zwei der zehn leeren Layer frei: `bcm` (§3.10 — Formkodierung nach
-- Kritikalitaet, RTO/RPO/MTPD im Gutter, Ausweichverfahren im Slot BL) und
-- `outage` (F6 — die Ausfallsimulation samt MTPD-Reisspunkt).
--
-- ── Warum die Elementebene den Unterschied macht ────────────────────
-- `bia_process_impact` gibt es seit dem BCM-Modul, aber je Prozess
-- (`process_id`) und in STUNDEN. §3.10 rechnet den Reisspunkt eines Prozesses
-- als MINIMUM ueber die betroffenen SCHRITTE — ohne Elementebene gaebe es
-- nichts zu minimieren, und die Zahl in der Kopfzeile ("Reisspunkt in 1 h
-- 45 min") waere geschaetzt statt gerechnet. Eine geschaetzte Zahl in einer
-- Kontinuitaetsaussage ist schlimmer als keine: sie sieht aus wie ein
-- Messwert.
--
-- ── Entscheidungen, die die Vorlage offen laesst ─────────────────────
-- 1. MINUTEN, nicht Stunden. `bia_process_impact` fuehrt `mtpd_hours`,
--    `rto_hours`, `rpo_hours`. Der Vertrag und `simulateOutage` rechnen in
--    Minuten, und die Aufloesung wird gebraucht: ein RPO von 15 Minuten ist
--    in Stunden nicht darstellbar, und genau solche Werte stehen in
--    IT-Kontinuitaetsplaenen. Die Prozessebene bleibt unangetastet; der
--    Endpunkt liest ausschliesslich diese Tabelle, mischt also keine
--    Einheiten.
-- 2. `criticality` als CHECK-Werteliste ueber die vier Vertragsstufen. Der
--    Vertrag fuehrt `GrcBia.criticality` als PFLICHTFELD — ein Schritt ohne
--    Kritikalitaet kann in dieser Sicht nichts aussagen. Deshalb NOT NULL
--    ohne Vorgabewert: wer eine BIA-Zeile anlegt, muss die Einstufung
--    nennen. Ein Vorgabewert waere hier eine Behauptung.
-- 3. `UNIQUE(process_step_id)` — 1:1, wie bei `process_step_ropa` und aus
--    demselben Grund (der Vertrag fuehrt `bia` als Einzelobjekt).
-- 4. `workaround_max_duration_minutes` mit CHECK >= 0 und ausdruecklich
--    zugelassener 0: `simulateOutage` wertet 0 als "traegt nicht" und laesst
--    den Schritt trotzdem als blockiert gelten (STUFE2-A2-GRC.md §7.4). Die
--    0 ist also eine Aussage, kein fehlender Wert — sie darf nicht verboten
--    und nicht auf NULL normalisiert werden.
-- 5. `impact_categories jsonb` mit Vorgabewert `[]`: die Vorlage nennt das
--    Feld ohne Struktur, und die Diagrammschicht liest es heute nicht. Ein
--    Enum oder eine Kindtabelle waere hier eine Festlegung ohne Verbraucher.
--    jsonb haelt die Stelle frei, ohne eine Struktur zu behaupten.
--
-- ── Audit-Trigger: ja (S03-13) ──────────────────────────────────────
-- MTPD/RTO/RPO sind die Zahlen, gegen die eine ISO-22301- bzw.
-- BSI-200-4-Pruefung den Kontinuitaetsplan haelt. Wer sie nach einem
-- gescheiterten Wiederanlauftest nach oben korrigiert, muss das erklaeren
-- koennen.

CREATE TABLE IF NOT EXISTS process_step_bia (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organization(id),
  process_step_id       uuid NOT NULL REFERENCES process_step(id) ON DELETE CASCADE,
  criticality           varchar(10) NOT NULL
                          CHECK (criticality IN ('very_high', 'high', 'medium', 'low')),
  mtpd_minutes          integer CHECK (mtpd_minutes IS NULL OR mtpd_minutes >= 0),
  rto_minutes           integer CHECK (rto_minutes  IS NULL OR rto_minutes  >= 0),
  rpo_minutes           integer CHECK (rpo_minutes  IS NULL OR rpo_minutes  >= 0),
  impact_categories     jsonb NOT NULL DEFAULT '[]'::jsonb,
  workaround            text,
  workaround_max_duration_minutes integer
                          CHECK (workaround_max_duration_minutes IS NULL
                                 OR workaround_max_duration_minutes >= 0),
  bia_assessment_id     uuid REFERENCES bia_assessment(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid,
  updated_by            uuid
);

CREATE INDEX IF NOT EXISTS process_step_bia_org_idx ON process_step_bia (org_id);
CREATE INDEX IF NOT EXISTS process_step_bia_assessment_idx
  ON process_step_bia (bia_assessment_id);
CREATE UNIQUE INDEX IF NOT EXISTS process_step_bia_step_uniq
  ON process_step_bia (process_step_id);

COMMENT ON TABLE process_step_bia IS
  'STUFE2-E: Kontinuitaetskennzahlen je Prozessschritt in MINUTEN. Schaltet den bcm-Layer (§3.10) und die Ausfallsimulation F6 frei; der MTPD-Reisspunkt ist damit gerechnet statt geschaetzt.';
COMMENT ON COLUMN process_step_bia.workaround_max_duration_minutes IS
  'Wie lange das Ausweichverfahren traegt. 0 ist eine Aussage, kein fehlender Wert: simulateOutage wertet 0 als "traegt nicht" (STUFE2-A2-GRC.md §7.4).';

ALTER TABLE process_step_bia ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_step_bia FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS process_step_bia_org_isolation ON process_step_bia;
CREATE POLICY process_step_bia_org_isolation ON process_step_bia FOR ALL
  USING      (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid)
  WITH CHECK (org_id = (NULLIF(current_setting('app.current_org_id', true), ''))::uuid);

DO $g$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON process_step_bia TO grc_app;
  END IF;
END $g$;

DROP TRIGGER IF EXISTS set_updated_at ON process_step_bia;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON process_step_bia
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS audit_trigger ON process_step_bia;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON process_step_bia
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
