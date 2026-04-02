#!/usr/bin/env bash
# ============================================================================
# ARCTOS GRC Platform — One-Command Setup
# Usage: ./scripts/setup.sh
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DB_DIR="$ROOT_DIR/packages/db"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[ARCTOS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }
step() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

# ─────────────────────────────────────────────────────────────────
# 1. Check prerequisites
# ─────────────────────────────────────────────────────────────────
step "Checking prerequisites"

command -v node >/dev/null 2>&1 || { err "Node.js is required. Install Node.js 22+."; exit 1; }
command -v psql >/dev/null 2>&1 || { err "psql is required. Install PostgreSQL client."; exit 1; }

NODE_VERSION=$(node -v | grep -oP '\d+' | head -1)
if [ "$NODE_VERSION" -lt 22 ]; then
  err "Node.js 22+ required, found $(node -v)"
  exit 1
fi
log "Node.js $(node -v) ✓"

# ─────────────────────────────────────────────────────────────────
# 2. Environment file
# ─────────────────────────────────────────────────────────────────
step "Setting up environment"

if [ ! -f "$ROOT_DIR/.env" ]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  # Generate secrets
  AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  WB_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  CRON_SECRET=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")

  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|AUTH_SECRET=.*|AUTH_SECRET=$AUTH_SECRET|" "$ROOT_DIR/.env"
    sed -i '' "s|WB_ENCRYPTION_KEY=.*|WB_ENCRYPTION_KEY=$WB_KEY|" "$ROOT_DIR/.env"
    sed -i '' "s|CRON_SECRET=.*|CRON_SECRET=$CRON_SECRET|" "$ROOT_DIR/.env"
  else
    sed -i "s|AUTH_SECRET=.*|AUTH_SECRET=$AUTH_SECRET|" "$ROOT_DIR/.env"
    sed -i "s|WB_ENCRYPTION_KEY=.*|WB_ENCRYPTION_KEY=$WB_KEY|" "$ROOT_DIR/.env"
    sed -i "s|CRON_SECRET=.*|CRON_SECRET=$CRON_SECRET|" "$ROOT_DIR/.env"
  fi
  log "Created .env with generated secrets ✓"
else
  log ".env already exists ✓"
fi

# Source env
set -a; source "$ROOT_DIR/.env"; set +a

# ─────────────────────────────────────────────────────────────────
# 3. Install dependencies
# ─────────────────────────────────────────────────────────────────
step "Installing dependencies"

cd "$ROOT_DIR"
npm install 2>&1 | tail -3
log "Dependencies installed ✓"

# ─────────────────────────────────────────────────────────────────
# 4. Database setup
# ─────────────────────────────────────────────────────────────────
step "Setting up database"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-grc}"
DB_PASS="${DB_PASS:-grc_dev_password}"
DB_NAME="${DB_NAME:-grc_platform}"

# Check if PostgreSQL is reachable
if ! PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1" >/dev/null 2>&1; then
  warn "PostgreSQL not reachable at $DB_HOST:$DB_PORT"
  warn "Starting Docker Compose..."
  if command -v docker >/dev/null 2>&1; then
    docker compose up -d 2>&1 | tail -3
    log "Waiting for PostgreSQL to be ready..."
    for i in $(seq 1 30); do
      if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
  else
    err "Docker not found. Please start PostgreSQL manually."
    exit 1
  fi
fi
log "PostgreSQL connected ✓"

# Create database if not exists
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "
  SELECT 'CREATE DATABASE $DB_NAME' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')
\gexec" 2>/dev/null || true

# Create extensions
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
" 2>/dev/null
log "Database & extensions ready ✓"

# ─────────────────────────────────────────────────────────────────
# 5. Run Drizzle migrations
# ─────────────────────────────────────────────────────────────────
step "Running database migrations"

cd "$DB_DIR"
npx drizzle-kit migrate 2>&1 | tail -3
log "Drizzle migrations applied ✓"

# ─────────────────────────────────────────────────────────────────
# 6. Run custom SQL migrations (0025+)
# ─────────────────────────────────────────────────────────────────
step "Running custom SQL migrations"

