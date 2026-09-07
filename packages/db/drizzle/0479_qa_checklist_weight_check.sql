-- 0479_qa_checklist_weight_check.sql
--
-- Migration: 0479_qa_checklist_weight_check
-- Breaking: no
-- Estimated-Duration: 1
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 · N-1 aus Welle 4b-6 §8] Die Datenbank nimmt ein
-- Gewicht an, das fachlich keines ist.
--
-- ── Befund ──────────────────────────────────────────────────────────
-- `audit_qa_checklist_item.weight` ist `integer NOT NULL DEFAULT 3` OHNE
-- CHECK-Constraint. Gemessen am 2026-09-07 gegen `grc_v4c`:
--
--     Table "public.audit_qa_checklist_item"
--      weight | integer | not null | 3
--     (keine Check constraints)
--
-- Welle 4b-6 hat die ANWENDUNG gegen jedes Gewicht abgesichert
-- (`computeQaScore`, `packages/shared/src/schemas/audit-advanced.ts:213`):
-- Positionen mit `weight <= 0` oder nicht-endlichem Gewicht fallen aus der
-- Bewertung heraus, und die Wache fragt nach uebrigem GEWICHT statt nach
-- uebrigen Positionen. Vorher war messbar:
--
--     [{compliant, 0}]                    -> score = NaN        (JSON: null)
--     [{compliant,-1},{non_compliant,1}]  -> score = -Infinity
--     [{compliant, 5},{non_compliant,-1}] -> score = 125, rating "green"
--
-- Der letzte Fall ist der schwerste: ein negatives Gewicht war ein Hebel,
-- mit dem sich eine gruene QA-Bewertung erzeugen liess, obwohl eine Position
-- nicht konform ist.
--
-- ── Warum hier und nicht im Zod-Schema ──────────────────────────────
-- `weight` steht in KEINEM Zod-Schema. `updateQaChecklistSchema`
-- (`packages/shared/src/schemas/audit-advanced.ts:162`) traegt `id`,
-- `compliance` und `reviewerComment`; das Gewicht kommt ausschliesslich aus
-- der Vorlage `QA_CHECKLIST_TEMPLATE` der POST-Route und wird ueber keine
-- Route geschrieben. Eine Zod-Regel fuer ein Feld, das niemand sendet, waere
-- eine Kontrolle ohne Wirkung. Die einzige Stelle, an der ein negatives
-- Gewicht heute noch entstehen kann, ist ein direkter Schreibzugriff auf die
-- Tabelle — also genau die Schicht, die dieser Constraint deckt.
--
-- ── Warum `> 0` und nicht `>= 0` ────────────────────────────────────
-- Ein Gewicht 0 heisst fachlich „zaehlt nicht" — und dafuer gibt es bereits
-- einen Wert: `compliance = 'not_applicable'`. Zwei Wege, dasselbe zu sagen,
-- sind einer zu viel; `computeQaScore` behandelt beide seit Welle 4b-6
-- ohnehin identisch.
--
-- ── Bestandsdaten ───────────────────────────────────────────────────
-- Gemessen am 2026-09-07 gegen `grc_v4c` (428 Migrationen, 617 Tabellen):
--
--     select count(*), min(weight), max(weight),
--            count(*) filter (where weight <= 0)
--       from audit_qa_checklist_item;
--     -> 0 | (null) | (null) | 0
--
-- Die Tabelle ist leer, die Normalisierung unten ist also in dieser Umgebung
-- ein No-op. Sie steht trotzdem da, weil eine Migration, die auf fremden
-- Bestandsdaten scheitern kann, keine Migration ist. Sie ist
-- bedeutungserhaltend: `computeQaScore` behandelt `weight <= 0` bereits wie
-- `not_applicable`, die Zeile bekommt also genau die Bedeutung
-- geschrieben, nach der sie schon bewertet wurde.

DO $$
DECLARE
  offending integer;
BEGIN
  SELECT count(*) INTO offending
    FROM audit_qa_checklist_item
   WHERE weight <= 0;

  IF offending > 0 THEN
    RAISE NOTICE
      '0479: % Zeile(n) mit weight <= 0 auf not_applicable/weight=3 normalisiert.',
      offending;

    UPDATE audit_qa_checklist_item
       SET compliance = 'not_applicable',
           weight     = 3
     WHERE weight <= 0;
  END IF;
END
$$;

ALTER TABLE audit_qa_checklist_item
  ADD CONSTRAINT audit_qa_checklist_item_weight_positive
  CHECK (weight > 0);

COMMENT ON CONSTRAINT audit_qa_checklist_item_weight_positive
  ON audit_qa_checklist_item IS
  'N-1 (Welle 6a): ein Gewicht <= 0 ist kein Gewicht. Fachlich heisst es '
  '''not_applicable'' — dafuer gibt es die Spalte compliance. Ein negatives '
  'Gewicht war ein Hebel fuer eine gruene QA-Bewertung trotz nicht konformer '
  'Position (score 125/green, gemessen in Welle 4b-6).';
