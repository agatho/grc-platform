-- ISO 27005:2022 Threat & Vulnerability Catalog
-- Based on ISO 27005:2022 Annex A (Threat examples) and Annex D (Vulnerability examples)

-- ============================================================
-- ISO 27005 Threat Catalog
-- ============================================================

INSERT INTO catalog (id, name, description, catalog_type, source, version, language, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-270050000001',
  'ISO/IEC 27005:2022 Bedrohungskatalog',
  'Bedrohungsbeispiele aus ISO 27005:2022 Anhang A',
  'risk', 'iso_27005_2022_threats', '2022', 'de', true,
  '{isms,erm}'
) ON CONFLICT (id) DO NOTHING;

-- Physical Threats
INSERT INTO catalog_entry (catalog_id, code, name, name_de, description, description_de, sort_order, status) VALUES
('c0000000-0000-0000-0000-270050000001', 'T.PHY.01', 'Fire', 'Brand', 'Accidental or deliberate fire affecting premises, equipment, or media', 'Versehentlicher oder vorsätzlicher Brand mit Auswirkung auf Gebäude, Geräte oder Datenträger', 10, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.PHY.02', 'Water damage', 'Wasserschaden', 'Flooding, pipe burst, or humidity damage to equipment', 'Überflutung, Rohrbruch oder Feuchtigkeitsschäden an Geräten', 20, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.PHY.03', 'Natural disaster', 'Naturkatastrophe', 'Earthquake, storm, lightning, extreme weather', 'Erdbeben, Sturm, Blitzschlag, extremes Wetter', 30, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.PHY.04', 'Power failure', 'Stromausfall', 'Loss of electrical power supply', 'Ausfall der Stromversorgung', 40, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.PHY.05', 'HVAC failure', 'Klimaanlagenausfall', 'Air conditioning or environmental control system failure', 'Ausfall der Klimaanlage oder Gebäudetechnik', 50, 'active'),

-- Intentional Human Threats
('c0000000-0000-0000-0000-270050000001', 'T.INT.01', 'Malware / Ransomware', 'Schadsoftware / Ransomware', 'Malicious software including viruses, worms, trojans, ransomware', 'Schadprogramme einschließlich Viren, Würmer, Trojaner, Ransomware', 100, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.INT.02', 'Phishing / Social Engineering', 'Phishing / Social Engineering', 'Manipulation of humans to obtain unauthorized access or information', 'Manipulation von Personen zur Erlangung unbefugten Zugangs oder Informationen', 110, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.INT.03', 'Denial of Service (DoS/DDoS)', 'Denial of Service (DoS/DDoS)', 'Deliberate overloading of systems to prevent service availability', 'Absichtliche Überlastung von Systemen zur Verhinderung der Dienstverfügbarkeit', 120, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.INT.04', 'Unauthorized access', 'Unbefugter Zugang', 'Gaining access to systems, networks, or data without authorization', 'Zugang zu Systemen, Netzwerken oder Daten ohne Berechtigung', 130, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.INT.05', 'Data theft / Exfiltration', 'Datendiebstahl / Exfiltration', 'Unauthorized copying or transfer of sensitive data', 'Unbefugtes Kopieren oder Übertragen sensibler Daten', 140, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.INT.06', 'Insider threat', 'Innentäterbedrohung', 'Malicious or negligent actions by authorized personnel', 'Böswillige oder fahrlässige Handlungen durch autorisiertes Personal', 150, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.INT.07', 'Identity theft / Spoofing', 'Identitätsdiebstahl / Spoofing', 'Impersonation of authorized users or systems', 'Nachahmung autorisierter Benutzer oder Systeme', 160, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.INT.08', 'Man-in-the-Middle', 'Man-in-the-Middle-Angriff', 'Interception and modification of communications', 'Abfangen und Verändern von Kommunikation', 170, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.INT.09', 'Privilege escalation', 'Rechteausweitung', 'Gaining higher access privileges than authorized', 'Erlangung höherer Zugriffsrechte als autorisiert', 180, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.INT.10', 'Supply chain attack', 'Lieferkettenangriff', 'Compromise through third-party suppliers or software dependencies', 'Kompromittierung über Drittanbieter oder Software-Abhängigkeiten', 190, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.INT.11', 'Advanced Persistent Threat (APT)', 'Advanced Persistent Threat (APT)', 'Sophisticated, prolonged targeted attack', 'Ausgeklügelter, langandauernder gezielter Angriff', 200, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.INT.12', 'Physical theft', 'Physischer Diebstahl', 'Theft of equipment, media, or documents', 'Diebstahl von Geräten, Datenträgern oder Dokumenten', 210, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.INT.13', 'Sabotage', 'Sabotage', 'Deliberate destruction or disruption of operations', 'Absichtliche Zerstörung oder Störung des Betriebs', 220, 'active'),

