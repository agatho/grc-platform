#!/usr/bin/env bash
# Reproduziert die exakte Drizzle-Auth-Query in BEIDEN Web-Containern.
# Container rootfs ist read-only → wir piepen das Node-Script über stdin.

set -uo pipefail

# Default: admin von grc_platform (public), overridable
CONTAINERS=(arctos-web-1 daimon-web-daimon-1)
# email per container (gleiche sollte auf beiden funktionieren falls im DB)
declare -A EMAILS=(
  [arctos-web-1]="${ARCTOS_EMAIL:-admin@arctos.dev}"
  [daimon-web-daimon-1]="${DAIMON_EMAIL:-agatho@charliehund.de}"
)

probe_container() {
  local c="$1"
  local email="$2"
  echo
  echo "════════════════════════════════════════════════"
  echo " $c  →  email: $email"
  echo "════════════════════════════════════════════════"

  if ! docker ps --format '{{.Names}}' | grep -qw "$c"; then
    echo "  (container not running — skipping)"
    return
  fi

  docker exec -i -e LOGIN_EMAIL="$email" "$c" node --input-type=commonjs <<'NODE_SCRIPT'
const postgres = require("postgres");
const url = process.env.DATABASE_URL;
const sql = postgres(url, { max: 1 });
const EMAIL = process.env.LOGIN_EMAIL;

(async () => {
  try {
    console.log(`Connecting to: ${url.replace(/:[^@]+@/, ':***@')}`);
    console.log(`Probing email : ${EMAIL}`);
    console.log();

    const rows = await sql`
      SELECT "id", "email", "name", "email_verified", "password_hash",
             "avatar_url", "sso_provider_id", "language", "is_active",
             "last_login_at", "notification_preferences", "ical_token",
             "ical_token_created_at", "external_id", "identity_provider",
             "last_synced_at", "created_at", "updated_at", "created_by",
             "updated_by", "deleted_at", "deleted_by"
      FROM "user"
      WHERE "user"."email" = ${EMAIL}
        AND "user"."is_active" = true
        AND "user"."deleted_at" IS NULL
    `;
    console.log("OK — rows:", rows.length);
    if (rows.length) {
      const r = rows[0];
      console.log("  id:", r.id);
      console.log("  email:", r.email);
      console.log("  is_active:", r.is_active);
      console.log("  password_hash starts:", String(r.password_hash || "").slice(0, 8));
    } else {
      console.log("  (no row matched)");
    }
  } catch (err) {
    console.error("FAIL:", err.message);
    if (err.cause) console.error("  cause:", err.cause.message);
    if (err.code) console.error("  pg code:", err.code);
    if (err.detail) console.error("  pg detail:", err.detail);
    if (err.where) console.error("  pg where:", err.where);
    if (err.hint) console.error("  pg hint:", err.hint);
    if (err.query) console.error("  query:", err.query.slice(0, 300));
    if (err.parameters) console.error("  params:", JSON.stringify(err.parameters));
    if (err.stack) console.error("  stack:", err.stack.split("\n").slice(0, 8).join("\n"));
  } finally {
    await sql.end();
  }
})();
NODE_SCRIPT

  echo
  echo "── Auth-Error-Logs (letzte 15 s) $c ──"
  docker logs --since 15s "$c" 2>&1 | tail -20
}

for c in "${CONTAINERS[@]}"; do
  probe_container "$c" "${EMAILS[$c]}"
done

echo
echo "════ DIAG AUTH-REPRODUCE COMPLETE (both containers) ════"
