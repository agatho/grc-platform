-- Migration 0387: fehlende Indizes auf Fremdschlüsseln und org_id
--
-- Migration: 0387_fk_and_org_id_indexes
-- Breaking: no
-- Estimated-Duration: 120
-- Locking: long
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- [ARCTOS-FULL-2026-08-31 / WP1 · S09-13, S09-14]
--
-- S09-14 (gemessen): Tabellen mit `org_id` und aktivem RLS, deren Indizes
-- `org_id` nicht führend enthalten. An `document_file` (200.000 Zeilen, 50
-- Organisationen) belegt der Audit den Effekt per EXPLAIN ANALYZE:
--   Seq Scan   … Buffers: shared hit=2858 … 5,019 ms
--   Index Scan … Buffers: shared hit=6    … 0,062 ms
-- 476-fach weniger Buffer, 81-fach schneller — und weil RLS aktiv ist, greift
-- das org_id-Prädikat bei JEDER Abfrage der Anwendung auf diese Tabelle.
--
-- S09-13 (gemessen): 443 Fremdschlüssel ohne führenden Index, davon 377 auf
-- `"user"` (created_by/updated_by/deleted_by). Zwei Wirkungen: (a) jedes
-- DELETE auf `user` oder `organization` löst pro Kindtabelle einen Seq Scan
-- zur FK-Prüfung aus — ein Nutzer-Löschvorgang ist damit eine
-- Volltabellen-Kaskade über hunderte Tabellen, was ausgerechnet den
-- DSGVO-Löschpfad trifft; (b) Joins auf `created_by` (Aktivitätsansichten)
-- laufen ohne Index.
--
-- Abwägung: Die Indizes kosten pro INSERT/UPDATE je einen zusätzlichen
-- Index-Eintrag. Bei den Schreibraten einer GRC-Plattform ist das gegenüber
-- einer Volltabellen-Kaskade beim Löschen die klar bessere Seite des
-- Tauschs. Die Migration ist generisch: sie legt nur an, was fehlt, und ist
-- damit idempotent und auch nach künftigen Schemaänderungen wieder wirksam.
--
-- Locking: CREATE INDEX nimmt einen SHARE-Lock auf die jeweilige Tabelle.
-- Auf einer befüllten Produktionsdatenbank gehört diese Migration in ein
-- Wartungsfenster; alternativ lassen sich die Indizes vorab manuell mit
-- CREATE INDEX CONCURRENTLY anlegen — die Migration überspringt dann alles,
-- was schon da ist.

-- ── 1. org_id führend (S09-14) ────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
  idx TEXT;
  n INT := 0;
BEGIN
  FOR r IN
    SELECT c.oid, c.relname
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace AND ns.nspname = 'public'
    WHERE c.relkind = 'r'
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = c.oid AND a.attname = 'org_id'
          AND a.attnum > 0 AND NOT a.attisdropped)
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        JOIN pg_attribute a2 ON a2.attrelid = c.oid AND a2.attnum = i.indkey[0]
        WHERE i.indrelid = c.oid AND a2.attname = 'org_id')
    ORDER BY c.relname
  LOOP
    idx := left('idx_' || r.relname || '_org_id', 63);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (org_id)', idx, r.relname);
    n := n + 1;
  END LOOP;
  RAISE NOTICE '0387: % org_id indexes created', n;
END $$;

-- ── 2. Fremdschlüssel ohne führenden Index (S09-13) ───────────────────
DO $$
DECLARE
  r RECORD;
  idx TEXT;
  n INT := 0;
BEGIN
  FOR r IN
    SELECT t.relname AS tab,
           string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord) AS cols,
           string_agg(a.attname, '_' ORDER BY k.ord) AS colnames
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace AND ns.nspname = 'public'
    JOIN LATERAL unnest(c.conkey) WITH ORDINALITY k(attnum, ord) ON TRUE
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.contype = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1])
    GROUP BY t.relname, c.conname
    ORDER BY t.relname
  LOOP
    -- Indexnamen sind schemaweit eindeutig; der Tabellenname im Namen
    -- verhindert die 42P07-Klasse aus S09-01.
    idx := left('idx_' || r.tab || '_' || r.colnames || '_fk', 63);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (%s)', idx, r.tab, r.cols);
    n := n + 1;
  END LOOP;
  RAISE NOTICE '0387: % foreign-key indexes created', n;
END $$;

-- ── 3. Nachzügler aus späteren Konvergenz-Pässen ──────────────────────
-- Vier Dateien sind nicht topologisch sortiert und laufen erst im zweiten
-- Pass (0068/0069 brauchen `catalog` aus 0075, 0071 eine Spalte, die eine
-- spätere Datei ergänzt, 0106 `framework_mapping` aus 0107). Was sie anlegen,
-- entsteht damit NACH dem generischen Sweep oben. Betroffen ist genau ein
-- Fremdschlüssel; er wird hier explizit nachgezogen.
DO $$
BEGIN
  IF to_regclass('public.risk_anomaly_detection') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_risk_anomaly_detection_resolved_by_fk
      ON risk_anomaly_detection (resolved_by);
  END IF;
END $$;
