#!/usr/bin/env bash
# Auth-Query EXAKT wie Drizzle sie schickt — via PREPARE + EXECUTE.
# Zeigt, ob das der Query selber oder das Param-Binding ist.

set -uo pipefail
section() { echo; echo "── $1 ─────────────────────"; }

for DB in grc_platform grc_daimon; do
  section "DB: $DB — prepared exec exactly like drizzle sends it"
  docker exec -i arctos-postgres-1 psql -U grc -d "$DB" <<'SQL' 2>&1
PREPARE auth_query(text, boolean) AS
  SELECT "id", "email", "name", "email_verified", "password_hash",
         "avatar_url", "sso_provider_id", "language", "is_active",
         "last_login_at", "notification_preferences", "ical_token",
         "ical_token_created_at", "external_id", "identity_provider",
         "last_synced_at", "created_at", "updated_at", "created_by",
         "updated_by", "deleted_at", "deleted_by"
  FROM "user"
  WHERE "user"."email" = $1
    AND "user"."is_active" = $2
    AND "user"."deleted_at" IS NULL;

SELECT '-- EXECUTE with boolean true --' AS note;
EXECUTE auth_query('admin@arctos.dev', true);

SELECT '-- Drop + re-prepare to test grc_daimon admin --' AS note;
DEALLOCATE auth_query;
PREPARE auth_query(text, boolean) AS
  SELECT "id", "email", "name", "email_verified", "password_hash",
         "avatar_url", "sso_provider_id", "language", "is_active",
         "last_login_at", "notification_preferences", "ical_token",
         "ical_token_created_at", "external_id", "identity_provider",
         "last_synced_at", "created_at", "updated_at", "created_by",
         "updated_by", "deleted_at", "deleted_by"
  FROM "user"
  WHERE "user"."email" = $1
    AND "user"."is_active" = $2
    AND "user"."deleted_at" IS NULL;
EXECUTE auth_query('agatho@charliehund.de', true);

DEALLOCATE auth_query;
SQL
done

section "Image hashes — welches Web-Image läuft?"
for c in arctos-web-1 daimon-web-daimon-1; do
  echo "$c:"
  docker inspect --format='  image-tag: {{.Config.Image}}' "$c"
  docker inspect --format='  image-id:  {{.Image}}' "$c"
  docker inspect --format='  started:   {{.State.StartedAt}}' "$c"
  docker inspect --format='  env-count: {{len .Config.Env}}' "$c"
done

section "Drizzle-version im Image"
for c in arctos-web-1 daimon-web-daimon-1; do
  echo "$c:"
  docker exec "$c" sh -c 'find / -type d -name "drizzle-orm" 2>/dev/null | head -3 | while read d; do
    [ -f "$d/package.json" ] && node -e "console.log(\"  \" + \"'$d'/package.json\" + \": \" + require(\"'$d'/package.json\").version)" 2>/dev/null
  done' 2>&1 | head -5
done

echo
echo "── DIAG RAW COMPLETE ──"
