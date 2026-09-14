-- 0480_op267_disable_seeded_login_accounts.sql
--
-- Migration: 0480_op267_disable_seeded_login_accounts
-- Breaking: no
-- Estimated-Duration: 1
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- ============================================================================
-- [ARCTOS-FULL-2026-08-31 · OP-267] Migrationen legten anmeldefaehige Konten
-- mit einem veroeffentlichten Passwort an — in JEDER frisch migrierten
-- Datenbank.
-- ============================================================================
--
-- Gefunden am 2026-09-14 beim Wiederaufbau der drei Mandanten-Datenbanken.
-- `grc_qumasoft` sollte laut eigenem Runbook GENAU EIN Konto enthalten
-- (`admin@qumasoft.de`). Gezaehlt wurden 35. Die 34 zusaetzlichen stammen aus
-- Migrationen, nicht aus einem Seed:
--
--   0316_seed_rbac_test_users.sql                13 × @arctos.test
--   0317_seed_rbac_login_users.sql                9 × @meridian.test
--   0318_user_role_enum_backfill_and_rbac_retry   (Wiederholung von 0316/0317)
--   0326_seed_arctistx_rbac_users.sql             4 × @arctistx.test
--   0346_seed_bcm_security_external_auditor_users 3 × @meridian.test
--   0096_additional_system_roles.sql              6 × @arctos.dev (namentlich)
--
-- Der Kern des Befunds ist nicht die Zahl, sondern der WEG. Das Projekt hat
-- fuer genau diesen Fall drei Schalter gebaut — `SEED_DEMO_DATA`,
-- `ALLOW_DEMO_SEED_IN_PROD` (#SEC-F04) und `ALLOW_PRODUCTION_SEED` —, und der
-- Waechter `scripts/assert-runtime-config.mjs` verweigert den Start, wenn die
-- ersten beiden gesetzt sind. Alle drei greifen ausschliesslich im SEED-Pfad.
-- Eine Migration laeuft daran vorbei: sie ist unbedingt, sie laeuft auf jeder
-- Datenbank, und sie laeuft, BEVOR irgendein Schalter gelesen wird. Auf dem
-- Mandanten stand `RUN_SEEDS=false` — die Konten waren trotzdem da.
--
-- 0317 nennt das Passwort in der eigenen Kopfzeile im Klartext, und das
-- Repository ist oeffentlich; 0326 und 0346 benutzen denselben bcrypt-Hash.
-- Das sind 15 anmeldefaehige Konten je Datenbank mit einem Passwort, das
-- jeder lesen kann. Die 13 aus 0316 tragen einen Platzhalter-Hash und koennen
-- sich nicht anmelden — sie werden trotzdem stillgelegt: ein Konto, das
-- niemand braucht, ist ein Konto zu viel.
--
-- Warum eine NEUE Migration und keine Korrektur der sechs alten: nach ADR-014
-- gilt eine ausgelieferte Migration als unveraenderlich. Diese sechs SIND
-- ausgeliefert — sie sind am 2026-09-14 gegen vier produktive Datenbanken
-- gelaufen. Der Ledger haelt sie fest; eine Aenderung an den Dateien wuerde
-- auf keiner bestehenden Instanz mehr ausgefuehrt und dort genau nichts
-- bewirken. Nur ein Vorwaertsschritt erreicht Bestand UND Neuinstallation.
--
-- Vorgehen wie in `deploy/purge-demo-accounts.sh` (#SEC-F04): KEIN hartes
-- DELETE. Auf `user.id` zeigen zahlreiche nullable Referenzen, und die
-- Audit-Historie soll erhalten bleiben. Stattdessen deaktivieren,
-- soft-loeschen und den Hash unbrauchbar machen — der Credentials-Provider
-- verlangt `is_active = true AND deleted_at IS NULL` und einen gueltigen
-- Hash, jede der drei Aenderungen genuegt fuer sich.
--
-- Idempotent: die WHERE-Klausel fasst nur an, was noch nicht stillgelegt ist.
-- ============================================================================

-- Die drei Domains sind nach RFC 6761 reserviert (`.test`) und koennen daher
-- niemals ein echtes Konto bezeichnen — hier ist ein Muster zulaessig.
-- Bei `@arctos.dev` ist es das NICHT: dort legt `packages/db/src/seed.ts` die
-- echten Betriebskonten an (`admin@arctos.dev` und die Rollen-Demo-Konten,
-- deren Passwort der Seed zufaellig erzeugt). Ein Muster auf diese Domain
-- wuerde den Administrator jeder Installation aussperren. Die sechs Konten
-- aus 0096 werden deshalb namentlich genannt.
UPDATE "user"
   SET is_active     = false,
       deleted_at    = COALESCE(deleted_at, now()),
       password_hash = 'DISABLED-DEMO-ACCOUNT-' || gen_random_uuid()
 WHERE (
         email ILIKE '%@arctos.test'
      OR email ILIKE '%@meridian.test'
      OR email ILIKE '%@arctistx.test'
      OR email IN (
           'ciso@arctos.dev',
           'compliance@arctos.dev',
           'bcm@arctos.dev',
           'contracts@arctos.dev',
           'qm@arctos.dev',
           'security@arctos.dev'
         )
       )
   AND (
        is_active = true
     OR deleted_at IS NULL
     OR password_hash IS NULL
     OR password_hash NOT LIKE 'DISABLED-DEMO-ACCOUNT-%'
   );

-- Rollenzuweisungen derselben Konten mit stilllegen. Auf den vier
-- Datenbanken vom 2026-09-14 war das ein No-Op (0317 haengt seine
-- `INSERT ... SELECT ... WHERE EXISTS` an eine fest verdrahtete Org-UUID, die
-- dort nicht existierte) — auf einer Datenbank, auf der die Org existiert,
-- ist es kein No-Op.
UPDATE user_organization_role
   SET deleted_at = now()
 WHERE deleted_at IS NULL
   AND user_id IN (
         SELECT id FROM "user"
          WHERE email ILIKE '%@arctos.test'
             OR email ILIKE '%@meridian.test'
             OR email ILIKE '%@arctistx.test'
             OR email IN (
                  'ciso@arctos.dev',
                  'compliance@arctos.dev',
                  'bcm@arctos.dev',
                  'contracts@arctos.dev',
                  'qm@arctos.dev',
                  'security@arctos.dev'
                )
       );
