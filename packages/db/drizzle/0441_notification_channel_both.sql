-- 0441_notification_channel_both.sql
-- [ARCTOS-FULL-2026-08-31 / E2E-Triage-2 · C-08]
--
-- Migration: 0441_notification_channel_both
-- Breaking: no
-- Estimated-Duration: 1
-- Locking: none
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- Befund C-08 — Schema-Drift zwischen Drizzle und der Datenbank, der ueber
-- 40 Schreibpfade zur Laufzeit auf 500 laufen laesst.
--
-- `packages/db/src/schema/platform.ts:137` deklariert
--
--     notificationChannelEnum = pgEnum("notification_channel",
--       ["in_app", "email", "teams", "both"])
--
-- Die Datenbank kennt aber nur drei Werte:
--
--     select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid
--      where t.typname='notification_channel';
--      -> in_app, email, teams
--
-- Es hat nie eine Migration gegeben, die `both` hinzufuegt. Weil der
-- TypeScript-Typ aus der Drizzle-Deklaration kommt, typprueft
-- `channel: "both"` anstandslos — 40 Aufrufstellen benutzen es
-- (`grep -rn 'channel: *"both"' apps/web/src` -> 40 Treffer gegenueber
-- 6x "in_app" und 4x "email"). Zur Laufzeit weist PostgreSQL den Wert ab,
-- die Ausnahme schlaegt durch die umgebende Transaktion durch und der
-- ganze Endpunkt antwortet 500.
--
-- An der laufenden Instanz gemessen (requestId 7d9f8d1dfcba66b1):
--
--   PUT /api/v1/processes/<id>/ropa-profile  -> 500
--   Serverlog: Failed query: insert into "notification" (...)
--              params: …,approval_request,dpia,…,both,dpia_auto_created,…
--
-- Betroffen sind unter anderem: Prozess-Statuswechsel und Freigabeketten
-- (processes/[id]/status, approval-steps, bulk-approve), die automatische
-- DSFA-Anlage aus dem ROPA-Profil, Findings- und Control-Statuswechsel,
-- Task-Zuweisungen, KRI-Schwellwertverletzungen, Policy-Verteilungen und
-- der Abbruch von Signaturanfragen. In jedem dieser Faelle ist die
-- fachliche Handlung bereits geschrieben, wenn die Benachrichtigung
-- scheitert — der Aufrufer sieht einen 500 auf eine Aktion, die
-- tatsaechlich stattgefunden hat.
--
-- ── Warum den Wert ergaenzen und nicht die 40 Aufrufstellen aendern ──
--
-- `both` ist die deklarierte Absicht des Schemas („in-app UND E-Mail"), und
-- `platform-advanced.ts:89` setzt denselben Wert sogar als DEFAULT einer
-- eigenen `channel`-Spalte. Die Aufrufstellen sind also nicht falsch — die
-- Datenbank hinkt der Deklaration hinterher. Der Drift wird hier in die
-- Richtung aufgeloest, in die das Schema zeigt.
--
-- `ALTER TYPE ... ADD VALUE` laeuft nicht in einem Transaktionsblock;
-- `packages/db/src/migrate-all.ts:66` erkennt das Muster und fuehrt die
-- Datei deshalb ausserhalb einer Transaktion aus. Die Selbstpruefung steht
-- in einer eigenen Anweisung, weil ein neu hinzugefuegter Enum-Wert in
-- derselben Transaktion nicht benutzt werden darf.

ALTER TYPE notification_channel ADD VALUE IF NOT EXISTS 'both';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'notification_channel' AND e.enumlabel = 'both'
  ) THEN
    RAISE EXCEPTION '0441: notification_channel kennt ''both'' immer noch nicht.';
  END IF;
  RAISE NOTICE 'C-08: notification_channel um ''both'' ergaenzt (Drift zu schema/platform.ts:137 geschlossen).';
END $$;
