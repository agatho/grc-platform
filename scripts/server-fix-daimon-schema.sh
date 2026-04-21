#!/usr/bin/env bash
# grc_daimon Tenant-DB Schema-Drift fixen.
# Vergleicht "user"-Tabelle gegen die Spalten, die die Auth-Query erwartet
# und ergänzt fehlende per ALTER TABLE ADD COLUMN IF NOT EXISTS.
# Idempotent.
#
# Danach läuft Login auf daimon.arctos.charliehund.de wieder.
#
# Auf dem Server:
#   curl -fsSL https://raw.githubusercontent.com/agatho/grc-platform/main/scripts/server-fix-daimon-schema.sh | bash

set -euo pipefail

TARGET_DB="${1:-grc_daimon}"

section() { echo; echo "── $1 ─────────────────────"; }

section "Vor dem Fix: existierende Spalten in \"user\" auf $TARGET_DB"
docker exec arctos-postgres-1 psql -U grc -d "$TARGET_DB" -tAc "
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='user'
  ORDER BY column_name;
" | tr '\n' ',' | sed 's/,$//; s/,/, /g'
echo
echo

section "Fehlende Spalten nachziehen"
# Die Liste stammt aus apps/web/src/packages/auth/...authorize() —
# Drizzle generiert exakt diese SELECT-Felder.
docker exec arctos-postgres-1 psql -U grc -d "$TARGET_DB" <<'SQL'
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS avatar_url            TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS sso_provider_id       UUID;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS language              VARCHAR(5) DEFAULT 'de';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS last_login_at         TIMESTAMPTZ;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS ical_token            TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS ical_token_created_at TIMESTAMPTZ;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS external_id           VARCHAR(255);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS identity_provider     VARCHAR(100);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS last_synced_at        TIMESTAMPTZ;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS email_verified        TIMESTAMPTZ;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS created_by            UUID;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS updated_by            UUID;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS deleted_at            TIMESTAMPTZ;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS deleted_by            UUID;
SQL

section "Nach dem Fix: Spalten in \"user\""
docker exec arctos-postgres-1 psql -U grc -d "$TARGET_DB" -tAc "
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='user'
  ORDER BY column_name;
" | tr '\n' ',' | sed 's/,$//; s/,/, /g'
echo

section "Test-Query (die Auth.js ausführt)"
docker exec arctos-postgres-1 psql -U grc -d "$TARGET_DB" -c "
  SELECT id, email, length(password_hash) AS hash_len
  FROM \"user\"
  WHERE email = 'agatho@charliehund.de'
    AND is_active = true
    AND deleted_at IS NULL;
"

echo
echo "── FERTIG — Login auf daimon.arctos.charliehund.de erneut versuchen ──"
