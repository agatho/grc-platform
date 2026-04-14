-- =============================================================================
-- ARCTOS Demo Data Seed — TPRM & Contract Management (Sprint 9)
-- vendor, vendor_contact, vendor_risk_assessment, vendor_due_diligence,
-- contract, contract_sla, contract_sla_measurement, contract_obligation,
-- lksg_assessment
-- =============================================================================
-- Idempotent: uses INSERT ... ON CONFLICT DO NOTHING
-- Deterministic UUIDs: d0000000-0000-0000-0000-0000000007XX pattern
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
-- 1. Vendors (5 vendors)
-- ─────────────────────────────────────────────────────────────────────────────

-- VND-001: CloudNova GmbH (cloud, critical)
INSERT INTO vendor (id, org_id, name, legal_name, description, category, tier, status, country, address, website, tax_id,
  inherent_risk_score, residual_risk_score, last_assessment_date, next_assessment_date,
  is_lksg_relevant, owner_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000701',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'CloudNova GmbH',
  'CloudNova Infrastruktur GmbH',
  'Primärer Cloud-Infrastruktur-Anbieter für Produktiv- und Staging-Umgebungen. Betreibt dedizierte Kubernetes-Cluster in deutschen Rechenzentren (Frankfurt, Nürnberg).',
  'cloud_provider',
  'critical',
  'active',
  'Deutschland',
  'Technologiepark 15, 60486 Frankfurt am Main',
  'https://cloudnova.example.de',
  'DE312456789',
  82,
  45,
  '2026-01-15',
  '2026-07-15',
  false,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- VND-002: SalesTech CRM (IT services, important)
INSERT INTO vendor (id, org_id, name, legal_name, description, category, tier, status, country, address, website, tax_id,
  inherent_risk_score, residual_risk_score, last_assessment_date, next_assessment_date,
  is_lksg_relevant, owner_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000702',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'SalesTech CRM',
  'SalesTech Solutions GmbH',
  'SaaS-Anbieter für Customer-Relationship-Management. EU-Hosting mit Rechenzentren in Irland und Deutschland. SOC 2 Type II zertifiziert.',
  'it_services',
  'important',
  'active',
  'Deutschland',
  'Digitalstrasse 8, 80331 Muenchen',
  'https://salestech-crm.example.de',
  'DE298765432',
  58,
  38,
  '2025-11-01',
  '2026-11-01',
  false,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- VND-003: PayPilot AG (HR services, critical)
INSERT INTO vendor (id, org_id, name, legal_name, description, category, tier, status, country, address, website, tax_id,
  inherent_risk_score, residual_risk_score, last_assessment_date, next_assessment_date,
  is_lksg_relevant, owner_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000703',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'PayPilot AG',
  'PayPilot Personaldienstleistungen AG',
  'Dienstleister für Lohn- und Gehaltsabrechnung sowie Personaladministration. Verarbeitet sensible Mitarbeiterdaten inklusive Gehalts- und Steuerinformationen.',
  'hr_services',
  'critical',
  'active',
  'Deutschland',
  'Rheinuferweg 22, 40213 Duesseldorf',
  'https://paypilot.example.de',
  'DE276543210',
  75,
  42,
  '2025-12-01',
  '2026-06-01',
  false,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- VND-004: FloorClean GmbH (facility, standard)
INSERT INTO vendor (id, org_id, name, legal_name, description, category, tier, status, country, address, website, tax_id,
  inherent_risk_score, residual_risk_score,
  is_lksg_relevant, lksg_tier, owner_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000704',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'FloorClean GmbH',
  'FloorClean Gebaeudeservice GmbH',
  'Facility-Management-Dienstleister für Gebaeudereinigung, Winterdienst und Gruenpflege. Setzt Subunternehmer ein — LkSG-relevant aufgrund von Beschaeftigungsrisiken in der Lieferkette.',
  'facility',
  'standard',
  'active',
  'Deutschland',
  'Industriestrasse 45, 45127 Essen',
  'https://floorclean.example.de',
  'DE234567890',
  35,
  28,
  true,
  'direct',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- VND-005: ITConsult Partners (consulting, important)
INSERT INTO vendor (id, org_id, name, legal_name, description, category, tier, status, country, address, website, tax_id,
  inherent_risk_score, residual_risk_score,
  is_lksg_relevant, owner_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000705',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'ITConsult Partners',
  'ITConsult Partners Beratungsgesellschaft mbH',
  'IT-Beratungsunternehmen mit Schwerpunkt Informationssicherheit, Cloud-Architektur und GRC-Implementierung. Stellt externe Berater für ISMS-Aufbau und ISO 27001 Zertifizierungsvorbereitung.',
  'consulting',
  'important',
  'active',
  'Deutschland',
  'Friedrichstrasse 191, 10117 Berlin',
  'https://itconsult-partners.example.de',
  'DE287654321',
  45,
  30,
  false,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Vendor Contacts (1 per vendor)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO vendor_contact (id, vendor_id, org_id, name, email, phone, role, is_primary)
VALUES (
  'd0000000-0000-0000-0000-000000000710',
  'd0000000-0000-0000-0000-000000000701',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Thomas Weber',
  't.weber@cloudnova.example.de',
  '+49 69 123456-10',
  'Key Account Manager',
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO vendor_contact (id, vendor_id, org_id, name, email, phone, role, is_primary)
VALUES (
  'd0000000-0000-0000-0000-000000000711',
  'd0000000-0000-0000-0000-000000000702',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Lisa Hoffmann',
  'l.hoffmann@salestech-crm.example.de',
  '+49 89 987654-20',
  'Customer Success Manager',
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO vendor_contact (id, vendor_id, org_id, name, email, phone, role, is_primary)
VALUES (
  'd0000000-0000-0000-0000-000000000712',
  'd0000000-0000-0000-0000-000000000703',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Martin Schulz',
  'm.schulz@paypilot.example.de',
  '+49 211 456789-30',
  'Projektleiter Payroll',
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO vendor_contact (id, vendor_id, org_id, name, email, phone, role, is_primary)
VALUES (
  'd0000000-0000-0000-0000-000000000713',
  'd0000000-0000-0000-0000-000000000704',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Petra Koenig',
  'p.koenig@floorclean.example.de',
  '+49 201 334455-40',
  'Objektleiterin',
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO vendor_contact (id, vendor_id, org_id, name, email, phone, role, is_primary)
VALUES (
  'd0000000-0000-0000-0000-000000000714',
  'd0000000-0000-0000-0000-000000000705',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Dr. Alexander Braun',
  'a.braun@itconsult-partners.example.de',
  '+49 30 778899-50',
  'Partner — Information Security',
  true
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Vendor Risk Assessments (3: CloudNova, SalesTech, PayPilot)
-- ─────────────────────────────────────────────────────────────────────────────

-- VRA-001: CloudNova GmbH
INSERT INTO vendor_risk_assessment (id, vendor_id, org_id, assessment_date,
  inherent_risk_score, residual_risk_score,
  confidentiality_score, integrity_score, availability_score,
  compliance_score, financial_score, reputation_score,
  risk_trend, assessed_by, notes)
VALUES (
  'd0000000-0000-0000-0000-000000000720',
  'd0000000-0000-0000-0000-000000000701',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  '2026-01-15',
  82, 45,
  4, 3, 5,
  3, 4, 3,
  'stable',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'Hohe Abhängigkeit aufgrund Primär-Hosting. Verfügbarkeitsrisiko am höchsten bewertet. ISO 27001 und SOC 2 Zertifizierungen vorhanden. Restrisiko durch Single-Provider-Abhängigkeit.'
) ON CONFLICT (id) DO NOTHING;

-- VRA-002: SalesTech CRM
INSERT INTO vendor_risk_assessment (id, vendor_id, org_id, assessment_date,
  inherent_risk_score, residual_risk_score,
  confidentiality_score, integrity_score, availability_score,
  compliance_score, financial_score, reputation_score,
  risk_trend, assessed_by, notes)
VALUES (
  'd0000000-0000-0000-0000-000000000721',
  'd0000000-0000-0000-0000-000000000702',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  '2025-11-01',
  58, 38,
  3, 2, 3,
  3, 2, 2,
  'improving',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'Mittleres Risikoprofil. EU-Hosting bestätigt. SOC 2 Type II Report liegt vor. Verbesserung durch kueerzlich implementierte MFA für alle Administratoren.'
) ON CONFLICT (id) DO NOTHING;

-- VRA-003: PayPilot AG
INSERT INTO vendor_risk_assessment (id, vendor_id, org_id, assessment_date,
  inherent_risk_score, residual_risk_score,
  confidentiality_score, integrity_score, availability_score,
  compliance_score, financial_score, reputation_score,
  risk_trend, assessed_by, notes)
VALUES (
  'd0000000-0000-0000-0000-000000000722',
  'd0000000-0000-0000-0000-000000000703',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  '2025-12-01',
  75, 42,
  5, 4, 3,
  4, 3, 4,
  'stable',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'Hohes Vertraulichkeitsrisiko durch Verarbeitung sensibler Gehaltsdaten. AV-Vertrag gemäß Art. 28 DSGVO abgeschlossen. Jährlicher ISAE 3402 Bericht wird geliefert.'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Vendor Due Diligence (1: CloudNova, completed)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO vendor_due_diligence (id, vendor_id, org_id, questionnaire_version, status,
  sent_at, completed_at, responses, risk_score,
  reviewed_by, reviewed_at)
VALUES (
  'd0000000-0000-0000-0000-000000000730',
  'd0000000-0000-0000-0000-000000000701',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'v2.1',
  'completed',
  '2025-12-01 09:00:00+01',
  '2025-12-20 16:30:00+01',
  '{"information_security": {"iso27001_certified": true, "soc2_report": true, "penetration_test_frequency": "quarterly", "encryption_at_rest": "AES-256", "encryption_in_transit": "TLS 1.3"}, "data_protection": {"dpa_signed": true, "data_location": "EU (Frankfurt, Nürnberg)", "sub_processors": 3, "breach_notification_hours": 24}, "business_continuity": {"rto_hours": 4, "rpo_hours": 1, "backup_frequency": "hourly", "disaster_recovery_tested": true}}',
  35,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-01-10 11:00:00+01'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Contracts (3 contracts)
-- ─────────────────────────────────────────────────────────────────────────────

-- CON-001: CloudNova Master Agreement + SLA
INSERT INTO contract (id, org_id, vendor_id, title, description, contract_type, status,
  contract_number, effective_date, expiration_date, notice_period_days, auto_renewal, renewal_period_months,
  total_value, currency, annual_value, payment_terms,
  owner_id, signed_date, signed_by, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000740',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000701',
  'Rahmenvertrag Cloud-Infrastruktur CloudNova',
  'Rahmenvertrag für dedizierte Cloud-Infrastruktur inklusive Managed Kubernetes, Objektspeicher und Datenbankservices. Umfasst SLA mit Verfügbarkeitsgarantien und Incident-Response-Zeiten.',
  'master_agreement',
  'active',
  'CON-2025-001',
  '2025-04-01',
  '2028-03-31',
  180,
  true,
  12,
  540000.00,
  'EUR',
  180000.00,
  'Monatliche Abrechnung, Zahlung 30 Tage netto',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2025-03-15',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- CON-002: PayPilot Service Agreement
INSERT INTO contract (id, org_id, vendor_id, title, description, contract_type, status,
  contract_number, effective_date, expiration_date, notice_period_days, auto_renewal, renewal_period_months,
  total_value, currency, annual_value, payment_terms,
  owner_id, signed_date, signed_by, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000741',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000703',
  'Dienstleistungsvertrag Lohn- und Gehaltsabrechnung',
  'Vertrag ueber die Erbringung von Lohn- und Gehaltsabrechnungsdienstleistungen für alle Konzerngesellschaften. Umfasst monatliche Abrechnung, Meldewesen und Jahresabschlussarbeiten.',
  'service_agreement',
  'active',
  'CON-2024-008',
  '2024-01-01',
  '2026-12-31',
  90,
  false,
  NULL,
  216000.00,
  'EUR',
  72000.00,
  'Monatliche Pauschale, Zahlung 14 Tage netto',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2023-12-01',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- CON-003: ITConsult Partners Consulting Agreement
INSERT INTO contract (id, org_id, vendor_id, title, description, contract_type, status,
  contract_number, effective_date, expiration_date, notice_period_days,
  total_value, currency, annual_value, payment_terms,
  owner_id, signed_date, signed_by, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000742',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000705',
  'Beratungsvertrag ISMS-Aufbau und ISO 27001 Zertifizierung',
  'Beratungsvertrag für die Unterstuetzung beim Aufbau des ISMS und der Vorbereitung der ISO 27001 Erstzertifizierung. Umfasst Gap-Analyse, Dokumentationserstellung, interne Audits und Zertifizierungsbegleitung.',
  'consulting',
  'active',
  'CON-2025-012',
  '2025-10-01',
  '2026-09-30',
  30,
  120000.00,
  'EUR',
  120000.00,
  'Monatliche Abrechnung nach Aufwand, Zahlung 30 Tage netto, Tagessatz 1.800 EUR',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2025-09-15',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Contract SLAs (4: 2 CloudNova, 1 PayPilot, 1 ITConsult)
-- ─────────────────────────────────────────────────────────────────────────────

-- SLA-001: CloudNova Uptime 99.9%
INSERT INTO contract_sla (id, contract_id, org_id, metric_name, target_value, unit, measurement_frequency, penalty_clause)
VALUES (
  'd0000000-0000-0000-0000-000000000750',
  'd0000000-0000-0000-0000-000000000740',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Infrastruktur-Verfügbarkeit',
  99.9000,
  'percent',
  'monthly',
  'Bei Unterschreitung der 99,9% Verfügbarkeit: Gutschrift von 10% der Monatspauschale pro 0,1% Unterschreitung, maximal 30% der Monatspauschale.'
) ON CONFLICT (id) DO NOTHING;

-- SLA-002: CloudNova Response Time
INSERT INTO contract_sla (id, contract_id, org_id, metric_name, target_value, unit, measurement_frequency, penalty_clause)
VALUES (
  'd0000000-0000-0000-0000-000000000751',
  'd0000000-0000-0000-0000-000000000740',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Incident-Reaktionszeit (Severity 1)',
  15.0000,
  'minutes',
  'monthly',
  'Bei Ueberschreitung der 15-Minuten-Reaktionszeit für Severity-1-Vorfaelle: Gutschrift von 500 EUR pro Vorfall.'
) ON CONFLICT (id) DO NOTHING;

-- SLA-003: PayPilot Payroll Accuracy
INSERT INTO contract_sla (id, contract_id, org_id, metric_name, target_value, unit, measurement_frequency, penalty_clause)
VALUES (
  'd0000000-0000-0000-0000-000000000752',
  'd0000000-0000-0000-0000-000000000741',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Abrechnungsgenauigkeit',
  99.5000,
  'percent',
  'monthly',
  'Bei Fehlerquote ueber 0,5%: Nachbearbeitung auf Kosten des Dienstleisters. Bei wiederholter Unterschreitung (3 Monate) Sonderkuendigungsrecht.'
) ON CONFLICT (id) DO NOTHING;

-- SLA-004: ITConsult Consultant Availability
INSERT INTO contract_sla (id, contract_id, org_id, metric_name, target_value, unit, measurement_frequency, penalty_clause)
VALUES (
  'd0000000-0000-0000-0000-000000000753',
  'd0000000-0000-0000-0000-000000000742',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Berater-Verfügbarkeit',
  90.0000,
  'percent',
  'quarterly',
  'Bei Unterschreitung der zugesicherten Beratertage um mehr als 10%: Verlängerung der Vertragslaufzeit um die ausgefallenen Tage ohne Mehrkosten.'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Contract SLA Measurements (6: 2 months of CloudNova uptime)
-- ─────────────────────────────────────────────────────────────────────────────

-- Uptime Jan 2026: 99.95% — OK
INSERT INTO contract_sla_measurement (id, sla_id, org_id, period_start, period_end, actual_value, is_breach, notes, measured_by)
VALUES (
  'd0000000-0000-0000-0000-000000000760',
  'd0000000-0000-0000-0000-000000000750',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  '2026-01-01',
  '2026-01-31',
  99.9500,
  false,
  'Keine nennenswerten Ausfaelle. Geplante Wartung am 18.01. (22 Min) im Wartungsfenster.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- Uptime Feb 2026: 99.82% — BREACH
INSERT INTO contract_sla_measurement (id, sla_id, org_id, period_start, period_end, actual_value, is_breach, notes, measured_by)
VALUES (
  'd0000000-0000-0000-0000-000000000761',
  'd0000000-0000-0000-0000-000000000750',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  '2026-02-01',
  '2026-02-28',
  99.8200,
  true,
  'Ungeplanter Ausfall am 12.02. (78 Min) durch Netzwerkstoeruung im Rechenzentrum Frankfurt. Gutschrift von 10% der Monatspauschale beantragt.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- Response Time Jan 2026: 8 min — OK
INSERT INTO contract_sla_measurement (id, sla_id, org_id, period_start, period_end, actual_value, is_breach, notes, measured_by)
VALUES (
  'd0000000-0000-0000-0000-000000000762',
  'd0000000-0000-0000-0000-000000000751',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  '2026-01-01',
  '2026-01-31',
  8.0000,
  false,
  'Durchschnittliche Reaktionszeit bei 2 Severity-1-Vorfaellen: 8 Minuten. Innerhalb des SLA.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- Response Time Feb 2026: 12 min — OK
INSERT INTO contract_sla_measurement (id, sla_id, org_id, period_start, period_end, actual_value, is_breach, notes, measured_by)
VALUES (
  'd0000000-0000-0000-0000-000000000763',
  'd0000000-0000-0000-0000-000000000751',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  '2026-02-01',
  '2026-02-28',
  12.0000,
  false,
  'Durchschnittliche Reaktionszeit bei 3 Severity-1-Vorfaellen: 12 Minuten. Knapp innerhalb des SLA, Trend beobachten.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- PayPilot Accuracy Jan 2026: 99.8% — OK
INSERT INTO contract_sla_measurement (id, sla_id, org_id, period_start, period_end, actual_value, is_breach, notes, measured_by)
VALUES (
  'd0000000-0000-0000-0000-000000000764',
  'd0000000-0000-0000-0000-000000000752',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  '2026-01-01',
  '2026-01-31',
  99.8000,
  false,
  '3 geringfuegige Abrechnungsfehler bei 1.500 Abrechnungen (0,2%). Alle innerhalb von 48h korrigiert.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- PayPilot Accuracy Feb 2026: 99.6% — OK
INSERT INTO contract_sla_measurement (id, sla_id, org_id, period_start, period_end, actual_value, is_breach, notes, measured_by)
VALUES (
  'd0000000-0000-0000-0000-000000000765',
  'd0000000-0000-0000-0000-000000000752',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  '2026-02-01',
  '2026-02-28',
  99.6000,
  false,
  '6 Abrechnungsfehler bei 1.500 Abrechnungen (0,4%). Erhöhte Fehlerrate durch Tarifumstellung zum 01.02. Innerhalb SLA, aber Trend beobachten.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Contract Obligations (3)
-- ─────────────────────────────────────────────────────────────────────────────

-- OBL-001: CloudNova annual security audit
INSERT INTO contract_obligation (id, contract_id, org_id, title, description, obligation_type, due_date,
  recurring, recurring_interval_months, status, responsible_id)
VALUES (
  'd0000000-0000-0000-0000-000000000770',
  'd0000000-0000-0000-0000-000000000740',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Jährliches Sicherheitsaudit CloudNova',
  'CloudNova ist verpflichtet, jährlich einen unabhängigen Sicherheitsauditbericht (SOC 2 Type II oder ISO 27001 Zertifikat) vorzulegen. Der Bericht muss innerhalb von 90 Tagen nach Auditabschluss bereitgestellt werden.',
  'audit_right',
  '2026-06-30',
  true,
  12,
  'pending',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- OBL-002: PayPilot monthly report
INSERT INTO contract_obligation (id, contract_id, org_id, title, description, obligation_type, due_date,
  recurring, recurring_interval_months, status, responsible_id)
VALUES (
  'd0000000-0000-0000-0000-000000000771',
  'd0000000-0000-0000-0000-000000000741',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Monatlicher Abrechnungsqualitaetsbericht',
  'PayPilot liefert bis zum 10. Werktag des Folgemonats einen Qualitaetsbericht mit Fehlerquote, Korrekturmaßnahmen und Statistiken zur Abrechnungsgenauigkeit.',
  'reporting',
  '2026-04-14',
  true,
  1,
  'in_progress',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- OBL-003: ITConsult quarterly review
INSERT INTO contract_obligation (id, contract_id, org_id, title, description, obligation_type, due_date,
  recurring, recurring_interval_months, status, responsible_id)
VALUES (
  'd0000000-0000-0000-0000-000000000772',
  'd0000000-0000-0000-0000-000000000742',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Quartalsweise Fortschrittsbewertung ISMS-Aufbau',
  'ITConsult Partners praesentiert quartalsweise den Fortschritt des ISMS-Aufbaus mit Meilensteinbericht, Risiken und Empfehlungen. Nächster Review: Q1 2026 Abschluss.',
  'deliverable',
  '2026-04-15',
  true,
  3,
  'pending',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. LkSG Assessment (1: FloorClean GmbH)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO lksg_assessment (id, vendor_id, org_id, assessment_date, lksg_tier,
  risk_areas, mitigation_plans, status, overall_risk_level,
  assessed_by, reviewed_by, reviewed_at, next_review_date)
VALUES (
  'd0000000-0000-0000-0000-000000000780',
  'd0000000-0000-0000-0000-000000000704',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  '2026-02-01',
  'direct',
  '[{"area": "Arbeitnehmerrechte", "risk_level": "medium", "description": "Einsatz von Subunternehmern in der Gebaeudereinigung mit potenziellen Risiken bei Mindestlohn und Arbeitszeiten."}, {"area": "Arbeitsschutz", "risk_level": "low", "description": "Umgang mit Reinigungschemikalien erfordert Schulungen und Schutzausruestung."}, {"area": "Diskriminierung", "risk_level": "low", "description": "Diversitaet in der Belegschaft vorhanden, keine Hinweise auf systematische Diskriminierung."}]',
  '[{"area": "Arbeitnehmerrechte", "measure": "Vertragliche Verpflichtung zur Einhaltung des Mindestlohngesetzes durch Subunternehmer. Stichprobenartige Kontrollen der Lohnabrechnungen.", "deadline": "2026-06-30", "status": "in_progress"}, {"area": "Arbeitsschutz", "measure": "Nachweis der jährlichen Unterweisung aller Mitarbeiter im Umgang mit Gefahrstoffen.", "deadline": "2026-04-30", "status": "completed"}]',
  'completed',
  'medium',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-02-15 14:00:00+01',
  '2027-02-01'
) ON CONFLICT (id) DO NOTHING;

COMMIT;
