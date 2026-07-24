#!/usr/bin/env bash
# Seed demo data only (assumes setup.sh has already run)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DB_DIR="$ROOT_DIR/packages/db"

set -a; source "$ROOT_DIR/.env" 2>/dev/null || true; set +a

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-grc}"
DB_PASS="${DB_PASS:-grc_dev_password}"
DB_NAME="${DB_NAME:-grc_platform}"

# #SEC-F04: same guard as scripts/docker-entrypoint.sh. This helper seeds
# accounts with KNOWN passwords — never let it run against a production
# instance unless explicitly overridden. Dev/CI (NODE_ENV != production,
# usually unset) is unaffected.
if [ "${NODE_ENV:-}" = "production" ] && [ "${ALLOW_DEMO_SEED_IN_PROD:-}" != "true" ]; then
  echo "WARNING: refusing to seed demo/test accounts in production; set ALLOW_DEMO_SEED_IN_PROD=true to override." >&2
  exit 0
fi

echo "Seeding demo data..."

for f in \
  "$DB_DIR/sql/seed_demo_data.sql" \
  "$DB_DIR/sql/seed_demo_09_processes.sql" \
  "$DB_DIR/sql/seed_demo_01_assets_isms.sql" \
  "$DB_DIR/sql/seed_demo_08_documents.sql" \
  "$DB_DIR/sql/seed_demo_04_tprm_contracts.sql" \
  "$DB_DIR/sql/seed_demo_02_dpms.sql" \
  "$DB_DIR/sql/seed_demo_03_audit.sql" \
  "$DB_DIR/sql/seed_demo_05_bcms.sql" \
  "$DB_DIR/sql/seed_demo_06_kris.sql" \
  "$DB_DIR/sql/seed_demo_10_control_tests.sql" \
  "$DB_DIR/sql/seed_demo_07_tasks_findings.sql"; do
  [ -f "$f" ] || continue
  echo "  $(basename $f)"
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$f" >/dev/null 2>&1 || true
done

echo "Done."
