-- ============================================================================
-- Migration 0290: Audit-Finding-Klassifikation nach ISO 19011 + ISO/IEC 17021-1
--
-- Die bisherige checklist_result-Klassifikation (conforming / nonconforming /
-- observation / not_applicable) ist zu grob für den DAkkS-/TÜV-Praxisstandard.
-- Auditor:innen benötigen die feinere Differenzierung, die auch in ISO 19011
-- § 3.4 / ISO 17021-1 § 9.4.8 vorgesehen ist:
--
--   positive                   — Positive Feststellung / Commendation
--                                (Best-Practice-Umsetzung, keine Maßnahme nötig)
--   conforming                 — Konform (keine Abweichung)
--   opportunity_for_improvement — Hinweis / Verbesserungspotenzial (OFI)
--                                (nicht bindend, Empfehlung)
--   observation                — Feststellung / Beobachtung
--                                (noch keine Abweichung, aber Aufmerksamkeit nötig)
--   minor_nonconformity        — Nebenabweichung (Minor NC)
--                                (isolierte Lücke, Korrektur in Standard-Frist)
--   major_nonconformity        — Hauptabweichung (Major NC)
--                                (systemisches Versagen, zertifizierungsrelevant)
--   nonconforming              — [DEPRECATED] Legacy-Wert für Altdaten
--   not_applicable             — N/A
--
-- Zusätzlich erweitern wir audit_checklist_item um die Felder, die ISO 19011
-- § 6.4.7 ("Erfassung von Auditnachweisen") für ein prüfungssicheres
-- Arbeitspapier verlangt: Kriterium, Methode, Interviewpartner, Stichprobe,
-- Risikobewertung, Korrekturmaßnahmen-Vorschlag, Frist.
--
-- Idempotent: ADD VALUE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS.
-- ============================================================================

-- ── Enum erweitern ────────────────────────────────────────────────────
ALTER TYPE checklist_result ADD VALUE IF NOT EXISTS 'positive';
ALTER TYPE checklist_result ADD VALUE IF NOT EXISTS 'opportunity_for_improvement';
ALTER TYPE checklist_result ADD VALUE IF NOT EXISTS 'minor_nonconformity';
ALTER TYPE checklist_result ADD VALUE IF NOT EXISTS 'major_nonconformity';

-- Altdaten auf die neue differenzierte Klassifikation heben:
-- „nonconforming" war bisher einheitlich alles von OFI bis Hauptabweichung.
-- Wir mappen konservativ auf Nebenabweichung — jede konkretere Bewertung
-- muss der Auditor manuell nacherfassen.
UPDATE audit_checklist_item
SET result = 'minor_nonconformity'::checklist_result
WHERE result = 'nonconforming'::checklist_result;

-- ── Neue Spalten für tiefere Auditor-Erfassung ────────────────────────
ALTER TABLE audit_checklist_item
  ADD COLUMN IF NOT EXISTS criterion_reference VARCHAR(200);
COMMENT ON COLUMN audit_checklist_item.criterion_reference IS
  'ISO 19011 § 6.4.5: Audit-Kriterium gegen das geprüft wurde (z.B. "ISO 27001 A.5.1", "CIS v8 IG2-06.8")';

ALTER TABLE audit_checklist_item
  ADD COLUMN IF NOT EXISTS audit_method VARCHAR(50);
COMMENT ON COLUMN audit_checklist_item.audit_method IS
  'ISO 19011 § 6.4.7: Methode zur Evidenzerhebung — interview, document_review, observation, technical_test, sampling, walkthrough';

ALTER TABLE audit_checklist_item
  ADD COLUMN IF NOT EXISTS interviewee VARCHAR(200);
COMMENT ON COLUMN audit_checklist_item.interviewee IS
  'Name der auditierten Person (bei method=interview)';

ALTER TABLE audit_checklist_item
  ADD COLUMN IF NOT EXISTS interviewee_role VARCHAR(200);
COMMENT ON COLUMN audit_checklist_item.interviewee_role IS
  'Rolle/Funktion der auditierten Person (z.B. CISO, IT-Leitung, Prozess-Eigner)';

ALTER TABLE audit_checklist_item
  ADD COLUMN IF NOT EXISTS sample_size INTEGER;
COMMENT ON COLUMN audit_checklist_item.sample_size IS
  'Anzahl geprüfter Elemente in der Stichprobe (bei method=sampling/technical_test)';

ALTER TABLE audit_checklist_item
  ADD COLUMN IF NOT EXISTS sample_ids TEXT[];
COMMENT ON COLUMN audit_checklist_item.sample_ids IS
  'IDs/Referenzen der gezogenen Stichprobe (Ticket-Nr., User-IDs, Change-Requests, …)';

ALTER TABLE audit_checklist_item
  ADD COLUMN IF NOT EXISTS risk_rating VARCHAR(20);
COMMENT ON COLUMN audit_checklist_item.risk_rating IS
  'Risikobewertung der Abweichung falls NC — low/medium/high/critical (ISO 31000 § 6.4.3)';

ALTER TABLE audit_checklist_item
  ADD COLUMN IF NOT EXISTS corrective_action_suggestion TEXT;
COMMENT ON COLUMN audit_checklist_item.corrective_action_suggestion IS
  'Vorschlag für Korrekturmaßnahme (ISO 27001 § 10.1 / ISO 9001 § 10.2)';

ALTER TABLE audit_checklist_item
  ADD COLUMN IF NOT EXISTS remediation_deadline DATE;
COMMENT ON COLUMN audit_checklist_item.remediation_deadline IS
  'Frist bis zu der die Korrekturmaßnahme umgesetzt/verifiziert sein muss';

-- ── Check-Constraint für risk_rating ─────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'audit_checklist_item_risk_rating_check'
  ) THEN
    ALTER TABLE audit_checklist_item
      ADD CONSTRAINT audit_checklist_item_risk_rating_check
      CHECK (risk_rating IS NULL OR risk_rating IN ('low', 'medium', 'high', 'critical'));
  END IF;
END $$;

-- ── Check-Constraint für audit_method ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'audit_checklist_item_method_check'
  ) THEN
    ALTER TABLE audit_checklist_item
      ADD CONSTRAINT audit_checklist_item_method_check
      CHECK (audit_method IS NULL OR audit_method IN (
        'interview', 'document_review', 'observation',
        'technical_test', 'sampling', 'walkthrough', 'reperformance'
      ));
  END IF;
END $$;

-- ── Index für Remediation-Fristen (Reporting „was ist überfällig?") ──
CREATE INDEX IF NOT EXISTS aci_remediation_deadline_idx
  ON audit_checklist_item (remediation_deadline)
  WHERE remediation_deadline IS NOT NULL;
