-- ============================================================================
-- ARCTOS Seed: module_definition for all Sprint 4-9 modules
-- Extends Sprint 1.3 module_definition table
-- Run AFTER Sprint 1.3 migrations (021-025)
-- ============================================================================

-- Sprint 4: ICS (Internal Control System)
INSERT INTO module_definition (module_key, display_name_de, display_name_en, description_de, description_en, icon, nav_order, license_tier)
VALUES ('ics', 'Internes Kontrollsystem', 'Internal Control System', 'Kontrollen, Tests, Feststellungen und Maßnahmen', 'Controls, tests, findings and measures', 'shield-check', 40, 'included')
ON CONFLICT (module_key) DO NOTHING;

-- Sprint 4: DMS (Document Management)
INSERT INTO module_definition (module_key, display_name_de, display_name_en, description_de, description_en, icon, nav_order, license_tier)
VALUES ('dms', 'Dokumentenmanagement', 'Document Management', 'Richtlinien, Verfahren und Nachweise', 'Policies, procedures and evidence', 'file-text', 45, 'included')
ON CONFLICT (module_key) DO NOTHING;

-- Sprint 5a/5b: ISMS (Information Security Management)
INSERT INTO module_definition (module_key, display_name_de, display_name_en, description_de, description_en, icon, nav_order, license_tier)
VALUES ('isms', 'Informationssicherheit', 'Information Security', 'ISMS nach ISO 27001: Assets, PRQ, Assessments, SoA', 'ISMS per ISO 27001: assets, PRQ, assessments, SoA', 'lock', 50, 'included')
ON CONFLICT (module_key) DO NOTHING;

-- Sprint 6: BCMS (Business Continuity)
INSERT INTO module_definition (module_key, display_name_de, display_name_en, description_de, description_en, icon, nav_order, license_tier)
VALUES ('bcms', 'Business Continuity', 'Business Continuity', 'BIA, Notfallpläne, Krisenmanagement, Übungen', 'BIA, continuity plans, crisis management, exercises', 'activity', 60, 'included')
ON CONFLICT (module_key) DO NOTHING;

-- Sprint 7: DPMS (Data Protection)
INSERT INTO module_definition (module_key, display_name_de, display_name_en, description_de, description_en, icon, nav_order, license_tier)
VALUES ('dpms', 'Datenschutz', 'Data Protection', 'RoPA, DSFA, Betroffenenanfragen, Datenpannen', 'RoPA, DPIA, data subject requests, breach management', 'eye-off', 70, 'included')
ON CONFLICT (module_key) DO NOTHING;

-- Sprint 8: Audit Management
INSERT INTO module_definition (module_key, display_name_de, display_name_en, description_de, description_en, icon, nav_order, license_tier)
VALUES ('audit', 'Audit Management', 'Audit Management', 'Audit-Universum, Audit-Pläne, Durchführung, Feststellungen', 'Audit universe, audit plans, execution, findings', 'clipboard-check', 80, 'included')
ON CONFLICT (module_key) DO NOTHING;

-- Sprint 9: TPRM (Third-Party Risk)
INSERT INTO module_definition (module_key, display_name_de, display_name_en, description_de, description_en, icon, nav_order, license_tier)
VALUES ('tprm', 'Drittparteien-Risiko', 'Third-Party Risk', 'Lieferanten, Due Diligence, Risikobewertung, LkSG', 'Vendors, due diligence, risk assessment, supply chain', 'users', 90, 'included')
ON CONFLICT (module_key) DO NOTHING;

-- Sprint 9: Contract Management
INSERT INTO module_definition (module_key, display_name_de, display_name_en, description_de, description_en, icon, nav_order, license_tier)
VALUES ('contract', 'Vertragsmanagement', 'Contract Management', 'Verträge, Pflichten, SLA-Monitoring, Verlängerungen', 'Contracts, obligations, SLA monitoring, renewals', 'file-signature', 95, 'included')
ON CONFLICT (module_key) DO NOTHING;

-- ============================================================================
-- Sidebar Navigation Entries per Module
-- These define the left-nav items visible when a module is activated
-- ============================================================================

