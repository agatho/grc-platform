-- =============================================================================
-- ARCTOS Demo Data Seed 01 — Meridian Holdings: Assets & ISMS
-- 10 assets, 5 threats, 4 vulnerabilities, 5 risk scenarios,
-- 8 SoA entries, 8 risk-asset links
-- =============================================================================
-- Idempotent: uses INSERT ... ON CONFLICT (id) DO NOTHING
-- Deterministic UUIDs: d0000000-0000-0000-0000-0000000004XX (range 0401-04FF)
-- Depends on: seed_demo_data.sql (risks 0101-0105, controls 0201-0208)
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
-- 1. Assets (10 assets)
-- ─────────────────────────────────────────────────────────────────────────────

-- AST-001: IT-Abteilung (business_structure — parent for all IT assets)
INSERT INTO asset (id, org_id, name, description, asset_tier, code_group,
  default_confidentiality, default_integrity, default_availability,
  contact_person, visible_in_modules, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000000401',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'IT-Abteilung',
  'Organisationseinheit IT mit Verantwortung für alle informationstechnischen Systeme, Infrastruktur und Dienste.',
  'business_structure',
  'ORG',
  3, 3, 3,
  'IT-Leitung',
  '{isms,erm,bpm}',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- AST-002: ERP-System (primary_asset — application)
INSERT INTO asset (id, org_id, name, description, asset_tier, code_group, parent_asset_id,
  default_confidentiality, default_integrity, default_availability,
  visible_in_modules, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000000402',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'ERP-System',
  'Zentrales Enterprise-Resource-Planning-System für Finanzbuchhaltung, Controlling, Materialwirtschaft und Personalwesen. Geschäftskritisch mit Hochverfügbarkeitsanforderung.',
  'primary_asset',
  'APP',
  'd0000000-0000-0000-0000-000000000401',
  4, 4, 4,
  '{isms,erm,bpm,bcms}',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- AST-003: CRM-System (primary_asset — application)
INSERT INTO asset (id, org_id, name, description, asset_tier, code_group, parent_asset_id,
  default_confidentiality, default_integrity, default_availability,
  visible_in_modules, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000000403',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'CRM-System',
  'Customer-Relationship-Management-System mit Kundenstammdaten, Vertriebspipeline und Kontakthistorie. Enthaelt personenbezogene Daten gemäß DSGVO.',
  'primary_asset',
  'APP',
  'd0000000-0000-0000-0000-000000000401',
  4, 3, 3,
  '{isms,erm,dpms}',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- AST-004: Cloud Payroll (primary_asset — application)
INSERT INTO asset (id, org_id, name, description, asset_tier, code_group, parent_asset_id,
  default_confidentiality, default_integrity, default_availability,
  visible_in_modules, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000000404',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Cloud-Gehaltsabrechnung',
  'Cloud-basiertes Lohn- und Gehaltsabrechnungssystem mit Schnittstellen zu Finanzbuchhaltung und Sozialversicherungstraegern. Hochsensible Mitarbeiterdaten.',
  'primary_asset',
  'APP',
  'd0000000-0000-0000-0000-000000000401',
  4, 4, 3,
  '{isms,dpms}',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- AST-005: Applikationsserver (supporting_asset — server)
INSERT INTO asset (id, org_id, name, description, asset_tier, code_group, parent_asset_id,
  default_confidentiality, default_integrity, default_availability,
  visible_in_modules, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000000405',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Applikationsserver',
  'Zentraler Applikationsserver-Cluster (Linux) für ERP, CRM und interne Webanwendungen. Redundante Konfiguration mit Load-Balancing.',
  'supporting_asset',
  'SRV',
  'd0000000-0000-0000-0000-000000000401',
  3, 4, 4,
  '{isms,erm}',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- AST-006: Datenbankserver (supporting_asset — server)
INSERT INTO asset (id, org_id, name, description, asset_tier, code_group, parent_asset_id,
  default_confidentiality, default_integrity, default_availability,
  visible_in_modules, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000000406',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Datenbankserver',
  'PostgreSQL-Datenbankcluster mit Primary-Replica-Setup für alle geschäftskritischen Anwendungen. Automatisches Failover und Point-in-Time-Recovery.',
  'supporting_asset',
  'SRV',
  'd0000000-0000-0000-0000-000000000401',
  4, 4, 4,
  '{isms,erm}',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- AST-007: Firewall (supporting_asset — network)
INSERT INTO asset (id, org_id, name, description, asset_tier, code_group, parent_asset_id,
  default_confidentiality, default_integrity, default_availability,
  visible_in_modules, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000000407',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Firewall (Perimeter)',
  'Next-Generation-Firewall am Netzwerkperimeter mit IDS/IPS, Deep Packet Inspection und VPN-Terminierung. Hochverfügbar in Active-Passive-Konfiguration.',
  'supporting_asset',
  'NET',
  'd0000000-0000-0000-0000-000000000401',
  2, 4, 4,
  '{isms}',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- AST-008: E-Mail-Gateway (supporting_asset — network)
INSERT INTO asset (id, org_id, name, description, asset_tier, code_group, parent_asset_id,
  default_confidentiality, default_integrity, default_availability,
  visible_in_modules, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000000408',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'E-Mail-Gateway',
  'Secure E-Mail Gateway mit Anti-Spam, Anti-Malware, DLP-Policies und TLS-Verschlüsselung. Filtert ein- und ausgehenden E-Mail-Verkehr.',
  'supporting_asset',
  'NET',
  'd0000000-0000-0000-0000-000000000401',
  3, 3, 3,
  '{isms}',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- AST-009: Cloud-Speicher (supporting_asset — cloud_service)
INSERT INTO asset (id, org_id, name, description, asset_tier, code_group, parent_asset_id,
  default_confidentiality, default_integrity, default_availability,
  visible_in_modules, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-000000000409',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Cloud-Speicher',
  'Unternehmensweiter Cloud-Speicherdienst für Dokumentenablage und Collaboration. Verschlüsselung at-rest und in-transit, Standort EU (Frankfurt).',
  'supporting_asset',
  'CLD',
  'd0000000-0000-0000-0000-000000000401',
  3, 3, 3,
  '{isms,dpms}',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- AST-010: Backup-System (supporting_asset — server)
INSERT INTO asset (id, org_id, name, description, asset_tier, code_group, parent_asset_id,
  default_confidentiality, default_integrity, default_availability,
  visible_in_modules, created_by, updated_by)
VALUES (
  'd0000000-0000-0000-0000-00000000040A',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Backup-System',
  'Zentrales Backup-System mit 3-2-1-Strategie: lokale Disk-Backups, Tape-Bibliothek und Off-Site-Replikation. Unterstuetzt alle geschäftskritischen Systeme.',
  'supporting_asset',
  'SRV',
  'd0000000-0000-0000-0000-000000000401',
  3, 4, 3,
  '{isms,bcms}',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Threats (5 threats)
-- ─────────────────────────────────────────────────────────────────────────────

-- THR-001: Ransomware (BSI G 0.39 Schadprogramme)
INSERT INTO threat (id, org_id, code, title, description, threat_category, likelihood_rating, is_system, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000411',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'G.0.39',
  'Ransomware-Angriff',
  'Gezielte oder opportunistische Ransomware-Attacke mit Verschlüsselung von Daten und Systemen. Haeufig kombiniert mit Datenexfiltration (Double Extortion).',
  'malware',
  4,
  false,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- THR-002: Phishing (BSI G 0.36 Identitaetsdiebstahl)
INSERT INTO threat (id, org_id, code, title, description, threat_category, likelihood_rating, is_system, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000412',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'G.0.36',
  'Phishing und Social Engineering',
  'Gezielte Phishing-Kampagnen (Spear-Phishing) gegen Mitarbeiter zur Erlangung von Zugangsdaten oder Installation von Malware. Zunehmend KI-gestuetzte Angriffe.',
  'social_engineering',
  4,
  false,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- THR-003: DDoS (BSI G 0.40 Denial of Service)
INSERT INTO threat (id, org_id, code, title, description, threat_category, likelihood_rating, is_system, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000413',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'G.0.40',
  'Distributed Denial of Service (DDoS)',
  'Volumetrische oder applikationsbasierte DDoS-Angriffe auf extern erreichbare Dienste. Kann zu mehrstuendiger Nichtverfügbarkeit kritischer Systeme fuehren.',
  'network_attack',
  3,
  false,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- THR-004: Insider Threat (BSI G 0.37 Abhoeren / Ausspähen)
INSERT INTO threat (id, org_id, code, title, description, threat_category, likelihood_rating, is_system, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000414',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'G.0.37',
  'Insider-Bedrohung',
  'Böswilliger oder fahrlässiger Missbrauch von Zugriffsrechten durch Mitarbeiter, Dienstleister oder ehemalige Beschäftigte. Datenexfiltration oder Sabotage.',
  'insider',
  2,
  false,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- THR-005: Konfigurationsfehler (BSI G 0.28 Software-Schwachstellen)
INSERT INTO threat (id, org_id, code, title, description, threat_category, likelihood_rating, is_system, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000415',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'G.0.28',
  'Konfigurationsfehler',
  'Fehlerhafte Konfiguration von Systemen, Netzwerkkomponenten oder Cloud-Diensten führt zu unbeabsichtigter Offenlegung von Daten oder Angriffsvektoren.',
  'misconfiguration',
  3,
  false,
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Vulnerabilities (4 vulnerabilities on specific assets)
-- ─────────────────────────────────────────────────────────────────────────────

-- VLN-001: Log4Shell on Applikationsserver
INSERT INTO vulnerability (id, org_id, title, description, cve_reference, affected_asset_id, severity, status, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000421',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Log4Shell (CVE-2021-44228) auf Applikationsserver',
  'Kritische Remote-Code-Execution-Schwachstelle in Apache Log4j 2. Betrifft Java-basierte Anwendungen auf dem Applikationsserver. CVSS 10.0.',
  'CVE-2021-44228',
  'd0000000-0000-0000-0000-000000000405', -- Applikationsserver
  'critical',
  'mitigated',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- VLN-002: Veraltetes TLS auf E-Mail-Gateway
INSERT INTO vulnerability (id, org_id, title, description, cve_reference, affected_asset_id, severity, status, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000422',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Veraltete TLS-Konfiguration auf E-Mail-Gateway',
  'E-Mail-Gateway unterstuetzt noch TLS 1.0/1.1 neben TLS 1.2/1.3. Ermoegglicht potenzielle Downgrade-Angriffe und widerspricht BSI-Empfehlungen.',
  NULL,
  'd0000000-0000-0000-0000-000000000408', -- E-Mail-Gateway
  'medium',
  'open',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- VLN-003: SQL-Injection-Risiko im CRM-System
INSERT INTO vulnerability (id, org_id, title, description, cve_reference, affected_asset_id, severity, status, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000423',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'SQL-Injection-Risiko im CRM-System',
  'Unzureichende Eingabevalidierung in der erweiterten Suchfunktion des CRM-Systems ermoeglicht potenziell SQL-Injection. Betrifft Kundenstammdaten-Modul.',
  NULL,
  'd0000000-0000-0000-0000-000000000403', -- CRM-System
  'high',
  'open',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- VLN-004: Fehlende Sicherheitspatches auf Datenbankserver
INSERT INTO vulnerability (id, org_id, title, description, cve_reference, affected_asset_id, severity, status, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000424',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'Fehlende Sicherheitspatches auf Datenbankserver',
  'PostgreSQL-Datenbankserver ist zwei Minor-Versionen hinter dem aktuellen Release. Mehrere bekannte Schwachstellen mit CVSS 6.5-7.5 sind nicht gepatcht.',
  NULL,
  'd0000000-0000-0000-0000-000000000406', -- Datenbankserver
  'high',
  'open',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Risk Scenarios (5 scenarios linking threats + vulnerabilities + assets + risks)
-- ─────────────────────────────────────────────────────────────────────────────

-- RS-001: Ransomware via Log4Shell on App Server → RSK-001
INSERT INTO risk_scenario (id, org_id, risk_id, threat_id, vulnerability_id, asset_id, description)
VALUES (
  'd0000000-0000-0000-0000-000000000431',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000101', -- RSK-001 Ransomware
  'd0000000-0000-0000-0000-000000000411', -- THR-001 Ransomware
  'd0000000-0000-0000-0000-000000000421', -- VLN-001 Log4Shell
  'd0000000-0000-0000-0000-000000000405', -- Applikationsserver
  'Angreifer nutzt Log4Shell-Schwachstelle auf dem Applikationsserver zur Einschleusung von Ransomware. Verschlüsselung des ERP-Systems und angeschlossener Datenbanken.'
) ON CONFLICT (id) DO NOTHING;

-- RS-002: Phishing → CRM SQL Injection → Data Breach → RSK-003
INSERT INTO risk_scenario (id, org_id, risk_id, threat_id, vulnerability_id, asset_id, description)
VALUES (
  'd0000000-0000-0000-0000-000000000432',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000103', -- RSK-003 DSGVO-Verstoss
  'd0000000-0000-0000-0000-000000000412', -- THR-002 Phishing
  'd0000000-0000-0000-0000-000000000423', -- VLN-003 SQL Injection CRM
  'd0000000-0000-0000-0000-000000000403', -- CRM-System
  'Angreifer erlangt durch Phishing Zugang zum CRM-System und nutzt SQL-Injection-Schwachstelle zur Exfiltration von Kundenstammdaten. Meldepflicht gemäß Art. 33 DSGVO.'
) ON CONFLICT (id) DO NOTHING;

-- RS-003: DDoS on Firewall → Cloud Provider Outage → RSK-005
INSERT INTO risk_scenario (id, org_id, risk_id, threat_id, vulnerability_id, asset_id, description)
VALUES (
  'd0000000-0000-0000-0000-000000000433',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000105', -- RSK-005 Cloud-Provider-Ausfall
  'd0000000-0000-0000-0000-000000000413', -- THR-003 DDoS
  NULL,                                     -- No specific vulnerability
  'd0000000-0000-0000-0000-000000000407', -- Firewall
  'Großflächiger DDoS-Angriff überlastet die Perimeter-Firewall und führt zu Nichtverfügbarkeit aller extern erreichbaren Dienste inklusive Cloud-Anbindung.'
) ON CONFLICT (id) DO NOTHING;

-- RS-004: Insider Threat + Missing Patches on DB Server → RSK-001
INSERT INTO risk_scenario (id, org_id, risk_id, threat_id, vulnerability_id, asset_id, description)
VALUES (
  'd0000000-0000-0000-0000-000000000434',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000101', -- RSK-001 Ransomware
  'd0000000-0000-0000-0000-000000000414', -- THR-004 Insider Threat
  'd0000000-0000-0000-0000-000000000424', -- VLN-004 Fehlende Patches DB
  'd0000000-0000-0000-0000-000000000406', -- Datenbankserver
  'Böswilliger Insider nutzt ungepatchte Schwachstelle auf dem Datenbankserver zur Datenmanipulation oder -exfiltration. Erhöhtes Risiko durch privilegierte Zugriffsrechte.'
) ON CONFLICT (id) DO NOTHING;

-- RS-005: Configuration Error on E-Mail Gateway + Phishing → RSK-002
INSERT INTO risk_scenario (id, org_id, risk_id, threat_id, vulnerability_id, asset_id, description)
VALUES (
  'd0000000-0000-0000-0000-000000000435',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000102', -- RSK-002 Lieferkette
  'd0000000-0000-0000-0000-000000000415', -- THR-005 Konfigurationsfehler
  'd0000000-0000-0000-0000-000000000422', -- VLN-002 Veraltetes TLS
  'd0000000-0000-0000-0000-000000000408', -- E-Mail-Gateway
  'Veraltete TLS-Konfiguration des E-Mail-Gateways ermoeglicht Man-in-the-Middle-Angriff auf Lieferantenkommunikation. Kompromittierung von Bestelldaten und Vertragsinformationen.'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. SoA Entries (8 entries linking controls to ISO 27001 Annex A catalog entries)
-- ─────────────────────────────────────────────────────────────────────────────

-- SoA-001: A.5.1 Informationssicherheitsrichtlinien → CTL-001
INSERT INTO soa_entry (id, org_id, catalog_entry_id, control_id, applicability, applicability_justification, implementation, implementation_notes, responsible_id, last_reviewed)
VALUES (
  'd0000000-0000-0000-0000-000000000441',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  '2c598ce1-7b22-49ea-8d05-6b639e7a74e1', -- A.5.1 (control_catalog_entry)
  'd0000000-0000-0000-0000-000000000201', -- CTL-001
  'applicable',
  'Zentrale Richtlinie für das gesamte ISMS erforderlich. Geltungsbereich umfasst alle Standorte und Tochtergesellschaften.',
  'implemented',
  'IS-Richtlinie v3.2 genehmigt durch Geschäftsführung am 15.01.2026. Nächste Ueberprüfung geplant für Q1 2027.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-01-15 10:00:00+01'
) ON CONFLICT (id) DO NOTHING;

-- SoA-002: A.5.2 Rollen und Verantwortlichkeiten → CTL-002
INSERT INTO soa_entry (id, org_id, catalog_entry_id, control_id, applicability, applicability_justification, implementation, implementation_notes, responsible_id, last_reviewed)
VALUES (
  'd0000000-0000-0000-0000-000000000442',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  '52fc1e05-0f7f-4615-b3af-f1c192135ef8', -- A.5.2 (control_catalog_entry)
  'd0000000-0000-0000-0000-000000000202', -- CTL-002
  'applicable',
  'RBAC und Rezertifizierung sind Pflicht für alle IT-Systeme mit personenbezogenen oder geschäftskritischen Daten.',
  'implemented',
  'IAM-System implementiert mit quartalsweiser Rezertifizierung. Letzte Kampagne: Q4 2025 mit 98% Abschlussquote.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-01-20 14:00:00+01'
) ON CONFLICT (id) DO NOTHING;

-- SoA-003: A.5.5 Kontakt mit Behoerden → CTL-008
INSERT INTO soa_entry (id, org_id, catalog_entry_id, control_id, applicability, applicability_justification, implementation, implementation_notes, responsible_id, last_reviewed)
VALUES (
  'd0000000-0000-0000-0000-000000000443',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  '0abdffa8-fa92-44fc-bfec-6740ef8aa1de', -- A.5.5 (control_catalog_entry)
  'd0000000-0000-0000-0000-000000000208', -- CTL-008
  'applicable',
  'Kontakt mit Aufsichtsbehoerden und Lieferanten-Sicherheitsbewertung erforderlich aufgrund regulatorischer Anforderungen.',
  'partially_implemented',
  'Kontaktlisten für BSI, BfDI und Aufsichtsbehoerden gepflegt. Standardisierter Fragebogen für Lieferantenbewertung vorhanden. Automatisierung geplant Q3 2026.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-02-01 09:00:00+01'
) ON CONFLICT (id) DO NOTHING;

-- SoA-004: A.5.4 Verantwortung der Leitung → CTL-005
INSERT INTO soa_entry (id, org_id, catalog_entry_id, control_id, applicability, applicability_justification, implementation, implementation_notes, responsible_id, last_reviewed)
VALUES (
  'd0000000-0000-0000-0000-000000000444',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  '675c001b-87d2-49ec-8cab-6e7964245804', -- A.5.4 (control_catalog_entry)
  'd0000000-0000-0000-0000-000000000205', -- CTL-005
  'applicable',
  'Leitungsverantwortung für Incident-Management und ISMS-Betrieb ist regulatorische Pflicht (NIS2, DSGVO Art. 33/34).',
  'implemented',
  'IR-Prozess mit Eskalation an Geschäftsführung etabliert. Jährliche Tabletop-Exercise durchgeführt. Letzte Übung: November 2025.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2025-11-20 15:00:00+01'
) ON CONFLICT (id) DO NOTHING;

-- SoA-005: A.6.3 Sensibilisierung und Schulung → CTL-007
INSERT INTO soa_entry (id, org_id, catalog_entry_id, control_id, applicability, applicability_justification, implementation, implementation_notes, responsible_id, last_reviewed)
VALUES (
  'd0000000-0000-0000-0000-000000000445',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  '27ca1e65-1555-4ea4-907a-1f577325b6f9', -- A.6.3 (control_catalog_entry)
  'd0000000-0000-0000-0000-000000000207', -- CTL-007
  'applicable',
  'Schulungspflicht für alle Mitarbeiter gemäß ISO 27001 und BSI IT-Grundschutz. Besondere Anforderungen für privilegierte Nutzer.',
  'implemented',
  'E-Learning-Plattform mit monatlichen Phishing-Simulationen. Abschlussquote 2025: 94%. Nächste Pflichtschulung: April 2026.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-01-10 11:00:00+01'
) ON CONFLICT (id) DO NOTHING;

-- SoA-006: A.8.1 Endgeraetesicherheit → CTL-004
INSERT INTO soa_entry (id, org_id, catalog_entry_id, control_id, applicability, applicability_justification, implementation, implementation_notes, responsible_id, last_reviewed)
VALUES (
  'd0000000-0000-0000-0000-000000000446',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  '18afef37-2dd9-45bc-b3d1-6e5dbe7cef26', -- A.8.1 (control_catalog_entry)
  'd0000000-0000-0000-0000-000000000204', -- CTL-004
  'applicable',
  'Endgeraetesicherheit und Schwachstellen-Scanning sind Pflicht für alle Endpunkte und Server im Netzwerk.',
  'implemented',
  'Wöchentliche automatisierte Scans, quartalsweise externer Penetrationstest. Patch-SLA: kritisch 72h, hoch 7 Tage, mittel 30 Tage.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-02-15 10:00:00+01'
) ON CONFLICT (id) DO NOTHING;

-- SoA-007: A.8.3 Informationszugangsbeschraenkung → CTL-003
INSERT INTO soa_entry (id, org_id, catalog_entry_id, control_id, applicability, applicability_justification, implementation, implementation_notes, responsible_id, last_reviewed)
VALUES (
  'd0000000-0000-0000-0000-000000000447',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  '89704cc9-eb01-4d68-8384-101474ee56a6', -- A.8.3 (control_catalog_entry)
  'd0000000-0000-0000-0000-000000000203', -- CTL-003
  'applicable',
  'Zugangsbeschraenkung und Datensicherung sind essenziell für Business Continuity und Ransomware-Resilienz.',
  'implemented',
  'Tägliche inkrementelle Backups, wöchentliche Voll-Backups. Monatliche Restore-Tests. RTO: 4h, RPO: 24h für kritische Systeme.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-01-25 16:00:00+01'
) ON CONFLICT (id) DO NOTHING;

-- SoA-008: A.8.5 Sichere Authentifizierung → CTL-006
INSERT INTO soa_entry (id, org_id, catalog_entry_id, control_id, applicability, applicability_justification, implementation, implementation_notes, responsible_id, last_reviewed)
VALUES (
  'd0000000-0000-0000-0000-000000000448',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  '2f977c19-c854-4f7b-8b17-03da44345818', -- A.8.5 (control_catalog_entry)
  'd0000000-0000-0000-0000-000000000206', -- CTL-006
  'applicable',
  'Sichere Authentifizierung und Verschlüsselung sind Pflicht gemäß DSGVO Art. 32 und BSI-Vorgaben.',
  'implemented',
  'AES-256 für Daten at-rest, TLS 1.3 für in-transit. MFA für alle Benutzer. Zentrales HSM für Key-Management. Jährlicher Krypto-Review.',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf',
  '2026-02-10 13:00:00+01'
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Risk-Asset Links (8 entries linking risks to assets)
-- ─────────────────────────────────────────────────────────────────────────────

-- RSK-001 Ransomware → Applikationsserver
INSERT INTO risk_asset (id, org_id, risk_id, asset_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000451',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000101',
  'd0000000-0000-0000-0000-000000000405',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- RSK-001 Ransomware → Datenbankserver
INSERT INTO risk_asset (id, org_id, risk_id, asset_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000452',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000101',
  'd0000000-0000-0000-0000-000000000406',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- RSK-001 Ransomware → ERP-System
INSERT INTO risk_asset (id, org_id, risk_id, asset_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000453',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000101',
  'd0000000-0000-0000-0000-000000000402',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- RSK-002 Lieferkette → E-Mail-Gateway
INSERT INTO risk_asset (id, org_id, risk_id, asset_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000454',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000102',
  'd0000000-0000-0000-0000-000000000408',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- RSK-003 DSGVO → CRM-System
INSERT INTO risk_asset (id, org_id, risk_id, asset_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000455',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000103',
  'd0000000-0000-0000-0000-000000000403',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- RSK-003 DSGVO → Cloud-Gehaltsabrechnung
INSERT INTO risk_asset (id, org_id, risk_id, asset_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000456',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000103',
  'd0000000-0000-0000-0000-000000000404',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- RSK-005 Cloud-Ausfall → Cloud-Speicher
INSERT INTO risk_asset (id, org_id, risk_id, asset_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000457',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000105',
  'd0000000-0000-0000-0000-000000000409',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

-- RSK-005 Cloud-Ausfall → Firewall
INSERT INTO risk_asset (id, org_id, risk_id, asset_id, created_by)
VALUES (
  'd0000000-0000-0000-0000-000000000458',
  'ccc4cc1c-4b09-499c-8420-ebd8da655cd7',
  'd0000000-0000-0000-0000-000000000105',
  'd0000000-0000-0000-0000-000000000407',
  '8c148f0a-f558-4a9f-8886-a3d7096da6cf'
) ON CONFLICT (id) DO NOTHING;

COMMIT;
