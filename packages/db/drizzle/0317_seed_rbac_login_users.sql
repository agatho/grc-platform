-- Migration 0317: seed login-capable RBAC test users for Meridian Holdings.
--
-- #WAVE12-RBAC-01: the 0316 seed gave each role a user but with the
-- placeholder password_hash 'rbac_test_seed_no_login' — useful for
-- permission-matrix unit tests, useless for Cowork QA's session-level
-- testing. This migration adds the 9 user-spec'd accounts with a
-- real bcrypt-hashed password so QA can actually log in as each role.
--
-- Default password (all 9 accounts): WaveQA-2026!
-- bcrypt hash (cost 10): $2b$10$YObrulE0IAoL0zR1A3b3d..8oPuwIZtGKk6f/fxPOTkGHwt5IGLKy
--
-- Org: Meridian Holdings GmbH = ccc4cc1c-4b09-499c-8420-ebd8da655cd7
--
-- Note on `vendor-mgr`: the user_role enum has no `vendor_manager`
-- value. Mapped to `contract_manager` since that role covers the
-- TPRM/contract-lifecycle responsibilities a "vendor manager" needs.
-- If a dedicated vendor_manager role lands later, update both the
-- enum and this seed.
--
-- Idempotent: ON CONFLICT DO NOTHING on email + role tuple.

BEGIN;

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
