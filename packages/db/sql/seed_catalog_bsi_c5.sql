-- ============================================================================
-- ARCTOS Seed: BSI C5:2020 — Cloud Computing Compliance Criteria Catalogue
-- Source: BSI C5:2020 (Cloud Computing Compliance Criteria Catalogue)
-- 17 categories / 124 criteria
--
-- Target modules: isms, tprm (cloud-provider assurance for German market)
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-b51c50000001',
  'BSI C5:2020 Cloud Compliance Criteria',
  'BSI Cloud Computing Compliance Criteria Catalogue C5:2020. 124 criteria across 17 categories for assurance of cloud-service-provider security; basis for SOC2-style attestations in DE.',
  'control', 'platform', 'bsi_c5_2020', '2020', 'de', true, '{isms,tprm}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, name_de, description, description_de, level, sort_order, status) VALUES
-- ── 17 Categories + selected key criteria ──────────────────────────────────
('c0000000-0000-0000-0000-b51c50000001', 'OIS', 'Organisation der Informationssicherheit', 'Organisation der Informationssicherheit', 'Organization of information security', 'Organisation der Informationssicherheit', 0, 100, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'OIS-01', 'Information Security Management System (ISMS)', 'Informationssicherheits-Managementsystem (ISMS)', 'A documented ISMS shall be implemented and operated', 'Ein dokumentiertes ISMS muss implementiert und betrieben werden', 1, 110, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'OIS-02', 'Information security policy', 'Informationssicherheitsleitlinie', 'A formal IS-policy shall be defined, approved and communicated', 'Eine formelle IS-Leitlinie muss definiert, genehmigt und kommuniziert werden', 1, 120, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'OIS-03', 'Interfaces and dependencies', 'Schnittstellen und Abhängigkeiten', 'External interfaces and dependencies shall be identified', 'Externe Schnittstellen und Abhängigkeiten müssen identifiziert werden', 1, 130, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'OIS-04', 'Segregation of duties', 'Funktionstrennung', 'Conflicting duties shall be segregated', 'Widersprüchliche Aufgaben müssen getrennt werden', 1, 140, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'OIS-06', 'Information security in project management', 'Informationssicherheit im Projektmanagement', 'IS shall be addressed in project management', 'IS muss im Projektmanagement berücksichtigt werden', 1, 150, 'active'),

('c0000000-0000-0000-0000-b51c50000001', 'SP', 'Sicherheitsrichtlinien und Arbeitsanweisungen', 'Sicherheitsrichtlinien und Arbeitsanweisungen', 'Security policies and instructions', 'Sicherheitsrichtlinien und Arbeitsanweisungen', 0, 200, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'SP-01', 'Documentation, communication and provision of policies and instructions', 'Dokumentation, Kommunikation und Bereitstellung von Richtlinien', 'Policies and instructions shall be documented, communicated and made available', 'Richtlinien und Anweisungen müssen dokumentiert, kommuniziert und bereitgestellt werden', 1, 210, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'SP-02', 'Review and approval of policies', 'Prüfung und Genehmigung von Richtlinien', 'Policies shall be reviewed and approved', 'Richtlinien müssen geprüft und genehmigt werden', 1, 220, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'SP-03', 'Exceptions from policies', 'Ausnahmen von Richtlinien', 'Exceptions from policies shall be documented and approved', 'Ausnahmen von Richtlinien müssen dokumentiert und genehmigt werden', 1, 230, 'active'),

('c0000000-0000-0000-0000-b51c50000001', 'HR', 'Personal', 'Personal', 'Personnel', 'Personal', 0, 300, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'HR-01', 'Verification of qualification and trustworthiness', 'Überprüfung der Qualifikation und Vertrauenswürdigkeit', 'Personnel qualification and trustworthiness shall be verified', 'Qualifikation und Vertrauenswürdigkeit des Personals müssen geprüft werden', 1, 310, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'HR-03', 'Security training and awareness', 'Sicherheitsschulung und Awareness', 'Personnel shall be trained in information security', 'Personal muss in Informationssicherheit geschult werden', 1, 320, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'HR-04', 'Disciplinary measures', 'Disziplinarmaßnahmen', 'Disciplinary procedures for IS-violations shall be defined', 'Disziplinarverfahren bei IS-Verstößen müssen definiert sein', 1, 330, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'HR-05', 'Responsibilities upon termination', 'Verantwortlichkeiten bei Beendigung', 'Termination procedures shall ensure asset return and access removal', 'Beendigungsverfahren müssen Asset-Rückgabe und Zugangsentzug sicherstellen', 1, 340, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'HR-06', 'Remote working', 'Telearbeit', 'Remote-working procedures shall be defined and secured', 'Telearbeitsverfahren müssen definiert und gesichert werden', 1, 350, 'active'),

