-- ============================================================================
-- ARCTOS Seed: EU NIS2 Directive (2022/2555) Control Catalog
-- Source: Directive (EU) 2022/2555 — Network and Information Security
-- Art. 20 Governance, Art. 21 Cybersecurity risk-management measures,
-- Art. 23 Reporting obligations, Annex I/II Entity classification
-- ~45 entries across 3 levels (Area → Measure → Detailed Requirement)
-- ============================================================================

-- Create catalog container
INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-415200000002',
  'EU NIS2 Directive (2022/2555)',
  'Directive on measures for a high common level of cybersecurity across the Union. Covers governance, risk management, incident handling, business continuity, supply chain security, and reporting obligations for essential and important entities.',
  'control', 'platform', 'eu_nis2', '2022/2555', true, '{isms,bcms,erm}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Area 1: Governance (Art. 20)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-415200000002', 'NIS2-GOV', 'Governance', 'Management body accountability and cybersecurity governance requirements (Article 20)', 0, 100, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.20.1', 'Management body approval and oversight', 'Member States shall ensure that the management bodies of essential and important entities approve the cybersecurity risk-management measures taken by those entities and oversee their implementation.', 1, 110, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.20.1-LIA', 'Management body liability', 'Members of the management bodies can be held liable for infringements of Article 21 requirements in accordance with national law.', 2, 111, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.20.2', 'Cybersecurity training for management', 'Member States shall ensure that the members of the management bodies are required to follow training and shall encourage essential and important entities to offer similar training to their employees on a regular basis.', 1, 120, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Area 2: Cybersecurity Risk-Management Measures (Art. 21)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-415200000002', 'NIS2-RMM', 'Cybersecurity Risk-Management Measures', 'Technical, operational and organisational measures to manage risks posed to the security of network and information systems (Article 21)', 0, 200, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.1', 'Appropriate and proportionate measures', 'Essential and important entities shall take appropriate and proportionate technical, operational and organisational measures to manage the risks posed to the security of network and information systems used for their operations or services, and to prevent or minimise the impact of incidents.', 1, 210, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.1-AHR', 'All-hazards approach', 'Measures shall be based on an all-hazards approach that aims to protect network and information systems and the physical environment of those systems from incidents.', 2, 211, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2a', 'Risk analysis and information system security policies', 'Entities shall implement policies on risk analysis and information system security as part of their cybersecurity risk-management measures.', 1, 220, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2a-RA', 'Risk assessment methodology', 'Establish and maintain a documented risk assessment methodology that identifies threats, vulnerabilities and impacts to network and information systems.', 2, 221, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2a-ISP', 'Information security policies', 'Develop, maintain and communicate information security policies addressing the security of network and information systems, including topic-specific policies.', 2, 222, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2b', 'Incident handling', 'Entities shall implement incident handling procedures and capabilities as part of their cybersecurity risk-management measures.', 1, 230, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2b-DET', 'Incident detection and monitoring', 'Implement mechanisms for detecting, monitoring and logging security events to enable timely identification of incidents.', 2, 231, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2b-RSP', 'Incident response procedures', 'Establish documented procedures for incident response including roles and responsibilities, communication plans, escalation procedures and post-incident review.', 2, 232, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2c', 'Business continuity and crisis management', 'Entities shall implement business continuity measures including backup management, disaster recovery and crisis management as part of their cybersecurity risk-management measures.', 1, 240, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2c-BCP', 'Business continuity planning', 'Develop and maintain business continuity plans that address the continuity of critical functions and services in the event of a cyber incident.', 2, 241, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2c-BAK', 'Backup management', 'Implement and regularly test backup strategies to ensure data and system availability can be restored in a timely manner after an incident.', 2, 242, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2c-DR', 'Disaster recovery', 'Establish and test disaster recovery procedures to restore network and information systems to normal operations after a disruptive incident.', 2, 243, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2c-CRM', 'Crisis management', 'Establish crisis management structures and procedures for coordinating response to severe cybersecurity incidents.', 2, 244, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-415200000002', 'Art.21.2d', 'Supply chain security', 'Entities shall address supply chain security including security-related aspects concerning the relationships between each entity and its direct suppliers or service providers.', 1, 250, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2d-SUP', 'Supplier security assessment', 'Assess the cybersecurity practices and vulnerabilities of direct suppliers and service providers, taking into account the overall quality and resilience of products and services.', 2, 251, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2d-CON', 'Contractual security requirements', 'Include appropriate cybersecurity requirements in contractual arrangements with direct suppliers and service providers.', 2, 252, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2e', 'Security in network and IS acquisition, development and maintenance', 'Entities shall address security in network and information systems acquisition, development and maintenance, including vulnerability handling and disclosure.', 1, 260, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2e-SDL', 'Secure development lifecycle', 'Implement security considerations throughout the acquisition, development and maintenance lifecycle of network and information systems.', 2, 261, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2e-VUL', 'Vulnerability handling and disclosure', 'Establish processes for identifying, tracking and remediating vulnerabilities in network and information systems, including coordinated vulnerability disclosure.', 2, 262, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2f', 'Policies and procedures for assessing effectiveness', 'Entities shall implement policies and procedures to assess the effectiveness of cybersecurity risk-management measures.', 1, 270, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2f-AUD', 'Security audits and testing', 'Conduct regular security audits, penetration tests and vulnerability assessments to evaluate the effectiveness of implemented measures.', 2, 271, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2f-KPI', 'Security metrics and reporting', 'Define and monitor key performance indicators and metrics to measure and report on the effectiveness of cybersecurity measures to management.', 2, 272, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2g', 'Basic cyber hygiene practices and cybersecurity training', 'Entities shall implement basic cyber hygiene practices and provide cybersecurity training to all personnel.', 1, 280, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2g-HYG', 'Cyber hygiene practices', 'Implement basic cyber hygiene practices including patch management, password policies, principle of least privilege, network segmentation and secure configurations.', 2, 281, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2g-TRN', 'Cybersecurity awareness training', 'Provide regular cybersecurity awareness training to all employees, including role-specific training for personnel with elevated access or responsibilities.', 2, 282, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2h', 'Policies and procedures on cryptography and encryption', 'Entities shall implement policies and procedures regarding the use of cryptography and, where appropriate, encryption.', 1, 290, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2h-CRY', 'Cryptographic controls', 'Define and implement cryptographic policies covering key management, algorithm selection, encryption of data at rest and in transit, and certificate management.', 2, 291, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2i', 'Human resources security, access control and asset management', 'Entities shall implement human resources security measures, access control policies and asset management processes.', 1, 300, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2i-HR', 'Human resources security', 'Implement security screening, onboarding/offboarding procedures and ongoing personnel security measures for employees with access to network and information systems.', 2, 301, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2i-AC', 'Access control policies', 'Implement access control policies based on the principle of least privilege, including role-based access, privileged access management and regular access reviews.', 2, 302, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2i-AM', 'Asset management', 'Maintain an inventory of information assets and network and information systems, classify assets by criticality and ensure appropriate protection throughout the asset lifecycle.', 2, 303, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2j', 'Multi-factor authentication, secured communications and emergency communications', 'Entities shall use multi-factor authentication or continuous authentication solutions, secured voice, video and text communications, and secured emergency communication systems where appropriate.', 1, 310, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2j-MFA', 'Multi-factor authentication', 'Implement multi-factor authentication or continuous authentication solutions for access to network and information systems, in particular for administrative and privileged accounts.', 2, 311, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2j-SEC', 'Secured communications', 'Use secured voice, video and text communications within the entity, including end-to-end encryption where appropriate.', 2, 312, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.21.2j-EMR', 'Secured emergency communications', 'Establish and maintain secured emergency communication systems to ensure communication capability during crisis situations.', 2, 313, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Area 3: Incident Reporting Obligations (Art. 23)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-415200000002', 'NIS2-RPT', 'Reporting Obligations', 'Incident notification and reporting requirements for essential and important entities (Article 23)', 0, 400, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.23.1', 'Significant incident notification', 'Each essential or important entity shall notify its CSIRT or competent authority without undue delay of any significant incident that has a significant impact on the provision of their services.', 1, 410, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.23.4a', 'Early warning (24 hours)', 'An early warning shall be submitted without undue delay and in any event within 24 hours of the entity becoming aware of the significant incident, indicating whether the incident is suspected of being caused by unlawful or malicious acts or could have a cross-border impact.', 2, 411, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.23.4b', 'Incident notification (72 hours)', 'An incident notification shall be submitted without undue delay and in any event within 72 hours of becoming aware of the significant incident, updating the early warning and providing an initial assessment of severity, impact and indicators of compromise.', 2, 412, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.23.4d', 'Final report (1 month)', 'A final report shall be submitted not later than one month after the incident notification, including a detailed description, the type of threat or root cause, mitigation measures applied, and the cross-border impact if applicable.', 2, 413, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Area 4: Entity Classification (Annex I / Annex II)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-415200000002', 'NIS2-ENT', 'Entity Classification', 'Classification of essential and important entities under Annex I (high criticality) and Annex II (other critical) sectors', 0, 500, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Annex-I', 'Sectors of high criticality', 'Essential entities in sectors of high criticality: energy, transport, banking, financial market infrastructure, health, drinking water, waste water, digital infrastructure, ICT service management (B2B), public administration, and space.', 1, 510, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Annex-II', 'Other critical sectors', 'Important entities in other critical sectors: postal and courier services, waste management, manufacture/production/distribution of chemicals, food production/processing/distribution, manufacturing (medical devices, computer/electronic/optical products, electrical equipment, machinery, motor vehicles, other transport equipment), digital providers (online marketplaces, search engines, social networking), and research.', 1, 520, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.3.1', 'Essential entities', 'Essential entities are large entities in Annex I sectors, qualified trust service providers, DNS service providers, TLD name registries, entities identified by Member States, and critical entities under Directive (EU) 2022/2557.', 2, 511, 'active'),
('c0000000-0000-0000-0000-415200000002', 'Art.3.2', 'Important entities', 'Important entities are medium-sized or larger entities in Annex I or II sectors that are not classified as essential entities.', 2, 521, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Summary: ~45 entries (4 areas + ~15 measures + ~26 detailed requirements)
-- ============================================================================