-- Accidental Human Threats
('c0000000-0000-0000-0000-270050000001', 'T.ACC.01', 'Human error / Misconfiguration', 'Menschliches Versagen / Fehlkonfiguration', 'Accidental errors in operation or configuration', 'Versehentliche Fehler bei Betrieb oder Konfiguration', 300, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.ACC.02', 'Accidental data deletion', 'Versehentliche Datenlöschung', 'Unintentional destruction of data', 'Unbeabsichtigte Zerstörung von Daten', 310, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.ACC.03', 'Unauthorized data disclosure', 'Unbeabsichtigte Datenoffenlegung', 'Accidental exposure of confidential data', 'Versehentliche Offenlegung vertraulicher Daten', 320, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.ACC.04', 'Loss of media', 'Verlust von Datenträgern', 'Loss of portable storage devices, documents, or equipment', 'Verlust tragbarer Speichergeräte, Dokumente oder Geräte', 330, 'active'),

-- Technical Threats
('c0000000-0000-0000-0000-270050000001', 'T.TEC.01', 'Hardware failure', 'Hardwareausfall', 'Physical failure of servers, storage, network components', 'Physischer Ausfall von Servern, Speicher, Netzwerkkomponenten', 400, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.TEC.02', 'Software failure', 'Softwarefehler', 'Bugs, crashes, or unexpected behavior in applications', 'Fehler, Abstürze oder unerwartetes Verhalten in Anwendungen', 410, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.TEC.03', 'Network failure', 'Netzwerkausfall', 'Loss of network connectivity or communication services', 'Verlust der Netzwerkkonnektivität oder Kommunikationsdienste', 420, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.TEC.04', 'Capacity exhaustion', 'Kapazitätserschöpfung', 'Storage, bandwidth, or processing capacity exceeded', 'Speicher-, Bandbreiten- oder Verarbeitungskapazität überschritten', 430, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.TEC.05', 'Cryptographic failure', 'Kryptographieversagen', 'Weak encryption, key compromise, or certificate issues', 'Schwache Verschlüsselung, Schlüsselkompromittierung oder Zertifikatsprobleme', 440, 'active'),

-- Organizational Threats
('c0000000-0000-0000-0000-270050000001', 'T.ORG.01', 'Third-party service failure', 'Dienstleisterausfall', 'Failure or compromise of outsourced/cloud services', 'Ausfall oder Kompromittierung ausgelagerter/Cloud-Dienste', 500, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.ORG.02', 'Regulatory non-compliance', 'Regulatorische Nichteinhaltung', 'Failure to comply with laws, regulations, or contractual obligations', 'Nichterfüllung von Gesetzen, Vorschriften oder vertraglichen Pflichten', 510, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.ORG.03', 'Staff shortage', 'Personalmangel', 'Insufficient skilled personnel for security operations', 'Unzureichend qualifiziertes Personal für den Sicherheitsbetrieb', 520, 'active'),
('c0000000-0000-0000-0000-270050000001', 'T.ORG.04', 'Insufficient security awareness', 'Mangelndes Sicherheitsbewusstsein', 'Lack of security training and awareness among employees', 'Fehlendes Sicherheitstraining und -bewusstsein bei Mitarbeitern', 530, 'active');

-- ============================================================
-- ISO 27005 Vulnerability Catalog (Anhang D)
-- ============================================================

INSERT INTO catalog (id, name, description, catalog_type, source, version, language, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-270050000002',
  'ISO/IEC 27005:2022 Schwachstellenkatalog',
  'Schwachstellenbeispiele aus ISO 27005:2022 Anhang D',
  'risk', 'iso_27005_2022_vulnerabilities', '2022', 'de', true,
  '{isms,erm}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, name_de, description, description_de, sort_order, status) VALUES
-- Technical Vulnerabilities
('c0000000-0000-0000-0000-270050000002', 'V.TEC.01', 'Unpatched software', 'Ungepatchte Software', 'Missing security updates for operating systems and applications', 'Fehlende Sicherheitsupdates für Betriebssysteme und Anwendungen', 10, 'active'),
('c0000000-0000-0000-0000-270050000002', 'V.TEC.02', 'Default credentials', 'Standard-Anmeldedaten', 'Use of factory-default or weak passwords', 'Verwendung von Werkseinstellungen oder schwachen Passwörtern', 20, 'active'),
('c0000000-0000-0000-0000-270050000002', 'V.TEC.03', 'Missing encryption', 'Fehlende Verschlüsselung', 'Unencrypted data at rest or in transit', 'Unverschlüsselte Daten im Ruhezustand oder bei Übertragung', 30, 'active'),
('c0000000-0000-0000-0000-270050000002', 'V.TEC.04', 'Insufficient logging', 'Unzureichende Protokollierung', 'Missing or inadequate security event logging and monitoring', 'Fehlende oder unzureichende Sicherheitsereignis-Protokollierung', 40, 'active'),
('c0000000-0000-0000-0000-270050000002', 'V.TEC.05', 'Insecure interfaces', 'Unsichere Schnittstellen', 'Exposed APIs or management interfaces without proper protection', 'Exponierte APIs oder Management-Schnittstellen ohne angemessenen Schutz', 50, 'active'),
('c0000000-0000-0000-0000-270050000002', 'V.TEC.06', 'Outdated protocols', 'Veraltete Protokolle', 'Use of deprecated or insecure protocols (TLS 1.0, SSLv3, etc.)', 'Verwendung veralteter oder unsicherer Protokolle (TLS 1.0, SSLv3 etc.)', 60, 'active'),
('c0000000-0000-0000-0000-270050000002', 'V.TEC.07', 'Injection vulnerabilities', 'Injection-Schwachstellen', 'SQL injection, XSS, command injection in web applications', 'SQL-Injection, XSS, Command-Injection in Webanwendungen', 70, 'active'),
('c0000000-0000-0000-0000-270050000002', 'V.TEC.08', 'Missing redundancy', 'Fehlende Redundanz', 'Single points of failure in critical infrastructure', 'Einzelne Ausfallpunkte in kritischer Infrastruktur', 80, 'active'),
('c0000000-0000-0000-0000-270050000002', 'V.TEC.09', 'Weak authentication', 'Schwache Authentifizierung', 'Missing MFA, weak password policies, or session management', 'Fehlendes MFA, schwache Passwortrichtlinien oder Session-Management', 90, 'active'),
('c0000000-0000-0000-0000-270050000002', 'V.TEC.10', 'Insufficient network segmentation', 'Unzureichende Netzwerksegmentierung', 'Flat network architecture without proper zone separation', 'Flache Netzwerkarchitektur ohne angemessene Zonentrennung', 100, 'active'),

-- Organizational Vulnerabilities
('c0000000-0000-0000-0000-270050000002', 'V.ORG.01', 'Excessive permissions', 'Überhöhte Berechtigungen', 'Users with more access rights than required for their role', 'Benutzer mit mehr Zugriffsrechten als für ihre Rolle erforderlich', 200, 'active'),
('c0000000-0000-0000-0000-270050000002', 'V.ORG.02', 'Missing security policies', 'Fehlende Sicherheitsrichtlinien', 'Absence of documented information security policies', 'Fehlen dokumentierter Informationssicherheitsrichtlinien', 210, 'active'),
('c0000000-0000-0000-0000-270050000002', 'V.ORG.03', 'Inadequate change management', 'Unzureichendes Änderungsmanagement', 'Missing or insufficient change control procedures', 'Fehlende oder unzureichende Änderungskontrollverfahren', 220, 'active'),
('c0000000-0000-0000-0000-270050000002', 'V.ORG.04', 'Lacking incident response', 'Mangelhafter Incident Response', 'No defined incident response plan or team', 'Kein definierter Incident-Response-Plan oder -Team', 230, 'active'),
('c0000000-0000-0000-0000-270050000002', 'V.ORG.05', 'Insufficient backup', 'Unzureichende Datensicherung', 'Missing, untested, or incomplete backup procedures', 'Fehlende, ungetestete oder unvollständige Backup-Verfahren', 240, 'active'),
('c0000000-0000-0000-0000-270050000002', 'V.ORG.06', 'Missing awareness training', 'Fehlendes Awareness-Training', 'No regular security awareness program for employees', 'Kein regelmäßiges Sicherheitsbewusstseinsprogramm für Mitarbeiter', 250, 'active'),
('c0000000-0000-0000-0000-270050000002', 'V.ORG.07', 'Unclear responsibilities', 'Unklare Verantwortlichkeiten', 'Missing or overlapping security role definitions', 'Fehlende oder überlappende Sicherheitsrollen-Definitionen', 260, 'active'),
('c0000000-0000-0000-0000-270050000002', 'V.ORG.08', 'No vendor management', 'Kein Lieferantenmanagement', 'Missing third-party risk assessment processes', 'Fehlende Prozesse zur Drittanbieter-Risikobewertung', 270, 'active'),

-- Physical Vulnerabilities
('c0000000-0000-0000-0000-270050000002', 'V.PHY.01', 'Insufficient physical access control', 'Unzureichende physische Zugangskontrolle', 'Missing or weak physical access controls for sensitive areas', 'Fehlende oder schwache physische Zugangskontrollen für sensible Bereiche', 300, 'active'),
('c0000000-0000-0000-0000-270050000002', 'V.PHY.02', 'Missing environmental controls', 'Fehlende Umgebungskontrollen', 'Inadequate temperature, humidity, or power protection', 'Unzureichender Temperatur-, Feuchtigkeits- oder Stromschutz', 310, 'active'),
('c0000000-0000-0000-0000-270050000002', 'V.PHY.03', 'Insecure disposal', 'Unsichere Entsorgung', 'Improper disposal of equipment or media containing data', 'Unsachgemäße Entsorgung von Geräten oder Datenträgern mit Daten', 320, 'active'),

-- Personnel Vulnerabilities
('c0000000-0000-0000-0000-270050000002', 'V.PER.01', 'Insufficient vetting', 'Unzureichende Überprüfung', 'Missing background checks for personnel in sensitive roles', 'Fehlende Hintergrundüberprüfungen für Personal in sensiblen Rollen', 400, 'active'),
('c0000000-0000-0000-0000-270050000002', 'V.PER.02', 'Key person dependency', 'Schlüsselpersonenabhängigkeit', 'Critical knowledge held by single individuals', 'Kritisches Wissen bei einzelnen Personen konzentriert', 410, 'active');

-- Done. 32 threats + 25 vulnerabilities = 57 ISO 27005 catalog entries
