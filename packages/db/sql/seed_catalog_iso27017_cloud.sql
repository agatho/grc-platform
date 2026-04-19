-- ============================================================================
-- ARCTOS Seed: ISO/IEC 27017:2015 — Cloud Security Controls
-- Source: ISO/IEC 27017:2015 (Code of practice for information security
--         controls based on ISO/IEC 27002 for cloud services)
--
-- Structure: Controls are either (a) implementation guidance for existing
-- ISO 27002 controls in cloud context, or (b) cloud-specific extension
-- controls (CLD.x). This seed includes the 7 cloud-specific extension
-- controls plus the most important cloud implementation guidance items.
--
-- Target modules: isms (cloud connector workloads, SaaS metering)
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-270170000001',
  'ISO/IEC 27017:2015 Cloud Security',
  'Code of practice for information security controls based on ISO/IEC 27002 for cloud services. Includes 7 cloud-specific extension controls (CLD) plus cloud implementation guidance for ISO 27002 controls.',
  'control', 'platform', 'iso_27017_2015', '2015', 'en', true, '{isms,ics,tprm}'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Cloud Extension Controls (CLD.x) — unique to ISO 27017
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, name_de, description, description_de, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-270170000001', 'CLD', 'Cloud-spezifische Erweiterungs-Controls', 'Cloud-specific Extension Controls', 'Controls unique to ISO 27017, additional to ISO 27002', 'Controls die zusätzlich zu ISO 27002 nur in ISO 27017 enthalten sind', 0, 100, 'active'),
('c0000000-0000-0000-0000-270170000001', 'CLD.6.3.1', 'Shared roles and responsibilities within cloud computing environment', 'Geteilte Rollen und Verantwortlichkeiten in der Cloud', 'Cloud customer and cloud service provider should agree on the allocation of information security roles and responsibilities and document them.', 'Cloud-Kunde und Cloud-Service-Provider müssen die Zuweisung von Informationssicherheitsrollen und -verantwortlichkeiten vereinbaren und dokumentieren.', 1, 110, 'active'),
('c0000000-0000-0000-0000-270170000001', 'CLD.8.1.5', 'Removal of cloud service customer assets', 'Entfernung von Cloud-Kunden-Assets', 'Assets of the cloud service customer that are on the premises of the cloud service provider shall be removed and returned in a timely manner upon termination.', 'Assets des Cloud-Service-Kunden, die sich beim Cloud-Provider befinden, müssen bei Vertragsende zeitnah entfernt und zurückgegeben werden.', 1, 120, 'active'),
('c0000000-0000-0000-0000-270170000001', 'CLD.9.5.1', 'Segregation in virtual computing environments', 'Trennung in virtuellen Rechenumgebungen', 'A cloud service customer''s virtual environment running on a cloud service shall be protected from other cloud service customers and unauthorized persons.', 'Die virtuelle Umgebung eines Cloud-Service-Kunden muss von anderen Kunden und unbefugten Personen geschützt werden.', 1, 130, 'active'),
('c0000000-0000-0000-0000-270170000001', 'CLD.9.5.2', 'Virtual machine hardening', 'Härtung virtueller Maschinen', 'Virtual machines in a cloud computing environment shall be hardened to meet business needs.', 'Virtuelle Maschinen in einer Cloud-Computing-Umgebung müssen entsprechend den geschäftlichen Anforderungen gehärtet werden.', 1, 140, 'active'),
('c0000000-0000-0000-0000-270170000001', 'CLD.12.1.5', 'Administrator''s operational security', 'Operative Sicherheit für Administratoren', 'Procedures for administrative operations of a cloud computing environment shall be defined, documented and monitored.', 'Verfahren für administrative Tätigkeiten in einer Cloud-Computing-Umgebung müssen definiert, dokumentiert und überwacht werden.', 1, 150, 'active'),
('c0000000-0000-0000-0000-270170000001', 'CLD.12.4.5', 'Monitoring of cloud services', 'Überwachung von Cloud-Diensten', 'The cloud service customer shall have the capability to monitor specified aspects of the operation of the cloud services that the customer uses.', 'Der Cloud-Service-Kunde muss in der Lage sein, bestimmte Aspekte des Betriebs der genutzten Cloud-Dienste zu überwachen.', 1, 160, 'active'),
('c0000000-0000-0000-0000-270170000001', 'CLD.13.1.4', 'Alignment of security management for virtual and physical networks', 'Abstimmung Sicherheitsmanagement virtueller und physischer Netzwerke', 'Upon configuration of virtual networks, consistency of configurations between virtual and physical networks shall be verified based on the cloud service provider''s network security policy.', 'Bei der Konfiguration virtueller Netzwerke muss die Konsistenz zwischen virtueller und physischer Netzwerkkonfiguration überprüft werden.', 1, 170, 'active'),

