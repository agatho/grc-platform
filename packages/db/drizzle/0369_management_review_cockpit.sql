-- ============================================================================
-- Migration 0369: Management-Review-Cockpit (ISO 27001 Kap. 9.3)
--
-- Kontext (2026-07-11): Das Management-Review-Modul (management_review,
-- Migration 0014 Sprint 5b) traegt Beschluesse/Massnahmen bislang nur als
-- unstrukturierte jsonb-Felder (decisions, action_items). Das Cockpit macht
-- daraus ein strukturiertes Protokoll:
--
--   1. management_review: + completed_at (Abschluss-Zeitstempel, gesetzt beim
--      Uebergang in_progress -> completed), + period_start/period_end
--      (konfigurierbarer Review-Zeitraum fuer die 9.3-Input-Aggregation;
--      Fallback = seit letztem completed Review).
--   2. management_review_item: strukturierte Review-Punkte (Kategorie,
--      Feststellung, Beschluss, optionale Massnahme als work_item-FK).
--   3. work_item_type 'management_review_action': Typ fuer Massnahmen, die
--      aus einem Review-Beschluss heraus angelegt werden.
--   4. RLS (ENABLE + FORCE + Policy mit USING/WITH CHECK, Pattern 0360) und
--      Audit-Trigger-Registrierung (Guard-Pattern 0357/0360).
--
-- Idempotent: alle Statements mit IF NOT EXISTS / ON CONFLICT / Guards.
-- ============================================================================

-- ============================================================
-- 1) management_review: Cockpit-Spalten
-- ============================================================

ALTER TABLE management_review
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE management_review
  ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE management_review
  ADD COLUMN IF NOT EXISTS period_end DATE;

COMMENT ON COLUMN management_review.completed_at IS
  'Gesetzt beim Statusuebergang -> completed; Review ist danach read-only (Items 422).';
COMMENT ON COLUMN management_review.period_start IS
  'Optionaler Beginn des Review-Zeitraums fuer die 9.3-Input-Aggregation. NULL = seit letztem completed Review.';
COMMENT ON COLUMN management_review.period_end IS
  'Optionales Ende des Review-Zeitraums. NULL = review_date.';

-- ============================================================
-- 2) work_item_type: Massnahmen aus Review-Beschluessen
-- ============================================================

INSERT INTO work_item_type (type_key, display_name_de, display_name_en, icon, color_class, primary_module, secondary_modules, has_due_date, has_linked_asset, has_cia_evaluation, is_cross_module, nav_order)
VALUES ('management_review_action', 'Management-Review-Maßnahme', 'Management Review Action', 'check-circle', 'text-slate-600', 'isms', '{}', true, false, false, true, 99)
ON CONFLICT (type_key) DO NOTHING;

-- ============================================================
-- 3) management_review_item — strukturierte Review-Punkte
-- ============================================================

CREATE TABLE IF NOT EXISTS management_review_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id),
  review_id UUID NOT NULL REFERENCES management_review(id) ON DELETE CASCADE,
  -- Input-Kategorie nach ISO 27001 9.3.2 (Zod-validiert; VARCHAR statt Enum,
  -- damit neue Kategorien ohne Enum-Migration ergaenzt werden koennen)
  category VARCHAR(50) NOT NULL,
  -- Feststellung (vorbefuellt aus dem Cockpit-Dashboard oder manuell)
  content TEXT NOT NULL,
  -- Management-Beschluss zu dieser Feststellung
  decision TEXT,
  -- Optionale Massnahme: FK auf work_item (typeKey management_review_action)
  action_work_item_id UUID REFERENCES work_item(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES "user"(id),
  updated_by UUID REFERENCES "user"(id)
);

-- Prefix mgmt_review_item_ (NICHT mri_): mri_org_idx ist bereits von
-- maturity_roadmap_item (0245) belegt — Indexnamen sind schema-global.
CREATE INDEX IF NOT EXISTS mgmt_review_item_org_idx ON management_review_item(org_id);
CREATE INDEX IF NOT EXISTS mgmt_review_item_review_idx ON management_review_item(review_id, sort_order);
CREATE INDEX IF NOT EXISTS mgmt_review_item_action_wi_idx ON management_review_item(action_work_item_id);

-- ============================================================
-- 4) RLS: ENABLE + FORCE + Policy (USING + WITH CHECK) — Pattern 0360
-- ============================================================

DO $$ BEGIN
  EXECUTE 'ALTER TABLE management_review_item ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE management_review_item FORCE ROW LEVEL SECURITY';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'management_review_item RLS enable/force: %', SQLERRM;
END $$;

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS rls_management_review_item ON management_review_item';
  EXECUTE 'CREATE POLICY rls_management_review_item ON management_review_item ' ||
          'FOR ALL ' ||
          'USING (org_id = current_setting(''app.current_org_id'')::uuid) ' ||
          'WITH CHECK (org_id = current_setting(''app.current_org_id'')::uuid)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'management_review_item policy: %', SQLERRM;
END $$;

-- ============================================================
-- 5) Audit-Trigger — Guard-Pattern 0357/0360 (idempotent)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN
    RAISE NOTICE '[0369] audit_trigger() fehlt - Block uebersprungen';
    RETURN;
  END IF;
  IF to_regclass('public.management_review_item') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_trigger tg
    JOIN pg_proc pr ON pr.oid = tg.tgfoid
    WHERE tg.tgrelid = to_regclass('public.management_review_item')
      AND pr.proname = 'audit_trigger' AND NOT tg.tgisinternal
  ) THEN
    CREATE TRIGGER management_review_item_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON management_review_item
      FOR EACH ROW EXECUTE FUNCTION audit_trigger();
  END IF;
END $$;
