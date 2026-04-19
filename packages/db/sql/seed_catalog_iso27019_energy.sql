-- ============================================================================
-- ARCTOS Seed: ISO/IEC 27019:2017 — ISMS for Energy Utility Industry
-- Source: ISO/IEC 27019:2017 (Information security controls for the
--         energy utility industry; sector-specific extension to ISO 27002)
--
-- Structure: Sector-specific guidance for ISO 27002 controls plus 11
-- additional energy-utility-specific controls (ENR.x).
--
-- Target modules: isms (relevant for energy/utility tenants, KRITIS, NIS2 OES)
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-270190000001',
  'ISO/IEC 27019:2017 Energy Utility',
  'Sector-specific information security controls for the energy utility industry. Extends ISO 27002 with 11 ENR controls and process-control-system guidance.',
  'control', 'platform', 'iso_27019_2017', '2017', 'en', true, '{isms,bcms}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, name_de, description, description_de, level, sort_order, status) VALUES
-- ── Energy-utility extension controls (ENR) ────────────────────────────────
('c0000000-0000-0000-0000-270190000001', 'ENR', 'Energy-utility extension controls', 'Energieversorgungs-Erweiterungs-Controls', 'Controls additional to ISO 27002 for the energy utility sector', 'Zusätzliche Controls über ISO 27002 hinaus für die Energieversorgungs-Branche', 0, 100, 'active'),
('c0000000-0000-0000-0000-270190000001', 'ENR.6.1.6', 'Identification of risks related to external parties', 'Identifikation von Risiken durch Dritte (PCS)', 'Risks related to external parties accessing process control systems shall be identified and managed.', 'Risiken durch Drittparteien mit Zugang zu Prozessleitsystemen müssen identifiziert und gemanagt werden.', 1, 110, 'active'),
('c0000000-0000-0000-0000-270190000001', 'ENR.6.1.7', 'Identification of risks related to non-utility users', 'Identifikation von Risiken durch Nicht-EVU-Nutzer', 'Risks from access by users not directly employed by the utility shall be identified and treated.', 'Risiken durch Zugang von Nutzern, die nicht direkt beim EVU angestellt sind, müssen identifiziert und behandelt werden.', 1, 120, 'active'),
('c0000000-0000-0000-0000-270190000001', 'ENR.7.1.4', 'Equipment in non-controlled areas', 'Betriebsmittel in nicht überwachten Bereichen', 'Equipment located in geographically distributed and non-controlled areas (e.g., substations, field devices) shall be specifically protected.', 'Betriebsmittel in geografisch verteilten und nicht überwachten Bereichen (z. B. Umspannwerke, Feldgeräte) müssen besonders geschützt werden.', 1, 130, 'active'),
('c0000000-0000-0000-0000-270190000001', 'ENR.7.2.4', 'Securing communication networks', 'Sicherung von Kommunikationsnetzen', 'Communication networks used for process control (SCADA, telecontrol, IEC 60870/61850) shall be specifically secured.', 'Kommunikationsnetze für Prozessleittechnik (SCADA, Fernwirken, IEC 60870/61850) müssen besonders gesichert werden.', 1, 140, 'active'),
('c0000000-0000-0000-0000-270190000001', 'ENR.10.1.1', 'Cryptographic controls in process control', 'Kryptographische Maßnahmen in der Prozessleittechnik', 'Cryptographic controls shall consider real-time, performance and legacy-protocol constraints in process control systems.', 'Kryptographische Maßnahmen müssen Echtzeit-, Performance- und Legacy-Protokoll-Anforderungen in Prozessleitsystemen berücksichtigen.', 1, 150, 'active'),
('c0000000-0000-0000-0000-270190000001', 'ENR.11.2.4', 'Maintenance of equipment in geographically distributed areas', 'Wartung verteilter Betriebsmittel', 'Maintenance of process-control equipment in remote/geographically distributed areas shall include security checks.', 'Wartung von Prozessleittechnik-Geräten in entfernten/verteilten Bereichen muss Sicherheitsprüfungen einschließen.', 1, 160, 'active'),
('c0000000-0000-0000-0000-270190000001', 'ENR.12.1.5', 'Recovery procedures for process control', 'Wiederherstellungsverfahren für Prozessleittechnik', 'Recovery procedures shall consider operational continuity of process control and protective relaying.', 'Wiederherstellungsverfahren müssen die operative Kontinuität der Prozessleittechnik und des Schutzsystems berücksichtigen.', 1, 170, 'active'),
('c0000000-0000-0000-0000-270190000001', 'ENR.12.6.3', 'Software installation in process control systems', 'Software-Installation in Prozessleitsystemen', 'Installation of software in process control environments shall follow vendor-validated change windows.', 'Software-Installationen in Prozessleitsystemen müssen herstellerseitig validierten Änderungsfenstern folgen.', 1, 180, 'active'),
('c0000000-0000-0000-0000-270190000001', 'ENR.13.2.5', 'Security of communications between control centres', 'Sicherheit der Leitstellen-Kommunikation', 'Communication links between control centres (e.g., grid operators) shall be secured (mutual TLS, IPsec, dedicated links).', 'Kommunikationsverbindungen zwischen Leitstellen müssen gesichert werden (mTLS, IPsec, dedizierte Leitungen).', 1, 190, 'active'),
('c0000000-0000-0000-0000-270190000001', 'ENR.16.1.3', 'Reporting of weak points in process control', 'Meldung von Schwachstellen in Prozessleittechnik', 'Procedures for reporting weak points in process control systems shall be established (incl. CERT-Bund/E-ISAC).', 'Verfahren zur Meldung von Schwachstellen in Prozessleittechnik müssen etabliert werden (inkl. CERT-Bund/E-ISAC).', 1, 200, 'active'),
('c0000000-0000-0000-0000-270190000001', 'ENR.17.2.2', 'Continuity of process control', 'Kontinuität der Prozessleittechnik', 'Business-continuity arrangements shall ensure the continuity of essential process control functions including black-start capability.', 'Geschäftskontinuitäts-Arrangements müssen die Kontinuität wesentlicher Prozessleitfunktionen sicherstellen, inkl. Schwarzstart-Fähigkeit.', 1, 210, 'active'),

