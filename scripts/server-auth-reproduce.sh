#!/usr/bin/env bash
# Reproduziert die exakte Drizzle-Auth-Query im daimon-web-Container.
# Container rootfs ist read-only → wir piepen das Node-Script über stdin.

set -uo pipefail

EMAIL="${LOGIN_EMAIL:-agatho@charliehund.de}"

echo "── Run exact drizzle auth query inside daimon-web-daimon-1 ──"
echo "email: $EMAIL"
echo

docker exec -i -e LOGIN_EMAIL="$EMAIL" daimon-web-daimon-1 node --input-type=commonjs <<'NODE_SCRIPT'
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
echo "── Frische Auth-Error-Logs aus dem Container (letzte 15 s) ──"
docker logs --since 15s daimon-web-daimon-1 2>&1 | tail -40

echo
echo "── DIAG AUTH-REPRODUCE COMPLETE ──"
