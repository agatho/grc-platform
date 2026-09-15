-- 0480_op267_disable_seeded_login_accounts.sql
--
-- Migration: 0480_op267_disable_seeded_login_accounts
-- Breaking: no
-- Estimated-Duration: 1
-- Locking: short
-- Compensating-Required: no
-- Reviewer: audit/full-2026-08-31
--
-- ============================================================================
-- [ARCTOS-FULL-2026-08-31 · OP-267] Migrations created login-capable accounts
-- with a published password — in EVERY freshly migrated database.
-- ============================================================================
--
-- Found on 2026-09-14 while rebuilding the three tenant databases.
-- `grc_qumasoft` should hold EXACTLY ONE account according to its own runbook
-- (`admin@qumasoft.de`). It held 35. The 34 extra ones come from migrations,
-- not from a seed:
--
--   0316_seed_rbac_test_users.sql                13 × @arctos.test
--   0317_seed_rbac_login_users.sql                9 × @meridian.test
--   0318_user_role_enum_backfill_and_rbac_retry   (repeat of 0316/0317)
--   0326_seed_arctistx_rbac_users.sql             4 × @arctistx.test
--   0346_seed_bcm_security_external_auditor_users 3 × @meridian.test
--   0096_additional_system_roles.sql              6 × @arctos.dev (named)
--
-- The heart of the finding is not the number but the PATH. The project built
-- three switches for exactly this case — `SEED_DEMO_DATA`,
-- `ALLOW_DEMO_SEED_IN_PROD` (#SEC-F04) and `ALLOW_PRODUCTION_SEED` — and the
-- guard `scripts/assert-runtime-config.mjs` refuses to start when the first
-- two are set. All three act on the SEED path only. A migration walks past
-- them: it is unconditional, it runs on every database, and it runs BEFORE
-- any switch is read. The tenant had `RUN_SEEDS=false`; the accounts were
-- there anyway.
--
-- 0317 states the password in plain text in its own header, and the
-- repository is public; 0326 and 0346 use the same bcrypt hash. That is 15
-- login-capable accounts per database with a password anyone can read. The 13
-- from 0316 carry a placeholder hash and cannot log in — they are neutralized
-- all the same: an account nobody needs is one account too many.
--
-- Why a NEW migration and not a correction of the six old ones: under ADR-014
-- a delivered migration is immutable. These six ARE delivered — they ran
-- against four production databases on 2026-09-14. The ledger records them; a
-- change to the files would never execute again on any existing instance and
-- would achieve exactly nothing there. Only a forward step reaches both the
-- installed base and new installations.
--
-- Approach as in `deploy/purge-demo-accounts.sh` (#SEC-F04): NO hard DELETE.
-- Many nullable references point at `user.id`, and the audit history should
-- survive. Instead deactivate, soft-delete and make the hash unusable — the
-- credentials provider requires `is_active = true AND deleted_at IS NULL` and
-- a valid hash, so any one of the three changes is sufficient on its own.
--
-- Idempotent: the WHERE clause only touches what is not already neutralized.
-- ============================================================================

-- The three domains are reserved by RFC 6761 (`.test`) and can therefore never
-- denote a real account — a pattern is safe there. For `@arctos.dev` it is
-- NOT: that is where `packages/db/src/seed.ts` creates the real operational
-- accounts (`admin@arctos.dev` and the role demo accounts, whose password the
-- seed generates randomly). A pattern on that domain would lock the
-- administrator out of every installation. The six accounts from 0096 are
-- therefore named individually.
UPDATE "user"
   SET is_active     = false,
       deleted_at    = COALESCE(deleted_at, now()),
       password_hash = 'DISABLED-DEMO-ACCOUNT-' || gen_random_uuid()
 WHERE (
         email ILIKE '%@arctos.test'
      OR email ILIKE '%@meridian.test'
      OR email ILIKE '%@arctistx.test'
      OR email IN (
           'ciso@arctos.dev',
           'compliance@arctos.dev',
           'bcm@arctos.dev',
           'contracts@arctos.dev',
           'qm@arctos.dev',
           'security@arctos.dev'
         )
       )
   AND (
        is_active = true
     OR deleted_at IS NULL
     OR password_hash IS NULL
     OR password_hash NOT LIKE 'DISABLED-DEMO-ACCOUNT-%'
   );

-- Neutralize the role assignments of the same accounts. On the four databases
-- of 2026-09-14 this was a no-op (0317 attaches its
-- `INSERT ... SELECT ... WHERE EXISTS` to a hardcoded org UUID that does not
-- exist there) — on a database where that org does exist, it is not.
UPDATE user_organization_role
   SET deleted_at = now()
 WHERE deleted_at IS NULL
   AND user_id IN (
         SELECT id FROM "user"
          WHERE email ILIKE '%@arctos.test'
             OR email ILIKE '%@meridian.test'
             OR email ILIKE '%@arctistx.test'
             OR email IN (
                  'ciso@arctos.dev',
                  'compliance@arctos.dev',
                  'bcm@arctos.dev',
                  'contracts@arctos.dev',
                  'qm@arctos.dev',
                  'security@arctos.dev'
                )
       );