('c0000000-0000-0000-0000-b51c50000001', 'AM', 'Asset Management', 'Asset Management', 'Asset management', 'Asset Management', 0, 400, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'AM-01', 'Asset inventory', 'Asset-Inventar', 'An inventory of all assets shall be maintained', 'Ein Inventar aller Assets muss geführt werden', 1, 410, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'AM-03', 'Acceptable use of assets', 'Akzeptable Nutzung von Assets', 'Rules for the acceptable use of assets shall be defined', 'Regeln für die akzeptable Nutzung von Assets müssen definiert werden', 1, 420, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'AM-05', 'Classification of assets', 'Klassifizierung von Assets', 'Assets shall be classified based on the value to the organization', 'Assets müssen basierend auf ihrem Wert klassifiziert werden', 1, 430, 'active'),

('c0000000-0000-0000-0000-b51c50000001', 'PS', 'Physische Sicherheit', 'Physische Sicherheit', 'Physical security', 'Physische Sicherheit', 0, 500, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'PS-01', 'Physical security perimeters', 'Physische Sicherheitsperimeter', 'Physical security perimeters for protected areas shall be defined', 'Physische Sicherheitsperimeter für geschützte Bereiche müssen definiert sein', 1, 510, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'PS-03', 'Protection against environmental threats', 'Schutz vor Umweltbedrohungen', 'Protective measures against environmental threats shall be implemented', 'Schutzmaßnahmen gegen Umweltbedrohungen müssen implementiert werden', 1, 520, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'PS-04', 'Protection against environmental influences', 'Schutz vor Umwelteinflüssen', 'Cooling, fire suppression and water-leak protection shall be in place', 'Kühlung, Brandschutz und Wasserleckschutz müssen vorhanden sein', 1, 530, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'PS-05', 'Redundancy of supply', 'Redundante Versorgung', 'Power and cooling shall be redundant', 'Strom- und Kühlversorgung müssen redundant ausgeführt sein', 1, 540, 'active'),

('c0000000-0000-0000-0000-b51c50000001', 'RB', 'Regelbetrieb', 'Regelbetrieb', 'Regular operation', 'Regelbetrieb', 0, 600, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'RB-01', 'Capacity planning', 'Kapazitätsplanung', 'Capacity planning shall be established', 'Kapazitätsplanung muss etabliert sein', 1, 610, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'RB-03', 'Backup and restoration concept', 'Datensicherungs- und Wiederherstellungskonzept', 'A backup and restoration concept shall be defined and tested', 'Ein Backup- und Wiederherstellungskonzept muss definiert und getestet sein', 1, 620, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'RB-08', 'Logging and monitoring', 'Logging und Monitoring', 'Security-relevant events shall be logged and monitored', 'Sicherheitsrelevante Ereignisse müssen protokolliert und überwacht werden', 1, 630, 'active'),

('c0000000-0000-0000-0000-b51c50000001', 'IDM', 'Identitäts- und Berechtigungsmanagement', 'Identitäts- und Berechtigungsmanagement', 'Identity and access management', 'Identitäts- und Berechtigungsmanagement', 0, 700, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'IDM-01', 'Policy for managing user accounts and permissions', 'Richtlinie für Benutzer- und Berechtigungsmanagement', 'A policy shall govern user-account and permission management', 'Eine Richtlinie muss das Benutzer- und Berechtigungsmanagement regeln', 1, 710, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'IDM-02', 'Granting and changing user accounts', 'Vergabe und Änderung von Benutzerkonten', 'A formal process shall be in place for granting and changing accounts', 'Ein formales Verfahren muss für die Vergabe und Änderung von Konten vorhanden sein', 1, 720, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'IDM-04', 'Privileged accounts', 'Privilegierte Konten', 'Privileged accounts shall be subject to additional controls', 'Privilegierte Konten müssen zusätzlichen Maßnahmen unterliegen', 1, 730, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'IDM-08', 'Authentication mechanisms', 'Authentifizierungsmechanismen', 'Strong authentication mechanisms (incl. MFA) shall be used', 'Starke Authentifizierungsmechanismen (inkl. MFA) müssen verwendet werden', 1, 740, 'active'),

