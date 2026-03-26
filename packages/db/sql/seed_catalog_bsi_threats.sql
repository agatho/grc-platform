-- ============================================================================
-- ARCTOS Seed: BSI IT-Grundschutz Elementargefährdungen (G 0.1 – G 0.47)
-- Source: BSI IT-Grundschutz Kompendium, Edition 2023
-- Used by Sprint 5a: threat table pre-seeded with these entries
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active)
VALUES (
  'c0000000-0000-0000-0000-b51e1e3e47a2',
  'BSI Elementargefährdungen',
  'BSI IT-Grundschutz Kompendium — 47 Elementargefährdungen (G 0.1 bis G 0.47)',
  'risk', 'platform', 'bsi_itgs_elementar', '2023', true
) ON CONFLICT DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.1', 'Feuer', 'Brand in Gebäuden, Rechenzentren oder Serverräumen', 0, 1, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.2', 'Ungünstige klimatische Bedingungen', 'Extreme Temperaturen, Feuchtigkeit oder Staub', 0, 2, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.3', 'Wasser', 'Überschwemmung, Wassereinbruch, Leckagen', 0, 3, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.4', 'Verschmutzung, Staub, Korrosion', 'Physische Verschmutzung von IT-Systemen', 0, 4, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.5', 'Naturkatastrophen', 'Erdbeben, Sturm, Überschwemmung', 0, 5, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.6', 'Katastrophen im Umfeld', 'Industrieunfälle, Chemieunfälle in der Nachbarschaft', 0, 6, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.7', 'Großereignisse im Umfeld', 'Demonstrationen, Streiks, Terroranschläge', 0, 7, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.8', 'Ausfall oder Störung der Stromversorgung', 'Stromausfall, USV-Versagen', 0, 8, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.9', 'Ausfall oder Störung von Kommunikationsnetzen', 'Netzwerkausfall, Internetausfall, WAN-Störung', 0, 9, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.10', 'Ausfall oder Störung von Versorgungsnetzen', 'Wasser-, Gas-, Klimaanlagenausfall', 0, 10, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.11', 'Ausfall oder Störung von Dienstleistern', 'Cloud-Provider-Ausfall, Outsourcing-Partner-Ausfall', 0, 11, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.12', 'Elektromagnetische Störstrahlung', 'EMV-Probleme, Interferenzen', 0, 12, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.13', 'Abfangen kompromittierender Strahlung', 'TEMPEST, elektromagnetische Abstrahlungen', 0, 13, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.14', 'Ausspähen von Informationen / Spionage', 'Industriespionage, Social Engineering zum Informationsdiebstahl', 0, 14, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.15', 'Abhören', 'Abhören von Telefonaten, Raumgesprächen oder Datenübertragungen', 0, 15, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.16', 'Diebstahl von Geräten, Datenträgern oder Dokumenten', 'Entwendung von IT-Equipment, mobilen Geräten oder vertraulichen Unterlagen', 0, 16, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.17', 'Verlust von Geräten, Datenträgern oder Dokumenten', 'Unbeabsichtigter Verlust von IT-Equipment oder Informationsträgern', 0, 17, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.18', 'Fehlplanung oder fehlende Anpassung', 'Unzureichende Planung von IT-Systemen oder fehlende Anpassung an veränderte Anforderungen', 0, 18, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.19', 'Offenlegung schützenswerter Informationen', 'Unbeabsichtigte oder unbefugte Weitergabe vertraulicher Informationen', 0, 19, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.20', 'Informationen oder Produkte aus unzuverlässiger Quelle', 'Verwendung manipulierter oder fehlerhafter Informationen und Software', 0, 20, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.21', 'Manipulation von Hard- oder Software', 'Absichtliche Veränderung von IT-Systemen oder Programmen', 0, 21, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.22', 'Manipulation von Informationen', 'Absichtliche Verfälschung von Daten oder Dokumenten', 0, 22, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.23', 'Unbefugtes Eindringen in IT-Systeme', 'Hacking, Exploitation von Schwachstellen, unbefugter Zugriff', 0, 23, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.24', 'Zerstörung von Geräten oder Datenträgern', 'Physische Zerstörung von IT-Hardware oder Speichermedien', 0, 24, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.25', 'Ausfall von Geräten oder Systemen', 'Hardware-Defekte, Systemabstürze, technisches Versagen', 0, 25, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.26', 'Fehlfunktion von Geräten oder Systemen', 'Fehlerhafte Funktion von Hardware oder Software ohne vollständigen Ausfall', 0, 26, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.27', 'Ressourcenmangel', 'Unzureichende Personalausstattung, fehlende Kompetenzen, Budget-Mangel', 0, 27, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.28', 'Software-Schwachstellen oder -Fehler', 'Bugs, Sicherheitslücken, Design-Fehler in Software', 0, 28, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.29', 'Verstoß gegen Gesetze oder Regelungen', 'Non-Compliance mit DSGVO, NIS2, IT-Sicherheitsgesetz oder internen Richtlinien', 0, 29, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.30', 'Unberechtigte Nutzung oder Administration von Geräten und Systemen', 'Missbrauch von Admin-Rechten, Shadow-IT, unerlaubte Gerätenutzung', 0, 30, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.31', 'Fehlerhafte Nutzung oder Administration von Geräten und Systemen', 'Bedienungsfehler, Fehlkonfiguration, versehentliche Datenlöschung', 0, 31, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.32', 'Missbrauch von Berechtigungen', 'Insider-Threat: autorisierte Nutzer überschreiten ihre Befugnisse', 0, 32, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.33', 'Personalausfall', 'Abwesenheit von Schlüsselpersonal durch Krankheit, Kündigung oder Unfall', 0, 33, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.34', 'Anschlag', 'Gezielter physischer Angriff auf Gebäude, Rechenzentren oder Infrastruktur', 0, 34, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.35', 'Nötigung, Erpressung oder Korruption', 'Ransomware-Erpressung, Bestechung, Drohungen gegen Mitarbeiter', 0, 35, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.36', 'Identitätsdiebstahl', 'Übernahme fremder Identitäten für Betrug oder unbefugten Zugriff', 0, 36, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.37', 'Abstreiten von Handlungen', 'Non-Repudiation-Problem: Handlungen können nicht nachgewiesen werden', 0, 37, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.38', 'Missbrauch personenbezogener Daten', 'Zweckentfremdung, unbefugte Verarbeitung personenbezogener Daten (DSGVO-Verstoß)', 0, 38, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.39', 'Schadprogramme', 'Malware: Viren, Trojaner, Ransomware, Spyware, Rootkits, Würmer', 0, 39, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.40', 'Verhinderung von Diensten (Denial of Service)', 'DDoS-Angriffe, Ressourcenerschöpfung, Service-Überlastung', 0, 40, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.41', 'Sabotage', 'Gezielte Störung oder Zerstörung von IT-Systemen durch Insider oder Externe', 0, 41, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.42', 'Social Engineering', 'Manipulation von Menschen zur Preisgabe vertraulicher Informationen (Phishing, Pretexting, Baiting)', 0, 42, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.43', 'Einspielen von Nachrichten', 'Replay-Angriffe, Man-in-the-Middle, Session-Hijacking', 0, 43, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.44', 'Unbefugtes Eindringen in Räumlichkeiten', 'Physisches Eindringen in gesicherte Bereiche (Rechenzentrum, Serverraum)', 0, 44, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.45', 'Datenverlust', 'Unwiederbringlicher Verlust von Daten durch Löschung, Korruption oder Medienfehler', 0, 45, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.46', 'Integritätsverlust schützenswerter Informationen', 'Unbemerkte Verfälschung von Daten, die die Geschäftslogik beeinträchtigt', 0, 46, 'active'),
('c0000000-0000-0000-0000-b51e1e3e47a2', 'G 0.47', 'Schädliche Seiteneffekte IT-gestützter Angriffe', 'Kollateralschäden durch Cyberangriffe auf Dritte (Supply-Chain-Attacks)', 0, 47, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- Summary: 47 Elementargefährdungen (G 0.1 bis G 0.47)
