-- ============================================================================
-- Migration 0291: audit_method (single) → audit_methods (multi)
--
-- In der Praxis werden einzelne Audit-Kriterien oft mit MEHREREN Methoden
-- geprüft — z. B. Interview mit dem Prozess-Eigner PLUS Dokumentenprüfung
-- der Richtlinie PLUS Beobachtung vor Ort PLUS technischer Test (Config-
-- Screenshot). ISO 19011 § 6.4.7 Abs. 2: „Audit evidence should be obtained
-- using an appropriate combination of methods".
--
-- Idempotent: ADD/DROP per IF NOT EXISTS / IF EXISTS.
-- ============================================================================

-- ── Neue Array-Spalte ───────────────────────────────────────────────
ALTER TABLE audit_checklist_item
  ADD COLUMN IF NOT EXISTS audit_methods TEXT[];

COMMENT ON COLUMN audit_checklist_item.audit_methods IS
  'ISO 19011 § 6.4.7: Methoden-Kombination zur Evidenzerhebung. Array-Werte aus: interview, document_review, observation, technical_test, sampling, walkthrough, reperformance.';

-- ── Altdaten ins Array kopieren ─────────────────────────────────────
UPDATE audit_checklist_item
SET audit_methods = ARRAY[audit_method]
WHERE audit_method IS NOT NULL
  AND (audit_methods IS NULL OR cardinality(audit_methods) = 0);

-- ── Alten Check-Constraint auf audit_method entfernen ───────────────
ALTER TABLE audit_checklist_item
  DROP CONSTRAINT IF EXISTS audit_checklist_item_method_check;

-- ── Alte Single-Spalte droppen ──────────────────────────────────────
ALTER TABLE audit_checklist_item
  DROP COLUMN IF EXISTS audit_method;

-- ── Check-Constraint: jedes Array-Element muss ein gültiger Wert sein ─
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'audit_checklist_item_methods_check'
  ) THEN
    ALTER TABLE audit_checklist_item
      ADD CONSTRAINT audit_checklist_item_methods_check
      CHECK (
        audit_methods IS NULL
        OR audit_methods <@ ARRAY[
          'interview','document_review','observation',
          'technical_test','sampling','walkthrough','reperformance'
        ]::text[]
      );
  END IF;
END $$;

-- GIN-Index auf das Methoden-Array für „zeig alle Interviews"-Filter
CREATE INDEX IF NOT EXISTS aci_audit_methods_idx
  ON audit_checklist_item USING gin (audit_methods);
