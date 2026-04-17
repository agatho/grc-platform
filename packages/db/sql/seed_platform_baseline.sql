-- seed_platform_baseline.sql — Required platform data for ANY tenant (demo or private)
-- Contains only module definitions and work item types. No organizations, no users.
-- Private tenants must provision at least one admin user + one organization separately
-- (either manually, via invitation flow, or via create-tenant.sh --admin-email).

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Module Definitions
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

-- Note: module_config rows are NOT inserted here because no orgs exist yet.
-- They must be inserted when an organization is created (via the org-create API
-- or a tenant-provisioning script).

-- ============================================================
-- Work Item Types (required by auto-create triggers)
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