-- ICS Sidebar
INSERT INTO module_nav_item (module_key, label_de, label_en, icon, route, sort_order, required_roles, parent_route) VALUES
  ('ics', 'Übersicht', 'Overview', 'layout-dashboard', '/controls', 10, '{}', NULL),
  ('ics', 'Kontrollregister', 'Control Register', 'shield-check', '/controls/register', 20, '{}', '/controls'),
  ('ics', 'Kontroll-Tests', 'Control Tests', 'clipboard-check', '/controls/tests', 30, '{}', '/controls'),
  ('ics', 'Feststellungen', 'Findings', 'search', '/controls/findings', 40, '{}', '/controls'),
  ('ics', 'Kampagnen', 'Campaigns', 'calendar', '/controls/campaigns', 50, '{admin,risk_manager}', '/controls')
ON CONFLICT (module_key, route) DO NOTHING;

-- DMS Sidebar
INSERT INTO module_nav_item (module_key, label_de, label_en, icon, route, sort_order, required_roles, parent_route) VALUES
  ('dms', 'Dokumentenablage', 'Document Repository', 'file-text', '/documents', 10, '{}', NULL),
  ('dms', 'Richtlinien', 'Policies', 'book-open', '/documents/policies', 20, '{}', '/documents'),
  ('dms', 'Verfahren', 'Procedures', 'list', '/documents/procedures', 30, '{}', '/documents'),
  ('dms', 'Nachweise', 'Evidence', 'paperclip', '/documents/evidence', 40, '{}', '/documents'),
  ('dms', 'Kenntnisnahmen', 'Acknowledgments', 'check-circle', '/documents/acknowledgments', 50, '{}', '/documents')
ON CONFLICT (module_key, route) DO NOTHING;

-- ISMS Sidebar (Sprint 5a + 5b)
INSERT INTO module_nav_item (module_key, label_de, label_en, icon, route, sort_order, required_roles, parent_route) VALUES
  ('isms', 'Übersicht', 'Overview', 'layout-dashboard', '/isms', 10, '{}', NULL),
  ('isms', 'Assets & PRQ', 'Assets & PRQ', 'server', '/isms/assets', 20, '{}', '/isms'),
  ('isms', 'Bedrohungen', 'Threats', 'zap', '/isms/threats', 30, '{}', '/isms'),
  ('isms', 'Schwachstellen', 'Vulnerabilities', 'alert-octagon', '/isms/vulnerabilities', 40, '{}', '/isms'),
  ('isms', 'Risiko-Szenarien', 'Risk Scenarios', 'target', '/isms/risk-scenarios', 50, '{}', '/isms'),
  ('isms', 'Vorfälle', 'Incidents', 'bell', '/isms/incidents', 60, '{}', '/isms'),
  ('isms', 'Assessments', 'Assessments', 'clipboard-list', '/isms/assessments', 70, '{admin,risk_manager}', '/isms'),
  ('isms', 'Reifegrad', 'Maturity', 'bar-chart-2', '/isms/maturity', 80, '{admin,risk_manager}', '/isms'),
  ('isms', 'SoA', 'SoA', 'check-square', '/isms/soa', 90, '{admin,risk_manager}', '/isms'),
  ('isms', 'Management Review', 'Management Review', 'file-text', '/isms/reviews', 100, '{admin,risk_manager}', '/isms')
ON CONFLICT (module_key, route) DO NOTHING;

-- BCMS Sidebar (Sprint 6)
INSERT INTO module_nav_item (module_key, label_de, label_en, icon, route, sort_order, required_roles, parent_route) VALUES
  ('bcms', 'Übersicht', 'Overview', 'layout-dashboard', '/bcms', 10, '{}', NULL),
  ('bcms', 'BIA', 'BIA', 'clipboard-list', '/bcms/bia', 20, '{}', '/bcms'),
  ('bcms', 'Notfallpläne', 'Continuity Plans', 'file-text', '/bcms/plans', 30, '{}', '/bcms'),
  ('bcms', 'Krisenmanagement', 'Crisis Management', 'alert-triangle', '/bcms/crisis', 40, '{}', '/bcms'),
  ('bcms', 'Wiederanlaufstrat.', 'Recovery Strategies', 'refresh-cw', '/bcms/strategies', 50, '{}', '/bcms'),
  ('bcms', 'Übungen & Tests', 'Exercises & Tests', 'play-circle', '/bcms/exercises', 60, '{}', '/bcms')
