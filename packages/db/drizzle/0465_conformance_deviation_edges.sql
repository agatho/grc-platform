-- 0465_conformance_deviation_edges.sql
--
-- Migration: 0465_conformance_deviation_edges
-- Breaking: no
-- Estimated-Duration: 5
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 · OP-014]
--
-- `GrcConformanceSummary.deviations` (packages/bpmn/src/grc/contract.ts) will
-- ein KANTENPAAR: `fromElementId`, `toElementId`, `frequency`, `share`. Die
-- einzige Quelle, die es dafuer gab, war `process_conformance_result.fitness_gaps`
-- — und die fuehrt Knoten: `{activity, frequency, …}`. Aus einem Knoten ein Paar
-- zu machen waere geraten, also blieb das Feld leer, dauerhaft, und der Layer
-- zeigte nie eine Abweichung an. Das stand ehrlich in `MISSING_TODAY`
-- (apps/web/src/lib/grc-overlay.ts) — aber ehrlich leer ist immer noch leer.
--
-- Diese Spalte traegt die fehlende Groesse: beobachtete Uebergaenge zwischen
-- zwei modellierten Schritten, die das Modell nicht direkt verbindet. Erhoben
-- wird sie dort, wo die Spur noch vollstaendig vorliegt — im Cron
-- `process-mining-conformance`, waehrend er ohnehin ueber jede Spur laeuft —
-- statt sie spaeter aus Aggregaten zu rekonstruieren.
--
-- Warum `jsonb` und keine eigene Tabelle: die Nachbarspalten (`fitness_gaps`,
-- `rework_loops`, `bottlenecks`) sind es auch. Der Datensatz ist als Ganzes
-- das Analyseergebnis eines Laufs, wird als Ganzes ersetzt (der Cron loescht
-- und schreibt neu) und nie einzeln abgefragt. Eine Tabelle daneben haette
-- eine zweite Loeschregel und einen zweiten Lebenszyklus gebraucht, ohne eine
-- Frage zu beantworten, die heute jemand stellt.
--
-- Bestandszeilen bekommen `'[]'` — kein Rueckwaertsrechnen. Die Rohereignisse
-- eines schon analysierten Protokolls stehen zwar noch in `process_event`, aber
-- ein Nachtrag waere eine zweite Auswertung mit einer anderen Codeversion unter
-- demselben `computed_at`. Der naechste Lauf des Crons fuellt sie richtig.

DO $$ BEGIN
  IF to_regclass('public.process_conformance_result') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = 'public'
                        AND table_name = 'process_conformance_result'
                        AND column_name = 'deviation_edges')
  THEN
    ALTER TABLE process_conformance_result
      ADD COLUMN deviation_edges jsonb NOT NULL DEFAULT '[]'::jsonb;

    COMMENT ON COLUMN process_conformance_result.deviation_edges IS
      'OP-014: beobachtete Uebergaenge zwischen zwei modellierten Schritten, '
      'die das Modell nicht direkt verbindet. Form: [{fromElementId, '
      'toElementId, frequency, share}] mit BPMN-Elementkennungen aus '
      'process_step.bpmn_element_id. Quelle fuer '
      'GrcConformanceSummary.deviations; fitness_gaps fuehrt Knoten und kann '
      'das nicht leisten.';
  END IF;
END $$;
