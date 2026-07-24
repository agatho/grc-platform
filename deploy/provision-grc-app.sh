#!/bin/bash
# ============================================================================
# ARCTOS — Provision the non-superuser runtime role `grc_app`  (#SEC-F01)
#
# The application must connect to PostgreSQL as a NON-superuser so that
# Row-Level Security is actually enforced at runtime. The historical prod
# config connected as `grc` (SUPERUSER + BYPASSRLS), which silently disabled
# every RLS policy — a cross-tenant blast radius across all databases.
#
# This script (idempotent) creates/refreshes the login role `grc_app` with
# LEAST privilege — no SUPERUSER, CREATEDB, CREATEROLE or BYPASSRLS — and
# grants it exactly the DML it needs (SELECT/INSERT/UPDATE/DELETE on tables,
# USAGE/SELECT on sequences, EXECUTE on functions) on the given database(s).
# ALTER DEFAULT PRIVILEGES covers objects that FUTURE migrations create.
#
# IMPORTANT: grc_app is deliberately NOT the OWNER of any table. Table owners
# bypass RLS unless FORCE ROW LEVEL SECURITY is set; keeping ownership with
# `grc` and handing grc_app only GRANTs means the RLS policies always apply.
#
# It also closes #SEC-F09: `ALTER TABLE organization FORCE ROW LEVEL SECURITY`
# (the one tenant-root table that was missing FORCE).
#
# Usage:
#   GRC_APP_PASSWORD=... sudo -E bash deploy/provision-grc-app.sh <DB> [<DB> ...]
#   GRC_APP_PASSWORD=... sudo -E bash deploy/provision-grc-app.sh grc_platform
#
# Local dev (no docker compose — talk to localhost:5432 directly):
#   DIRECT_PSQL=1 GRC_APP_PASSWORD=grc_app_dev_password \
#     bash deploy/provision-grc-app.sh grc_platform
#
# Environment:
#   GRC_APP_PASSWORD  (required)  login password for role grc_app
#   COMPOSE_FILE      default /opt/arctos/docker-compose.production.yml
#   PGSUPERUSER       default grc  (owner role that runs CREATE ROLE + GRANTs)
#   DIRECT_PSQL=1     bypass docker compose and use a local psql binary
#                     (honours PGHOST/PGPORT/PGUSER/PGPASSWORD; dev defaults
#                     localhost:5432 / grc / grc_dev_password)
# ============================================================================

set -uo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: GRC_APP_PASSWORD=... bash deploy/provision-grc-app.sh <DB_NAME> [<DB_NAME> ...]" >&2
  exit 1
fi

if [ -z "${GRC_APP_PASSWORD:-}" ]; then
  echo "FEHLER: GRC_APP_PASSWORD ist nicht gesetzt — Rolle grc_app braucht ein Passwort." >&2
  exit 1
fi

COMPOSE_FILE="${COMPOSE_FILE:-/opt/arctos/docker-compose.production.yml}"
PGSUPERUSER="${PGSUPERUSER:-grc}"
DIRECT_PSQL="${DIRECT_PSQL:-0}"

# Escape single quotes for safe embedding in the PASSWORD literal.
ESCAPED_PW="${GRC_APP_PASSWORD//\'/\'\'}"

if [ "$DIRECT_PSQL" != "1" ] && [ ! -f "$COMPOSE_FILE" ]; then
  ALT="/opt/arctos/docker-compose.yml"
  if [ -f "$ALT" ]; then
    COMPOSE_FILE="$ALT"
  else
    echo "FEHLER: Compose-Datei $COMPOSE_FILE nicht gefunden (oder DIRECT_PSQL=1 setzen)." >&2
    exit 2
  fi
fi

# psql wrapper: reads SQL from stdin, runs it against database $1 as superuser.
# ON_ERROR_STOP=0 so a GRANT on a not-yet-existing object never aborts the
# whole batch; real ERROR lines are surfaced by the caller.
psql_db() {
  local db="$1"
  if [ "$DIRECT_PSQL" = "1" ]; then
    PGHOST="${PGHOST:-localhost}" \
    PGPORT="${PGPORT:-5432}" \
    PGUSER="${PGUSER:-$PGSUPERUSER}" \
    PGPASSWORD="${PGPASSWORD:-grc_dev_password}" \
      psql -v ON_ERROR_STOP=0 -q -d "$db" -f -
  else
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
      psql -U "$PGSUPERUSER" -v ON_ERROR_STOP=0 -q -d "$db" -f -
  fi
}

