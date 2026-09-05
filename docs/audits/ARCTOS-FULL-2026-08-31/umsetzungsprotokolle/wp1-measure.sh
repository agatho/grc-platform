#!/bin/bash
# WP1 measurement helper — fresh DB, full migrate-all run.
export PGPASSWORD=grc_dev_password
DB=${1:-wp1_$(date +%s)}
dropdb -h localhost -U grc --if-exists "$DB" >/dev/null 2>&1
createdb -h localhost -U grc "$DB"
psql -q -h localhost -U grc -d "$DB" -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS timescaledb;' >/dev/null
cd /work/repo/packages/db
DATABASE_URL="postgresql://grc:grc_dev_password@localhost:5432/$DB" npx tsx src/migrate-all.ts > /tmp/wp1-run.log 2>&1
RC=$?
echo "== DB=$DB  exit=$RC =="
grep -E "^Applying|^  Pass|^✓|^✗|^All migrations" /tmp/wp1-run.log
echo "--- still failing ---"
sed -n '/still failing:/,$p' /tmp/wp1-run.log | grep -E '^    [0-9]' | sed 's/^    //'
