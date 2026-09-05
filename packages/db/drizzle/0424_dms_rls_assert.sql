-- Migration 0424: RLS auf den Signaturtabellen wird zugesichert statt gehofft
--
-- Migration: 0424_dms_rls_assert
-- Breaking: no
-- Estimated-Duration: 1
-- Locking: none
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP7 · S06-22]
--
-- 0375:137-169 kapselt das Aktivieren von RLS und das Anlegen der Policies in
--
--   DO $$ BEGIN
--     EXECUTE 'ALTER TABLE document_signature ENABLE ROW LEVEL SECURITY';
--     …
--   EXCEPTION WHEN OTHERS THEN
--     RAISE NOTICE '…: %', SQLERRM;
--   END $$;
--
-- Schlaegt eine dieser Anweisungen fehl, laeuft die Migration ERFOLGREICH
-- durch und die Tabelle bleibt ohne Mandantentrennung — im Protokoll steht
-- nur ein NOTICE. In einem Produkt, das 43 dauerhaft fehlschlagende
-- Migrationen hatte, ist ein Fehlerbild, das nicht rot wird, ein reales
-- Risiko. 0375 selbst ist ausgeliefert und wird nicht angefasst; diese
-- Migration stellt den Zustand her UND prueft ihn hart nach.

DO $$
DECLARE
  t          text;
  v_rls      boolean;
  v_force    boolean;
  v_policies integer;
  v_missing  text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY['document_signature', 'document_signature_request']
  LOOP
    -- Herstellen (idempotent, ohne EXCEPTION-Mantel: ein Fehler hier MUSS
    -- die Migration abbrechen).
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

    SELECT c.relrowsecurity, c.relforcerowsecurity
      INTO v_rls, v_force
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname = t AND n.nspname = 'public';

    SELECT count(*) INTO v_policies FROM pg_policies
     WHERE schemaname = 'public' AND tablename = t;

    IF NOT COALESCE(v_rls, false) THEN
      v_missing := v_missing || format('%s: RLS nicht aktiv; ', t);
    END IF;
    IF NOT COALESCE(v_force, false) THEN
      v_missing := v_missing || format('%s: FORCE fehlt; ', t);
    END IF;
    IF COALESCE(v_policies, 0) = 0 THEN
      v_missing := v_missing || format('%s: keine Policy; ', t);
    END IF;
  END LOOP;

  IF v_missing <> '' THEN
    RAISE EXCEPTION
      'S06-22: Mandantentrennung auf den Signaturtabellen unvollstaendig — %',
      v_missing;
  END IF;
END $$;
