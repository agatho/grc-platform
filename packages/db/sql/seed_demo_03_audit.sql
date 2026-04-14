-- =============================================================================
-- ARCTOS Demo Data Seed — Audit Management (Sprint 8)
-- audit_universe_entry, audit_plan, audit_plan_item, audit,
-- audit_checklist, audit_checklist_item, audit_activity, finding
-- =============================================================================
-- Idempotent: uses INSERT ... ON CONFLICT DO NOTHING
-- Deterministic UUIDs: d0000000-0000-0000-0000-0000000006XX pattern
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
-- 1. Audit Universe Entries (5 auditable entities)
-- ─────────────────────────────────────────────────────────────────────────────

-- AUE-001: IT Department
INSERT INTO audit_universe_entry (id, org_id, name, entity_type, risk_score, last_audit_date, audit_cycle_months, next_audit_due, priority, notes, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000601',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'IT-Abteilung',
  'department',
  85,
  '2025-03-15',
  12,
  '2026-03-15',
  1,
  'Zentraler Bereich für Informationssicherheit und IT-Betrieb. Hohes Risikoprofil aufgrund kritischer Infrastrukturverantwortung.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- AUE-002: ERP System
INSERT INTO audit_universe_entry (id, org_id, name, entity_type, risk_score, last_audit_date, audit_cycle_months, next_audit_due, priority, notes, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000602',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'ERP-System (Finanzbuchhaltung & Logistik)',
  'it_system',
  78,
  '2025-06-01',
  12,
  '2026-06-01',
  2,
  'Geschäftskritisches System für Finanzbuchhaltung, Einkauf und Logistik. Verarbeitet personenbezogene Daten und Finanztransaktionen.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- AUE-003: HR Process
INSERT INTO audit_universe_entry (id, org_id, name, entity_type, risk_score, last_audit_date, audit_cycle_months, next_audit_due, priority, notes, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000603',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Personalmanagement-Prozess',
  'process',
  62,
  '2024-11-01',
  18,
  '2026-05-01',
  3,
  'Umfasst Recruiting, Onboarding, Gehaltsabrechnung und Offboarding. DSGVO-relevant durch umfangreiche Verarbeitung personenbezogener Mitarbeiterdaten.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- AUE-004: Cloud Hosting Vendor
INSERT INTO audit_universe_entry (id, org_id, name, entity_type, risk_score, last_audit_date, audit_cycle_months, next_audit_due, priority, notes, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000604',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Cloud-Hosting-Dienstleister',
  'vendor',
  72,
  NULL,
  12,
  '2026-06-30',
  2,
  'Primärer Cloud-Anbieter für Produktivumgebungen. Noch kein Lieferantenaudit durchgeführt — Erstaudit geplant für Q2 2026.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- AUE-005: Finance Department
INSERT INTO audit_universe_entry (id, org_id, name, entity_type, risk_score, last_audit_date, audit_cycle_months, next_audit_due, priority, notes, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000605',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Finanzabteilung',
  'department',
  70,
  '2025-09-01',
  12,
  '2026-09-01',
  2,
  'Verantwortlich für Rechnungswesen, Controlling und Treasury. Hohe regulatorische Anforderungen (HGB, IFRS, Steuerrecht).',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Audit Plan: Auditplan 2026
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO audit_plan (id, org_id, name, year, description, status, total_planned_days, approved_by, approved_at, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000610',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Auditplan 2026',
  2026,
  'Jährlicher Auditplan für das Geschäftsjahr 2026. Umfasst ISO 27001 Voraudit, NIS2-Gap-Analyse und geplante Lieferantenaudits.',
  'active',
  45,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-01-15 10:00:00+01',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Audit Plan Items (2 items)
-- ─────────────────────────────────────────────────────────────────────────────

-- API-001: ISO 27001 Pre-Audit
INSERT INTO audit_plan_item (id, org_id, audit_plan_id, universe_entry_id, title, scope_description, planned_start, planned_end, estimated_days, lead_auditor_id, status)
VALUES (
  'd0000000-0000-0000-0000-000000000620',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000610',
  'd0000000-0000-0000-0000-000000000601', -- IT-Abteilung
  'ISO 27001 Voraudit',
  'Internes Voraudit zur Vorbereitung der ISO 27001 Erstzertifizierung. Prüfung aller Annex-A-Kontrollen mit Fokus auf A.5, A.6, A.8. Scope: IT-Abteilung und unterstuetzende Prozesse.',
  '2026-01-20',
  '2026-02-28',
  20,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'completed'
) ON CONFLICT (id) DO NOTHING;

-- API-002: NIS2 Gap Assessment
INSERT INTO audit_plan_item (id, org_id, audit_plan_id, universe_entry_id, title, scope_description, planned_start, planned_end, estimated_days, lead_auditor_id, status)
VALUES (
  'd0000000-0000-0000-0000-000000000621',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000610',
  'd0000000-0000-0000-0000-000000000601', -- IT-Abteilung
  'NIS2 Gap-Analyse',
  'Gap-Analyse der aktuellen Sicherheitsmaßnahmen gegenueber den Anforderungen der NIS2-Richtlinie (EU 2022/2555). Identifikation von Handlungsbedarf in den Bereichen Risikomanagement, Incident Response und Lieferkettensicherheit.',
  '2026-03-01',
  '2026-03-31',
  15,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'in_progress'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Audits (2 audits)
-- ─────────────────────────────────────────────────────────────────────────────

-- AUD-001: ISO 27001 Pre-Audit (completed)
INSERT INTO audit (id, org_id, audit_plan_item_id, title, description, audit_type, status,
  scope_description, scope_frameworks, lead_auditor_id,
  planned_start, planned_end, actual_start, actual_end,
  finding_count, conclusion, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000630',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000620',
  'ISO 27001 Voraudit — Q1 2026',
  'Internes Voraudit zur Bewertung der Zertifizierungsreife. Prüfung der ISMS-Dokumentation, technischer Kontrollen und organisatorischer Maßnahmen gegen ISO 27001:2022 Annex A.',
  'internal',
  'completed',
  'Prüfung aller implementierten Annex-A-Kontrollen der IT-Abteilung einschließlich Zugriffskontrolle, Backup, Verschlüsselung und Awareness-Programm.',
  ARRAY['ISO 27001:2022'],
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-01-20',
  '2026-02-28',
  '2026-01-20',
  '2026-02-25',
  3,
  'minor_nonconformity',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- AUD-002: NIS2 Gap Assessment (fieldwork)
INSERT INTO audit (id, org_id, audit_plan_item_id, title, description, audit_type, status,
  scope_description, scope_frameworks, lead_auditor_id,
  planned_start, planned_end, actual_start,
  created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000631',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000621',
  'NIS2 Gap-Analyse — Maerz 2026',
  'Systematische Gap-Analyse der NIS2-Anforderungen. Bewertung des Reifegrads in den Bereichen Governance, Risikomanagement, Incident Handling, Business Continuity und Supply Chain Security.',
  'internal',
  'fieldwork',
  'Analyse aller NIS2-relevanten Bereiche: Art. 21 Risikomanagement, Art. 23 Meldepflichten, Lieferkettensicherheit und Governance-Strukturen.',
  ARRAY['NIS2 (EU 2022/2555)'],
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-03-01',
  '2026-03-31',
  '2026-03-03',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Audit Checklists (1 per audit)
-- ─────────────────────────────────────────────────────────────────────────────

-- CL-001: ISO 27001 Checklist
INSERT INTO audit_checklist (id, org_id, audit_id, name, source_type, total_items, completed_items, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000640',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000630',
  'ISO 27001:2022 Annex A Pruefcheckliste',
  'auto_controls',
  5,
  5,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- CL-002: NIS2 Checklist
INSERT INTO audit_checklist (id, org_id, audit_id, name, source_type, total_items, completed_items, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000641',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000631',
  'NIS2 Anforderungskatalog',
  'custom',
  3,
  1,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Audit Checklist Items (5 for ISO, 3 for NIS2)
-- ─────────────────────────────────────────────────────────────────────────────

-- ISO 27001 Checklist Items (5)

-- CLI-001: Access control (A.5.15) → conforming
INSERT INTO audit_checklist_item (id, org_id, checklist_id, control_id, question, expected_evidence, result, notes, sort_order, completed_at, completed_by)
VALUES (
  'd0000000-0000-0000-0000-000000000650',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000640',
  'd0000000-0000-0000-0000-000000000202', -- CTL-002 Zugriffskontrolle
  'Ist ein rollenbasiertes Zugriffskontrollsystem implementiert und werden Berechtigungen regelmäßig rezertifiziert?',
  'RBAC-Konfiguration, Rezertifizierungsprotokolle, Onboarding/Offboarding-Checklisten',
  'nonconforming',
  'RBAC implementiert, jedoch letzte Rezertifizierung überfällig (> 6 Monate). Drei verwaiste Admin-Konten gefunden.',
  1,
  '2026-02-05 14:00:00+01',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- CLI-002: Backup & Recovery (A.8.13) → nonconforming
INSERT INTO audit_checklist_item (id, org_id, checklist_id, control_id, question, expected_evidence, result, notes, sort_order, completed_at, completed_by)
VALUES (
  'd0000000-0000-0000-0000-000000000651',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000640',
  'd0000000-0000-0000-0000-000000000203', -- CTL-003 Backup
  'Werden tägliche Backups durchgeführt und regelmäßige Wiederherstellungstests dokumentiert?',
  'Backup-Logs, Wiederherstellungstestprotokolle, RTO/RPO-Dokumentation',
  'nonconforming',
  'Backups laufen automatisiert, Wiederherstellungstests jedoch nur für 2 von 5 kritischen Systemen dokumentiert. RTO/RPO-Dokumentation unvollständig.',
  2,
  '2026-02-07 10:30:00+01',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- CLI-003: Vulnerability Management (A.8.8) → conforming
INSERT INTO audit_checklist_item (id, org_id, checklist_id, control_id, question, expected_evidence, result, notes, sort_order, completed_at, completed_by)
VALUES (
  'd0000000-0000-0000-0000-000000000652',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000640',
  'd0000000-0000-0000-0000-000000000204', -- CTL-004 Vulnerability Mgmt
  'Werden regelmäßige Schwachstellenscans durchgeführt und kritische Schwachstellen zeitnah behoben?',
  'Scan-Reports, Patch-Protokolle, CVSS-Tracking',
  'conforming',
  'Wöchentliche Scans nachgewiesen. Kritische Schwachstellen (CVSS >= 9.0) wurden innerhalb von 72h gepatcht. Patch-Compliance bei 97%.',
  3,
  '2026-02-10 09:00:00+01',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- CLI-004: Encryption (A.8.24) → conforming
INSERT INTO audit_checklist_item (id, org_id, checklist_id, control_id, question, expected_evidence, result, notes, sort_order, completed_at, completed_by)
VALUES (
  'd0000000-0000-0000-0000-000000000653',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000640',
  'd0000000-0000-0000-0000-000000000206', -- CTL-006 Encryption
  'Werden Daten at-rest und in-transit verschlüsselt und wird ein zentrales Key-Management eingesetzt?',
  'Verschlüsselungskonfiguration, Key-Management-Dokumentation, TLS-Zertifikate',
  'conforming',
  'AES-256 at-rest und TLS 1.3 in-transit nachgewiesen. HSM-basiertes Key-Management implementiert.',
  4,
  '2026-02-12 11:00:00+01',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- CLI-005: Security Awareness (A.6.3) → observation
INSERT INTO audit_checklist_item (id, org_id, checklist_id, control_id, question, expected_evidence, result, notes, sort_order, completed_at, completed_by)
VALUES (
  'd0000000-0000-0000-0000-000000000654',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000640',
  'd0000000-0000-0000-0000-000000000207', -- CTL-007 Awareness
  'Werden alle Mitarbeiter regelmäßig in Informationssicherheit geschult und Phishing-Simulationen durchgeführt?',
  'Schulungsnachweise, Teilnahmelisten, Phishing-Simulationsergebnisse',
  'observation',
  'Jährliche Schulung wird durchgeführt, Teilnahmequote jedoch nur 78% (Ziel: 95%). Phishing-Simulationen zeigen 12% Klickrate — Verbesserungspotenzial bei Fachabteilungen.',
  5,
  '2026-02-14 15:00:00+01',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- NIS2 Checklist Items (3)

-- CLI-006: Risk management measures (Art. 21)
INSERT INTO audit_checklist_item (id, org_id, checklist_id, question, expected_evidence, result, notes, sort_order, completed_at, completed_by)
VALUES (
  'd0000000-0000-0000-0000-000000000655',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000641',
  'Sind Risikomanagement-Maßnahmen gemäß Art. 21 NIS2 implementiert, einschließlich Risikoanalyse, Incident-Management und Business Continuity?',
  'Risikoregister, Incident-Response-Plan, BCP-Dokumentation, Management-Review-Protokolle',
  'conforming',
  'Risikoregister mit 5 identifizierten Cyberrisiken vorhanden. Incident-Response-Prozess dokumentiert. BCP in Erstellung.',
  1,
  '2026-03-10 10:00:00+01',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- CLI-007: Incident reporting (Art. 23)
INSERT INTO audit_checklist_item (id, org_id, checklist_id, question, expected_evidence, result, notes, sort_order)
VALUES (
  'd0000000-0000-0000-0000-000000000656',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000641',
  'Sind Meldeprozesse gemäß Art. 23 NIS2 etabliert (Fruehwarnung 24h, Vorfallmeldung 72h, Abschlussbericht 1 Monat)?',
  'Meldeprozess-Dokumentation, Eskalationsmatrix, BSI-Kontaktdaten, Testmeldungen',
  NULL,
  NULL,
  2
) ON CONFLICT (id) DO NOTHING;

-- CLI-008: Supply chain security (Art. 21 Abs. 2 lit. d)
INSERT INTO audit_checklist_item (id, org_id, checklist_id, question, expected_evidence, result, notes, sort_order)
VALUES (
  'd0000000-0000-0000-0000-000000000657',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000641',
  'Werden Sicherheitsaspekte in der Lieferkette systematisch bewertet, einschließlich Bewertung kritischer IKT-Dienstleister?',
  'Lieferantenbewertungen, Sicherheitsanforderungen in Vertraegen, Due-Diligence-Berichte',
  NULL,
  NULL,
  3
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Audit Activities (4 for completed ISO audit)
-- ─────────────────────────────────────────────────────────────────────────────

-- AA-001: Opening meeting
INSERT INTO audit_activity (id, org_id, audit_id, activity_type, title, description, performed_by, performed_at, duration, notes)
VALUES (
  'd0000000-0000-0000-0000-000000000660',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000630',
  'opening_meeting',
  'Eroeffnungsbesprechung ISO 27001 Voraudit',
  'Vorstellung des Auditteams, Prüfungsumfang und Zeitplan. Abstimmung der Ansprechpartner je Fachbereich.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-01-20 09:00:00+01',
  60,
  'Teilnehmer: CISO, IT-Leiter, Datenschutzbeauftragter, GRC-Koordinator. Scope bestätigt.'
) ON CONFLICT (id) DO NOTHING;

-- AA-002: Document review
INSERT INTO audit_activity (id, org_id, audit_id, activity_type, title, description, performed_by, performed_at, duration, notes)
VALUES (
  'd0000000-0000-0000-0000-000000000661',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000630',
  'document_review',
  'Dokumentenprüfung ISMS-Richtlinien',
  'Sichtung und Bewertung der ISMS-Dokumentation: Informationssicherheitsrichtlinie, Zugriffskontrollrichtlinie, Backup-Konzept, Verschlüsselungsrichtlinie und Awareness-Programm.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-01-22 09:00:00+01',
  480,
  'IS-Richtlinie aktuell und freigegeben. Backup-Konzept teilweise veraltet — RTO/RPO für 3 Systeme fehlend.'
) ON CONFLICT (id) DO NOTHING;

-- AA-003: Interviews
INSERT INTO audit_activity (id, org_id, audit_id, activity_type, title, description, performed_by, performed_at, duration, notes)
VALUES (
  'd0000000-0000-0000-0000-000000000662',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000630',
  'interview',
  'Interviews mit Kontrolleigentueemern',
  'Einzelinterviews mit den Verantwortlichen für Zugriffskontrolle, Backup, Schwachstellenmanagement, Verschlüsselung und Awareness-Programm.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-02-03 09:00:00+01',
  600,
  '5 Interviews durchgeführt. Hauptthemen: Rezertifizierungsrueckstand bei Zugriffsrechten, unvollständige Wiederherstellungstests, niedrige Awareness-Teilnahmequote.'
) ON CONFLICT (id) DO NOTHING;

-- AA-004: Closing meeting
INSERT INTO audit_activity (id, org_id, audit_id, activity_type, title, description, performed_by, performed_at, duration, notes)
VALUES (
  'd0000000-0000-0000-0000-000000000663',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000630',
  'closing_meeting',
  'Abschlussbesprechung ISO 27001 Voraudit',
  'Praesentation der Auditergebnisse: 1 wesentliche Nichtkonformitaet (Zugriffskontrolle), 1 geringfuegige Nichtkonformitaet (Backup-Dokumentation), 1 Beobachtung (Awareness). Maßnahmenplan vereinbart.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-02-25 14:00:00+01',
  90,
  'Geschäftsführung informiert. Maßnahmenplan mit Fristen bis 30.06.2026 vereinbart. Zertifizierungsaudit für Q3 2026 angestrebt.'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Findings (3 findings from ISO 27001 audit, linked to controls)
-- ─────────────────────────────────────────────────────────────────────────────

-- FND-001: Significant nonconformity — Access control (CTL-002)
INSERT INTO finding (id, org_id, audit_id, control_id, title, description, severity, status, source, owner_id,
  remediation_plan, remediation_due_date, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000670',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000630',
  'd0000000-0000-0000-0000-000000000202', -- CTL-002 Zugriffskontrolle
  'Überfällige Rezertifizierung und verwaiste Admin-Konten',
  'Die vierteljährliche Rezertifizierung von Zugriffsrechten wurde seit ueber 6 Monaten nicht durchgeführt. Bei der Stichprobe wurden 3 verwaiste Administratorkonten identifiziert, die seit dem Austritt der jeweiligen Mitarbeiter nicht deaktiviert wurden. Dies stellt ein erhebliches Risiko für unbefugten Zugriff dar.',
  'significant_nonconformity',
  'in_remediation',
  'audit',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '1. Sofortige Deaktivierung der 3 verwaisten Admin-Konten. 2. Durchfuehrung einer vollständigen Rezertifizierung aller privilegierten Konten bis 31.03.2026. 3. Implementierung einer automatisierten Offboarding-Prüfung im IAM-System. 4. Einrichtung eines monatlichen Reports ueber inaktive Konten.',
  '2026-04-30',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- FND-002: Insignificant nonconformity — Backup docs (CTL-003)
INSERT INTO finding (id, org_id, audit_id, control_id, title, description, severity, status, source, owner_id,
  remediation_plan, remediation_due_date, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000671',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000630',
  'd0000000-0000-0000-0000-000000000203', -- CTL-003 Backup
  'Unvollständige Backup-Wiederherstellungsdokumentation',
  'Wiederherstellungstests sind nur für 2 von 5 kritischen Systemen dokumentiert. Die RTO/RPO-Definitionen für die Systeme Lagerverwaltung, CRM und Dokumentenmanagementsystem fehlen. Die tatsaechlichen Backups laufen ordnungsgemäß.',
  'insignificant_nonconformity',
  'in_remediation',
  'audit',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '1. Erstellung der fehlenden RTO/RPO-Definitionen für Lagerverwaltung, CRM und DMS. 2. Durchfuehrung und Dokumentation von Wiederherstellungstests für alle 5 kritischen Systeme. 3. Aufnahme der Wiederherstellungstests in den monatlichen IT-Operations-Kalender.',
  '2026-05-31',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- FND-003: Observation — Security awareness (CTL-007)
INSERT INTO finding (id, org_id, audit_id, control_id, title, description, severity, status, source, owner_id,
  remediation_plan, remediation_due_date, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000672',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000630',
  'd0000000-0000-0000-0000-000000000207', -- CTL-007 Awareness
  'Niedrige Teilnahmequote bei Security-Awareness-Schulungen',
  'Die Teilnahmequote an der jährlichen Security-Awareness-Schulung liegt bei 78% und damit unter dem Zielwert von 95%. Die Phishing-Simulation zeigt eine Klickrate von 12%, wobei besonders die Fachabteilungen Finanzen und HR auffaellig sind.',
  'observation',
  'identified',
  'audit',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '1. Einfuehrung verpflichtender Schulungstermine mit Eskalation an Abteilungsleiter bei Nichtteilnahme. 2. Gezielte Phishing-Awareness-Kampagne für Finanzen und HR. 3. Gamification-Elemente in der E-Learning-Plattform aktivieren.',
  '2026-06-30',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

COMMIT;
