-- ============================================================================
-- ARCTOS Seed: Fachliche Stammdaten (Domain-specific reference data)
-- Sprint 5a: Incident categories
-- Sprint 6: Crisis scenarios
-- Sprint 7: DSR types, Legal bases, DPIA criteria
-- Sprint 9: DD questionnaire, LkSG risk categories
-- ============================================================================

-- ============================================================================
-- 1. Incident Categories (Sprint 5a — I-NEW-11)
-- Based on NIST SP 800-61, BSI IT-Grundschutz, ENISA taxonomy
-- ============================================================================
INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active)
VALUES ('c0000000-0000-0000-0000-14c1de47ca75', 'Incident-Kategorien', 'Taxonomie für Sicherheitsvorfälle nach NIST/BSI/ENISA', 'reference', 'platform', 'arctos_incident_taxonomy', '1.0', true)
ON CONFLICT DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-14c1de47ca75', 'IC-01', 'Malware / Schadprogramme', 'Ransomware, Trojaner, Viren, Würmer, Spyware, Rootkits', 0, 1, 'active'),
('c0000000-0000-0000-0000-14c1de47ca75', 'IC-02', 'Phishing / Social Engineering', 'Spear-Phishing, Vishing, Pretexting, Baiting, CEO-Fraud', 0, 2, 'active'),
('c0000000-0000-0000-0000-14c1de47ca75', 'IC-03', 'Unbefugter Zugriff', 'Account-Kompromittierung, Brute-Force, Credential Stuffing, Privilege Escalation', 0, 3, 'active'),
('c0000000-0000-0000-0000-14c1de47ca75', 'IC-04', 'Denial of Service (DoS/DDoS)', 'Volumetrische Angriffe, Protokollangriffe, Application-Layer-Angriffe', 0, 4, 'active'),
('c0000000-0000-0000-0000-14c1de47ca75', 'IC-05', 'Datenverlust / Datenleck', 'Unbeabsichtigte Offenlegung, Fehlversand, Cloud-Fehlkonfiguration', 0, 5, 'active'),
('c0000000-0000-0000-0000-14c1de47ca75', 'IC-06', 'Insider-Bedrohung', 'Böswillige Insider, fahrlässiges Verhalten, Sabotage durch Mitarbeiter', 0, 6, 'active'),
('c0000000-0000-0000-0000-14c1de47ca75', 'IC-07', 'Web Application Attack', 'SQL Injection, XSS, CSRF, File Upload, API-Missbrauch', 0, 7, 'active'),
('c0000000-0000-0000-0000-14c1de47ca75', 'IC-08', 'Supply-Chain-Angriff', 'Kompromittierung von Drittanbieter-Software oder -Diensten', 0, 8, 'active'),
('c0000000-0000-0000-0000-14c1de47ca75', 'IC-09', 'Physischer Sicherheitsvorfall', 'Einbruch, Diebstahl von Geräten, Manipulation von Hardware', 0, 9, 'active'),
('c0000000-0000-0000-0000-14c1de47ca75', 'IC-10', 'Kryptographischer Vorfall', 'Zertifikats-Kompromittierung, Key-Leak, Protokoll-Downgrade', 0, 10, 'active'),
('c0000000-0000-0000-0000-14c1de47ca75', 'IC-11', 'Konfigurationsfehler', 'Fehlkonfiguration von Systemen, offene Ports, Default-Credentials', 0, 11, 'active'),
('c0000000-0000-0000-0000-14c1de47ca75', 'IC-12', 'Systemausfall / Verfügbarkeit', 'Hardware-Defekt, Softwarefehler, Infrastruktur-Ausfall (ohne Angriff)', 0, 12, 'active'),
('c0000000-0000-0000-0000-14c1de47ca75', 'IC-13', 'Datenschutzvorfall', 'DSGVO-Meldepflicht, unrechtmäßige Verarbeitung, Betroffenenrechte-Verletzung', 0, 13, 'active'),
('c0000000-0000-0000-0000-14c1de47ca75', 'IC-14', 'Compliance-Verstoß', 'Regulatorische Verstöße (NIS2, PCI-DSS, SOX), Policy-Verletzungen', 0, 14, 'active'),
('c0000000-0000-0000-0000-14c1de47ca75', 'IC-15', 'Sonstiges', 'Nicht kategorisierbare Vorfälle', 0, 15, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- 2. Crisis Scenarios (Sprint 6 — pre-defined templates)
-- Based on BSI 200-4, ISO 22301, common enterprise scenarios
-- ============================================================================
INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active)
VALUES ('c0000000-0000-0000-0000-c215155ce420', 'Krisenszenarien-Vorlagen', 'Vordefinierte Krisenszenarien für BCMS nach BSI 200-4', 'reference', 'platform', 'arctos_crisis_templates', '1.0', true)
ON CONFLICT DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-c215155ce420', 'CS-01', 'Cyber-Angriff (Ransomware)', 'Verschlüsselung kritischer Systeme durch Ransomware. Betrifft: IT-Infrastruktur, Datenbanken, ERP. Eskalation: Level 3. Erwartete Dauer: 3-14 Tage. Sofortmaßnahmen: Netzwerk isolieren, Backup-Status prüfen, Krisenstab einberufen, BSI/BKA informieren.', 0, 1, 'active'),
('c0000000-0000-0000-0000-c215155ce420', 'CS-02', 'IT-Totalausfall Rechenzentrum', 'Vollständiger Ausfall des primären Rechenzentrums (Strom, Kühlung, Hardware). Betrifft: Alle IT-Dienste. Eskalation: Level 3. Erwartete Dauer: 4-48 Stunden. Sofortmaßnahmen: DR-Standort aktivieren, Notfall-Kommunikation starten, Lieferanten kontaktieren.', 0, 2, 'active'),
('c0000000-0000-0000-0000-c215155ce420', 'CS-03', 'Pandemie / Personalmangel', 'Großflächiger Ausfall von Personal (>30%) durch Pandemie oder andere Ursachen. Betrifft: Alle Geschäftsprozesse. Eskalation: Level 2-3. Erwartete Dauer: Wochen-Monate. Sofortmaßnahmen: Remote-Arbeit aktivieren, Priorisierung wesentlicher Prozesse, Stellvertreter-Regelungen.', 0, 3, 'active'),
('c0000000-0000-0000-0000-c215155ce420', 'CS-04', 'Lieferkettenunterbrechung', 'Ausfall eines kritischen Lieferanten oder Engpass bei Schlüsselkomponenten. Betrifft: Produktion, Logistik. Eskalation: Level 2. Erwartete Dauer: Tage-Wochen. Sofortmaßnahmen: Alternative Lieferanten aktivieren, Lagerbestände prüfen, Kundenkommunikation.', 0, 4, 'active'),
('c0000000-0000-0000-0000-c215155ce420', 'CS-05', 'Naturkatastrophe / Gebäudeschaden', 'Überschwemmung, Sturm, Brand oder Erdbeben mit Gebäudeschaden. Betrifft: Physische Infrastruktur, Mitarbeitersicherheit. Eskalation: Level 3-4. Sofortmaßnahmen: Evakuierung, Notfallnummern, Ausweichstandort, Versicherung informieren.', 0, 5, 'active'),
('c0000000-0000-0000-0000-c215155ce420', 'CS-06', 'Datenschutzverletzung (Groß)', 'Kompromittierung personenbezogener Daten von >10.000 Betroffenen. Betrifft: Datenschutz, Reputation, Regulierung. Eskalation: Level 2-3. 72h-Meldefrist Aufsichtsbehörde. Sofortmaßnahmen: DPO informieren, Ursache eingrenzen, Meldung vorbereiten, Betroffene informieren.', 0, 6, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- 3. Due Diligence Questionnaire Template (Sprint 9)
-- Standard vendor assessment questions for TPRM
-- ============================================================================
INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active)
VALUES ('c0000000-0000-0000-0000-dd00e5710420', 'DD-Fragebogen Standard', 'Standard Due-Diligence-Fragebogen für Lieferantenbewertung', 'reference', 'platform', 'arctos_dd_template', '1.0', true)
ON CONFLICT DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
-- Information Security
('c0000000-0000-0000-0000-dd00e5710420', 'DD-IS', 'Informationssicherheit', 'Fragen zur IT- und Informationssicherheit des Lieferanten', 0, 100, 'active'),
('c0000000-0000-0000-0000-dd00e5710420', 'DD-IS-01', 'Sind Sie nach ISO 27001 oder vergleichbar zertifiziert?', 'Zertifizierung, SOC 2, BSI IT-Grundschutz-Zertifikat', 1, 101, 'active'),
('c0000000-0000-0000-0000-dd00e5710420', 'DD-IS-02', 'Verfügen Sie über ein dokumentiertes ISMS?', 'Richtlinien, Verantwortlichkeiten, Risikomanagement', 1, 102, 'active'),
('c0000000-0000-0000-0000-dd00e5710420', 'DD-IS-03', 'Wie ist Ihre Zugriffskontrolle organisiert?', 'MFA, Berechtigungskonzept, Privileged Access Management', 1, 103, 'active'),
('c0000000-0000-0000-0000-dd00e5710420', 'DD-IS-04', 'Wie handhaben Sie Schwachstellen-Management?', 'Patch-Frequenz, Vulnerability Scanning, Penetrationstests', 1, 104, 'active'),
('c0000000-0000-0000-0000-dd00e5710420', 'DD-IS-05', 'Verfügen Sie über einen Incident-Response-Plan?', 'Meldefristen, Eskalation, Kommunikation an Auftraggeber', 1, 105, 'active'),
-- Data Protection
('c0000000-0000-0000-0000-dd00e5710420', 'DD-DP', 'Datenschutz', 'Fragen zur DSGVO-Compliance und Datenverarbeitung', 0, 200, 'active'),
('c0000000-0000-0000-0000-dd00e5710420', 'DD-DP-01', 'Liegt eine Datenschutzvereinbarung (DPA/AVV) vor?', 'Art. 28 DSGVO, Standardvertragsklauseln bei Drittländern', 1, 201, 'active'),
('c0000000-0000-0000-0000-dd00e5710420', 'DD-DP-02', 'Wo werden die Daten verarbeitet und gespeichert?', 'EU/EWR, Drittland, Sub-Auftragsverarbeiter', 1, 202, 'active'),
('c0000000-0000-0000-0000-dd00e5710420', 'DD-DP-03', 'Wie gewährleisten Sie die Rechte der Betroffenen?', 'Auskunft, Löschung, Datenübertragbarkeit', 1, 203, 'active'),
-- Business Continuity
('c0000000-0000-0000-0000-dd00e5710420', 'DD-BC', 'Business Continuity', 'Fragen zur Geschäftskontinuität und Disaster Recovery', 0, 300, 'active'),
('c0000000-0000-0000-0000-dd00e5710420', 'DD-BC-01', 'Verfügen Sie über einen Business Continuity Plan?', 'BIA, BCP, DR-Pläne, Backup-Strategien', 1, 301, 'active'),
('c0000000-0000-0000-0000-dd00e5710420', 'DD-BC-02', 'Wie oft testen Sie Ihre Notfallpläne?', 'Übungsfrequenz, Art (Tabletop, funktional, Simulation)', 1, 302, 'active'),
('c0000000-0000-0000-0000-dd00e5710420', 'DD-BC-03', 'Was sind Ihre RTO/RPO-Ziele?', 'Recovery Time/Point Objective, SLA-Zusagen', 1, 303, 'active'),
-- Financial Stability
('c0000000-0000-0000-0000-dd00e5710420', 'DD-FI', 'Finanzielle Stabilität', 'Fragen zur finanziellen Leistungsfähigkeit', 0, 400, 'active'),
('c0000000-0000-0000-0000-dd00e5710420', 'DD-FI-01', 'Wie ist Ihre aktuelle Bonität / Kreditwürdigkeit?', 'Rating-Agentur, Creditreform, Dun & Bradstreet', 1, 401, 'active'),
('c0000000-0000-0000-0000-dd00e5710420', 'DD-FI-02', 'Verfügen Sie über eine Berufshaftpflichtversicherung?', 'Deckungssumme, Cyber-Versicherung', 1, 402, 'active'),
-- Compliance
('c0000000-0000-0000-0000-dd00e5710420', 'DD-CO', 'Compliance & Governance', 'Fragen zu regulatorischer Compliance', 0, 500, 'active'),
('c0000000-0000-0000-0000-dd00e5710420', 'DD-CO-01', 'Haben Sie einen Code of Conduct?', 'Ethikrichtlinie, Anti-Korruptions-Policy', 1, 501, 'active'),
('c0000000-0000-0000-0000-dd00e5710420', 'DD-CO-02', 'Verfügen Sie über ein Hinweisgebersystem?', 'Whistleblowing-Kanal, Anonymität', 1, 502, 'active'),
-- Geopolitical
('c0000000-0000-0000-0000-dd00e5710420', 'DD-GP', 'Geopolitisches Risiko', 'Fragen zu Standort- und geopolitischen Risiken', 0, 600, 'active'),
('c0000000-0000-0000-0000-dd00e5710420', 'DD-GP-01', 'In welchen Ländern haben Sie Standorte?', 'Sanktionslisten-Prüfung, politische Stabilität', 1, 601, 'active'),
('c0000000-0000-0000-0000-dd00e5710420', 'DD-GP-02', 'Unterliegen Sie dem US CLOUD Act oder vergleichbaren Regelungen?', 'Datenzugriffsrisiko durch ausländische Behörden', 1, 602, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- 4. LkSG Risk Categories (Sprint 9 — Supply Chain Due Diligence Act)
-- Based on LkSG §2 (Menschenrechte) + §2 (Umwelt)
-- ============================================================================
INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active)
VALUES ('c0000000-0000-0000-0000-1a5921540a75', 'LkSG-Risikokategorien', 'Risikokategorien nach dem Lieferkettensorgfaltspflichtengesetz (LkSG)', 'reference', 'platform', 'arctos_lksg', '1.0', true)
ON CONFLICT DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
-- Human Rights (§2 Abs. 2)
('c0000000-0000-0000-0000-1a5921540a75', 'LK-HR', 'Menschenrechtsrisiken', 'Risiken bezüglich internationaler Menschenrechtsstandards', 0, 100, 'active'),
('c0000000-0000-0000-0000-1a5921540a75', 'LK-HR-01', 'Kinderarbeit', 'Beschäftigung von Kindern unter dem Mindestalter (ILO C138, C182)', 1, 101, 'active'),
('c0000000-0000-0000-0000-1a5921540a75', 'LK-HR-02', 'Zwangsarbeit', 'Jede Form von Zwangs- oder Pflichtarbeit (ILO C29, C105)', 1, 102, 'active'),
('c0000000-0000-0000-0000-1a5921540a75', 'LK-HR-03', 'Arbeitsschutz', 'Missachtung von Arbeitsschutzpflichten, unsichere Arbeitsbedingungen', 1, 103, 'active'),
('c0000000-0000-0000-0000-1a5921540a75', 'LK-HR-04', 'Vereinigungsfreiheit', 'Einschränkung der Koalitionsfreiheit und des Rechts auf Kollektivverhandlungen', 1, 104, 'active'),
('c0000000-0000-0000-0000-1a5921540a75', 'LK-HR-05', 'Diskriminierung', 'Ungleichbehandlung bei Beschäftigung aufgrund von Herkunft, Geschlecht, Religion', 1, 105, 'active'),
('c0000000-0000-0000-0000-1a5921540a75', 'LK-HR-06', 'Entlohnung', 'Vorenthalten eines angemessenen Lohns (mindestens Mindestlohn des Landes)', 1, 106, 'active'),
('c0000000-0000-0000-0000-1a5921540a75', 'LK-HR-07', 'Landraub', 'Widerrechtliche Zwangsräumung oder Entzug von Land', 1, 107, 'active'),
('c0000000-0000-0000-0000-1a5921540a75', 'LK-HR-08', 'Private Sicherheitskräfte', 'Einsatz privater Sicherheitskräfte mit unverhältnismäßiger Gewalt', 1, 108, 'active'),
-- Environmental (§2 Abs. 3)
('c0000000-0000-0000-0000-1a5921540a75', 'LK-ENV', 'Umweltrisiken', 'Risiken bezüglich Umweltstandards (Minamata, Stockholm, Basel)', 0, 200, 'active'),
('c0000000-0000-0000-0000-1a5921540a75', 'LK-ENV-01', 'Quecksilber (Minamata)', 'Verwendung von Quecksilber in Produkten oder Prozessen entgegen dem Minamata-Übereinkommen', 1, 201, 'active'),
('c0000000-0000-0000-0000-1a5921540a75', 'LK-ENV-02', 'Persistente organische Schadstoffe (Stockholm)', 'Herstellung oder Verwendung von POP-Substanzen entgegen dem Stockholmer Übereinkommen', 1, 202, 'active'),
('c0000000-0000-0000-0000-1a5921540a75', 'LK-ENV-03', 'Gefährliche Abfälle (Basel)', 'Export oder Entsorgung gefährlicher Abfälle entgegen dem Basler Übereinkommen', 1, 203, 'active'),
('c0000000-0000-0000-0000-1a5921540a75', 'LK-ENV-04', 'Wasserverschmutzung', 'Erhebliche Verunreinigung von Gewässern durch Produktionsprozesse', 1, 204, 'active'),
('c0000000-0000-0000-0000-1a5921540a75', 'LK-ENV-05', 'Bodenverschmutzung', 'Kontaminierung von Böden durch Chemikalien oder Abfälle', 1, 205, 'active'),
('c0000000-0000-0000-0000-1a5921540a75', 'LK-ENV-06', 'Luftverschmutzung', 'Übermäßige Emissionen entgegen lokaler Regulierung oder WHO-Grenzwerten', 1, 206, 'active'),
('c0000000-0000-0000-0000-1a5921540a75', 'LK-ENV-07', 'Übermäßiger Wasserverbrauch', 'Wasserentnahme die lokale Versorgung gefährdet', 1, 207, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- 5. DPIA High-Risk Indicators (Sprint 7 — GDPR Art. 35.3)
-- ============================================================================
INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active)
VALUES ('c0000000-0000-0000-0000-d91a14d1ca72', 'DSFA-Prüfkriterien', 'Kriterien für die Pflicht zur Datenschutz-Folgenabschätzung nach Art. 35 DSGVO', 'reference', 'platform', 'arctos_dpia_criteria', '1.0', true)
ON CONFLICT DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-d91a14d1ca72', 'DPIA-01', 'Automatisierte Einzelentscheidungen (Profiling)', 'Art. 35.3a: Systematische und umfassende Bewertung persönlicher Aspekte natürlicher Personen, einschließlich Profiling, auf deren Grundlage Entscheidungen getroffen werden', 0, 1, 'active'),
('c0000000-0000-0000-0000-d91a14d1ca72', 'DPIA-02', 'Umfangreiche Verarbeitung besonderer Kategorien', 'Art. 35.3b: Umfangreiche Verarbeitung besonderer Kategorien personenbezogener Daten (Art. 9) oder Daten über strafrechtliche Verurteilungen (Art. 10)', 0, 2, 'active'),
('c0000000-0000-0000-0000-d91a14d1ca72', 'DPIA-03', 'Systematische Überwachung öffentlicher Bereiche', 'Art. 35.3c: Systematische umfangreiche Überwachung öffentlich zugänglicher Bereiche (z.B. Videoüberwachung)', 0, 3, 'active'),
('c0000000-0000-0000-0000-d91a14d1ca72', 'DPIA-04', 'Neue Technologien', 'Einsatz neuer Technologien (KI, Biometrie, IoT) die ein hohes Risiko für Betroffene bergen können', 0, 4, 'active'),
('c0000000-0000-0000-0000-d91a14d1ca72', 'DPIA-05', 'Scoring / Bewertung', 'Bewertung oder Einstufung von Personen (Kreditwürdigkeit, Arbeitsleistung, Gesundheit, Verhalten)', 0, 5, 'active'),
('c0000000-0000-0000-0000-d91a14d1ca72', 'DPIA-06', 'Umfangreiche Datenzusammenführung', 'Zusammenführung von Datensätzen aus verschiedenen Quellen die über die vernünftigen Erwartungen der Betroffenen hinausgeht', 0, 6, 'active'),
('c0000000-0000-0000-0000-d91a14d1ca72', 'DPIA-07', 'Verarbeitung vulnerabler Gruppen', 'Verarbeitung von Daten schutzbedürftiger Personen (Minderjährige, Arbeitnehmer, Patienten, Asylbewerber)', 0, 7, 'active'),
('c0000000-0000-0000-0000-d91a14d1ca72', 'DPIA-08', 'Innovative Nutzung biometrischer Daten', 'Verarbeitung biometrischer Daten zur eindeutigen Identifizierung natürlicher Personen', 0, 8, 'active'),
('c0000000-0000-0000-0000-d91a14d1ca72', 'DPIA-09', 'Datenübermittlung in Drittländer', 'Übermittlung personenbezogener Daten in Länder ohne angemessenes Datenschutzniveau', 0, 9, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- Set parent_entry_id for hierarchical entries
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'DD-IS' AND catalog_id = 'c0000000-0000-0000-0000-dd00e5710420') WHERE code LIKE 'DD-IS-%' AND catalog_id = 'c0000000-0000-0000-0000-dd00e5710420';
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'DD-DP' AND catalog_id = 'c0000000-0000-0000-0000-dd00e5710420') WHERE code LIKE 'DD-DP-%' AND catalog_id = 'c0000000-0000-0000-0000-dd00e5710420';
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'DD-BC' AND catalog_id = 'c0000000-0000-0000-0000-dd00e5710420') WHERE code LIKE 'DD-BC-%' AND catalog_id = 'c0000000-0000-0000-0000-dd00e5710420';
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'DD-FI' AND catalog_id = 'c0000000-0000-0000-0000-dd00e5710420') WHERE code LIKE 'DD-FI-%' AND catalog_id = 'c0000000-0000-0000-0000-dd00e5710420';
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'DD-CO' AND catalog_id = 'c0000000-0000-0000-0000-dd00e5710420') WHERE code LIKE 'DD-CO-%' AND catalog_id = 'c0000000-0000-0000-0000-dd00e5710420';
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'DD-GP' AND catalog_id = 'c0000000-0000-0000-0000-dd00e5710420') WHERE code LIKE 'DD-GP-%' AND catalog_id = 'c0000000-0000-0000-0000-dd00e5710420';
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'LK-HR' AND catalog_id = 'c0000000-0000-0000-0000-1a5921540a75') WHERE code LIKE 'LK-HR-%' AND catalog_id = 'c0000000-0000-0000-0000-1a5921540a75';
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'LK-ENV' AND catalog_id = 'c0000000-0000-0000-0000-1a5921540a75') WHERE code LIKE 'LK-ENV-%' AND catalog_id = 'c0000000-0000-0000-0000-1a5921540a75';

-- ============================================================================
-- Summary:
-- Incident Categories: 15 entries (IC-01 to IC-15)
-- Crisis Scenarios: 6 templates (CS-01 to CS-06)
-- DD Questionnaire: 6 categories + 19 questions = 25 entries
-- LkSG: 2 categories + 15 subcategories = 17 entries
-- DPIA Criteria: 9 entries
-- TOTAL: 72 fachliche Stammdaten entries
-- ============================================================================