('c0000000-0000-0000-0000-b51c50000001', 'KRY', 'Kryptografie und Schlüsselmanagement', 'Kryptografie und Schlüsselmanagement', 'Cryptography and key management', 'Kryptografie und Schlüsselmanagement', 0, 800, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'KRY-01', 'Policy for use of cryptography', 'Richtlinie für den Einsatz von Kryptografie', 'A policy shall govern cryptographic mechanisms', 'Eine Richtlinie muss kryptographische Mechanismen regeln', 1, 810, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'KRY-02', 'Encryption of data in transit', 'Verschlüsselung von Daten bei der Übertragung', 'Data in transit shall be encrypted using strong, current algorithms', 'Daten bei Übertragung müssen mit starken, aktuellen Algorithmen verschlüsselt werden', 1, 820, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'KRY-03', 'Encryption of data at rest', 'Verschlüsselung von Daten im Ruhezustand', 'Data at rest shall be encrypted using strong, current algorithms', 'Daten im Ruhezustand müssen mit starken, aktuellen Algorithmen verschlüsselt werden', 1, 830, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'KRY-04', 'Secure key management', 'Sicheres Schlüsselmanagement', 'Cryptographic keys shall be securely managed throughout their lifecycle', 'Kryptographische Schlüssel müssen während ihres gesamten Lebenszyklus sicher verwaltet werden', 1, 840, 'active'),

('c0000000-0000-0000-0000-b51c50000001', 'KOS', 'Kommunikationssicherheit', 'Kommunikationssicherheit', 'Communications security', 'Kommunikationssicherheit', 0, 900, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'KOS-01', 'Technical safeguards for the network', 'Technische Schutzmaßnahmen für das Netzwerk', 'Networks shall be protected by technical safeguards', 'Netzwerke müssen durch technische Maßnahmen geschützt werden', 1, 910, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'KOS-03', 'Cross-network protection', 'Netzwerkübergreifender Schutz', 'Cross-network communication shall be controlled', 'Netzwerkübergreifende Kommunikation muss kontrolliert werden', 1, 920, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'KOS-05', 'Data leakage prevention', 'Vermeidung von Datenabfluss', 'Measures to prevent unauthorized data disclosure shall be implemented', 'Maßnahmen zur Verhinderung unbefugter Datenoffenlegung müssen implementiert werden', 1, 930, 'active'),

('c0000000-0000-0000-0000-b51c50000001', 'PI', 'Portabilität und Interoperabilität', 'Portabilität und Interoperabilität', 'Portability and interoperability', 'Portabilität und Interoperabilität', 0, 1000, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'PI-01', 'Documentation and safety of migration and recovery', 'Dokumentation und Sicherheit von Migration und Wiederherstellung', 'Documented procedures for migration and recovery shall be in place', 'Dokumentierte Verfahren für Migration und Wiederherstellung müssen vorhanden sein', 1, 1010, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'PI-03', 'Customer-side data export', 'Kundenseitiger Datenexport', 'Customer shall be able to export their data in a structured format', 'Der Kunde muss seine Daten in einem strukturierten Format exportieren können', 1, 1020, 'active'),

('c0000000-0000-0000-0000-b51c50000001', 'BEI', 'Beschaffung, Entwicklung und Änderung von Informationssystemen', 'Beschaffung, Entwicklung und Änderung', 'Procurement, development and change', 'Beschaffung, Entwicklung und Änderung', 0, 1100, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'BEI-01', 'Policy for development and procurement', 'Richtlinie für Entwicklung und Beschaffung', 'Policies for system acquisition and development shall be defined', 'Richtlinien für Systembeschaffung und -entwicklung müssen definiert werden', 1, 1110, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'BEI-03', 'Risk-based testing of changes', 'Risikobasiertes Testen von Änderungen', 'Changes shall be tested in a risk-based manner', 'Änderungen müssen risikobasiert getestet werden', 1, 1120, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'BEI-08', 'Software vulnerabilities', 'Software-Schwachstellen', 'Software vulnerabilities shall be identified and remediated', 'Software-Schwachstellen müssen identifiziert und behoben werden', 1, 1130, 'active'),

('c0000000-0000-0000-0000-b51c50000001', 'DLL', 'Steuerung und Überwachung von Dienstleistern und Lieferanten', 'Dienstleister und Lieferanten', 'Supplier and service-provider management', 'Steuerung und Überwachung von Dienstleistern und Lieferanten', 0, 1200, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'DLL-01', 'Policy for supplier and service-provider management', 'Richtlinie für Dienstleister- und Lieferantenmanagement', 'A policy shall govern supplier management', 'Eine Richtlinie muss das Lieferantenmanagement regeln', 1, 1210, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'DLL-04', 'Monitoring of services from sub-contractors', 'Überwachung von Leistungen von Unterauftragnehmern', 'Sub-contractor performance and security shall be monitored', 'Leistung und Sicherheit von Unterauftragnehmern müssen überwacht werden', 1, 1220, 'active'),

