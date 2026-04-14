-- =============================================================================
-- ARCTOS Demo Data Seed — Documents & Document Versions
-- 8 documents (policies, procedures, templates) with version 1.0
-- Linked to controls and BCP via document_entity_link
-- =============================================================================
-- Idempotent: uses INSERT ... ON CONFLICT DO NOTHING
-- Deterministic UUIDs: d0000000-0000-0000-0000-000000000BXX pattern
-- Depends on: seed_demo_data.sql (controls 0201-0203)
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
-- 1. Documents (8 entries)
-- ─────────────────────────────────────────────────────────────────────────────

-- DOC-001: Informationssicherheitsrichtlinie (policy, published)
INSERT INTO document (id, org_id, title, content, category, status, current_version,
  requires_acknowledgment, tags, owner_id, reviewer_id, approver_id,
  published_at, review_date, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B01',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Informationssicherheitsrichtlinie',
  'Zentrale Richtlinie zur Informationssicherheit. Definiert Geltungsbereich, Verantwortlichkeiten, Sicherheitsziele und Grundsaetze für den Umgang mit Informationswerten. Gilt für alle Mitarbeiter, Auftragnehmer und Dienstleister.',
  'policy',
  'published',
  1,
  true,
  ARRAY['isms', 'iso27001', 'policy', 'mandatory'],
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2025-09-15 14:00:00+02',
  '2026-09-15 00:00:00+02',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- DOC-002: Zugriffskontrollrichtlinie (policy, published)
INSERT INTO document (id, org_id, title, content, category, status, current_version,
  requires_acknowledgment, tags, owner_id, reviewer_id, approver_id,
  published_at, review_date, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B02',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Zugriffskontrollrichtlinie',
  'Regelung der Zugriffskontrolle auf Informationssysteme und Daten. Umfasst RBAC-Prinzipien, Least-Privilege-Ansatz, Onboarding/Offboarding-Prozesse, Rezertifizierungszyklen und Protokollierung privilegierter Zugriffe.',
  'policy',
  'published',
  1,
  true,
  ARRAY['isms', 'iso27001', 'access-control', 'rbac'],
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2025-10-01 10:00:00+02',
  '2026-10-01 00:00:00+02',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- DOC-003: Backup-Richtlinie (policy, published)
INSERT INTO document (id, org_id, title, content, category, status, current_version,
  requires_acknowledgment, tags, owner_id, reviewer_id, approver_id,
  published_at, review_date, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B03',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Backup-Richtlinie',
  'Richtlinie für die Datensicherung und Wiederherstellung. Beschreibt 3-2-1-Backup-Strategie, Aufbewahrungsfristen, RTO/RPO-Ziele pro Systemklasse, Verschlüsselung der Backup-Medien und monatliche Wiederherstellungstests.',
  'policy',
  'published',
  1,
  false,
  ARRAY['isms', 'iso27001', 'backup', 'recovery', 'bcp'],
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2025-08-20 09:00:00+02',
  '2026-08-20 00:00:00+02',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- DOC-004: Incident-Response-Plan (procedure, approved)
INSERT INTO document (id, org_id, title, content, category, status, current_version,
  requires_acknowledgment, tags, owner_id, reviewer_id, approver_id,
  review_date, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B04',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Incident-Response-Plan',
  'Detaillierter Plan zur Behandlung von Sicherheitsvorfaellen. Definiert Eskalationsstufen (P1-P4), Kommunikationswege, Rollen im Incident-Response-Team, Meldepflichten gemäß NIS2 und DSGVO sowie Post-Incident-Review-Prozess.',
  'procedure',
  'approved',
  1,
  false,
  ARRAY['isms', 'incident-response', 'nis2', 'soc'],
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-11-01 00:00:00+01',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- DOC-005: Business-Continuity-Plan (procedure, approved)
INSERT INTO document (id, org_id, title, content, category, status, current_version,
  requires_acknowledgment, tags, owner_id, reviewer_id, approver_id,
  review_date, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B05',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Business-Continuity-Plan',
  'Uebergeordneter Notfallplan zur Sicherstellung des Geschäftsbetriebs. Enthält BIA-Ergebnisse, Wiederanlaufplaene für kritische Prozesse, Krisenstabsorganisation, Kommunikationsplaene und Übungskalender gemäß ISO 22301.',
  'procedure',
  'approved',
  1,
  false,
  ARRAY['bcms', 'iso22301', 'bcp', 'notfallplanung'],
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-12-01 00:00:00+01',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- DOC-006: DSFA-Vorlage (template, published)
INSERT INTO document (id, org_id, title, content, category, status, current_version,
  requires_acknowledgment, tags, owner_id, reviewer_id, approver_id,
  published_at, review_date, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B06',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'DSFA-Vorlage',
  'Standardvorlage für Datenschutz-Folgenabschätzungen gemäß Art. 35 DSGVO. Enthält strukturierte Abschnitte für Verarbeitungsbeschreibung, Notwendigkeitsprüfung, Risikobewertung, Maßnahmenplanung und Konsultationsverfahren.',
  'template',
  'published',
  1,
  false,
  ARRAY['dpms', 'dsgvo', 'dsfa', 'dpia', 'template'],
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2025-11-01 10:00:00+01',
  '2026-11-01 00:00:00+01',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- DOC-007: Lieferantenbewertungsvorlage (template, published)
INSERT INTO document (id, org_id, title, content, category, status, current_version,
  requires_acknowledgment, tags, owner_id, reviewer_id, approver_id,
  published_at, review_date, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B07',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Lieferantenbewertungsvorlage',
  'Standardisierte Vorlage für die Sicherheitsbewertung von IT-Dienstleistern und Lieferanten. Umfasst Fragenkatalog zu Informationssicherheit, Datenschutz, BCM, Zertifizierungen und Subunternehmer-Management.',
  'template',
  'published',
  1,
  false,
  ARRAY['tprm', 'lieferanten', 'due-diligence', 'template'],
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2025-10-15 10:00:00+02',
  '2026-10-15 00:00:00+02',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- DOC-008: Datenklassifizierungsrichtlinie (policy, in_review)
INSERT INTO document (id, org_id, title, content, category, status, current_version,
  requires_acknowledgment, tags, owner_id, reviewer_id, approver_id,
  review_date, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B08',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Datenklassifizierungsrichtlinie',
  'Richtlinie zur Klassifizierung von Informationswerten nach Vertraulichkeit, Integrität und Verfügbarkeit. Definiert vier Schutzklassen (öffentlich, intern, vertraulich, streng vertraulich) mit zugehörigen Handhabungsvorschriften und Kennzeichnungspflichten.',
  'policy',
  'in_review',
  1,
  true,
  ARRAY['isms', 'iso27001', 'datenklassifizierung', 'schutzklassen'],
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-04-30 00:00:00+02',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Document Versions (8 entries, one per document — version 1.0)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO document_version (id, document_id, org_id, version_number, content, change_summary, is_current, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B11',
  'd0000000-0000-0000-0000-000000000B01',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  1,
  'Zentrale Richtlinie zur Informationssicherheit. Definiert Geltungsbereich, Verantwortlichkeiten, Sicherheitsziele und Grundsaetze für den Umgang mit Informationswerten.',
  'Erstversion der Informationssicherheitsrichtlinie. Freigabe durch Geschäftsführung.',
  true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO document_version (id, document_id, org_id, version_number, content, change_summary, is_current, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B12',
  'd0000000-0000-0000-0000-000000000B02',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  1,
  'Regelung der Zugriffskontrolle auf Informationssysteme und Daten. Umfasst RBAC-Prinzipien, Least-Privilege-Ansatz und Rezertifizierungszyklen.',
  'Erstversion der Zugriffskontrollrichtlinie. Abgestimmt mit IT-Sicherheit und HR.',
  true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO document_version (id, document_id, org_id, version_number, content, change_summary, is_current, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B13',
  'd0000000-0000-0000-0000-000000000B03',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  1,
  'Richtlinie für die Datensicherung und Wiederherstellung. Beschreibt 3-2-1-Backup-Strategie, RTO/RPO-Ziele und monatliche Wiederherstellungstests.',
  'Erstversion der Backup-Richtlinie. Basierend auf BSI-Grundschutz-Empfehlungen.',
  true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO document_version (id, document_id, org_id, version_number, content, change_summary, is_current, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B14',
  'd0000000-0000-0000-0000-000000000B04',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  1,
  'Detaillierter Plan zur Behandlung von Sicherheitsvorfaellen. Definiert Eskalationsstufen, Kommunikationswege und Post-Incident-Review-Prozess.',
  'Erstversion des Incident-Response-Plans. NIS2-konforme Meldepflichten integriert.',
  true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO document_version (id, document_id, org_id, version_number, content, change_summary, is_current, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B15',
  'd0000000-0000-0000-0000-000000000B05',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  1,
  'Uebergeordneter Notfallplan zur Sicherstellung des Geschäftsbetriebs. BIA-Ergebnisse, Wiederanlaufplaene und Krisenstabsorganisation.',
  'Erstversion des Business-Continuity-Plans. ISO 22301-konform aufgebaut.',
  true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO document_version (id, document_id, org_id, version_number, content, change_summary, is_current, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B16',
  'd0000000-0000-0000-0000-000000000B06',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  1,
  'Standardvorlage für Datenschutz-Folgenabschätzungen gemäß Art. 35 DSGVO. Strukturierte Abschnitte für alle DSFA-Phasen.',
  'Erstversion der DSFA-Vorlage. Abgestimmt mit DSB und Rechtsabteilung.',
  true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO document_version (id, document_id, org_id, version_number, content, change_summary, is_current, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B17',
  'd0000000-0000-0000-0000-000000000B07',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  1,
  'Standardisierte Vorlage für die Sicherheitsbewertung von IT-Dienstleistern. Fragenkatalog zu IS, Datenschutz, BCM und Zertifizierungen.',
  'Erstversion der Lieferantenbewertungsvorlage. Harmonisiert mit TISAX-Anforderungen.',
  true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO document_version (id, document_id, org_id, version_number, content, change_summary, is_current, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B18',
  'd0000000-0000-0000-0000-000000000B08',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  1,
  'Richtlinie zur Klassifizierung von Informationswerten. Vier Schutzklassen mit zugehörigen Handhabungsvorschriften.',
  'Erstversion der Datenklassifizierungsrichtlinie. Review durch CISO und DSB läuft.',
  true,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Document-Entity Links (link documents to controls and BCP)
-- ─────────────────────────────────────────────────────────────────────────────

-- DOC-001 → CTL-001 (Informationssicherheitsrichtlinie → IS-Richtlinie Control)
INSERT INTO document_entity_link (id, org_id, document_id, entity_type, entity_id, link_description, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B21',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000B01',
  'control',
  'd0000000-0000-0000-0000-000000000201',
  'Richtliniendokument für Control A.5.1 Informationssicherheitsrichtlinie',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- DOC-002 → CTL-002 (Zugriffskontrollrichtlinie → Zugriffskontrollmanagement Control)
INSERT INTO document_entity_link (id, org_id, document_id, entity_type, entity_id, link_description, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B22',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000B02',
  'control',
  'd0000000-0000-0000-0000-000000000202',
  'Richtliniendokument für Control A.5.15 Zugriffskontrollmanagement',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- DOC-003 → CTL-003 (Backup-Richtlinie → Datensicherung Control)
INSERT INTO document_entity_link (id, org_id, document_id, entity_type, entity_id, link_description, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B23',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000B03',
  'control',
  'd0000000-0000-0000-0000-000000000203',
  'Richtliniendokument für Control A.8.13 Datensicherung und Wiederherstellung',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- DOC-005 → BCP-001 (Business-Continuity-Plan → BCP entity)
INSERT INTO document_entity_link (id, org_id, document_id, entity_type, entity_id, link_description, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000B25',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000B05',
  'bcp',
  'd0000000-0000-0000-0000-000000000830',
  'Dokumentierter Business-Continuity-Plan für den uebergeordneten BCP',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

COMMIT;
