-- =============================================================================
-- ARCTOS Demo Data Seed 09 — Meridian Holdings: Processes (BPM)
-- 3 processes with versions and steps
-- =============================================================================
-- Idempotent: uses INSERT ... ON CONFLICT (id) DO NOTHING
-- Deterministic UUIDs: d0000000-0000-0000-0000-0000000000XX (range 0C01-0CFF)
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
-- 1. Processes
-- ─────────────────────────────────────────────────────────────────────────────

-- PRC-001: Incident-Response-Prozess (published)
INSERT INTO process (id, org_id, name, description, level, notation, status, process_owner_id, department, current_version, is_essential, published_at, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000000C01',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Incident-Response-Prozess',
  'Strukturierter Prozess zur Erkennung, Eindaemmung und Behebung von Sicherheitsvorfaellen. Umfasst Eskalationsstufen, Kommunikationswege und Post-Incident-Analyse gemäß ISO 27001 A.5.24.',
  1,
  'bpmn',
  'published',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'Informationssicherheit',
  1,
  true,
  '2026-01-15 10:00:00+01',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- PRC-002: Change-Management-Prozess (approved)
INSERT INTO process (id, org_id, name, description, level, notation, status, process_owner_id, department, current_version, is_essential, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000000C02',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Change-Management-Prozess',
  'Kontrollierter Prozess für die Planung, Genehmigung und Umsetzung von Änderungen an IT-Systemen und -Infrastruktur. Minimiert Ausfallrisiken durch strukturierte Bewertung und Freigabe.',
  1,
  'bpmn',
  'approved',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'IT-Betrieb',
  1,
  true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- PRC-003: Lieferanten-Onboarding-Prozess (in_review)
INSERT INTO process (id, org_id, name, description, level, notation, status, process_owner_id, department, current_version, is_essential, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000000C03',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Lieferanten-Onboarding-Prozess',
  'Standardisierter Prozess zur Aufnahme neuer Lieferanten mit Sorgfaltsprüfung, Risikobewertung und Vertragsprüfung. Stellt Compliance mit ISO 27001, NIS2 und LkSG sicher.',
  1,
  'bpmn',
  'in_review',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  'Beschaffung',
  1,
  false,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Process Versions
-- ─────────────────────────────────────────────────────────────────────────────

-- PV-001: Incident-Response v1 (current)
INSERT INTO process_version (id, process_id, org_id, version_number, change_summary, is_current, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000C11',
  'd0000000-0000-0000-0000-000000000C01',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  1,
  'Initiale Version des Incident-Response-Prozesses mit 4 Phasen gemäß NIST SP 800-61.',
  true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- PV-002: Change-Management v1 (current)
INSERT INTO process_version (id, process_id, org_id, version_number, change_summary, is_current, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000C12',
  'd0000000-0000-0000-0000-000000000C02',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  1,
  'Initiale Version des Change-Management-Prozesses basierend auf ITIL v4.',
  true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- PV-003: Lieferanten-Onboarding v1 (current)
INSERT INTO process_version (id, process_id, org_id, version_number, change_summary, is_current, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000C13',
  'd0000000-0000-0000-0000-000000000C03',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  1,
  'Initiale Version des Lieferanten-Onboarding-Prozesses mit Due-Diligence-Prüfung.',
  true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Process Steps
-- ─────────────────────────────────────────────────────────────────────────────

-- === PRC-001: Incident-Response-Prozess — 4 Steps ===

-- Step 1: Detect & Triage
INSERT INTO process_step (id, process_id, org_id, bpmn_element_id, name, description, step_type, responsible_role, sequence_order)
VALUES (
  'd0000000-0000-0000-0000-000000000C21',
  'd0000000-0000-0000-0000-000000000C01',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Task_IR_DetectTriage',
  'Erkennung und Triage',
  'Sicherheitsvorfall erkennen, Schweregrad bestimmen und Erstbewertung durchführen. Entscheidung über Eskalationsstufe und Aktivierung des Incident-Response-Teams.',
  'task',
  'SOC-Analyst',
  1
) ON CONFLICT (id) DO NOTHING;

-- Step 2: Contain & Eradicate
INSERT INTO process_step (id, process_id, org_id, bpmn_element_id, name, description, step_type, responsible_role, sequence_order)
VALUES (
  'd0000000-0000-0000-0000-000000000C22',
  'd0000000-0000-0000-0000-000000000C01',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Task_IR_ContainEradicate',
  'Eindaemmung und Beseitigung',
  'Betroffene Systeme isolieren, Angriffsvektor identifizieren und Schadsoftware/Zugang entfernen. Forensische Sicherung der Beweise vor Bereinigung.',
  'task',
  'Incident-Response-Team',
  2
) ON CONFLICT (id) DO NOTHING;

-- Step 3: Recover
INSERT INTO process_step (id, process_id, org_id, bpmn_element_id, name, description, step_type, responsible_role, sequence_order)
VALUES (
  'd0000000-0000-0000-0000-000000000C23',
  'd0000000-0000-0000-0000-000000000C01',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Task_IR_Recover',
  'Wiederherstellung',
  'Betroffene Systeme aus gesicherten Backups wiederherstellen, Integritätsprüfung durchführen und schrittweise Wiederinbetriebnahme mit erhöhtem Monitoring.',
  'task',
  'IT-Betrieb',
  3
) ON CONFLICT (id) DO NOTHING;

-- Step 4: Lessons Learned
INSERT INTO process_step (id, process_id, org_id, bpmn_element_id, name, description, step_type, responsible_role, sequence_order)
VALUES (
  'd0000000-0000-0000-0000-000000000C24',
  'd0000000-0000-0000-0000-000000000C01',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Task_IR_LessonsLearned',
  'Nachbereitung und Lessons Learned',
  'Post-Incident-Review mit allen Beteiligten. Dokumentation der Ursachen, Maßnahmen und Verbesserungsvorschlaege. Aktualisierung des Incident-Response-Plans bei Bedarf.',
  'task',
  'CISO',
  4
) ON CONFLICT (id) DO NOTHING;

-- === PRC-002: Change-Management-Prozess — 4 Steps ===

-- Step 1: Request
INSERT INTO process_step (id, process_id, org_id, bpmn_element_id, name, description, step_type, responsible_role, sequence_order)
VALUES (
  'd0000000-0000-0000-0000-000000000C31',
  'd0000000-0000-0000-0000-000000000C02',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Task_CM_Request',
  'Change-Request erstellen',
  'Änderungsantrag mit Beschreibung, Begruendung, betroffenen Systemen und gewuenschtem Zeitfenster erfassen. Kategorie (Standard, Normal, Emergency) zuweisen.',
  'task',
  'Antragsteller',
  1
) ON CONFLICT (id) DO NOTHING;

-- Step 2: Assessment
INSERT INTO process_step (id, process_id, org_id, bpmn_element_id, name, description, step_type, responsible_role, sequence_order)
VALUES (
  'd0000000-0000-0000-0000-000000000C32',
  'd0000000-0000-0000-0000-000000000C02',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Task_CM_Assessment',
  'Bewertung und Risikoanalyse',
  'Technische Machbarkeit prüfen, Risikoanalyse durchführen und Auswirkungen auf bestehende Systeme und SLAs bewerten. Rollback-Plan erstellen.',
  'task',
  'Change-Manager',
  2
) ON CONFLICT (id) DO NOTHING;

-- Step 3: Approval
INSERT INTO process_step (id, process_id, org_id, bpmn_element_id, name, description, step_type, responsible_role, sequence_order)
VALUES (
  'd0000000-0000-0000-0000-000000000C33',
  'd0000000-0000-0000-0000-000000000C02',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Task_CM_Approval',
  'Freigabe durch CAB',
  'Change Advisory Board (CAB) prueft und genehmigt den Änderungsantrag. Bei Hochrisiko-Changes zusaetzliche Freigabe durch IT-Leitung erforderlich.',
  'gateway',
  'CAB',
  3
) ON CONFLICT (id) DO NOTHING;

-- Step 4: Implementation
INSERT INTO process_step (id, process_id, org_id, bpmn_element_id, name, description, step_type, responsible_role, sequence_order)
VALUES (
  'd0000000-0000-0000-0000-000000000C34',
  'd0000000-0000-0000-0000-000000000C02',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Task_CM_Implementation',
  'Umsetzung und Validierung',
  'Änderung im geplanten Wartungsfenster umsetzen, Funktionstests durchführen und Ergebnis dokumentieren. Bei Fehlschlag Rollback-Plan aktivieren.',
  'task',
  'IT-Betrieb',
  4
) ON CONFLICT (id) DO NOTHING;

-- === PRC-003: Lieferanten-Onboarding-Prozess — 4 Steps ===

-- Step 1: Due Diligence
INSERT INTO process_step (id, process_id, org_id, bpmn_element_id, name, description, step_type, responsible_role, sequence_order)
VALUES (
  'd0000000-0000-0000-0000-000000000C41',
  'd0000000-0000-0000-0000-000000000C03',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Task_SO_DueDiligence',
  'Sorgfaltsprüfung (Due Diligence)',
  'Prüfung der Unternehmensstruktur, Bonitaet, Zertifizierungen (ISO 27001, SOC 2) und Referenzen des potenziellen Lieferanten. LkSG-Compliance prüfen.',
  'task',
  'Beschaffung',
  1
) ON CONFLICT (id) DO NOTHING;

-- Step 2: Risk Assessment
INSERT INTO process_step (id, process_id, org_id, bpmn_element_id, name, description, step_type, responsible_role, sequence_order)
VALUES (
  'd0000000-0000-0000-0000-000000000C42',
  'd0000000-0000-0000-0000-000000000C03',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Task_SO_RiskAssessment',
  'Risikobewertung',
  'Sicherheitsfragebogen auswerten, Datenschutz-Folgenabschätzung bei personenbezogenen Daten, geopolitische Risiken und Abhängigkeiten bewerten.',
  'task',
  'Risikomanagement',
  2
) ON CONFLICT (id) DO NOTHING;

-- Step 3: Contract Review
INSERT INTO process_step (id, process_id, org_id, bpmn_element_id, name, description, step_type, responsible_role, sequence_order)
VALUES (
  'd0000000-0000-0000-0000-000000000C43',
  'd0000000-0000-0000-0000-000000000C03',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Task_SO_ContractReview',
  'Vertragsprüfung',
  'Vertragsentwurf mit Sicherheitsanforderungen, SLAs, Datenschutzklauseln (AVV), Auditrechten und Kuendigungsbedingungen prüfen und verhandeln.',
  'task',
  'Rechtsabteilung',
  3
) ON CONFLICT (id) DO NOTHING;

-- Step 4: Approval
INSERT INTO process_step (id, process_id, org_id, bpmn_element_id, name, description, step_type, responsible_role, sequence_order)
VALUES (
  'd0000000-0000-0000-0000-000000000C44',
  'd0000000-0000-0000-0000-000000000C03',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Task_SO_Approval',
  'Freigabe und Onboarding',
  'Finale Freigabe durch Abteilungsleitung und CISO. Lieferant im Vendor-Management-System anlegen, Zugänge einrichten und Erstschulung durchführen.',
  'gateway',
  'CISO / Abteilungsleitung',
  4
) ON CONFLICT (id) DO NOTHING;

COMMIT;
