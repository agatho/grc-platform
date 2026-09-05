-- seed_demo_00_platform.sql — Base platform data (Orgs + Users + Roles + Modules + Work Item Types)
-- Must run BEFORE all other seed_demo_*.sql files
-- Personas are login-disabled (see section 2); no password is seeded here.

-- ============================================================
-- 0. Required Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. Organizations
-- ============================================================
-- Two org IDs are used across seeds:
-- c2446a5c = primary login org (shown in org switcher)
-- ccc4cc1c = demo data org (all seed_demo_01-12 reference this)

INSERT INTO organization (id, name, short_name, type, country)
VALUES
  ('c2446a5c-64f1-40a7-862a-8ab084f66f41', 'Meridian Holdings GmbH', 'Meridian', 'holding', 'DE'),
  -- #NIGHT-022: second Meridian was a demo-tenant duplicate; renamed
  -- so admins can tell the two apart in the org switcher.
  ('ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'Meridian Holdings GmbH (Demo Tenant)', 'Meridian-Demo', 'holding', 'DE'),
  ('6cf1eb6d-2727-4679-a767-2ac333395047', 'NovaTec Services GmbH', 'NovaTec', 'subsidiary', 'DE'),
  ('97ca2910-e9a6-45d3-8ba7-150e9a1ed0d0', 'Arctis Group GmbH', 'Arctis', 'subsidiary', 'DE'),
  ('7cf7aa82-af08-48f5-80d0-eb46b6e37319', 'Arctis Textilservice GmbH', 'Arctis Textil', 'subsidiary', 'DE'),
  ('87746c01-50a6-4abc-bb81-6613f6ffaf99', 'Borealis Workwear International AG', 'Borealis', 'subsidiary', 'CH'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'ClearStream Hygiene Solutions', 'ClearStream', 'subsidiary', 'DE'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Meridian Financial Services', 'MFS', 'subsidiary', 'DE'),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'Nordic Facility Management AS', 'Nordic FM', 'subsidiary', 'NO')
ON CONFLICT (id) DO NOTHING;

UPDATE organization SET parent_org_id = 'c2446a5c-64f1-40a7-862a-8ab084f66f41'
WHERE id NOT IN ('c2446a5c-64f1-40a7-862a-8ab084f66f41', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7')
  AND parent_org_id IS NULL;

-- ============================================================
-- 2. Users — LOGIN-DISABLED demo personas
-- ============================================================
-- [E2E-TRIAGE-2026-09-02] These ten rows used to carry ONE shared bcrypt hash
-- of the literal `admin123`, printed in the header of this file and committed
-- to the repository — exactly the default account WP3/S02-01 removed from
-- `seed.ts` and `deploy/setup.sh`. Re-creating it here through `db:seed:demo`
-- would have undone that finding on every demo/CI environment.
--
-- The rows themselves cannot simply be dropped: every seed_demo_*.sql file
-- references these UUIDs as `created_by` / `owner_id` / `assignee_id`, and
-- `8c148f0a…` is the `app.current_user_id` the audit triggers run under. So the
-- personas stay — as data — but they are no longer credentials:
--
--   * `password_hash` is a fixed non-bcrypt sentinel. `bcrypt.compare()`
--     returns false for EVERY input against it (it has no valid $2 prefix,
--     salt or cost), so there is no password that logs these accounts in —
--     not a guessable one, not a leaked one, not one.
--   * `must_change_password = true` keeps them refused by the login flow even
--     if someone later attaches a real hash by hand.
--
-- Every address also gained a `demo.` prefix. `"user".email` is UNIQUE, and
-- `seed.ts` / `seed-all.ts` create accounts under the SAME addresses with
-- DIFFERENT, generated ids. `ON CONFLICT (id) DO NOTHING` does not catch that
-- collision — it is on `email` — so on any database where `db:seed` had run
-- first (i.e. always) this whole INSERT aborted with
-- `duplicate key value violates unique constraint "user_email_unique"`, no
-- persona row was created, and every seed_demo file after it failed on the
-- foreign key to `8c148f0a…`. The ids are what the demo data references; the
-- addresses only have to be unique and unusable.
--
-- Real accounts come from `db:seed` (SEED_ADMIN_PASSWORD / a printed random
-- one) and `db:create-admin`. Never from here.

INSERT INTO "user" (id, email, name, password_hash, language, must_change_password)
VALUES
  ('f22a4bc0-0147-4c0d-a02f-98cf65f1e768', 'demo.admin@arctos.dev', 'Demo Platform Admin', 'disabled:no-login-demo-persona', 'de', true),
  ('8c148f0a-f558-4a9f-8886-a3d7096da6cf', 'demo.ciso@arctos.dev', 'Sarah Mueller', 'disabled:no-login-demo-persona', 'de', true),
  ('d4e5f6a7-b8c9-0123-def0-456789abcdef', 'demo.compliance@arctos.dev', 'Thomas Schmidt', 'disabled:no-login-demo-persona', 'de', true),
  ('e5f6a7b8-c9d0-1234-ef01-56789abcdef0', 'demo.bcm@arctos.dev', 'Lisa Wagner', 'disabled:no-login-demo-persona', 'de', true),
  ('f6a7b8c9-d0e1-2345-f012-6789abcdef01', 'demo.contracts@arctos.dev', 'Michael Hoffmann', 'disabled:no-login-demo-persona', 'de', true),
  ('a7b8c9d0-e1f2-3456-0123-789abcdef012', 'demo.qm@arctos.dev', 'Andrea Fischer', 'disabled:no-login-demo-persona', 'de', true),
  ('b8c9d0e1-f2a3-4567-1234-89abcdef0123', 'demo.security@arctos.dev', 'Markus Bauer', 'disabled:no-login-demo-persona', 'de', true),
  ('c9d0e1f2-a3b4-5678-2345-9abcdef01234', 'demo.auditor@arctos.dev', 'Dr. Klaus Richter', 'disabled:no-login-demo-persona', 'de', true),
  ('d0e1f2a3-b4c5-6789-3456-abcdef012345', 'demo.dpo@arctos.dev', 'Dr. Julia Krause', 'disabled:no-login-demo-persona', 'de', true),
  ('e1f2a3b4-c5d6-7890-4567-bcdef0123456', 'demo.risk@arctos.dev', 'Peter Zimmermann', 'disabled:no-login-demo-persona', 'de', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Role Assignments — both orgs
-- ============================================================

INSERT INTO user_organization_role (user_id, org_id, role, line_of_defense)
VALUES
  -- Primary org (c2446a5c)
  ('f22a4bc0-0147-4c0d-a02f-98cf65f1e768', 'c2446a5c-64f1-40a7-862a-8ab084f66f41', 'admin', 'first'),
  ('8c148f0a-f558-4a9f-8886-a3d7096da6cf', 'c2446a5c-64f1-40a7-862a-8ab084f66f41', 'risk_manager', 'second'),
  ('d4e5f6a7-b8c9-0123-def0-456789abcdef', 'c2446a5c-64f1-40a7-862a-8ab084f66f41', 'risk_manager', 'second'),
  ('e5f6a7b8-c9d0-1234-ef01-56789abcdef0', 'c2446a5c-64f1-40a7-862a-8ab084f66f41', 'risk_manager', 'second'),
  ('f6a7b8c9-d0e1-2345-f012-6789abcdef01', 'c2446a5c-64f1-40a7-862a-8ab084f66f41', 'risk_manager', 'first'),
  ('a7b8c9d0-e1f2-3456-0123-789abcdef012', 'c2446a5c-64f1-40a7-862a-8ab084f66f41', 'control_owner', 'first'),
  ('b8c9d0e1-f2a3-4567-1234-89abcdef0123', 'c2446a5c-64f1-40a7-862a-8ab084f66f41', 'risk_manager', 'first'),
  ('c9d0e1f2-a3b4-5678-2345-9abcdef01234', 'c2446a5c-64f1-40a7-862a-8ab084f66f41', 'auditor', 'third'),
  ('d0e1f2a3-b4c5-6789-3456-abcdef012345', 'c2446a5c-64f1-40a7-862a-8ab084f66f41', 'dpo', 'second'),
  ('e1f2a3b4-c5d6-7890-4567-bcdef0123456', 'c2446a5c-64f1-40a7-862a-8ab084f66f41', 'risk_manager', 'second'),
  -- Demo data org (ccc4cc1c) — full role roster mirrors the primary org so
  -- owner/assignee pickers in the demo data org actually have candidates
  -- (QA-008, 2026-05-10: dropdown previously showed only 2 users)
  ('f22a4bc0-0147-4c0d-a02f-98cf65f1e768', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'admin', 'first'),
  ('8c148f0a-f558-4a9f-8886-a3d7096da6cf', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'risk_manager', 'second'),
  ('d4e5f6a7-b8c9-0123-def0-456789abcdef', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'risk_manager', 'second'),
  ('e5f6a7b8-c9d0-1234-ef01-56789abcdef0', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'risk_manager', 'second'),
  ('f6a7b8c9-d0e1-2345-f012-6789abcdef01', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'process_owner', 'first'),
  ('a7b8c9d0-e1f2-3456-0123-789abcdef012', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'control_owner', 'first'),
  ('b8c9d0e1-f2a3-4567-1234-89abcdef0123', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'risk_manager', 'first'),
  ('c9d0e1f2-a3b4-5678-2345-9abcdef01234', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'auditor', 'third'),
  ('d0e1f2a3-b4c5-6789-3456-abcdef012345', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'dpo', 'second'),
  ('e1f2a3b4-c5d6-7890-4567-bcdef0123456', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'risk_manager', 'second'),
  -- NovaTec
  ('f22a4bc0-0147-4c0d-a02f-98cf65f1e768', '6cf1eb6d-2727-4679-a767-2ac333395047', 'admin', 'first')
ON CONFLICT DO NOTHING;

-- ── Give the REAL admin accounts access to the demo tenants ──────────
-- [E2E-TRIAGE-2026-09-02] Every seed_demo_*.sql file writes its rows into
-- `c2446a5c…` / `ccc4cc1c…`. The only accounts that held a role there were the
-- login-disabled personas above, so a human (or an E2E run) signing in with a
-- `db:seed` / `db:create-admin` account saw an empty product and had no way to
-- switch to the tenant that actually holds the demo data — the demo seed
-- populated a tenant nobody could reach.
--
-- Grant admin on both demo tenants to every account that is already an admin
-- somewhere, or a platform administrator. Derived, not hard-coded, because the
-- ids of those accounts are generated at seed time.
INSERT INTO user_organization_role (user_id, org_id, role, line_of_defense)
SELECT u.id, o.org_id, 'admin', 'first'
FROM (
  SELECT DISTINCT user_id AS id FROM user_organization_role WHERE role = 'admin'
  UNION
  SELECT user_id FROM platform_admin WHERE revoked_at IS NULL
) u
CROSS JOIN (VALUES
  ('c2446a5c-64f1-40a7-862a-8ab084f66f41'::uuid),
  ('ccc4cc1c-4b09-499c-8420-ebd8da655cd7'::uuid)
) AS o(org_id)
WHERE EXISTS (SELECT 1 FROM "user" usr WHERE usr.id = u.id AND usr.deleted_at IS NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. Module Definitions
-- ============================================================

INSERT INTO module_definition (module_key, display_name_de, display_name_en, icon, nav_order, license_tier)
VALUES
  ('erm', 'Enterprise Risk Management', 'Enterprise Risk Management', 'shield-alert', 10, 'included'),
  ('isms', 'Informationssicherheit', 'Information Security', 'shield-check', 20, 'included'),
  ('ics', 'Internes Kontrollsystem', 'Internal Control System', 'clipboard-check', 30, 'included'),
  ('dpms', 'Datenschutz', 'Data Protection', 'lock', 40, 'included'),
  ('bcms', 'Business Continuity', 'Business Continuity', 'life-buoy', 50, 'included'),
  ('audit', 'Audit Management', 'Audit Management', 'search', 60, 'included'),
  ('tprm', 'Drittparteien-Risiko', 'Third Party Risk', 'users', 70, 'included'),
  ('contract', 'Vertragsmanagement', 'Contract Management', 'file-text', 75, 'included'),
  ('esg', 'ESG & Nachhaltigkeit', 'ESG & Sustainability', 'leaf', 80, 'included'),
  ('bpm', 'Prozessmanagement', 'Process Management', 'git-branch', 90, 'included'),
  ('eam', 'Enterprise Architecture', 'Enterprise Architecture', 'layers', 95, 'included'),
  ('whistleblowing', 'Hinweisgebersystem', 'Whistleblowing', 'megaphone', 100, 'included'),
  ('reporting', 'Berichte', 'Reports', 'bar-chart', 110, 'included'),
  ('dms', 'Dokumentenmanagement', 'Document Management', 'folder', 120, 'included'),
  ('academy', 'GRC Academy', 'GRC Academy', 'graduation-cap', 130, 'included')
ON CONFLICT (module_key) DO NOTHING;

-- Enable all modules for ALL orgs
INSERT INTO module_config (org_id, module_key, ui_status, is_data_active)
SELECT o.id, md.module_key, 'enabled', true
FROM organization o
CROSS JOIN module_definition md
ON CONFLICT (org_id, module_key) DO NOTHING;

-- ============================================================
-- 5. Work Item Types (required by auto-create triggers)
-- ============================================================

INSERT INTO work_item_type (type_key, display_name_de, display_name_en, primary_module, nav_order)
VALUES
  ('task',      'Aufgabe',            'Task',        'erm',   5),
  ('risk',      'Risiko',             'Risk',        'erm',   10),
  ('incident',  'Vorfall',            'Incident',    'isms',  21),
  ('control',   'Kontrolle',          'Control',     'ics',   30),
  ('dpia',      'DSFA',               'DPIA',        'dpms',  40),
  ('dsr',       'Betroffenenanfrage', 'DSR',         'dpms',  41),
  ('breach',    'Datenpanne',         'Data Breach', 'dpms',  42),
  ('audit',     'Audit',              'Audit',       'audit', 60),
  ('finding',   'Feststellung',       'Finding',     'audit', 61),
  ('vendor',    'Lieferant',          'Vendor',      'tprm',  70),
  ('process',   'Prozess',            'Process',     'bpm',   90),
  ('document',  'Dokument',           'Document',    'dms',   120)
ON CONFLICT (type_key) DO NOTHING;