db_exists() {
  local db="$1"
  if [ "$DIRECT_PSQL" = "1" ]; then
    PGHOST="${PGHOST:-localhost}" PGPORT="${PGPORT:-5432}" \
    PGUSER="${PGUSER:-$PGSUPERUSER}" PGPASSWORD="${PGPASSWORD:-grc_dev_password}" \
      psql -qAtc "SELECT 1 FROM pg_database WHERE datname = '$db'" -d postgres 2>/dev/null | grep -q 1
  else
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
      psql -U "$PGSUPERUSER" -qAtc \
      "SELECT 1 FROM pg_database WHERE datname = '$db'" -d postgres 2>/dev/null | grep -q 1
  fi
}

# ── 1. Cluster-global role (create or refresh password + strip privileges) ──
# Roles are cluster-wide, so this only needs to run once; we target the
# maintenance DB `postgres`. Idempotent: CREATE on first run, ALTER after.
echo "[1/2] Rolle grc_app sicherstellen (LOGIN, kein SUPERUSER/BYPASSRLS)..."
ROLE_SQL=$(cat <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'grc_app') THEN
    CREATE ROLE grc_app LOGIN PASSWORD '${ESCAPED_PW}';
  ELSE
    ALTER ROLE grc_app LOGIN PASSWORD '${ESCAPED_PW}';
  END IF;
END \$\$;
-- Defence in depth: guarantee grc_app can never bypass RLS.
ALTER ROLE grc_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
SQL
)
if printf '%s\n' "$ROLE_SQL" | psql_db postgres 2>&1 | grep -E '^(ERROR|FATAL):'; then
  echo "  WARNUNG: Fehler beim Anlegen/Ändern der Rolle grc_app (siehe oben)." >&2
else
  echo "  ✓ Rolle grc_app bereit."
fi

# ── 2. Per-DB grants + default privileges + FORCE RLS on organization ──
echo "[2/2] Grants pro Datenbank..."
FAILED=0
for DB in "$@"; do
  if ! db_exists "$DB"; then
    echo "  ✗ $DB: Datenbank existiert nicht — übersprungen." >&2
    FAILED=$((FAILED + 1))
    continue
  fi

  GRANT_SQL=$(cat <<'SQL'
GRANT USAGE ON SCHEMA public TO grc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grc_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO grc_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO grc_app;

-- Future objects created by the `grc` owner during later migrations
-- inherit the same least-privilege grants automatically.
ALTER DEFAULT PRIVILEGES FOR ROLE grc IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO grc_app;
ALTER DEFAULT PRIVILEGES FOR ROLE grc IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO grc_app;
ALTER DEFAULT PRIVILEGES FOR ROLE grc IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO grc_app;

-- #SEC-F09: the organization table (tenant root) was missing FORCE RLS,
-- so its owner could read across tenants. Enforce it idempotently.
DO $$ BEGIN
  IF to_regclass('public.organization') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE organization FORCE ROW LEVEL SECURITY';
  END IF;
END $$;
SQL
)
  ERRS=$(printf '%s\n' "$GRANT_SQL" | psql_db "$DB" 2>&1 | grep -E '^(ERROR|FATAL):' || true)
  if [ -n "$ERRS" ]; then
    echo "  ✗ $DB: Fehler bei Grants:" >&2
    printf '%s\n' "$ERRS" | head -5 | sed 's/^/      /' >&2
    FAILED=$((FAILED + 1))
  else
    echo "  ✓ $DB: Grants + Default-Privileges + FORCE RLS gesetzt."
  fi
done

echo ""
if [ "$FAILED" -gt 0 ]; then
  echo "Abgeschlossen mit $FAILED Fehler(n)." >&2
  exit 1
fi
echo "grc_app-Provisionierung abgeschlossen."
