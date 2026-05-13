-- Migration 0318: backfill user_role enum + retry 0316/0317 seeds.
--
-- #WAVE12-RBAC-02: production deploy hit
--   ERROR: invalid input value for enum user_role: "esg_manager"
-- when 0317 tried to assign that role. The Drizzle schema in
-- packages/db/src/schema/platform.ts has these three values, but no
-- migration ever added them to the live DB enum:
--
--   esg_manager
--   esg_contributor
--   ombudsperson
--
-- 0067 added `whistleblowing_officer`. 0096 added compliance_officer /
-- ciso / bcm_manager / contract_manager / quality_manager /
-- security_analyst / department_head / external_auditor. The ESG +
-- ombudsperson values lived only in the Drizzle TS definition. Any
-- INSERT or ALTER using them blew up at runtime.
--
-- Effect: both 0316 (no-login seed) and 0317 (login-capable seed)
-- have transactions that include rows with role='esg_manager'. The
-- enum error rolled back ALL their inserts, so production saw 0
-- @meridian.test users + 0 of the 0316 rbac-* users.
--
-- This migration:
--   1. Adds the three missing enum values (idempotent via IF NOT EXISTS).
--   2. Re-runs 0316 and 0317's inserts. Both ON CONFLICT DO NOTHING.
--
-- Two-phase: the ALTER TYPE values must be visible to a NEW
-- transaction before they can be referenced. PG forbids reading a
-- value in the same transaction that adds it. So the ALTER block runs
-- in autocommit (no BEGIN/COMMIT wrap), then the INSERT block has its
-- own BEGIN/COMMIT.

-- ── Phase 1: add missing enum values (autocommit) ───────────────
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'esg_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'esg_contributor';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ombudsperson';

-- ── Phase 2: retry 0316 + 0317 inserts ─────────────────────────
BEGIN;

-- 0316 retry — permission-matrix seed users (no-login placeholder hash)
INSERT INTO "user" (id, email, name, password_hash, is_active, language)
VALUES
  ('a0000001-0000-0000-0000-000000000001', 'rbac-viewer@arctos.test',                'RBAC Viewer',                 'rbac_test_seed_no_login', true, 'de'),
  ('a0000001-0000-0000-0000-000000000002', 'rbac-esg-manager@arctos.test',           'RBAC ESG Manager',            'rbac_test_seed_no_login', true, 'de'),
  ('a0000001-0000-0000-0000-000000000003', 'rbac-esg-contributor@arctos.test',       'RBAC ESG Contributor',        'rbac_test_seed_no_login', true, 'de'),
  ('a0000001-0000-0000-0000-000000000004', 'rbac-whistleblowing-officer@arctos.test','RBAC Whistleblowing Officer', 'rbac_test_seed_no_login', true, 'de'),
  ('a0000001-0000-0000-0000-000000000005', 'rbac-ombudsperson@arctos.test',          'RBAC Ombudsperson',           'rbac_test_seed_no_login', true, 'de'),
  ('a0000001-0000-0000-0000-000000000006', 'rbac-compliance-officer@arctos.test',    'RBAC Compliance Officer',     'rbac_test_seed_no_login', true, 'de'),
  ('a0000001-0000-0000-0000-000000000007', 'rbac-ciso@arctos.test',                  'RBAC CISO',                   'rbac_test_seed_no_login', true, 'de'),
  ('a0000001-0000-0000-0000-000000000008', 'rbac-bcm-manager@arctos.test',           'RBAC BCM Manager',            'rbac_test_seed_no_login', true, 'de'),
  ('a0000001-0000-0000-0000-000000000009', 'rbac-contract-manager@arctos.test',      'RBAC Contract Manager',       'rbac_test_seed_no_login', true, 'de'),
  ('a0000001-0000-0000-0000-00000000000a', 'rbac-quality-manager@arctos.test',       'RBAC Quality Manager',        'rbac_test_seed_no_login', true, 'de'),
  ('a0000001-0000-0000-0000-00000000000b', 'rbac-security-analyst@arctos.test',      'RBAC Security Analyst',       'rbac_test_seed_no_login', true, 'de'),
  ('a0000001-0000-0000-0000-00000000000c', 'rbac-department-head@arctos.test',       'RBAC Department Head',        'rbac_test_seed_no_login', true, 'de'),
  ('a0000001-0000-0000-0000-00000000000d', 'rbac-external-auditor@arctos.test',      'RBAC External Auditor',       'rbac_test_seed_no_login', true, 'de')
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_organization_role (user_id, org_id, role, line_of_defense)
VALUES
  ('a0000001-0000-0000-0000-000000000001', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'viewer',                 NULL),
  ('a0000001-0000-0000-0000-000000000002', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'esg_manager',            'second'),
  ('a0000001-0000-0000-0000-000000000003', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'esg_contributor',        'first'),
  ('a0000001-0000-0000-0000-000000000004', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'whistleblowing_officer', NULL),
  ('a0000001-0000-0000-0000-000000000005', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'ombudsperson',           NULL),
  ('a0000001-0000-0000-0000-000000000006', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'compliance_officer',     'second'),
  ('a0000001-0000-0000-0000-000000000007', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'ciso',                   'second'),
  ('a0000001-0000-0000-0000-000000000008', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'bcm_manager',            'second'),
  ('a0000001-0000-0000-0000-000000000009', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'contract_manager',       'first'),
  ('a0000001-0000-0000-0000-00000000000a', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'quality_manager',        'second'),
  ('a0000001-0000-0000-0000-00000000000b', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'security_analyst',       'first'),
  ('a0000001-0000-0000-0000-00000000000c', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'department_head',        'first'),
  ('a0000001-0000-0000-0000-00000000000d', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'external_auditor',       'third')