-- ============================================================================
-- Cloud Implementation Guidance for selected ISO 27002 controls
-- (Only the most cloud-relevant controls included; full ISO 27002 reference)
-- ============================================================================
('c0000000-0000-0000-0000-270170000001', 'CLD-IG', 'Cloud-Implementierungsleitfaden zu ISO 27002', 'Cloud Implementation Guidance for ISO 27002', 'Cloud-specific implementation guidance for ISO 27002 controls', 'Cloud-spezifische Umsetzungshinweise zu ISO 27002 Controls', 0, 200, 'active'),
('c0000000-0000-0000-0000-270170000001', '5.1.1-CLD', 'Policies for information security (cloud context)', 'IS-Richtlinien (Cloud-Kontext)', 'Cloud customer policies should include cloud usage; cloud provider policies should address shared responsibility models.', 'Cloud-Kunden-Richtlinien müssen Cloud-Nutzung adressieren; Cloud-Provider-Richtlinien müssen Shared-Responsibility-Modelle berücksichtigen.', 1, 210, 'active'),
('c0000000-0000-0000-0000-270170000001', '6.1.1-CLD', 'Information security roles in cloud', 'IS-Rollen in der Cloud', 'Roles must reflect cloud customer/provider split; the responsibility matrix shall be documented.', 'Rollen müssen die Cloud-Kunden/Provider-Trennung widerspiegeln; eine Verantwortungsmatrix ist zu dokumentieren.', 1, 220, 'active'),
('c0000000-0000-0000-0000-270170000001', '8.1.1-CLD', 'Inventory of cloud assets', 'Inventar von Cloud-Assets', 'Cloud customer shall maintain an inventory of cloud services used and assets stored therein.', 'Der Cloud-Kunde muss ein Inventar genutzter Cloud-Dienste und der dort gespeicherten Assets pflegen.', 1, 230, 'active'),
('c0000000-0000-0000-0000-270170000001', '8.2.2-CLD', 'Labeling of information in the cloud', 'Kennzeichnung von Informationen in der Cloud', 'Information classification labels must remain valid in cloud storage and transmission.', 'Klassifizierungslabels müssen auch in Cloud-Speicherung und -Übertragung erhalten bleiben.', 1, 240, 'active'),
('c0000000-0000-0000-0000-270170000001', '9.2.1-CLD', 'User registration in cloud services', 'Benutzerregistrierung in Cloud-Diensten', 'User lifecycle (joiner-mover-leaver) for cloud services must be coordinated with on-prem identity systems.', 'Benutzer-Lifecycle (joiner-mover-leaver) für Cloud-Dienste muss mit On-Prem-Identity-Systemen koordiniert werden.', 1, 250, 'active'),
('c0000000-0000-0000-0000-270170000001', '9.4.1-CLD', 'Information access restriction (cloud context)', 'Zugriffsbeschränkung Informationen (Cloud-Kontext)', 'Cloud-customer access controls must be reviewed periodically against the cloud-provider IAM.', 'Cloud-Kunden-Zugriffskontrollen müssen regelmäßig gegen das Provider-IAM abgeglichen werden.', 1, 260, 'active'),
('c0000000-0000-0000-0000-270170000001', '10.1.1-CLD', 'Cryptographic controls in the cloud', 'Kryptographische Maßnahmen in der Cloud', 'Customer-managed keys (BYOK/HYOK) where regulatory requirements demand control of encryption keys.', 'Kundenseitig verwaltete Schlüssel (BYOK/HYOK) bei regulatorischen Anforderungen an Schlüsselkontrolle.', 1, 270, 'active'),
('c0000000-0000-0000-0000-270170000001', '12.1.2-CLD', 'Change management of cloud services', 'Änderungsmanagement Cloud-Dienste', 'Cloud provider changes that affect customer security posture must be communicated and assessed.', 'Provider-Änderungen mit Auswirkung auf die Kunden-Sicherheitslage müssen kommuniziert und bewertet werden.', 1, 280, 'active'),
('c0000000-0000-0000-0000-270170000001', '12.4.1-CLD', 'Event logging in the cloud', 'Ereignisprotokollierung in der Cloud', 'Cloud customer shall configure logging in line with internal monitoring; cloud provider shall provide audit logs.', 'Der Cloud-Kunde muss Logging im Einklang mit internem Monitoring konfigurieren; der Provider muss Audit-Logs bereitstellen.', 1, 290, 'active'),
('c0000000-0000-0000-0000-270170000001', '13.1.1-CLD', 'Network security in cloud', 'Netzwerksicherheit Cloud', 'Network segmentation between tenants and security groups/NACLs must be configured by the customer.', 'Netzwerk-Segmentierung zwischen Mandanten sowie Security-Groups/NACLs müssen vom Kunden konfiguriert werden.', 1, 300, 'active'),
('c0000000-0000-0000-0000-270170000001', '14.1.1-CLD', 'Information security in cloud development', 'IS in Cloud-Entwicklung', 'Cloud-native applications must include IaC security review and supply-chain controls.', 'Cloud-native Anwendungen müssen IaC-Security-Review und Supply-Chain-Kontrollen beinhalten.', 1, 310, 'active'),
('c0000000-0000-0000-0000-270170000001', '15.1.1-CLD', 'Information security in supplier relationships (cloud)', 'IS in Lieferantenbeziehungen (Cloud)', 'Cloud-provider DDQ, SOC 2 reports, ISO 27001 certificates and exit clauses must be obtained and reviewed.', 'Cloud-Provider DDQ, SOC-2-Reports, ISO 27001-Zertifikate und Exit-Klauseln müssen eingeholt und überprüft werden.', 1, 320, 'active'),
('c0000000-0000-0000-0000-270170000001', '16.1.7-CLD', 'Collection of evidence (cloud)', 'Beweissicherung (Cloud)', 'Forensic evidence in shared cloud environments requires defined chain-of-custody with the provider.', 'Forensische Beweissicherung in geteilten Cloud-Umgebungen erfordert definierte Chain-of-Custody mit dem Provider.', 1, 330, 'active'),
('c0000000-0000-0000-0000-270170000001', '17.1.1-CLD', 'Continuity in cloud services', 'Kontinuität von Cloud-Diensten', 'BC/DR scenarios must include cloud-provider failure, regional outage and exit-on-demand.', 'BC/DR-Szenarien müssen Cloud-Provider-Ausfall, Regional-Outage und Exit-on-Demand abdecken.', 1, 340, 'active'),
('c0000000-0000-0000-0000-270170000001', '18.1.1-CLD', 'Identification of legal requirements in the cloud', 'Identifikation rechtlicher Anforderungen Cloud', 'Data residency, applicable law and export controls (incl. CLOUD Act) must be assessed per cloud region.', 'Daten-Residenz, anwendbares Recht und Exportkontrollen (inkl. CLOUD Act) müssen pro Cloud-Region bewertet werden.', 1, 350, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- Done. 7 CLD extension controls + 16 cloud implementation guidance items = 23 entries
