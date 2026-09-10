-- Migration 0417: Provenienz für persistierte KI-Ausgaben
--
-- Migration: 0417_ai_output_provenance
-- Breaking: no
-- Estimated-Duration: 5
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP6 · S05-09, S05-11, S05-12]
--
-- Drei Tabellen nehmen KI-Ausgaben dauerhaft auf:
--   soa_ai_suggestion         (SoA-Lückenanalyse)
--   maturity_roadmap_action   (Reifegrad-Roadmap)
--   regulatory_relevance_score(unbeaufsichtigter Cron)
--
-- Keine von ihnen hielt fest, WELCHES Modell bei WELCHEM Provider die
-- Bewertung erzeugt hat. Damit ist weder AI Act Art. 12
-- („record-keeping") erfüllt noch die naheliegendste Frage eines
-- Auditors zu beantworten: „Auf welcher Grundlage steht diese Zeile?"
--
-- `regulatory_relevance_score` bekommt zusätzlich `is_ai_generated` und
-- `review_status`. Hintergrund ist S05-09: der Cron persistierte bei
-- unparsebarer Modellantwort eine Ersatzbewertung von 50 mit der
-- Begründung „Unable to parse AI response" — nicht von einer echten
-- Bewertung unterscheidbar. Der Code schreibt in diesem Fall jetzt gar
-- nichts mehr; die Spalten machen den Charakter der verbleibenden Zeilen
-- trotzdem explizit, damit Bestandsdaten und Neubestand unterscheidbar
-- bleiben.

ALTER TABLE soa_ai_suggestion
  ADD COLUMN IF NOT EXISTS ai_provider     varchar(32),
  ADD COLUMN IF NOT EXISTS ai_model        varchar(120),
  ADD COLUMN IF NOT EXISTS prompt_sha256   char(64),
  ADD COLUMN IF NOT EXISTS egress_log_id   uuid;

ALTER TABLE maturity_roadmap_action
  ADD COLUMN IF NOT EXISTS ai_provider     varchar(32),
  ADD COLUMN IF NOT EXISTS ai_model        varchar(120),
  ADD COLUMN IF NOT EXISTS prompt_sha256   char(64),
  ADD COLUMN IF NOT EXISTS egress_log_id   uuid;

ALTER TABLE regulatory_relevance_score
  ADD COLUMN IF NOT EXISTS ai_provider     varchar(32),
  ADD COLUMN IF NOT EXISTS ai_model        varchar(120),
  ADD COLUMN IF NOT EXISTS prompt_sha256   char(64),
  ADD COLUMN IF NOT EXISTS egress_log_id   uuid,
  ADD COLUMN IF NOT EXISTS is_ai_generated boolean NOT NULL DEFAULT true,
  -- 'unreviewed' — unbeaufsichtigt erzeugt, noch nicht fachlich bestätigt
  -- 'confirmed' / 'rejected' — nach menschlicher Durchsicht
  ADD COLUMN IF NOT EXISTS review_status   varchar(20) NOT NULL DEFAULT 'unreviewed';

-- Bestandsdaten: die Platzhalterbewertungen des alten Codepfads sind an
-- ihrer Begründung eindeutig erkennbar. Sie werden nicht gelöscht (das
-- wäre ein Eingriff in den Datenbestand des Betreibers), aber als das
-- markiert, was sie sind.
UPDATE regulatory_relevance_score
   SET review_status = 'rejected',
       reasoning = reasoning || ' [ARCTOS WP6/S05-09: Ersatzbewertung des alten Codepfads, keine Modellaussage]'
 WHERE reasoning = 'Unable to parse AI response';

CREATE INDEX IF NOT EXISTS rrs_review_status_idx
  ON regulatory_relevance_score (org_id, review_status);
