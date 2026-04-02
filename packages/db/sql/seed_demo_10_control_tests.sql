-- =============================================================================
-- ARCTOS Demo Data Seed — Control Test Campaigns & Control Tests
-- 2 campaigns (Q1 completed, Q2 active), 6 control tests
-- =============================================================================
-- Idempotent: uses INSERT ... ON CONFLICT DO NOTHING
-- Deterministic UUIDs: d0000000-0000-0000-0000-000000000DXX pattern
-- Depends on: seed_demo_data.sql (controls 0201-0208)
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
-- 1. Control Test Campaigns
-- ─────────────────────────────────────────────────────────────────────────────

-- Campaign 1: ICS Q1 2026 (completed)
INSERT INTO control_test_campaign (id, org_id, name, description, status, period_start, period_end, responsible_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000D01',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'ICS Q1 2026 Testlauf',
  'Regelmaessiger ICS-Testlauf fuer Q1 2026. Umfasst Design- und Wirksamkeitspruefungen der Kernkontrollen im Bereich Informationssicherheit.',
  'completed',
  '2026-01-01',
  '2026-03-31',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- Campaign 2: ICS Q2 2026 (active)
INSERT INTO control_test_campaign (id, org_id, name, description, status, period_start, period_end, responsible_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000D02',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'ICS Q2 2026 Testlauf',
  'Laufender ICS-Testlauf fuer Q2 2026. Fokus auf Verschluesselungskontrollen und Awareness-Massnahmen.',
  'active',
  '2026-04-01',
  '2026-06-30',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Control Tests — Q1 Campaign (completed)
-- ─────────────────────────────────────────────────────────────────────────────

-- CT-001: CTL-001 IS Policy — design effectiveness, effective
INSERT INTO control_test (id, org_id, control_id, campaign_id, test_type, status, tod_result, tester_id, test_date, sample_size, sample_description, conclusion, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000D11',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000201', -- CTL-001 Informationssicherheitsrichtlinie
  'd0000000-0000-0000-0000-000000000D01', -- Q1 Campaign
  'design_effectiveness',
  'completed',
  'effective',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-02-15',
  1,
  'Aktuelle IS-Richtlinie Version 3.2 vom 10.01.2026',
  'Die Informationssicherheitsrichtlinie ist aktuell, von der Geschaeftsfuehrung freigegeben und deckt alle relevanten Bereiche gemaess ISO 27001 ab. Design ist wirksam.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- CT-002: CTL-002 Access Control — operating effectiveness, partially effective
INSERT INTO control_test (id, org_id, control_id, campaign_id, test_type, status, toe_result, tester_id, test_date, sample_size, sample_description, conclusion, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000D12',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000202', -- CTL-002 Zugriffskontrollmanagement
  'd0000000-0000-0000-0000-000000000D01', -- Q1 Campaign
  'operating_effectiveness',
  'completed',
  'partially_effective',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-03-10',
  25,
  'Stichprobe von 25 Benutzerkonten aus AD und IAM-System',
  'Bei 3 von 25 geprueften Konten wurden veraltete Berechtigungen festgestellt, die nach Abteilungswechsel nicht entzogen wurden. Rezertifizierungsprozess greift nicht vollstaendig.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- CT-003: CTL-003 Backup — operating effectiveness, effective
INSERT INTO control_test (id, org_id, control_id, campaign_id, test_type, status, toe_result, tester_id, test_date, sample_size, sample_description, conclusion, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000D13',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000203', -- CTL-003 Datensicherung und Wiederherstellung
  'd0000000-0000-0000-0000-000000000D01', -- Q1 Campaign
  'operating_effectiveness',
  'completed',
  'effective',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-03-05',
  5,
  'Wiederherstellungstests fuer 5 kritische Systeme (ERP, E-Mail, Fileserver, DB-Cluster, CRM)',
  'Alle 5 Wiederherstellungstests erfolgreich innerhalb der definierten RTO-Ziele abgeschlossen. Backup-Integritaet durch Checksummen verifiziert.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- CT-004: CTL-004 Vuln Mgmt — operating effectiveness, effective
INSERT INTO control_test (id, org_id, control_id, campaign_id, test_type, status, toe_result, tester_id, test_date, sample_size, sample_description, conclusion, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000D14',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000204', -- CTL-004 Schwachstellenmanagement
  'd0000000-0000-0000-0000-000000000D01', -- Q1 Campaign
  'operating_effectiveness',
  'completed',
  'effective',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-03-20',
  50,
  'Stichprobe von 50 Schwachstellen-Tickets aus Q1 2026 (CVSS >= 7.0)',
  'Alle kritischen Schwachstellen (CVSS >= 9.0) wurden innerhalb der 72h-Frist gepatcht. Hohe Schwachstellen im Durchschnitt innerhalb von 5 Tagen behoben. Prozess wirksam.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Control Tests — Q2 Campaign (active)
-- ─────────────────────────────────────────────────────────────────────────────

-- CT-005: CTL-006 Encryption — design effectiveness, planned (no result yet)
INSERT INTO control_test (id, org_id, control_id, campaign_id, test_type, status, tester_id, sample_description, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000D21',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000206', -- CTL-006 Verschluesselungsrichtlinie
  'd0000000-0000-0000-0000-000000000D02', -- Q2 Campaign
  'design_effectiveness',
  'planned',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'Geplant: Pruefung der Verschluesselungsrichtlinie gegen BSI TR-02102 und aktuelle Best Practices',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- CT-006: CTL-007 Awareness — operating effectiveness, in_progress (no result yet)
INSERT INTO control_test (id, org_id, control_id, campaign_id, test_type, status, tester_id, sample_size, sample_description, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000D22',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000207', -- CTL-007 Security-Awareness-Schulungen
  'd0000000-0000-0000-0000-000000000D02', -- Q2 Campaign
  'operating_effectiveness',
  'in_progress',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  30,
  'Laufend: Auswertung der Phishing-Simulationen Q1 und Schulungsabschlussquoten',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

COMMIT;
