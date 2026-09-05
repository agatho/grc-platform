#!/usr/bin/env bash
# Seed demo data only (assumes setup.sh has already run).
#
# [E2E-TRIAGE-2026-09-02] This used to be a psql loop with three independent
# defects, each enough on its own to leave the database empty while the script
# printed "Done.":
#   * it listed 11 of the 16 seed_demo_*.sql files and omitted
#     seed_demo_00_platform.sql — the file whose own header says it must run
#     FIRST because it creates the organisations every other demo file
#     references — plus _11_extended, _12_ai_act, _13_programmes and
#     _14_july_features;
#   * every psql call ended in `>/dev/null 2>&1 || true`, so the resulting
#     foreign-key errors could not be reported even in principle;
#   * it read DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME, which this repository's
#     .env does not define (it defines DATABASE_URL), and defaulted to
#     localhost:5432 while the dev database listens on 5433.
#
# Ordering, the complete file list, the production guard and real error
# reporting now live in packages/db/src/seed-demo.ts, which connects via
# DATABASE_URL like every other entry point in packages/db and does not need
# psql on PATH (Windows, CI containers).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR/packages/db"
exec npm run --silent db:seed:demo