('c0000000-0000-0000-0000-b51c50000001', 'SIM', 'Sicherheitsvorfallmanagement', 'Sicherheitsvorfallmanagement', 'Incident management', 'Sicherheitsvorfallmanagement', 0, 1300, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'SIM-01', 'Policy for security-incident management', 'Richtlinie für Sicherheitsvorfallmanagement', 'A policy and process for incident management shall exist', 'Eine Richtlinie und ein Prozess für Vorfallmanagement müssen existieren', 1, 1310, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'SIM-04', 'Notification of cloud customers about security incidents', 'Benachrichtigung der Cloud-Kunden bei Vorfällen', 'Cloud customers shall be notified about security incidents in a timely manner', 'Cloud-Kunden müssen zeitnah über Sicherheitsvorfälle informiert werden', 1, 1320, 'active'),

('c0000000-0000-0000-0000-b51c50000001', 'BCM', 'Notfallmanagement', 'Notfallmanagement', 'Business continuity management', 'Notfallmanagement', 0, 1400, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'BCM-01', 'Top management responsibility', 'Verantwortung der obersten Leitung', 'Top management shall take responsibility for BCM', 'Die oberste Leitung muss Verantwortung für BCM übernehmen', 1, 1410, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'BCM-02', 'Business impact analysis policy and procedures', 'Richtlinie BIA', 'A BIA process shall be defined and conducted', 'Ein BIA-Prozess muss definiert und durchgeführt werden', 1, 1420, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'BCM-03', 'Planning of business continuity', 'Planung der Geschäftskontinuität', 'BC plans shall be defined and tested', 'BC-Pläne müssen definiert und getestet werden', 1, 1430, 'active'),

('c0000000-0000-0000-0000-b51c50000001', 'COM', 'Compliance', 'Compliance', 'Compliance', 'Compliance', 0, 1500, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'COM-01', 'Policy for the planning and implementation of compliance', 'Richtlinie zur Planung und Umsetzung von Compliance', 'Compliance shall be planned and implemented', 'Compliance muss geplant und umgesetzt werden', 1, 1510, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'COM-02', 'Identification of applicable legal, regulatory, self-imposed and contractual requirements', 'Identifikation anwendbarer Anforderungen', 'Applicable legal/regulatory/contractual requirements shall be identified', 'Anwendbare gesetzliche, regulatorische und vertragliche Anforderungen müssen identifiziert werden', 1, 1520, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'COM-04', 'Information about information processing', 'Information über Informationsverarbeitung', 'Cloud customers shall be informed about the processing of their data', 'Cloud-Kunden müssen über die Verarbeitung ihrer Daten informiert werden', 1, 1530, 'active'),

('c0000000-0000-0000-0000-b51c50000001', 'INQ', 'Umgang mit Ermittlungsanfragen staatlicher Stellen', 'Umgang mit Ermittlungsanfragen', 'Handling government inquiries', 'Umgang mit Ermittlungsanfragen staatlicher Stellen', 0, 1600, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'INQ-02', 'Investigation requests from government bodies', 'Ermittlungsanfragen staatlicher Stellen', 'Investigation requests shall be handled in line with policy and law', 'Ermittlungsanfragen müssen im Einklang mit Richtlinien und Gesetzen behandelt werden', 1, 1610, 'active'),

('c0000000-0000-0000-0000-b51c50000001', 'PSS', 'Produktsicherheit', 'Produktsicherheit', 'Product safety and security', 'Produktsicherheit', 0, 1700, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'PSS-01', 'Guidelines for product procurement', 'Leitlinien für die Produktbeschaffung', 'Guidelines for procuring secure products shall be established', 'Leitlinien für die Beschaffung sicherer Produkte müssen etabliert werden', 1, 1710, 'active'),
('c0000000-0000-0000-0000-b51c50000001', 'PSS-02', 'Online registries of public security flaws', 'Öffentliche Verzeichnisse von Sicherheitslücken', 'Public registries of security flaws (e.g., CVE) shall be monitored', 'Öffentliche Verzeichnisse von Sicherheitslücken (z. B. CVE) müssen überwacht werden', 1, 1720, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- Done. 17 categories + ~50 selected criteria = ~67 BSI C5 entries
