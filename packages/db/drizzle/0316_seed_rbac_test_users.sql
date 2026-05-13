-- Migration 0316: seed one RBAC test user per role.
--
-- #WAVE11-RBAC: Cowork QA needs a representative user per role to
-- exercise the role-gated endpoints end-to-end. The earlier 0300
-- backfill covered the core ERM roles (admin, risk_manager,
-- control_owner, auditor, dpo, process_owner) for the demo org. This
-- adds one user per *remaining* role so every withAuth(<role>) gate
-- has a real test subject:
--
--   admin (already exists in demo-data via 0300)
--   risk_manager, control_owner, auditor, dpo, process_owner (0300)
--   viewer, esg_manager, esg_contributor, whistleblowing_officer,
--   ombudsperson, compliance_officer, ciso, bcm_manager,
--   contract_manager, quality_manager, security_analyst,
--   department_head, external_auditor — added here.
--
-- All users are placed in the demo org ccc4cc1c-4b09-499c-8420-ebd8da655cd7.
-- Passwords are intentionally NOT set (sso_provider_id stays NULL,
-- password_hash is the placeholder 'rbac_test_seed_no_login') — these
-- are seed users for permission-matrix testing, not interactive login.
-- They can be promoted to real users later by setting password_hash
-- to a bcrypt hash and email_verified to a timestamp.
--
-- Idempotent: ON CONFLICT DO NOTHING on both the user.email unique
-- index and the user_organization_role tuple.

BEGIN;

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

COMMIT;
