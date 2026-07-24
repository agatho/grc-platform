#!/usr/bin/env bash
# ============================================================================
# ARCTOS — purge-demo-accounts.sh   (#SEC-F04)
#
# Neutralizes the DEMO / RBAC-test accounts that ship with KNOWN, published
# passwords, in case SEED_DEMO_DATA=true was ever run against an instance that
# now holds (or will hold) real data.
#
# Cleanly identifiable markers (see packages/db/sql/seed_demo_00_platform.sql
# and packages/db/drizzle/0326_seed_arctistx_rbac_users.sql):
#     *@arctos.dev      — demo org "Meridian Holdings GmbH" accounts
#     *@arctistx.test   — RBAC verification accounts
#
# What it does (idempotent, FK-safe — it does NOT hard-DELETE users, which
# would fail against the many nullable user_id references and lose audit
# history):
#   1. deactivates the account          (is_active = false)
#   2. soft-deletes it                   (deleted_at = now())
#   3. scrambles the password hash       (login impossible even if reactivated)
#   4. soft-deletes its org-role rows    (user_organization_role.deleted_at)
#
# The credentials provider requires is_active = true AND deleted_at IS NULL AND
# a valid password_hash, so after this runs none of these accounts can log in.
#
# It does NOT delete the demo ORG DATA (risks, controls, ...). Removing that is
# a separate, broad DBA task (drop the Meridian/Arctistx org ids with cascade)
# and is intentionally out of scope here — see the platform runbook.
#
# Usage:
#   deploy/purge-demo-accounts.sh                      # dry-run against $DATABASE_URL
#   deploy/purge-demo-accounts.sh --yes                # execute against $DATABASE_URL
#   DATABASE_URL=postgres://... deploy/purge-demo-accounts.sh --yes
#   deploy/purge-demo-accounts.sh --url postgres://... --yes
# ============================================================================
set -euo pipefail

DB_URL="${DATABASE_URL:-}"
APPLY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y) APPLY=1; shift ;;
    --url) DB_URL="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [ -z "$DB_URL" ]; then
  echo "ERROR: no database URL. Set DATABASE_URL or pass --url postgres://..." >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql not found in PATH." >&2
  exit 2
fi

# Match predicate — the two known non-production account domains.
MATCH="email ILIKE '%@arctos.dev' OR email ILIKE '%@arctistx.test'"

echo "== ARCTOS demo/test account purge (#SEC-F04) =="
echo "Target DB: ${DB_URL%%\?*}"
echo

echo "Accounts matching demo/test markers (before):"
psql "$DB_URL" -v ON_ERROR_STOP=1 -c \
  "SELECT email,
          is_active,
          (deleted_at IS NOT NULL) AS soft_deleted,
          (password_hash LIKE 'DISABLED-DEMO-ACCOUNT-%') AS pw_disabled
     FROM \"user\"
    WHERE $MATCH
    ORDER BY email;"

if [ "$APPLY" != "1" ]; then
  echo
  echo "DRY-RUN — no changes made. Re-run with --yes to neutralize these accounts."
  exit 0
fi

echo
echo "Applying (idempotent)..."
# gen_random_uuid() requires pgcrypto (present per platform extensions).
psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
BEGIN;

-- 1-3) deactivate + soft-delete + scramble password (only rows not already done)
UPDATE "user"
   SET is_active     = false,
       deleted_at    = COALESCE(deleted_at, now()),
       password_hash = 'DISABLED-DEMO-ACCOUNT-' || gen_random_uuid()
 WHERE ($MATCH)
   AND (
        is_active = true
     OR deleted_at IS NULL
     OR password_hash IS NULL
     OR password_hash NOT LIKE 'DISABLED-DEMO-ACCOUNT-%'
   );

-- 4) soft-delete their active org-role rows
UPDATE user_organization_role
   SET deleted_at = now()
 WHERE deleted_at IS NULL
   AND user_id IN (SELECT id FROM "user" WHERE $MATCH);

COMMIT;
SQL

echo
echo "Accounts after purge:"
psql "$DB_URL" -v ON_ERROR_STOP=1 -c \
  "SELECT email,
          is_active,
          (deleted_at IS NOT NULL) AS soft_deleted,
          (password_hash LIKE 'DISABLED-DEMO-ACCOUNT-%') AS pw_disabled
     FROM \"user\"
    WHERE $MATCH
    ORDER BY email;"

echo
echo "Done. Demo/test accounts can no longer authenticate."
echo "Note: demo ORG DATA (Meridian / Arctistx entities) is left intact by design."
