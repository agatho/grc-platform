#!/usr/bin/env bash
# Nachdem Spalten komplett sind: warum fails der Auth-SELECT trotzdem?
# Prüft Spaltentypen, RLS auf "user", und führt exakt die Drizzle-Query aus.

set -uo pipefail
TARGET_DB="${1:-grc_daimon}"
section() { echo; echo "── $1 ─────────────────────"; }

section "Spaltentypen in \"user\" auf $TARGET_DB"
docker exec arctos-postgres-1 psql -U grc -d "$TARGET_DB" -c "
  SELECT column_name, data_type, udt_name, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='user'
  ORDER BY ordinal_position;
"

section "RLS-Status der \"user\"-Tabelle"
docker exec arctos-postgres-1 psql -U grc -d "$TARGET_DB" -c "
  SELECT
    c.relname,
    c.relrowsecurity AS rls_on,
    c.relforcerowsecurity AS rls_forced
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname='public' AND c.relname='user';
"

section "Policies auf \"user\""
docker exec arctos-postgres-1 psql -U grc -d "$TARGET_DB" -c "
  SELECT policyname, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname='public' AND tablename='user';
"

section "Exakt die Drizzle-Auth-Query (mit Rolle grc, superuser)"
docker exec arctos-postgres-1 psql -U grc -d "$TARGET_DB" -c "
  SELECT \"id\", \"email\", \"name\", \"email_verified\", \"password_hash\",
         \"avatar_url\", \"sso_provider_id\", \"language\", \"is_active\",
         \"last_login_at\", \"notification_preferences\", \"ical_token\",
         \"ical_token_created_at\", \"external_id\", \"identity_provider\",
         \"last_synced_at\", \"created_at\", \"updated_at\", \"created_by\",
         \"updated_by\", \"deleted_at\", \"deleted_by\"
  FROM \"user\"
  WHERE \"user\".\"email\" = 'agatho@charliehund.de'
    AND \"user\".\"is_active\" = true
    AND \"user\".\"deleted_at\" IS NULL;
"

section "Als non-owner Role (grc_app) dieselbe Query"
# Falls daimon als grc_app verbindet, greift RLS. Reproduziere das.
docker exec arctos-postgres-1 psql -U grc -d "$TARGET_DB" <<'SQL' 2>&1
SET LOCAL ROLE grc_app;
SET LOCAL "app.current_org_id" = '00000000-0000-0000-0000-000000000000';
SELECT "id", "email", "is_active" FROM "user"
WHERE "user"."email" = 'agatho@charliehund.de'
  AND "user"."is_active" = true
  AND "user"."deleted_at" IS NULL;
RESET ROLE;
SQL

section "Mit welcher Rolle verbindet der daimon-web-Container?"
# Aus dessen DATABASE_URL extrahieren
docker inspect --format='{{range .Config.Env}}{{println .}}{{end}}' daimon-web-daimon-1 \
  | grep DATABASE_URL \
  | sed -E 's#postgresql://([^:]+):[^@]+@.*#  connect-user: \1#'

section "Letzter relevanter Eintrag in access_log (falls RLS nicht blockt)"
docker exec arctos-postgres-1 psql -U grc -d "$TARGET_DB" -c "
  SELECT event_type, failure_reason, email_attempted, created_at
  FROM access_log
  WHERE email_attempted = 'agatho@charliehund.de'
     OR user_id = 'f22a4bc0-0147-4c0d-a02f-98cf65f1e768'
  ORDER BY created_at DESC
  LIMIT 10;
" 2>&1

echo
echo "── DIAG AUTH-2 COMPLETE ──"
