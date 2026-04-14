-- =============================================================================
-- ARCTOS Demo Data Seed — Meridian Holdings GmbH
-- Budgets (hierarchical), Risks (Cambridge taxonomy), Controls (ISO 27001),
-- Risk Treatments (with costs)
-- =============================================================================
-- Idempotent: uses INSERT ... ON CONFLICT DO NOTHING
-- Deterministic UUIDs: d0000000-0000-0000-0000-00000000XXXX pattern
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Session config for audit triggers
-- ─────────────────────────────────────────────────────────────────────────────

SELECT set_config('app.current_org_id', 'ccc4cc1c-4b09-499c-8420-ebd8da655cd7', true);
SELECT set_config('app.current_user_id', '8c148f0a-f558-4a9f-8886-a3d7096da6cf', true);
SELECT set_config('app.current_user_email', 'admin@arctos.dev', true);
SELECT set_config('app.current_user_name', 'Platform Admin', true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Budgets (hierarchical)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1.1 Parent: GRC Gesamtbudget 2026
INSERT INTO grc_budget (id, org_id, name, budget_type, grc_area, year, period_start, period_end, total_amount, currency, status, owner_id, parent_budget_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000001',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'GRC Gesamtbudget 2026',
  'management_system',
  'general',
  2026,
  '2026-01-01',
  '2026-12-31',
  2000000.00,
  'EUR',
  'approved',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  NULL,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- 1.2 Child: ISMS Budget 2026
INSERT INTO grc_budget (id, org_id, name, budget_type, grc_area, year, period_start, period_end, total_amount, currency, status, owner_id, parent_budget_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000002',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'ISMS Budget 2026',
  'management_system',
  'isms',
  2026,
  '2026-01-01',
  '2026-12-31',
  500000.00,
  'EUR',
  'approved',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'd0000000-0000-0000-0000-000000000001',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- 1.3 Child: Datenschutz Budget 2026
INSERT INTO grc_budget (id, org_id, name, budget_type, grc_area, year, period_start, period_end, total_amount, currency, status, owner_id, parent_budget_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000003',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Datenschutz Budget 2026',
  'management_system',
  'dpms',
  2026,
  '2026-01-01',
  '2026-12-31',
  200000.00,
  'EUR',
  'approved',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'd0000000-0000-0000-0000-000000000001',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- 1.4 Child: ERM Budget 2026
INSERT INTO grc_budget (id, org_id, name, budget_type, grc_area, year, period_start, period_end, total_amount, currency, status, owner_id, parent_budget_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000004',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'ERM Budget 2026',
  'management_system',
  'erm',
  2026,
  '2026-01-01',
  '2026-12-31',
  150000.00,
  'EUR',
  'approved',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'd0000000-0000-0000-0000-000000000001',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- 1.5 Child: IT Security Operations
INSERT INTO grc_budget (id, org_id, name, budget_type, grc_area, year, period_start, period_end, total_amount, currency, status, owner_id, parent_budget_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000005',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'IT Security Operations',
  'department',
  'isms',
  2026,
  '2026-01-01',
  '2026-12-31',
  300000.00,
  'EUR',
  'approved',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'd0000000-0000-0000-0000-000000000001',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Risks (5 risks linked to Cambridge Taxonomy)
-- ─────────────────────────────────────────────────────────────────────────────

-- RSK-001: Ransomware attack → Cambridge TC.CA.01
INSERT INTO risk (id, org_id, title, description, risk_category, risk_source, status, owner_id,
  inherent_likelihood, inherent_impact, residual_likelihood, residual_impact,
  risk_score_inherent, risk_score_residual, treatment_strategy,
  catalog_entry_id, catalog_source,
  financial_impact_min, financial_impact_max, financial_impact_expected,
  review_date, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000101',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Ransomware-Angriff auf kritische Systeme',
  'Ein gezielter Ransomware-Angriff verschlüsselt produktionskritische Systeme und führt zu mehrtägigem Betriebsausfall. Risiko erhöhter Angriffsfläche durch zunehmende Digitalisierung.',
  'cyber',
  'isms',
  'assessed',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  4, 5, 2, 4,
  20, 8,
  'mitigate',
  '6b0c7c54-d659-4ec4-a206-7f24219e13e8', -- TC.CA.01 Ransomware / destructive malware
  'cambridge_taxonomy_v2',
  500000.00, 5000000.00, 2000000.00,
  '2026-06-30',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- RSK-002: Supply chain disruption → Cambridge TC.CA.04
INSERT INTO risk (id, org_id, title, description, risk_category, risk_source, status, owner_id,
  inherent_likelihood, inherent_impact, residual_likelihood, residual_impact,
  risk_score_inherent, risk_score_residual, treatment_strategy,
  catalog_entry_id, catalog_source,
  financial_impact_min, financial_impact_max, financial_impact_expected,
  review_date, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000102',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Lieferkettenunterbrechung kritischer IT-Dienstleister',
  'Ausfall oder Verzögerung bei der Lieferung von IT-Hardware, Software-Lizenzen oder Managed Services durch geopolitische Spannungen oder Insolvenz eines Schlüssellieferanten.',
  'operational',
  'erm',
  'assessed',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  3, 4, 2, 3,
  12, 6,
  'mitigate',
  'ced74883-f82d-41ec-a900-fb96a100c90d', -- TC.CA.04 Supply chain cyber attack
  'cambridge_taxonomy_v2',
  200000.00, 1500000.00, 600000.00,
  '2026-06-30',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- RSK-003: GDPR violation / data breach → Cambridge SH.LG.03
INSERT INTO risk (id, org_id, title, description, risk_category, risk_source, status, owner_id,
  inherent_likelihood, inherent_impact, residual_likelihood, residual_impact,
  risk_score_inherent, risk_score_residual, treatment_strategy,
  catalog_entry_id, catalog_source,
  financial_impact_min, financial_impact_max, financial_impact_expected,
  review_date, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000103',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'DSGVO-Verstoss durch Datenpanne',
  'Unbefugter Zugriff auf personenbezogene Daten von Kunden oder Mitarbeitern mit Meldepflicht an die Aufsichtsbehoerde. Potenzielle Bussgelder bis 4% des Jahresumsatzes gemäß Art. 83 DSGVO.',
  'compliance',
  'erm',
  'assessed',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  3, 5, 2, 4,
  15, 8,
  'mitigate',
  'd8f84ab1-8ccb-4194-b9e6-f011dc6aad68', -- SH.LG.03 Data privacy enforcement
  'cambridge_taxonomy_v2',
  100000.00, 10000000.00, 2500000.00,
  '2026-06-30',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- RSK-004: Key personnel loss → Cambridge SH.SR.03
INSERT INTO risk (id, org_id, title, description, risk_category, risk_source, status, owner_id,
  inherent_likelihood, inherent_impact, residual_likelihood, residual_impact,
  risk_score_inherent, risk_score_residual, treatment_strategy,
  catalog_entry_id, catalog_source,
  financial_impact_min, financial_impact_max, financial_impact_expected,
  review_date, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000104',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Verlust von Schlüssel-Personal (CISO, DPO, IT-Architekten)',
  'Abwanderung oder längerer Ausfall von Wissensträgern in Schlüsselrollen der Informationssicherheit und Compliance führt zu Wissensverlust und Verzögerung kritischer Projekte.',
  'operational',
  'erm',
  'identified',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  2, 3, 2, 2,
  6, 4,
  'mitigate',
  '00ff7a2c-bb2e-442c-b5c4-6b01b988fcfc', -- SH.SR.03 Skills shortage / labor crisis
  'cambridge_taxonomy_v2',
  50000.00, 500000.00, 200000.00,
  '2026-09-30',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- RSK-005: Cloud provider outage → Cambridge TC.TF.01
INSERT INTO risk (id, org_id, title, description, risk_category, risk_source, status, owner_id,
  inherent_likelihood, inherent_impact, residual_likelihood, residual_impact,
  risk_score_inherent, risk_score_residual, treatment_strategy,
  catalog_entry_id, catalog_source,
  financial_impact_min, financial_impact_max, financial_impact_expected,
  review_date, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000105',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Ausfall des primären Cloud-Providers',
  'Großflächiger Ausfall des primären Cloud-/SaaS-Anbieters führt zu mehrstündigem bis mehrtägigem Ausfall geschäftskritischer Anwendungen. Betrifft ERP, E-Mail und Collaboration-Tools.',
  'cyber',
  'isms',
  'assessed',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  3, 4, 2, 3,
  12, 6,
  'mitigate',
  '7f94c8f7-9405-425c-9706-16638cc6e8b7', -- TC.TF.01 Cloud / SaaS outage
  'cambridge_taxonomy_v2',
  100000.00, 2000000.00, 750000.00,
  '2026-06-30',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Controls (8 controls linked to ISO 27001 Annex A, with cost fields)
-- ─────────────────────────────────────────────────────────────────────────────

-- CTL-001: Information security policy (A.5.1) — ISMS Budget
INSERT INTO control (id, org_id, title, description, control_type, frequency, automation_level, status,
  owner_id, department, catalog_entry_id,
  cost_onetime, cost_annual, cost_currency, budget_id, cost_note,
  created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000201',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Informationssicherheitsrichtlinie',
  'Zentrale IS-Richtlinie mit regelmäßiger Ueberprüfung und Freigabe durch die Geschäftsführung. Umfasst Geltungsbereich, Verantwortlichkeiten und Grundsaetze der Informationssicherheit.',
  'preventive',
  'annually',
  'manual',
  'effective',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'Informationssicherheit',
  '7a9e6de7-66a8-41a1-9c82-049bbc8429e2', -- A.5.1
  NULL, 5000.00, 'EUR',
  'd0000000-0000-0000-0000-000000000002', -- ISMS Budget
  'Jährliche Ueberprüfung und Aktualisierung durch CISO-Team',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- CTL-002: Access control management (A.5.15) — IT Security
INSERT INTO control (id, org_id, title, description, control_type, frequency, automation_level, status,
  owner_id, department, catalog_entry_id,
  cost_onetime, cost_annual, cost_currency, budget_id, cost_note,
  created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000202',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Zugriffskontrollmanagement',
  'Rollenbasierte Zugriffskontrolle (RBAC) mit vierteljährlicher Rezertifizierung. Umfasst Onboarding/Offboarding-Prozesse, Least-Privilege-Prinzip und Protokollierung privilegierter Zugriffe.',
  'preventive',
  'quarterly',
  'semi_automated',
  'effective',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'IT-Sicherheit',
  'a49f1d27-1b36-45f9-aebd-f1fe4ba90cad', -- A.5.15
  NULL, 25000.00, 'EUR',
  'd0000000-0000-0000-0000-000000000005', -- IT Security Operations
  'IAM-Tooling und quartalsweise Rezertifizierungskampagnen',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- CTL-003: Backup & recovery (A.8.13) — ISMS Budget
INSERT INTO control (id, org_id, title, description, control_type, frequency, automation_level, status,
  owner_id, department, catalog_entry_id,
  cost_onetime, cost_annual, cost_currency, budget_id, cost_note,
  created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000203',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Datensicherung und Wiederherstellung',
  'Automatisierte tägliche Backups aller kritischen Systeme mit 3-2-1-Strategie. Monatliche Wiederherstellungstests und dokumentierte RTO/RPO-Ziele pro System.',
  'corrective',
  'daily',
  'fully_automated',
  'effective',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'IT-Betrieb',
  'd6b6d1a4-788a-4057-834d-d8a39f4ea535', -- A.8.13
  50000.00, 15000.00, 'EUR',
  'd0000000-0000-0000-0000-000000000002', -- ISMS Budget
  'Initiale Einrichtung Backup-Infrastruktur + laufende Speicher- und Lizenzkosten',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- CTL-004: Vulnerability management (A.8.8) — IT Security
INSERT INTO control (id, org_id, title, description, control_type, frequency, automation_level, status,
  owner_id, department, catalog_entry_id,
  cost_onetime, cost_annual, cost_currency, budget_id, cost_note,
  created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000204',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Schwachstellenmanagement',
  'Kontinuierliches Schwachstellen-Scanning mit wöchentlichen Scans und Patch-Management-Prozess. Kritische Schwachstellen (CVSS >= 9.0) muessen innerhalb von 72h gepatcht werden.',
  'detective',
  'weekly',
  'semi_automated',
  'effective',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'IT-Sicherheit',
  'ca089b3e-b7e1-43d2-bbee-0610d9cf5863', -- A.8.8
  NULL, 35000.00, 'EUR',
  'd0000000-0000-0000-0000-000000000005', -- IT Security Operations
  'Vulnerability-Scanner-Lizenz und externer Penetrationstest',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- CTL-005: Incident management (A.5.24) — ISMS Budget
INSERT INTO control (id, org_id, title, description, control_type, frequency, automation_level, status,
  owner_id, department, catalog_entry_id,
  cost_onetime, cost_annual, cost_currency, budget_id, cost_note,
  created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000205',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Sicherheitsvorfallmanagement',
  'Strukturierter Incident-Response-Prozess mit Eskalationsstufen, Meldepflichten und Post-Incident-Review. Jährliche Incident-Response-Übung mit Planspiel.',
  'corrective',
  'event_driven',
  'semi_automated',
  'implemented',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'Informationssicherheit',
  'e2d523fb-8c1f-473c-a1f9-d9aac7aa9250', -- A.5.24
  NULL, 10000.00, 'EUR',
  'd0000000-0000-0000-0000-000000000002', -- ISMS Budget
  'SIEM-Anteil und jährliche Tabletop-Exercise',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- CTL-006: Encryption policy (A.8.24) — ISMS Budget
INSERT INTO control (id, org_id, title, description, control_type, frequency, automation_level, status,
  owner_id, department, catalog_entry_id,
  cost_onetime, cost_annual, cost_currency, budget_id, cost_note,
  created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000206',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Verschlüsselungsrichtlinie und -umsetzung',
  'Verschlüsselung aller Daten at-rest (AES-256) und in-transit (TLS 1.3). Zentrales Key-Management mit HSM. Jährliche Ueberprüfung der Krypto-Algorithmen.',
  'preventive',
  'continuous',
  'fully_automated',
  'effective',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'IT-Sicherheit',
  '96e232bc-a444-47dc-9ddf-a1efe6bee924', -- A.8.24
  20000.00, 8000.00, 'EUR',
  'd0000000-0000-0000-0000-000000000002', -- ISMS Budget
  'HSM-Anschaffung und Lizenzkosten Key-Management-System',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- CTL-007: Security awareness training (A.6.3) — ISMS Budget
INSERT INTO control (id, org_id, title, description, control_type, frequency, automation_level, status,
  owner_id, department, catalog_entry_id,
  cost_onetime, cost_annual, cost_currency, budget_id, cost_note,
  created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000207',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Security-Awareness-Schulungen',
  'Verpflichtende jährliche Security-Awareness-Schulung für alle Mitarbeiter. Monatliche Phishing-Simulationen und gezielte Schulungen für Risikogruppen (Finanzen, HR, IT-Admin).',
  'preventive',
  'monthly',
  'semi_automated',
  'effective',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'Informationssicherheit',
  '6e73f2a4-713a-4a5d-acec-4409fedc4841', -- A.6.3
  NULL, 15000.00, 'EUR',
  'd0000000-0000-0000-0000-000000000002', -- ISMS Budget
  'E-Learning-Plattform-Lizenz und Phishing-Simulation-Tool',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- CTL-008: Supplier security (A.5.19) — ERM Budget
INSERT INTO control (id, org_id, title, description, control_type, frequency, automation_level, status,
  owner_id, department, catalog_entry_id,
  cost_onetime, cost_annual, cost_currency, budget_id, cost_note,
  created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000208',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Lieferanten-Sicherheitsmanagement',
  'Strukturierte Sicherheitsbewertung aller IT-Dienstleister mittels standardisiertem Fragebogen. Jährliche Rezertifizierung kritischer Lieferanten mit Vor-Ort-Audits bei Hochrisiko-Anbietern.',
  'preventive',
  'annually',
  'manual',
  'implemented',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'Beschaffung / IT-Sicherheit',
  '4255242f-8523-4a16-a23b-46dbcf228fe0', -- A.5.19
  NULL, 12000.00, 'EUR',
  'd0000000-0000-0000-0000-000000000004', -- ERM Budget
  'Externe Audits und Bewertungsplattform-Lizenz',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Risk Treatments (4 treatments with costs)
-- ─────────────────────────────────────────────────────────────────────────────

-- RT-001: Implement EDR solution for RSK-001 — IT Security Budget
INSERT INTO risk_treatment (id, org_id, risk_id, description, responsible_id, status,
  cost_estimate, cost_annual, cost_currency, budget_id,
  expected_risk_reduction, effort_hours, cost_note, due_date,
  created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000301',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000101', -- RSK-001 Ransomware
  'Einfuehrung einer EDR-Loesung (Endpoint Detection & Response) auf allen Endgeraeten und Servern. Umfasst Rollout, Tuning der Detection-Regeln und 24/7-SOC-Anbindung.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'in_progress',
  80000.00, 40000.00, 'EUR',
  'd0000000-0000-0000-0000-000000000005', -- IT Security Operations
  0.60, 320.00,
  'Einmalige Implementierung + jährliche Lizenz- und SOC-Kosten',
  '2026-06-30',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- RT-002: Dual-source critical suppliers for RSK-002 — ERM Budget
INSERT INTO risk_treatment (id, org_id, risk_id, description, responsible_id, status,
  cost_estimate, cost_annual, cost_currency, budget_id,
  expected_risk_reduction, effort_hours, cost_note, due_date,
  created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000302',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000102', -- RSK-002 Supply chain
  'Identifikation und Qualifizierung von Zweitlieferanten für alle kritischen IT-Dienste und -Komponenten. Aufbau vertraglicher Rahmenvereinbarungen mit Alternativanbietern.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'planned',
  30000.00, NULL, 'EUR',
  'd0000000-0000-0000-0000-000000000004', -- ERM Budget
  0.40, 160.00,
  'Einmalige Aufwaende für Lieferantensuche, Evaluation und Vertragsgestaltung',
  '2026-09-30',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- RT-003: DPO training + DPIA process for RSK-003 — Datenschutz Budget
INSERT INTO risk_treatment (id, org_id, risk_id, description, responsible_id, status,
  cost_estimate, cost_annual, cost_currency, budget_id,
  expected_risk_reduction, effort_hours, cost_note, due_date,
  created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000303',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000103', -- RSK-003 GDPR violation
  'Aufbau eines strukturierten DSFA-Prozesses (Datenschutz-Folgenabschätzung) mit Tool-Unterstützung. Schulung des DSB-Teams und Etablierung regelmäßiger Datenschutz-Audits.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'in_progress',
  15000.00, 5000.00, 'EUR',
  'd0000000-0000-0000-0000-000000000003', -- Datenschutz Budget
  0.50, 200.00,
  'Schulungskosten DSB-Team und DSFA-Tool-Lizenz',
  '2026-06-30',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- RT-004: Key-person insurance for RSK-004 — ERM Budget
INSERT INTO risk_treatment (id, org_id, risk_id, description, responsible_id, status,
  cost_estimate, cost_annual, cost_currency, budget_id,
  expected_risk_reduction, effort_hours, cost_note, due_date,
  created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000304',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000104', -- RSK-004 Key personnel
  'Abschluss einer Keyperson-Versicherung für CISO, DPO und leitende IT-Architekten. Zusaetzlich Aufbau von Stellvertreter-Regelungen und Wissensdokumentation.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'planned',
  NULL, 8000.00, 'EUR',
  'd0000000-0000-0000-0000-000000000004', -- ERM Budget
  0.30, 80.00,
  'Jährliche Versicherungspraemie für 3 Schluesselrollen',
  '2026-12-31',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

COMMIT;