ON CONFLICT (module_key, route) DO NOTHING;

-- DPMS Sidebar (Sprint 7)
INSERT INTO module_nav_item (module_key, label_de, label_en, icon, route, sort_order, required_roles, parent_route) VALUES
  ('dpms', 'Übersicht', 'Overview', 'layout-dashboard', '/dpms', 10, '{}', NULL),
  ('dpms', 'Verarbeitungsverz.', 'Processing Register', 'database', '/dpms/ropa', 20, '{}', '/dpms'),
  ('dpms', 'DSFA', 'DPIA', 'file-search', '/dpms/dpia', 30, '{}', '/dpms'),
  ('dpms', 'Betroffenenanfragen', 'Data Subject Requests', 'user-check', '/dpms/dsr', 40, '{}', '/dpms'),
  ('dpms', 'Datenpannen', 'Data Breaches', 'alert-circle', '/dpms/breaches', 50, '{}', '/dpms'),
  ('dpms', 'Drittland-Transfer', 'International Transfers', 'globe', '/dpms/tia', 60, '{admin,dpo}', '/dpms')
ON CONFLICT (module_key, route) DO NOTHING;

-- Audit Sidebar (Sprint 8)
INSERT INTO module_nav_item (module_key, label_de, label_en, icon, route, sort_order, required_roles, parent_route) VALUES
  ('audit', 'Übersicht', 'Overview', 'layout-dashboard', '/audit', 10, '{}', NULL),
  ('audit', 'Audit-Universum', 'Audit Universe', 'globe', '/audit/universe', 20, '{}', '/audit'),
  ('audit', 'Audit-Pläne', 'Audit Plans', 'calendar', '/audit/plans', 30, '{}', '/audit'),
  ('audit', 'Audits', 'Audits', 'clipboard-check', '/audit/executions', 40, '{}', '/audit'),
  ('audit', 'Feststellungen', 'Findings', 'search', '/audit/findings', 50, '{}', '/audit'),
  ('audit', 'Berichte', 'Reports', 'file-text', '/audit/reports', 60, '{admin,auditor}', '/audit')
ON CONFLICT (module_key, route) DO NOTHING;

-- TPRM Sidebar (Sprint 9)
INSERT INTO module_nav_item (module_key, label_de, label_en, icon, route, sort_order, required_roles, parent_route) VALUES
  ('tprm', 'Übersicht', 'Overview', 'layout-dashboard', '/tprm', 10, '{}', NULL),
  ('tprm', 'Lieferanten', 'Vendors', 'building', '/tprm/vendors', 20, '{}', '/tprm'),
  ('tprm', 'Due Diligence', 'Due Diligence', 'clipboard-list', '/tprm/due-diligence', 30, '{}', '/tprm'),
  ('tprm', 'Lieferantenrisiken', 'Vendor Risks', 'alert-triangle', '/tprm/risk', 40, '{}', '/tprm'),
  ('tprm', 'LkSG', 'Supply Chain Act', 'globe', '/tprm/lksg', 50, '{admin,risk_manager}', '/tprm')
ON CONFLICT (module_key, route) DO NOTHING;

-- Contract Sidebar (Sprint 9)
INSERT INTO module_nav_item (module_key, label_de, label_en, icon, route, sort_order, required_roles, parent_route) VALUES
  ('contract', 'Übersicht', 'Overview', 'layout-dashboard', '/contracts', 10, '{}', NULL),
  ('contract', 'Verträge', 'Contracts', 'file-text', '/contracts/list', 20, '{}', '/contracts'),
  ('contract', 'Fristen & Pflichten', 'Obligations', 'clock', '/contracts/obligations', 30, '{}', '/contracts'),
  ('contract', 'SLA-Monitoring', 'SLA Monitoring', 'bar-chart-2', '/contracts/sla', 40, '{}', '/contracts')
ON CONFLICT (module_key, route) DO NOTHING;
