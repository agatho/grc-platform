-- ============================================================================
-- Migration 0295: audit_trigger Lücke auf Audit-Modul-Tabellen schließen
--
-- Migration 0017 hat audit_trigger nur auf audit, audit_plan und audit_checklist
-- registriert. Die übrigen Audit-Tabellen (universe_entry, plan_item, activity,
-- checklist_item, evidence) sind seit Sprint 8 ohne Audit-Logging gelaufen.
-- Bei den 0290–0292 Änderungen kamen mit method_entries, riskRating,
-- remediationDeadline u.a. besonders sensible Felder auf audit_checklist_item
-- — Änderungen an Auditor-Bewertungen MÜSSEN in audit_log nachvollziehbar
-- sein (CLAUDE.md Core Design Principle 3 + ISO 27001 § 9.2).
--
-- Idempotent via DROP TRIGGER IF EXISTS + CREATE.
-- ============================================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'audit_universe_entry',
    'audit_plan_item',
    'audit_activity',
    'audit_checklist_item',
    'audit_evidence'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Nur registrieren wenn die Tabelle existiert (defensive — falls
    -- in einer alten DB einer der Sprint-8-Tabellen umbenannt wurde).
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_trigger ON %I', t);
      EXECUTE format(
        'CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_trigger()',
        t
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON TRIGGER audit_trigger ON audit_checklist_item IS
  'ISO 27001 § 9.2 / ISO 17021-1 § 9.4.7: jede Änderung an einer Audit-Bewertung (result, method_entries, riskRating, remediationDeadline, correctiveActionSuggestion, …) muss in audit_log nachvollziehbar sein.';
