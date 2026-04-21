#!/usr/bin/env bash
# Reproduziert den EXAKTEN Drizzle-Auth-Query im daimon-web-Container.
# Liest DATABASE_URL aus dem Container, führt postgres.js mit identischer
# Query aus — zeigt den TRUE pg-Error (statt "Failed query" ohne cause).

set -uo pipefail

NODE_SCRIPT=$(mktemp --suffix=.cjs)
trap 'rm -f "$NODE_SCRIPT"' EXIT

cat > "$NODE_SCRIPT" <<'EOF'
// Läuft INSIDE dem daimon-web-Container.
const postgres = require("postgres");
const url = process.env.DATABASE_URL;
const sql = postgres(url, { max: 1 });

const EMAIL = process.env.LOGIN_EMAIL || "agatho@charliehund.de";

(async () => {
  try {
    console.log(`Connecting to: ${url.replace(/:[^@]+@/, ':***@')}`);
    console.log(`Probing email: ${EMAIL}`);
    console.log();

    // Exakt das, was Drizzle aus .select().from(user).where(...) baut.
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
    }
  } catch (err) {
    console.error("FAIL:", err.message);
    if (err.cause) console.error("  cause:", err.cause.message);
    if (err.code) console.error("  pg code:", err.code);
    if (err.detail) console.error("  pg detail:", err.detail);
    if (err.where) console.error("  pg where:", err.where);
    if (err.hint) console.error("  pg hint:", err.hint);
    if (err.stack) console.error("  stack:", err.stack.split("\n").slice(0, 6).join("\n"));
  } finally {
    await sql.end();
  }
})();
EOF

echo "── 1) Copy probe script into daimon-web-daimon-1 ──"
docker cp "$NODE_SCRIPT" daimon-web-daimon-1:/tmp/auth-probe.cjs

echo
echo "── 2) Run probe inside the container (uses its DATABASE_URL) ──"
docker exec daimon-web-daimon-1 node /tmp/auth-probe.cjs

echo
echo "── 3) Fresh auth-error log from the container (last 5 s only) ──"
docker logs --since 10s daimon-web-daimon-1 2>&1 | tail -40

echo
echo "── DIAG AUTH-REPRODUCE COMPLETE ──"
