-- seed_demo_00_platform.sql — Base platform data (Orgs + Users + Roles + Modules + Work Item Types)
-- Must run BEFORE all other seed_demo_*.sql files
-- Password for all users: admin123

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
  ('ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'Meridian Holdings GmbH', 'Meridian-Demo', 'holding', 'DE'),
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
-- 2. Users (password: admin123 for all)
-- bcrypt hash of "admin123" with 12 rounds
-- ============================================================

INSERT INTO "user" (id, email, name, password_hash, language)
VALUES
  ('f22a4bc0-0147-4c0d-a02f-98cf65f1e768', 'admin@arctos.dev', 'Platform Admin', '$2b$12$VJqCv7CfzUqIXeSgVk3I2uFqj3llVxlhrLJVquIbUdt65Dh26e3oi', 'de'),
  ('8c148f0a-f558-4a9f-8886-a3d7096da6cf', 'ciso@arctos.dev', 'Sarah Mueller', '$2b$12$VJqCv7CfzUqIXeSgVk3I2uFqj3llVxlhrLJVquIbUdt65Dh26e3oi', 'de'),
  ('d4e5f6a7-b8c9-0123-def0-456789abcdef', 'compliance@arctos.dev', 'Thomas Schmidt', '$2b$12$VJqCv7CfzUqIXeSgVk3I2uFqj3llVxlhrLJVquIbUdt65Dh26e3oi', 'de'),
  ('e5f6a7b8-c9d0-1234-ef01-56789abcdef0', 'bcm@arctos.dev', 'Lisa Wagner', '$2b$12$VJqCv7CfzUqIXeSgVk3I2uFqj3llVxlhrLJVquIbUdt65Dh26e3oi', 'de'),
  ('f6a7b8c9-d0e1-2345-f012-6789abcdef01', 'contracts@arctos.dev', 'Michael Hoffmann', '$2b$12$VJqCv7CfzUqIXeSgVk3I2uFqj3llVxlhrLJVquIbUdt65Dh26e3oi', 'de'),
  ('a7b8c9d0-e1f2-3456-0123-789abcdef012', 'qm@arctos.dev', 'Andrea Fischer', '$2b$12$VJqCv7CfzUqIXeSgVk3I2uFqj3llVxlhrLJVquIbUdt65Dh26e3oi', 'de'),
  ('b8c9d0e1-f2a3-4567-1234-89abcdef0123', 'security@arctos.dev', 'Markus Bauer', '$2b$12$VJqCv7CfzUqIXeSgVk3I2uFqj3llVxlhrLJVquIbUdt65Dh26e3oi', 'de'),
  ('c9d0e1f2-a3b4-5678-2345-9abcdef01234', 'auditor@arctos.dev', 'Dr. Klaus Richter', '$2b$12$VJqCv7CfzUqIXeSgVk3I2uFqj3llVxlhrLJVquIbUdt65Dh26e3oi', 'de'),
  ('d0e1f2a3-b4c5-6789-3456-abcdef012345', 'dpo@arctos.dev', 'Dr. Julia Krause', '$2b$12$VJqCv7CfzUqIXeSgVk3I2uFqj3llVxlhrLJVquIbUdt65Dh26e3oi', 'de'),
  ('e1f2a3b4-c5d6-7890-4567-bcdef0123456', 'risk@arctos.dev', 'Peter Zimmermann', '$2b$12$VJqCv7CfzUqIXeSgVk3I2uFqj3llVxlhrLJVquIbUdt65Dh26e3oi', 'de')
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
  -- Demo data org (ccc4cc1c) — same users need access here for seeds
  ('f22a4bc0-0147-4c0d-a02f-98cf65f1e768', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'admin', 'first'),
  ('8c148f0a-f558-4a9f-8886-a3d7096da6cf', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', 'risk_manager', 'second'),
  -- NovaTec
  ('f22a4bc0-0147-4c0d-a02f-98cf65f1e768', '6cf1eb6d-2727-4679-a767-2ac333395047', 'admin', 'first')
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