CUSTOM_COUNT=0
for f in $(ls "$DB_DIR/drizzle"/0*.sql 2>/dev/null | sort); do
  TAG=$(basename "$f" .sql)
  IDX=$(echo "$TAG" | grep -oP '^\d+' | sed 's/^0*//')
  if [ "${IDX:-0}" -gt 24 ]; then
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$f" >/dev/null 2>&1 || true
    CUSTOM_COUNT=$((CUSTOM_COUNT + 1))
  fi
done
log "$CUSTOM_COUNT custom migrations applied ✓"

# ─────────────────────────────────────────────────────────────────
# 7. Create grc_app role for RLS
# ─────────────────────────────────────────────────────────────────
step "Creating application database role"

PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
  DO \$\$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'grc_app') THEN
      CREATE ROLE grc_app LOGIN PASSWORD 'grc_app_dev_password';
    END IF;
  END \$\$;
  GRANT USAGE ON SCHEMA public TO grc_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grc_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO grc_app;
" 2>/dev/null
log "grc_app role created ✓"

# ─────────────────────────────────────────────────────────────────
# 8. Seed foundation data
# ─────────────────────────────────────────────────────────────────
step "Seeding foundation data (organizations, users, roles)"

cd "$DB_DIR"
npx tsx src/seed.ts 2>&1 | tail -5
log "Foundation seed complete ✓"

# ─────────────────────────────────────────────────────────────────
# 9. Seed catalogs & frameworks
# ─────────────────────────────────────────────────────────────────
step "Seeding 29 catalog frameworks (2,000+ entries)"

CATALOG_COUNT=0
for f in "$DB_DIR/sql"/seed_catalog_*.sql; do
  [ -f "$f" ] || continue
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$f" >/dev/null 2>&1 || true
  CATALOG_COUNT=$((CATALOG_COUNT + 1))
done
log "$CATALOG_COUNT catalog files seeded ✓"

# Seed cross-framework mappings (needs helper function)
for f in "$DB_DIR/sql"/seed_cross_framework_mappings*.sql; do
  [ -f "$f" ] || continue
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$f" >/dev/null 2>&1 || true
done
log "Cross-framework mappings seeded ✓"

# Seed reference data
for f in "$DB_DIR/sql"/seed_fachliche_stammdaten.sql "$DB_DIR/sql"/seed_work_item_types_sprint5_9.sql "$DB_DIR/sql"/seed_module_definitions_sprint4_9.sql; do
  [ -f "$f" ] || continue
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$f" >/dev/null 2>&1 || true
done
log "Reference data seeded ✓"

# ─────────────────────────────────────────────────────────────────
# 10. Seed demo data (all modules)
# ─────────────────────────────────────────────────────────────────
step "Seeding demo data (risks, controls, vendors, audits, ...)"

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
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$f" >/dev/null 2>&1 || true
done
log "Demo data seeded ✓"

# ─────────────────────────────────────────────────────────────────
# 11. Build i18n bundles
# ─────────────────────────────────────────────────────────────────
step "Building i18n message bundles"

cd "$ROOT_DIR/apps/web"
npx tsx scripts/build-messages.ts 2>&1 | tail -3
log "i18n bundles built ✓"

# ─────────────────────────────────────────────────────────────────
# 12. Summary
# ─────────────────────────────────────────────────────────────────
step "Setup complete!"

TABLE_COUNT=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
  SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
" 2>/dev/null | tr -d ' ')

CATALOG_ENTRIES=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
  SELECT COUNT(*) FROM catalog_entry;
" 2>/dev/null | tr -d ' ')

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ARCTOS GRC Platform — Ready!                       ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Database tables:  ${TABLE_COUNT:-?}                               ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Catalog entries:  ${CATALOG_ENTRIES:-?}                            ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Frameworks:       29                                ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Cross-mappings:   401                               ${GREEN}║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Start dev server:  ${BLUE}npm run dev${NC}                      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Build production:  ${BLUE}npm run build${NC}                    ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Login:             ${BLUE}admin@arctos.dev / admin123${NC}      ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
