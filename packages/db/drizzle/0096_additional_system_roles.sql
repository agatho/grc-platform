-- Migration 0096: Additional System Roles for real-world coverage
-- Adds 8 industry-standard roles that were missing from the initial 11

-- ============================================================
-- 1. Add new roles to user_role enum
-- ============================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'compliance_officer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ciso';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'bcm_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'contract_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'quality_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'security_analyst';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'department_head';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'external_auditor';

-- ============================================================
-- 2. Insert new system roles for all orgs
-- ============================================================

INSERT INTO custom_role (org_id, name, description, color, is_system, system_role_key)
SELECT o.id, r.name, r.description, r.color, true, r.key
FROM organization o
CROSS JOIN (VALUES
  ('compliance_officer', 'Compliance Officer',         'Compliance-Management: ERM + ICS + Audit + DPMS cross-modular', '#6366f1'),
  ('ciso',               'CISO / ISB',                 'Informationssicherheitsbeauftragter: ISMS Admin, ERM + BCMS Lesen', '#0ea5e9'),
  ('bcm_manager',        'BCM-Manager',                'Business Continuity Manager: BCMS Admin, ERM + ISMS Lesen', '#f59e0b'),
  ('contract_manager',   'Vertragsmanager',             'Vertrags- und Lieferantenmanagement: Contracts + TPRM Admin', '#8b5cf6'),
  ('quality_manager',    'Qualitaetsmanager',           'QMB: ICS Schreiben, Audit Lesen, BPM Schreiben', '#14b8a6'),
  ('security_analyst',   'IT-Sicherheitsanalyst',       'SOC/Security Engineer: ISMS Schreiben, ERM Lesen', '#06b6d4'),
  ('department_head',    'Fachbereichsleiter',          'Bereichsleiter: Lesen auf ERM, ICS, BPM, ESG + eigene Risiken', '#78716c'),
  ('external_auditor',   'Externer Pruefer',            'WP/Zertifizierungsauditor: Read-Only auf Audit, ICS, ISMS', '#a3a3a3')
) AS r(key, name, description, color)
ON CONFLICT (org_id, name) DO NOTHING;

-- ============================================================
-- 3. Permission matrix for new roles
-- ============================================================

-- compliance_officer: Cross-modul Compliance
INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, m.key, m.action
FROM custom_role cr
CROSS JOIN (VALUES
  ('erm','write'), ('ics','write'), ('audit','write'), ('dpms','write'),
  ('isms','read'), ('bcms','read'), ('tprm','read'), ('esg','read'),
  ('bpm','read'), ('reporting','write'), ('dms','write')
) AS m(key, action)
WHERE cr.system_role_key = 'compliance_officer' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;

-- ciso: ISMS Admin + cross-read
INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, m.key, m.action
FROM custom_role cr
CROSS JOIN (VALUES
  ('isms','admin'), ('erm','write'), ('bcms','read'), ('tprm','read'),
  ('audit','read'), ('ics','read'), ('reporting','write')
) AS m(key, action)
WHERE cr.system_role_key = 'ciso' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;

-- bcm_manager: BCMS Admin
INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, m.key, m.action
FROM custom_role cr
CROSS JOIN (VALUES
  ('bcms','admin'), ('erm','read'), ('isms','read'), ('tprm','read'),
  ('bpm','read'), ('reporting','write')
) AS m(key, action)
WHERE cr.system_role_key = 'bcm_manager' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;

-- contract_manager: Contracts + TPRM
INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, m.key, m.action
FROM custom_role cr
CROSS JOIN (VALUES
  ('contract','admin'), ('tprm','admin'), ('erm','read'),
  ('dpms','read'), ('dms','write')
) AS m(key, action)
WHERE cr.system_role_key = 'contract_manager' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;

-- quality_manager: ICS + Audit + BPM
INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, m.key, m.action
FROM custom_role cr
CROSS JOIN (VALUES
  ('ics','write'), ('audit','read'), ('bpm','write'),
  ('erm','read'), ('dms','write'), ('reporting','write')
) AS m(key, action)
WHERE cr.system_role_key = 'quality_manager' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;

-- security_analyst: ISMS write (no admin), ERM read
INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, m.key, m.action
FROM custom_role cr
CROSS JOIN (VALUES
  ('isms','write'), ('erm','read'), ('bcms','read'),
  ('tprm','read'), ('audit','read')
) AS m(key, action)
WHERE cr.system_role_key = 'security_analyst' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;