ON CONFLICT DO NOTHING;

-- 0317 retry — login-capable Meridian users (bcrypt(WaveQA-2026!), cost 10)
INSERT INTO "user" (id, email, name, password_hash, email_verified, is_active, language)
VALUES
  ('a0000002-0000-0000-0000-000000000001', 'ciso@meridian.test',           'Meridian CISO',                    '$2b$10$YObrulE0IAoL0zR1A3b3d..8oPuwIZtGKk6f/fxPOTkGHwt5IGLKy', now(), true, 'de'),
  ('a0000002-0000-0000-0000-000000000002', 'dpo@meridian.test',            'Meridian DPO',                     '$2b$10$YObrulE0IAoL0zR1A3b3d..8oPuwIZtGKk6f/fxPOTkGHwt5IGLKy', now(), true, 'de'),
  ('a0000002-0000-0000-0000-000000000003', 'compliance@meridian.test',     'Meridian Compliance Officer',      '$2b$10$YObrulE0IAoL0zR1A3b3d..8oPuwIZtGKk6f/fxPOTkGHwt5IGLKy', now(), true, 'de'),
  ('a0000002-0000-0000-0000-000000000004', 'auditor@meridian.test',        'Meridian Internal Auditor',        '$2b$10$YObrulE0IAoL0zR1A3b3d..8oPuwIZtGKk6f/fxPOTkGHwt5IGLKy', now(), true, 'de'),
  ('a0000002-0000-0000-0000-000000000005', 'process-owner@meridian.test',  'Meridian Process Owner',           '$2b$10$YObrulE0IAoL0zR1A3b3d..8oPuwIZtGKk6f/fxPOTkGHwt5IGLKy', now(), true, 'de'),
  ('a0000002-0000-0000-0000-000000000006', 'vendor-mgr@meridian.test',     'Meridian Vendor Manager',          '$2b$10$YObrulE0IAoL0zR1A3b3d..8oPuwIZtGKk6f/fxPOTkGHwt5IGLKy', now(), true, 'de'),
  ('a0000002-0000-0000-0000-000000000007', 'esg@meridian.test',            'Meridian ESG Manager',             '$2b$10$YObrulE0IAoL0zR1A3b3d..8oPuwIZtGKk6f/fxPOTkGHwt5IGLKy', now(), true, 'de'),
  ('a0000002-0000-0000-0000-000000000008', 'whistleblowing@meridian.test', 'Meridian Whistleblowing Officer',  '$2b$10$YObrulE0IAoL0zR1A3b3d..8oPuwIZtGKk6f/fxPOTkGHwt5IGLKy', now(), true, 'de'),
  ('a0000002-0000-0000-0000-000000000009', 'viewer@meridian.test',         'Meridian Viewer',                  '$2b$10$YObrulE0IAoL0zR1A3b3d..8oPuwIZtGKk6f/fxPOTkGHwt5IGLKy', now(), true, 'de')
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_organization_role (user_id, org_id, role, line_of_defense)
VALUES
  ('a0000002-0000-0000-0000-000000000001', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'ciso',                    'second'),
  ('a0000002-0000-0000-0000-000000000002', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'dpo',                     'second'),
  ('a0000002-0000-0000-0000-000000000003', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'compliance_officer',      'second'),
  ('a0000002-0000-0000-0000-000000000004', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'auditor',                 'third'),
  ('a0000002-0000-0000-0000-000000000005', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'process_owner',           'first'),
  ('a0000002-0000-0000-0000-000000000006', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'contract_manager',        'first'),
  ('a0000002-0000-0000-0000-000000000007', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'esg_manager',             'second'),
  ('a0000002-0000-0000-0000-000000000008', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'whistleblowing_officer',  NULL),
  ('a0000002-0000-0000-0000-000000000009', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'viewer',                  NULL)
ON CONFLICT DO NOTHING;

COMMIT;
