-- ============================================================================
-- 0361: Audit-Trigger-Dedupe
-- ----------------------------------------------------------------------------
-- Befund (Dev-DB, 2026-07-10): 117 Tabellen tragen ZWEI aktive Trigger, die
-- beide audit_trigger() ausfuehren — den aelteren, explizit benannten Trigger
-- (z. B. <tbl>_audit, audit_<tbl>, <tbl>_audit_trigger) UND den vom
-- dynamischen Sweep in 0337 angelegten Trigger namens "audit_trigger".
-- Folge: jede Datenaenderung erzeugt zwei identische audit_log-Eintraege.
--
-- Strategie: pro Tabelle genau EINEN Trigger behalten.
--   1. Bevorzugt bleibt der Sweep-Trigger "audit_trigger" (uniform benannt).
--   2. Existiert er nicht, bleibt der alphabetisch erste Trigger.
--   Alle weiteren audit_trigger()-Trigger der Tabelle werden gedroppt.
-- Idempotent: nach dem ersten Lauf gibt es keine Duplikate mehr (No-Op).
-- Die Append-Only-Historie in audit_log bleibt unangetastet.
-- ============================================================================

DO $$
DECLARE
  rec RECORD;
  keep_name TEXT;
  drop_name TEXT;
  dropped INT := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'audit_trigger') THEN
    RAISE NOTICE '[0361] audit_trigger() fehlt - nichts zu tun';
    RETURN;
  END IF;

  FOR rec IN
    SELECT tg.tgrelid,
           tg.tgrelid::regclass::text AS tbl,
           array_agg(tg.tgname ORDER BY tg.tgname) AS names
    FROM pg_trigger tg
    JOIN pg_proc pr ON pr.oid = tg.tgfoid
    WHERE pr.proname = 'audit_trigger'
      AND NOT tg.tgisinternal
    GROUP BY tg.tgrelid
    HAVING count(*) > 1
  LOOP
    IF 'audit_trigger' = ANY (rec.names) THEN
      keep_name := 'audit_trigger';
    ELSE
      keep_name := rec.names[1];
    END IF;

    FOREACH drop_name IN ARRAY rec.names LOOP
      IF drop_name <> keep_name THEN
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', drop_name, rec.tbl);
        dropped := dropped + 1;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE '[0361] Audit-Trigger-Dedupe abgeschlossen: % Duplikat-Trigger entfernt', dropped;
END $$;