-- department_head: Cross-read + own risks
INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, m.key, m.action
FROM custom_role cr
CROSS JOIN (VALUES
  ('erm','read'), ('ics','read'), ('bpm','read'), ('esg','read'),
  ('bcms','read'), ('reporting','read'), ('dms','read')
) AS m(key, action)
WHERE cr.system_role_key = 'department_head' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;

-- external_auditor: Read-only audit-relevant modules
INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, m.key, m.action
FROM custom_role cr
CROSS JOIN (VALUES
  ('audit','read'), ('ics','read'), ('isms','read'),
  ('erm','read'), ('bcms','read'), ('dms','read')
) AS m(key, action)
WHERE cr.system_role_key = 'external_auditor' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;

-- ============================================================
-- 4. Seed demo users for new roles (Meridian Holdings only)
-- ============================================================

-- Create demo users
INSERT INTO "user" (email, name, password_hash, language, is_active)
VALUES
  ('ciso@arctos.dev',       'Sarah Mueller',    '$2a$10$xV5GqkGhJ8kXYJ5f1LqQXeGzKjWvL5H5bK4nVR3mJqHE5vZ5K8Hy', 'de', true),
  ('compliance@arctos.dev', 'Thomas Schmidt',   '$2a$10$xV5GqkGhJ8kXYJ5f1LqQXeGzKjWvL5H5bK4nVR3mJqHE5vZ5K8Hy', 'de', true),
  ('bcm@arctos.dev',        'Lisa Wagner',      '$2a$10$xV5GqkGhJ8kXYJ5f1LqQXeGzKjWvL5H5bK4nVR3mJqHE5vZ5K8Hy', 'de', true),
  ('contracts@arctos.dev',  'Michael Hoffmann', '$2a$10$xV5GqkGhJ8kXYJ5f1LqQXeGzKjWvL5H5bK4nVR3mJqHE5vZ5K8Hy', 'de', true),
  ('qm@arctos.dev',         'Andrea Fischer',   '$2a$10$xV5GqkGhJ8kXYJ5f1LqQXeGzKjWvL5H5bK4nVR3mJqHE5vZ5K8Hy', 'de', true),
  ('security@arctos.dev',   'Markus Bauer',     '$2a$10$xV5GqkGhJ8kXYJ5f1LqQXeGzKjWvL5H5bK4nVR3mJqHE5vZ5K8Hy', 'de', true)
ON CONFLICT DO NOTHING;

-- Assign org roles (Meridian Holdings)
INSERT INTO user_organization_role (user_id, org_id, role, line_of_defense)
SELECT u.id, 'c2446a5c-64f1-40a7-862a-8ab084f66f41', r.role::user_role, r.lod::line_of_defense
FROM "user" u
CROSS JOIN (VALUES
  ('ciso@arctos.dev',       'ciso',               'second'),
  ('compliance@arctos.dev', 'compliance_officer',  'second'),
  ('bcm@arctos.dev',        'bcm_manager',         'second'),
  ('contracts@arctos.dev',  'contract_manager',    'first'),
  ('qm@arctos.dev',         'quality_manager',     'first'),
  ('security@arctos.dev',   'security_analyst',    'first')
) AS r(email, role, lod)
WHERE u.email = r.email
ON CONFLICT DO NOTHING;

-- Also assign custom roles
INSERT INTO user_custom_role (user_id, org_id, custom_role_id, created_by)
SELECT u.id, cr.org_id, cr.id, (SELECT id FROM "user" WHERE email = 'admin@arctos.dev' LIMIT 1)
FROM "user" u
JOIN custom_role cr ON cr.system_role_key = (
  CASE u.email
    WHEN 'ciso@arctos.dev' THEN 'ciso'
    WHEN 'compliance@arctos.dev' THEN 'compliance_officer'
    WHEN 'bcm@arctos.dev' THEN 'bcm_manager'
    WHEN 'contracts@arctos.dev' THEN 'contract_manager'
    WHEN 'qm@arctos.dev' THEN 'quality_manager'
    WHEN 'security@arctos.dev' THEN 'security_analyst'
  END
)
WHERE u.email IN ('ciso@arctos.dev','compliance@arctos.dev','bcm@arctos.dev','contracts@arctos.dev','qm@arctos.dev','security@arctos.dev')
  AND cr.org_id = 'c2446a5c-64f1-40a7-862a-8ab084f66f41'
  AND cr.is_system = true
ON CONFLICT DO NOTHING;
