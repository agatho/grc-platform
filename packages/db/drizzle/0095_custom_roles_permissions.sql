-- Migration 0095: Custom Roles + Permission Matrix
-- Enables org-admins to create custom roles with fine-grained module permissions
-- System roles (11 predefined) are seeded as is_system=true and cannot be deleted

-- ============================================================
-- 1. custom_role — Role definitions (system + custom)
-- ============================================================

CREATE TABLE IF NOT EXISTS custom_role (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(20) DEFAULT '#6B7280',
  is_system BOOLEAN NOT NULL DEFAULT false,
  system_role_key VARCHAR(50),
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

CREATE INDEX IF NOT EXISTS custom_role_org_idx ON custom_role(org_id);

ALTER TABLE custom_role ENABLE ROW LEVEL SECURITY;
CREATE POLICY custom_role_org_isolation ON custom_role
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE TRIGGER custom_role_audit
  AFTER INSERT OR UPDATE OR DELETE ON custom_role
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ============================================================
-- 2. role_permission — Module x Action matrix per role
-- ============================================================

CREATE TABLE IF NOT EXISTS role_permission (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES custom_role(id) ON DELETE CASCADE,
  module_key VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('read', 'write', 'admin', 'none')),
  UNIQUE(role_id, module_key)
);

CREATE INDEX IF NOT EXISTS role_permission_role_idx ON role_permission(role_id);

-- No RLS needed — accessed via role_id JOIN to custom_role which has RLS

-- ============================================================
-- 3. user_custom_role — User assignment to custom roles
-- ============================================================

CREATE TABLE IF NOT EXISTS user_custom_role (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  custom_role_id UUID NOT NULL REFERENCES custom_role(id) ON DELETE CASCADE,
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, org_id, custom_role_id)
);

CREATE INDEX IF NOT EXISTS user_custom_role_user_idx ON user_custom_role(user_id, org_id);
CREATE INDEX IF NOT EXISTS user_custom_role_role_idx ON user_custom_role(custom_role_id);

ALTER TABLE user_custom_role ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_custom_role_org_isolation ON user_custom_role
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE TRIGGER user_custom_role_audit
  AFTER INSERT OR UPDATE OR DELETE ON user_custom_role
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ============================================================
-- 4. Seed system roles for all existing organizations
-- ============================================================

-- Insert system roles for each org
INSERT INTO custom_role (org_id, name, description, color, is_system, system_role_key)
SELECT o.id, r.name, r.description, r.color, true, r.key
FROM organization o
CROSS JOIN (VALUES
  ('admin',                  'Administrator',              'Voller Zugriff auf alle Module und Einstellungen', '#7c3aed'),
  ('risk_manager',           'Risikomanager',              'ERM, ISMS, BCMS, TPRM — Risikobewertung und -behandlung', '#2563eb'),
  ('control_owner',          'Kontrollverantwortlicher',   'ICS — Eigene Kontrollen, Testergebnisse, Nachweise', '#0d9488'),
  ('auditor',                'Auditor',                    'Audit-Management, Read-Only auf andere Module', '#ea580c'),
  ('dpo',                    'Datenschutzbeauftragter',    'DPMS — VVT, DSFA, DSR, Datenpannen', '#4f46e5'),
  ('process_owner',          'Prozessverantwortlicher',    'BPM — Eigene Prozesse, BPMN-Editor', '#16a34a'),
  ('esg_manager',            'ESG-Manager',                'ESG — Wesentlichkeit, Emissionen, Ziele, Berichte', '#059669'),
  ('esg_contributor',        'ESG-Dateneingeber',          'ESG — Dateneingabe und Messwerte', '#65a30d'),
  ('viewer',                 'Betrachter',                 'Read-Only auf alle freigegebenen Module', '#6b7280'),
  ('whistleblowing_officer', 'Hinweisgeberbeauftragter',   'Nur Whistleblowing — rechtlich isoliert', '#dc2626'),
  ('ombudsperson',           'Ombudsperson',               'Externe Ombudsperson fuer Hinweisgeberfaelle', '#991b1b')
) AS r(key, name, description, color)
ON CONFLICT (org_id, name) DO NOTHING;

-- ============================================================
-- 5. Seed permission matrix for system roles
-- ============================================================

-- Helper: Insert permissions for a system role across all orgs
-- admin → all modules: admin
INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, m.key, 'admin'
FROM custom_role cr
CROSS JOIN (VALUES ('erm'),('isms'),('ics'),('dpms'),('bcms'),('audit'),('tprm'),('contract'),('esg'),('bpm'),('eam'),('reporting'),('whistleblowing'),('academy'),('dms')) AS m(key)
WHERE cr.system_role_key = 'admin' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;

-- risk_manager
INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, m.key, m.action
FROM custom_role cr
CROSS JOIN (VALUES ('erm','admin'),('isms','write'),('bcms','write'),('tprm','write'),('ics','read'),('audit','read'),('esg','read'),('dpms','read'),('bpm','read'),('reporting','write')) AS m(key, action)
WHERE cr.system_role_key = 'risk_manager' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;

-- control_owner
INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, m.key, m.action
FROM custom_role cr
CROSS JOIN (VALUES ('ics','admin'),('erm','read'),('audit','read'),('bpm','read')) AS m(key, action)
WHERE cr.system_role_key = 'control_owner' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;

-- auditor
INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, m.key, m.action
FROM custom_role cr
CROSS JOIN (VALUES ('audit','admin'),('erm','read'),('ics','read'),('isms','read'),('bcms','read'),('dpms','read'),('tprm','read'),('esg','read'),('bpm','read')) AS m(key, action)
WHERE cr.system_role_key = 'auditor' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;

-- dpo
INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, m.key, m.action
FROM custom_role cr
CROSS JOIN (VALUES ('dpms','admin'),('isms','read'),('tprm','read'),('erm','read'),('audit','read')) AS m(key, action)
WHERE cr.system_role_key = 'dpo' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;

-- process_owner
INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, m.key, m.action
FROM custom_role cr
CROSS JOIN (VALUES ('bpm','admin'),('eam','write'),('ics','read'),('erm','read')) AS m(key, action)
WHERE cr.system_role_key = 'process_owner' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;

-- esg_manager
INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, m.key, m.action
FROM custom_role cr
CROSS JOIN (VALUES ('esg','admin'),('erm','read'),('tprm','read'),('reporting','write')) AS m(key, action)
WHERE cr.system_role_key = 'esg_manager' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;

-- esg_contributor
INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, m.key, m.action
FROM custom_role cr
CROSS JOIN (VALUES ('esg','write')) AS m(key, action)
WHERE cr.system_role_key = 'esg_contributor' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;

-- viewer → all modules: read
INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, m.key, 'read'
FROM custom_role cr
CROSS JOIN (VALUES ('erm'),('isms'),('ics'),('dpms'),('bcms'),('audit'),('tprm'),('contract'),('esg'),('bpm'),('eam'),('reporting'),('dms')) AS m(key)
WHERE cr.system_role_key = 'viewer' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;

-- whistleblowing_officer → only whistleblowing
INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, 'whistleblowing', 'admin'
FROM custom_role cr
WHERE cr.system_role_key = 'whistleblowing_officer' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;

-- ombudsperson → whistleblowing read only
INSERT INTO role_permission (role_id, module_key, action)
SELECT cr.id, 'whistleblowing', 'read'
FROM custom_role cr
WHERE cr.system_role_key = 'ombudsperson' AND cr.is_system = true
ON CONFLICT (role_id, module_key) DO NOTHING;
