-- 0435_worker_job_runtime.sql
-- [ARCTOS-FULL-2026-08-31 / WP9] Worker-Laufzeitinfrastruktur.
--
-- Deckt drei Findings ab:
--
--  * S10-10 — 69 von 128 Jobs sind bei Doppelausführung nicht idempotent,
--    40 von 44 Notification-Crons haben keinen Dedup-Guard. Ein täglich
--    laufender Reminder erzeugt für dieselbe Sachlage an jedem Tag eine
--    neue Zeile. Der Guard gehört in die Datenbank, nicht in 44 Dateien:
--    `notification.dedupe_key` + UNIQUE-Index, dagegen schreibt
--    der Worker mit ON CONFLICT DO NOTHING.
--
--  * S10-02 / S10-12 — es gab keinen Scheduler und keinen maschinenlesbaren
--    Erfolgsindikator (jeder Fehllauf antwortete HTTP 200 `success:true`).
--    `job_run` ist das Betriebsprotokoll des neuen In-Process-Schedulers:
--    pro Lauf eine Zeile mit Start, Ende, Status und Fehlerzahl. Damit ist
--    "lief der Job, und hat er etwas getan?" zum ersten Mal beantwortbar,
--    auch für das Monitoring (ADR-017, S13-11).
--
--  * S10-09 — der Lease-Timeout für hängengebliebene Queue-Zeilen braucht
--    einen Index auf (status, started_at), sonst wird der Reclaim-Scan auf
--    den großen Queue-Tabellen zum Seq-Scan.
--
-- Keine der Tabellen trägt org_id: `job_run` ist mandantenübergreifendes
-- Betriebsprotokoll und wird ausschließlich vom Worker geschrieben. Der
-- Event-Trigger arctos_rls_guard_trg legt deshalb korrekterweise keine
-- Org-Policy an.

-- ── 1. Notification-Dedup (S10-10) ──────────────────────────────────────
ALTER TABLE notification
  ADD COLUMN IF NOT EXISTS dedupe_key text;

COMMENT ON COLUMN notification.dedupe_key IS
  'WP9/S10-10: Idempotenzschluessel fuer wiederkehrende Cron-Benachrichtigungen. '
  'NULL = kein Dedup (Einzelereignisse aus der Web-App). Gefuellt vom Worker '
  'ueber apps/worker/src/lib/notify.ts; der UNIQUE-Index darunter setzt ihn durch.';

-- Bewusst NICHT partiell (kein `WHERE dedupe_key IS NOT NULL`): PostgreSQL
-- leitet einen partiellen Index als ON-CONFLICT-Arbiter nur ab, wenn das
-- INSERT das Prädikat wörtlich wiederholt — ein Fallstrick, der die
-- Dedup-Zusage an einer Formulierung im ORM hängen ließe. Ein voller
-- UNIQUE-Index tut hier dasselbe: NULL kollidiert in PostgreSQL nie mit
-- NULL, Zeilen ohne dedupe_key (Einzelereignisse aus der Web-App) bleiben
-- also uneingeschränkt.
CREATE UNIQUE INDEX IF NOT EXISTS notification_dedupe_uidx
  ON notification (org_id, dedupe_key);

-- ── 2. Betriebsprotokoll der Jobs (S10-02, S10-11, S10-12) ──────────────
CREATE TABLE IF NOT EXISTS job_run (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name       varchar(120) NOT NULL,
  trigger_source varchar(20)  NOT NULL DEFAULT 'scheduler',  -- scheduler | http | manual
  started_at     timestamptz  NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  duration_ms    integer,
  -- running | success | partial | failed | skipped_locked
  status         varchar(20)  NOT NULL DEFAULT 'running',
  failed_items   integer      NOT NULL DEFAULT 0,
  result         jsonb,
  error          text,
  host           varchar(120)
);

CREATE INDEX IF NOT EXISTS job_run_name_started_idx
  ON job_run (job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS job_run_status_idx
  ON job_run (status)
  WHERE status IN ('failed', 'partial', 'running');

COMMENT ON TABLE job_run IS
  'WP9/S10-02+S10-12: ein Datensatz je Job-Lauf. Vor diesem Audit gab es weder '
  'einen Scheduler noch eine Spur davon, ob ein Job gelaufen ist; Fehllaeufe '
  'antworteten HTTP 200 success:true. status=partial bedeutet: der Lauf hat '
  'Elemente verarbeitet UND mindestens eines ist gescheitert.';

-- Aufbewahrung: das Protokoll waechst sonst unbegrenzt. 90 Tage decken jede
-- Betriebsanalyse ab und bleiben unter den Aufbewahrungsfristen des
-- Audit-Trails (der hiervon unberuehrt ist — job_run ist kein Nachweis).
-- Die Bereinigung erledigt der Job `job-run-retention`.

-- ── 3. Lease-Index fuer haengende Queue-Zeilen (S10-09) ─────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'import_job', 'evidence_review_queue', 'var_calculation_run',
    'marketplace_security_scan', 'simulation_run'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = t
                      AND column_name = 'started_at')
       AND EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = t
                      AND column_name = 'status')
    THEN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (status, started_at)',
        t || '_lease_idx', t);
    END IF;
  END LOOP;
END $$;

-- ── 4. Grants ───────────────────────────────────────────────────────────
-- job_run wird vom Worker geschrieben und von der Web-App (Betriebs-UI,
-- Health-Endpunkt) gelesen. Die Default-Privileges aus provision-grc-app.sh
-- greifen fuer kuenftig erzeugte Tabellen; hier explizit, damit eine bereits
-- provisionierte Datenbank die Rechte ohne erneuten Skriptlauf bekommt.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_run TO grc_app';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grc_worker') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_run TO grc_worker';
  END IF;
END $$;