-- ── Sector-specific implementation guidance ────────────────────────────────
('c0000000-0000-0000-0000-270190000001', 'EUI-IG', 'Sector-specific implementation guidance', 'Branchenspezifische Implementierungshinweise', 'Selected ISO 27002 controls with energy-utility-specific guidance', 'Ausgewählte ISO 27002 Controls mit branchenspezifischen Hinweisen', 0, 300, 'active'),
('c0000000-0000-0000-0000-270190000001', 'EUI.A.5.1', 'Information security policy (energy)', 'IS-Richtlinie (Energiesektor)', 'IS-Policy must explicitly cover process control systems, smart grid components and KRITIS obligations.', 'IS-Richtlinie muss Prozessleittechnik, Smart-Grid-Komponenten und KRITIS-Pflichten explizit abdecken.', 1, 310, 'active'),
('c0000000-0000-0000-0000-270190000001', 'EUI.A.6.1', 'Roles for OT security', 'Rollen für OT-Sicherheit', 'Distinct roles for IT-Security and OT-Security shall be assigned with clear coordination.', 'Eigenständige Rollen für IT-Sicherheit und OT-Sicherheit müssen mit klarer Koordination zugewiesen werden.', 1, 320, 'active'),
('c0000000-0000-0000-0000-270190000001', 'EUI.A.8.1', 'Inventory of OT assets', 'Inventar OT-Assets', 'OT/PCS asset inventory shall include vendor, firmware version, network zone and safety classification.', 'OT/PCS-Asset-Inventar muss Hersteller, Firmware-Version, Netzwerkzone und Sicherheitsklassifizierung umfassen.', 1, 330, 'active'),
('c0000000-0000-0000-0000-270190000001', 'EUI.A.13.1', 'Network segmentation for OT', 'Netzwerksegmentierung OT', 'Strict zone-based segmentation between IT-Office, OT-Process, Safety and Field-Bus networks (Purdue model levels 0–4).', 'Strikte zonenbasierte Segmentierung zwischen IT-Office, OT-Prozess, Sicherheits- und Feldbus-Netzwerken (Purdue-Modell Ebenen 0–4).', 1, 340, 'active'),
('c0000000-0000-0000-0000-270190000001', 'EUI.A.14.2', 'Secure development for OT', 'Sichere Entwicklung für OT', 'OT-application development shall consider safety functions and shall not introduce regressions to protective relaying logic.', 'OT-Anwendungsentwicklung muss Sicherheitsfunktionen berücksichtigen und darf keine Regressionen bei Schutzlogik einführen.', 1, 350, 'active'),
('c0000000-0000-0000-0000-270190000001', 'EUI.A.16.1', 'Incident management for OT', 'Incident-Management für OT', 'Incident-handling procedures for OT shall include immediate consideration of grid-stability impact and BNetzA notification.', 'Incident-Handling-Verfahren für OT müssen unmittelbare Bewertung der Netzstabilitäts-Auswirkungen und BNetzA-Meldung einschließen.', 1, 360, 'active'),
('c0000000-0000-0000-0000-270190000001', 'EUI.A.17.1', 'BCM for energy utility', 'BCM für Energieversorgung', 'BCM scenarios shall include grid blackout, cascading failures, ransomware on SCADA and physical attack on substations.', 'BCM-Szenarien müssen Netz-Blackout, kaskadierende Ausfälle, Ransomware auf SCADA und physische Angriffe auf Umspannwerke einschließen.', 1, 370, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- Done. 11 ENR + 7 EUI guidance items = 18 ISO 27019 entries
