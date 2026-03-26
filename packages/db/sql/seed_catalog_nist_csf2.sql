-- ============================================================================
-- ARCTOS Seed: NIST Cybersecurity Framework 2.0
-- Source: NIST CSF 2.0 (February 2024)
-- 6 Functions → 22 Categories → 106 Subcategories
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active)
VALUES (
  'c0000000-0000-0000-0000-415cf5f20000',
  'NIST Cybersecurity Framework 2.0',
  'NIST CSF 2.0 — 6 Functions, 22 Categories, 106 Subcategories for managing cybersecurity risk.',
  'control', 'platform', 'nist_csf_2', '2.0', true
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Level 0: Functions
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-415cf5f20000', 'GV', 'GOVERN', 'Establish and monitor the organizations cybersecurity risk management strategy, expectations, and policy.', 0, 100, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID', 'IDENTIFY', 'Understand the organizations current cybersecurity risk posture to prioritize efforts.', 0, 200, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR', 'PROTECT', 'Use safeguards to manage the organizations cybersecurity risks.', 0, 300, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'DE', 'DETECT', 'Find and analyze possible cybersecurity attacks and compromises.', 0, 400, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RS', 'RESPOND', 'Take action regarding a detected cybersecurity incident.', 0, 500, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RC', 'RECOVER', 'Restore assets and operations affected by a cybersecurity incident.', 0, 600, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Level 1: Categories + Level 2: Subcategories — GOVERN (GV)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
-- GV Categories
('c0000000-0000-0000-0000-415cf5f20000', 'GV.OC', 'Organizational Context', 'The circumstances surrounding the organizations cybersecurity risk management decisions are understood.', 1, 110, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.RM', 'Risk Management Strategy', 'The organizations priorities, constraints, risk tolerance, and appetites are established and communicated.', 1, 120, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.RR', 'Roles, Responsibilities, and Authorities', 'Cybersecurity roles, responsibilities, and authorities are established and communicated.', 1, 130, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.PO', 'Policy', 'Organizational cybersecurity policy is established, communicated, and enforced.', 1, 140, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.OV', 'Oversight', 'Results of organization-wide cybersecurity risk management activities and performance are used to inform and adjust strategy.', 1, 150, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.SC', 'Cybersecurity Supply Chain Risk Management', 'Cyber supply chain risk management processes are identified, established, managed, monitored, and improved.', 1, 160, 'active'),
-- GV Subcategories
('c0000000-0000-0000-0000-415cf5f20000', 'GV.OC-01', 'The organizational mission is understood and informs cybersecurity risk management', '', 2, 111, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.OC-02', 'Internal and external stakeholders are understood, and their needs and expectations regarding cybersecurity risk management are understood and considered', '', 2, 112, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.OC-03', 'Legal, regulatory, and contractual requirements regarding cybersecurity are understood and managed', '', 2, 113, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.OC-04', 'Critical objectives, capabilities, and services that stakeholders depend on are understood and communicated', '', 2, 114, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.OC-05', 'Outcomes, capabilities, and services that the organization depends on are understood and communicated', '', 2, 115, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.RM-01', 'Risk management objectives are established and agreed to by organizational stakeholders', '', 2, 121, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.RM-02', 'Risk appetite and risk tolerance statements are established, communicated, and maintained', '', 2, 122, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.RM-03', 'Cybersecurity risk management activities and outcomes are included in enterprise risk management processes', '', 2, 123, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.RM-04', 'Strategic direction that describes appropriate risk response options is established and communicated', '', 2, 124, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.RR-01', 'Organizational leadership is responsible and accountable for cybersecurity risk', '', 2, 131, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.RR-02', 'Roles, responsibilities, and authorities related to cybersecurity risk management are established and communicated', '', 2, 132, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.RR-03', 'Adequate resources are allocated commensurate with the cybersecurity risk strategy, roles and responsibilities, and policies', '', 2, 133, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.RR-04', 'Cybersecurity is included in human resources practices', '', 2, 134, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.PO-01', 'Policy for managing cybersecurity risks is established based on organizational context, cybersecurity strategy, and priorities', '', 2, 141, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.PO-02', 'Policy for managing cybersecurity risks is reviewed, updated, communicated, and enforced', '', 2, 142, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.OV-01', 'Cybersecurity risk management strategy outcomes are reviewed to inform and adjust strategy and direction', '', 2, 151, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.OV-02', 'The cybersecurity risk management strategy is reviewed and adjusted to ensure coverage of organizational requirements and risks', '', 2, 152, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.OV-03', 'Organizational cybersecurity risk management performance is evaluated and reviewed for adjustments needed', '', 2, 153, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- GV Supply Chain subcategories
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-415cf5f20000', 'GV.SC-01', 'A cybersecurity supply chain risk management program is established', '', 2, 161, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.SC-02', 'Cybersecurity roles and responsibilities for suppliers, customers, and partners are established', '', 2, 162, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.SC-03', 'Cybersecurity supply chain risk management is integrated into cybersecurity and enterprise risk management', '', 2, 163, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.SC-04', 'Suppliers are known and prioritized by criticality', '', 2, 164, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.SC-05', 'Requirements to address cybersecurity risks in supply chains are established and communicated to suppliers', '', 2, 165, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.SC-06', 'Planning and due diligence are performed to reduce risks before entering into supplier relationships', '', 2, 166, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.SC-07', 'The risks posed by a supplier, their products and services, and other third parties are understood, recorded, prioritized, assessed, responded to, and monitored', '', 2, 167, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.SC-08', 'Relevant suppliers and other third parties are included in incident planning, response, and recovery activities', '', 2, 168, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.SC-09', 'Supply chain security practices are integrated into cybersecurity and enterprise risk management programs', '', 2, 169, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'GV.SC-10', 'Cybersecurity supply chain risk management plans include provisions for activities that occur after the conclusion of a partnership or service agreement', '', 2, 170, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Level 1+2: IDENTIFY (ID)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-415cf5f20000', 'ID.AM', 'Asset Management', 'Assets that enable the organization to achieve business purposes are identified and managed.', 1, 210, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.RA', 'Risk Assessment', 'The cybersecurity risk to the organization, assets, and individuals is understood.', 1, 220, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.IM', 'Improvement', 'Improvements to organizational cybersecurity risk management processes, procedures and activities are identified.', 1, 230, 'active'),
-- ID.AM subcategories
('c0000000-0000-0000-0000-415cf5f20000', 'ID.AM-01', 'Inventories of hardware managed by the organization are maintained', '', 2, 211, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.AM-02', 'Inventories of software, services, and systems managed by the organization are maintained', '', 2, 212, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.AM-03', 'Representations of the organizations authorized network communication and internal and external network data flows are maintained', '', 2, 213, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.AM-04', 'Inventories of services provided by suppliers are maintained', '', 2, 214, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.AM-05', 'Assets are prioritized based on classification, criticality, resources, and impact on the mission', '', 2, 215, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.AM-07', 'Inventories of data and corresponding metadata for designated data types are maintained', '', 2, 217, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.AM-08', 'Systems, hardware, software, services, and data are managed throughout their life cycles', '', 2, 218, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ID.RA subcategories
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-415cf5f20000', 'ID.RA-01', 'Vulnerabilities in assets are identified, validated, and recorded', '', 2, 221, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.RA-02', 'Cyber threat intelligence is received from information sharing forums and sources', '', 2, 222, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.RA-03', 'Internal and external threats to the organization are identified and recorded', '', 2, 223, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.RA-04', 'Potential impacts and likelihoods of threats exploiting vulnerabilities are identified and recorded', '', 2, 224, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.RA-05', 'Threats, vulnerabilities, likelihoods, and impacts are used to understand inherent risk and inform risk response prioritization', '', 2, 225, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.RA-06', 'Risk responses are chosen, prioritized, planned, tracked, and communicated', '', 2, 226, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.RA-07', 'Changes and exceptions are managed, assessed for risk impact, recorded, and tracked', '', 2, 227, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.RA-08', 'Processes for receiving, analyzing, and responding to vulnerability disclosures are established', '', 2, 228, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.RA-09', 'The authenticity and integrity of hardware and software are assessed prior to acquisition and use', '', 2, 229, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.RA-10', 'Critical suppliers are assessed prior to acquisition', '', 2, 230, 'active'),
-- ID.IM subcategories
('c0000000-0000-0000-0000-415cf5f20000', 'ID.IM-01', 'Improvements are identified from evaluations', '', 2, 231, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.IM-02', 'Improvements are identified from security tests and exercises, including those done in coordination with suppliers and relevant third parties', '', 2, 232, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.IM-03', 'Improvements are identified from execution of operational processes, procedures, and activities', '', 2, 233, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'ID.IM-04', 'Incident response plans and other cybersecurity plans that affect operations are established, communicated, maintained, and improved', '', 2, 234, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Level 1+2: PROTECT (PR)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-415cf5f20000', 'PR.AA', 'Identity Management, Authentication, and Access Control', 'Access to physical and logical assets is limited to authorized users, services, and hardware.', 1, 310, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.AT', 'Awareness and Training', 'The organizations personnel are provided cybersecurity awareness and training.', 1, 320, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.DS', 'Data Security', 'Data are managed consistent with the organizations risk strategy to protect CIA.', 1, 330, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.PS', 'Platform Security', 'The hardware, software, and services of physical and virtual platforms are managed consistent with the organizations risk strategy.', 1, 340, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.IR', 'Technology Infrastructure Resilience', 'Security architectures are managed with the organizations risk strategy to protect CIA and availability.', 1, 350, 'active'),
-- PR.AA subcategories
('c0000000-0000-0000-0000-415cf5f20000', 'PR.AA-01', 'Identities and credentials for authorized users, services, and hardware are managed by the organization', '', 2, 311, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.AA-02', 'Identities are proofed and bound to credentials based on the context of interactions', '', 2, 312, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.AA-03', 'Users, services, and hardware are authenticated', '', 2, 313, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.AA-04', 'Identity assertions are protected, conveyed, and verified', '', 2, 314, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.AA-05', 'Access permissions, entitlements, and authorizations are defined in a policy, managed, enforced, and reviewed', '', 2, 315, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.AA-06', 'Physical access to assets is managed, monitored, and enforced commensurate with risk', '', 2, 316, 'active'),
-- PR.AT subcategories
('c0000000-0000-0000-0000-415cf5f20000', 'PR.AT-01', 'Personnel are provided with awareness and training so that they possess the knowledge and skills to perform general tasks with cybersecurity risks in mind', '', 2, 321, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.AT-02', 'Individuals in specialized roles are provided with awareness and training so that they possess the knowledge and skills to perform relevant tasks with cybersecurity risks in mind', '', 2, 322, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- PR.DS subcategories
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-415cf5f20000', 'PR.DS-01', 'The confidentiality, integrity, and availability of data-at-rest are protected', '', 2, 331, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.DS-02', 'The confidentiality, integrity, and availability of data-in-transit are protected', '', 2, 332, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.DS-10', 'The confidentiality, integrity, and availability of data-in-use are protected', '', 2, 333, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.DS-11', 'Backups of data are created, protected, maintained, and tested', '', 2, 334, 'active'),
-- PR.PS subcategories
('c0000000-0000-0000-0000-415cf5f20000', 'PR.PS-01', 'Configuration management practices are established and applied', '', 2, 341, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.PS-02', 'Software is maintained, replaced, and removed commensurate with risk', '', 2, 342, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.PS-03', 'Hardware is maintained, replaced, and removed commensurate with risk', '', 2, 343, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.PS-04', 'Log records are generated and made available for continuous monitoring', '', 2, 344, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.PS-05', 'Installation and execution of unauthorized software is prevented', '', 2, 345, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.PS-06', 'Secure software development practices are integrated, and their performance is monitored throughout the software development life cycle', '', 2, 346, 'active'),
-- PR.IR subcategories
('c0000000-0000-0000-0000-415cf5f20000', 'PR.IR-01', 'Networks and environments are protected from unauthorized logical access and usage', '', 2, 351, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.IR-02', 'The organizations technology assets are protected from environmental threats', '', 2, 352, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.IR-03', 'Mechanisms are implemented to achieve resilience requirements in normal and adverse situations', '', 2, 353, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'PR.IR-04', 'Adequate resource capacity to ensure availability is maintained', '', 2, 354, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Level 1+2: DETECT (DE)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-415cf5f20000', 'DE.CM', 'Continuous Monitoring', 'Assets are monitored to find anomalies, indicators of compromise, and other potentially adverse events.', 1, 410, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'DE.AE', 'Adverse Event Analysis', 'Anomalies, indicators of compromise, and other potentially adverse events are analyzed to characterize the events and detect cybersecurity incidents.', 1, 420, 'active'),
-- DE.CM subcategories
('c0000000-0000-0000-0000-415cf5f20000', 'DE.CM-01', 'Networks and network services are monitored to find potentially adverse events', '', 2, 411, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'DE.CM-02', 'The physical environment is monitored to find potentially adverse events', '', 2, 412, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'DE.CM-03', 'Personnel activity and technology usage are monitored to find potentially adverse events', '', 2, 413, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'DE.CM-06', 'External service provider activities and services are monitored to find potentially adverse events', '', 2, 416, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'DE.CM-09', 'Computing hardware and software, runtime environments, and their data are monitored to find potentially adverse events', '', 2, 419, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- DE.AE subcategories
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-415cf5f20000', 'DE.AE-02', 'Potentially adverse events are analyzed to better understand associated activities', '', 2, 422, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'DE.AE-03', 'Information is correlated from multiple sources', '', 2, 423, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'DE.AE-04', 'The estimated impact and scope of adverse events are understood', '', 2, 424, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'DE.AE-06', 'Information on adverse events is provided to authorized staff and tools', '', 2, 426, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'DE.AE-07', 'Cyber threat intelligence and other contextual information are integrated into the analysis', '', 2, 427, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'DE.AE-08', 'Incidents are declared when adverse events meet the defined incident criteria', '', 2, 428, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Level 1+2: RESPOND (RS)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-415cf5f20000', 'RS.MA', 'Incident Management', 'Responses to detected cybersecurity incidents are managed.', 1, 510, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RS.AN', 'Incident Analysis', 'Investigations are conducted to ensure effective response and support forensics and recovery activities.', 1, 520, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RS.CO', 'Incident Response Reporting and Communication', 'Response activities are coordinated with internal and external stakeholders.', 1, 530, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RS.MI', 'Incident Mitigation', 'Activities are performed to prevent expansion of an event and mitigate its effects.', 1, 540, 'active'),
-- RS.MA subcategories
('c0000000-0000-0000-0000-415cf5f20000', 'RS.MA-01', 'The incident response plan is executed in coordination with relevant third parties once an incident is declared', '', 2, 511, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RS.MA-02', 'Incident reports are triaged and validated', '', 2, 512, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RS.MA-03', 'Incidents are categorized and prioritized', '', 2, 513, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RS.MA-04', 'Incidents are escalated or elevated as needed', '', 2, 514, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RS.MA-05', 'The criteria for initiating incident recovery are applied', '', 2, 515, 'active'),
-- RS.AN subcategories
('c0000000-0000-0000-0000-415cf5f20000', 'RS.AN-03', 'Analysis is performed to establish what has taken place during an incident and the root cause of the incident', '', 2, 523, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RS.AN-06', 'Actions performed during an investigation are recorded, and the records integrity and provenance are preserved', '', 2, 526, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RS.AN-07', 'Incident data and metadata are collected, and their integrity and provenance are preserved', '', 2, 527, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RS.AN-08', 'An incidents magnitude is estimated and validated', '', 2, 528, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- RS.CO subcategories
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-415cf5f20000', 'RS.CO-02', 'Internal and external stakeholders are notified of incidents', '', 2, 532, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RS.CO-03', 'Information is shared with designated internal and external stakeholders', '', 2, 533, 'active'),
-- RS.MI subcategories
('c0000000-0000-0000-0000-415cf5f20000', 'RS.MI-01', 'Incidents are contained', '', 2, 541, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RS.MI-02', 'Incidents are eradicated', '', 2, 542, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Level 1+2: RECOVER (RC)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-415cf5f20000', 'RC.RP', 'Incident Recovery Plan Execution', 'Restoration activities are performed to ensure operational availability of systems and services affected by cybersecurity incidents.', 1, 610, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RC.CO', 'Incident Recovery Communication', 'Restoration activities are coordinated with internal and external parties.', 1, 620, 'active'),
-- RC.RP subcategories
('c0000000-0000-0000-0000-415cf5f20000', 'RC.RP-01', 'The recovery portion of the incident response plan is executed once initiated from the incident response process', '', 2, 611, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RC.RP-02', 'Recovery actions are selected, scoped, prioritized, and performed', '', 2, 612, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RC.RP-03', 'The integrity of backups and other restoration assets is verified before using them for restoration', '', 2, 613, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RC.RP-04', 'Critical mission functions and cybersecurity risk management are considered to establish post-incident operational norms', '', 2, 614, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RC.RP-05', 'The integrity of restored assets is verified, systems and services are restored, and normal operating status is confirmed', '', 2, 615, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RC.RP-06', 'The end of incident recovery is declared based on criteria, and incident-related documentation is completed', '', 2, 616, 'active'),
-- RC.CO subcategories
('c0000000-0000-0000-0000-415cf5f20000', 'RC.CO-03', 'Recovery activities and progress in restoring operational capabilities are communicated to designated internal and external stakeholders', '', 2, 623, 'active'),
('c0000000-0000-0000-0000-415cf5f20000', 'RC.CO-04', 'Public updates on incident recovery are shared using approved methods and messaging', '', 2, 624, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Set parent_entry_id: categories → functions, subcategories → categories
-- ============================================================================

-- Categories under Functions
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'GV' AND catalog_id = 'c0000000-0000-0000-0000-415cf5f20000') WHERE code LIKE 'GV.%' AND code NOT LIKE '%.%-__' AND catalog_id = 'c0000000-0000-0000-0000-415cf5f20000' AND level = 1;
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'ID' AND catalog_id = 'c0000000-0000-0000-0000-415cf5f20000') WHERE code LIKE 'ID.%' AND catalog_id = 'c0000000-0000-0000-0000-415cf5f20000' AND level = 1;
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'PR' AND catalog_id = 'c0000000-0000-0000-0000-415cf5f20000') WHERE code LIKE 'PR.%' AND catalog_id = 'c0000000-0000-0000-0000-415cf5f20000' AND level = 1;
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'DE' AND catalog_id = 'c0000000-0000-0000-0000-415cf5f20000') WHERE code LIKE 'DE.%' AND catalog_id = 'c0000000-0000-0000-0000-415cf5f20000' AND level = 1;
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'RS' AND catalog_id = 'c0000000-0000-0000-0000-415cf5f20000') WHERE code LIKE 'RS.%' AND catalog_id = 'c0000000-0000-0000-0000-415cf5f20000' AND level = 1;
UPDATE catalog_entry SET parent_entry_id = (SELECT id FROM catalog_entry WHERE code = 'RC' AND catalog_id = 'c0000000-0000-0000-0000-415cf5f20000') WHERE code LIKE 'RC.%' AND catalog_id = 'c0000000-0000-0000-0000-415cf5f20000' AND level = 1;

-- Subcategories under Categories (e.g. GV.OC-01 → GV.OC)
UPDATE catalog_entry ce SET parent_entry_id = parent.id
FROM catalog_entry parent
WHERE ce.catalog_id = 'c0000000-0000-0000-0000-415cf5f20000'
  AND parent.catalog_id = 'c0000000-0000-0000-0000-415cf5f20000'
  AND ce.level = 2
  AND parent.level = 1
  AND ce.code LIKE parent.code || '-%';

-- ============================================================================
-- Summary: 6 Functions + 22 Categories + ~78 Subcategories = ~106 entries
-- GOVERN: OC, RM, RR, PO, OV, SC (6 categories, ~25 subcategories)
-- IDENTIFY: AM, RA, IM (3 categories, ~21 subcategories)
-- PROTECT: AA, AT, DS, PS, IR (5 categories, ~20 subcategories)
-- DETECT: CM, AE (2 categories, ~11 subcategories)
-- RESPOND: MA, AN, CO, MI (4 categories, ~11 subcategories)
-- RECOVER: RP, CO (2 categories, ~8 subcategories)
-- ============================================================================
