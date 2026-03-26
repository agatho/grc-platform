-- ============================================================================
-- ARCTOS Seed: ISO/IEC 27002:2022 Control Catalog (93 Controls)
-- Source: ISO/IEC 27002:2022 Information security controls
-- 4 Themes: Organizational (37), People (8), Physical (14), Technological (34)
-- ============================================================================

-- Create catalog container
INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active)
VALUES (
  'c0000000-0000-0000-0000-150270022022',
  'ISO/IEC 27002:2022',
  'Information security, cybersecurity and privacy protection — Information security controls. 93 controls in 4 themes.',
  'control', 'platform', 'iso27002_2022', '2022', true
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Theme 5: Organizational controls (A.5.1 – A.5.37)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-150270022022', 'A.5', 'Organizational controls', 'Controls related to organizational policies, responsibilities and governance', 0, 100, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.1', 'Policies for information security', 'Information security policy and topic-specific policies shall be defined, approved, published, communicated and acknowledged.', 1, 101, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.2', 'Information security roles and responsibilities', 'Information security roles and responsibilities shall be defined and allocated.', 1, 102, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.3', 'Segregation of duties', 'Conflicting duties and conflicting areas of responsibility shall be segregated.', 1, 103, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.4', 'Management responsibilities', 'Management shall require all personnel to apply information security in accordance with the established policies and procedures.', 1, 104, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.5', 'Contact with authorities', 'The organization shall establish and maintain contact with relevant authorities.', 1, 105, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.6', 'Contact with special interest groups', 'The organization shall establish and maintain contact with special interest groups or other specialist security forums.', 1, 106, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.7', 'Threat intelligence', 'Information relating to information security threats shall be collected and analysed to produce threat intelligence.', 1, 107, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.8', 'Information security in project management', 'Information security shall be integrated into project management.', 1, 108, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-150270022022', 'A.5.9', 'Inventory of information and other associated assets', 'An inventory of information and other associated assets shall be identified and maintained.', 1, 109, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.10', 'Acceptable use of information and other associated assets', 'Rules for the acceptable use and procedures for handling information shall be identified and documented.', 1, 110, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.11', 'Return of assets', 'Personnel and other interested parties shall return all the organizational assets in their possession upon change or termination.', 1, 111, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.12', 'Classification of information', 'Information shall be classified according to the information security needs of the organization.', 1, 112, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.13', 'Labelling of information', 'An appropriate set of procedures for information labelling shall be developed and implemented.', 1, 113, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.14', 'Information transfer', 'Information transfer rules, procedures, or agreements shall be in place for all types of transfer.', 1, 114, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.15', 'Access control', 'Rules to control physical and logical access to information shall be established and implemented.', 1, 115, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.16', 'Identity management', 'The full life cycle of identities shall be managed.', 1, 116, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.17', 'Authentication information', 'Allocation and management of authentication information shall be controlled.', 1, 117, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.18', 'Access rights', 'Access rights to information shall be provisioned, reviewed, modified and removed in accordance with policies and rules.', 1, 118, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.19', 'Information security in supplier relationships', 'Processes and procedures shall be defined and implemented to manage the information security risks.', 1, 119, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.20', 'Addressing information security within supplier agreements', 'Relevant information security requirements shall be established and agreed with each supplier.', 1, 120, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.21', 'Managing information security in the ICT supply chain', 'Processes and procedures shall be defined and implemented to manage security risks.', 1, 121, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.22', 'Monitoring, review and change management of supplier services', 'The organization shall regularly monitor, review, evaluate and manage change in supplier information security practices.', 1, 122, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.23', 'Information security for use of cloud services', 'Processes for acquisition, use, management and exit from cloud services shall be established.', 1, 123, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-150270022022', 'A.5.24', 'Information security incident management planning and preparation', 'The organization shall plan and prepare for managing information security incidents.', 1, 124, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.25', 'Assessment and decision on information security events', 'The organization shall assess information security events and decide if they are to be categorized as incidents.', 1, 125, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.26', 'Response to information security incidents', 'Information security incidents shall be responded to in accordance with the documented procedures.', 1, 126, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.27', 'Learning from information security incidents', 'Knowledge gained from information security incidents shall be used to strengthen controls.', 1, 127, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.28', 'Collection of evidence', 'The organization shall establish and implement procedures for the identification, collection, acquisition and preservation of evidence.', 1, 128, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.29', 'Information security during disruption', 'The organization shall plan how to maintain information security at an appropriate level during disruption.', 1, 129, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.30', 'ICT readiness for business continuity', 'ICT readiness shall be planned, implemented, maintained and tested based on business continuity objectives.', 1, 130, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.31', 'Legal, statutory, regulatory and contractual requirements', 'Legal, statutory, regulatory and contractual requirements relevant to information security shall be identified.', 1, 131, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.32', 'Intellectual property rights', 'The organization shall implement appropriate procedures to protect intellectual property rights.', 1, 132, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.33', 'Protection of records', 'Records shall be protected from loss, destruction, falsification, unauthorized access and unauthorized release.', 1, 133, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.34', 'Privacy and protection of PII', 'The organization shall identify and meet the requirements regarding the preservation of privacy and protection of PII.', 1, 134, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.35', 'Independent review of information security', 'The organizations approach to managing information security shall be independently reviewed at planned intervals.', 1, 135, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.36', 'Compliance with policies, rules and standards', 'Compliance with the organizations information security policy, topic-specific policies, rules and standards shall be regularly reviewed.', 1, 136, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.5.37', 'Documented operating procedures', 'Operating procedures for information processing facilities shall be documented and made available.', 1, 137, 'active'),

-- ============================================================================
-- Theme 6: People controls (A.6.1 – A.6.8)
-- ============================================================================
('c0000000-0000-0000-0000-150270022022', 'A.6', 'People controls', 'Controls related to personnel security', 0, 200, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.6.1', 'Screening', 'Background verification checks on all candidates to become personnel shall be carried out prior to joining.', 1, 201, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.6.2', 'Terms and conditions of employment', 'The employment contractual agreements shall state the personnels and the organizations responsibilities for information security.', 1, 202, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.6.3', 'Information security awareness, education and training', 'Personnel of the organization and relevant interested parties shall receive appropriate awareness education and training.', 1, 203, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.6.4', 'Disciplinary process', 'A disciplinary process shall be formalized and communicated to take actions against personnel who have committed an information security policy violation.', 1, 204, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.6.5', 'Responsibilities after termination or change of employment', 'Information security responsibilities and duties that remain valid after termination or change of employment shall be defined, enforced and communicated.', 1, 205, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.6.6', 'Confidentiality or non-disclosure agreements', 'Confidentiality or non-disclosure agreements reflecting the organizations needs for the protection of information shall be identified and regularly reviewed.', 1, 206, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.6.7', 'Remote working', 'Security measures shall be implemented when personnel are working remotely to protect information accessed, processed or stored outside the organizations premises.', 1, 207, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.6.8', 'Information security event reporting', 'The organization shall provide a mechanism for personnel to report observed or suspected information security events through appropriate channels in a timely manner.', 1, 208, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Theme 7: Physical controls (A.7.1 – A.7.14)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-150270022022', 'A.7', 'Physical controls', 'Controls related to physical security of premises and equipment', 0, 300, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.7.1', 'Physical security perimeters', 'Security perimeters shall be defined and used to protect areas that contain information and other associated assets.', 1, 301, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.7.2', 'Physical entry', 'Secure areas shall be protected by appropriate entry controls and access points.', 1, 302, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.7.3', 'Securing offices, rooms and facilities', 'Physical security for offices, rooms and facilities shall be designed and implemented.', 1, 303, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.7.4', 'Physical security monitoring', 'Premises shall be continuously monitored for unauthorized physical access.', 1, 304, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.7.5', 'Protecting against physical and environmental threats', 'Protection against physical and environmental threats such as natural disasters shall be designed and implemented.', 1, 305, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.7.6', 'Working in secure areas', 'Security measures for working in secure areas shall be designed and implemented.', 1, 306, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.7.7', 'Clear desk and clear screen', 'Clear desk rules for papers and removable storage media and clear screen rules for information processing facilities shall be defined and enforced.', 1, 307, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.7.8', 'Equipment siting and protection', 'Equipment shall be sited securely and protected.', 1, 308, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.7.9', 'Security of assets off-premises', 'Off-site assets shall be protected.', 1, 309, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.7.10', 'Storage media', 'Storage media shall be managed through their life cycle of acquisition, use, transportation and disposal.', 1, 310, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.7.11', 'Supporting utilities', 'Information processing facilities shall be protected from power failures and other disruptions caused by failures in supporting utilities.', 1, 311, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.7.12', 'Cabling security', 'Cables carrying power, data or supporting information services shall be protected from interception, interference or damage.', 1, 312, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.7.13', 'Equipment maintenance', 'Equipment shall be maintained correctly to ensure availability, integrity and confidentiality of information.', 1, 313, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.7.14', 'Secure disposal or re-use of equipment', 'Items of equipment containing storage media shall be verified to ensure that sensitive data has been removed or overwritten prior to disposal or re-use.', 1, 314, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Theme 8: Technological controls (A.8.1 – A.8.34)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-150270022022', 'A.8', 'Technological controls', 'Controls related to technology and technical security measures', 0, 400, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.1', 'User endpoint devices', 'Information stored on, processed by or accessible via user endpoint devices shall be protected.', 1, 401, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.2', 'Privileged access rights', 'The allocation and use of privileged access rights shall be restricted and managed.', 1, 402, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.3', 'Information access restriction', 'Access to information and other associated assets shall be restricted in accordance with the access control policy.', 1, 403, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.4', 'Access to source code', 'Read and write access to source code, development tools and software libraries shall be appropriately managed.', 1, 404, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.5', 'Secure authentication', 'Secure authentication technologies and procedures shall be established and implemented.', 1, 405, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.6', 'Capacity management', 'The use of resources shall be monitored and adjusted in line with current and expected capacity requirements.', 1, 406, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.7', 'Protection against malware', 'Protection against malware shall be implemented and supported by appropriate user awareness.', 1, 407, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.8', 'Management of technical vulnerabilities', 'Information about technical vulnerabilities of information systems in use shall be obtained and appropriate measures taken.', 1, 408, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.9', 'Configuration management', 'Configurations, including security configurations, of hardware, software, services and networks shall be established and managed.', 1, 409, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.10', 'Information deletion', 'Information stored in information systems, devices or in any other storage media shall be deleted when no longer required.', 1, 410, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.11', 'Data masking', 'Data masking shall be used in accordance with the organizations topic-specific policy and business requirements.', 1, 411, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.12', 'Data leakage prevention', 'Data leakage prevention measures shall be applied to systems, networks and any other devices that process, store or transmit sensitive information.', 1, 412, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-150270022022', 'A.8.13', 'Information backup', 'Backup copies of information, software and systems shall be maintained and regularly tested.', 1, 413, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.14', 'Redundancy of information processing facilities', 'Information processing facilities shall be implemented with redundancy sufficient to meet availability requirements.', 1, 414, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.15', 'Logging', 'Logs that record activities, exceptions, faults and other relevant events shall be produced, stored, protected and analysed.', 1, 415, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.16', 'Monitoring activities', 'Networks, systems and applications shall be monitored for anomalous behaviour and appropriate actions taken.', 1, 416, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.17', 'Clock synchronization', 'The clocks of information processing systems used by the organization shall be synchronized to approved time sources.', 1, 417, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.18', 'Use of privileged utility programs', 'The use of utility programs that might be capable of overriding system and application controls shall be restricted and tightly controlled.', 1, 418, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.19', 'Installation of software on operational systems', 'Procedures and measures shall be implemented to securely manage software installation on operational systems.', 1, 419, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.20', 'Networks security', 'Networks and network devices shall be secured, managed and controlled to protect information in systems and applications.', 1, 420, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.21', 'Security of network services', 'Security mechanisms, service levels and service requirements of network services shall be identified, implemented and monitored.', 1, 421, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.22', 'Segregation of networks', 'Groups of information services, users and information systems shall be segregated in the organizations networks.', 1, 422, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.23', 'Web filtering', 'Access to external websites shall be managed to reduce exposure to malicious content.', 1, 423, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.24', 'Use of cryptography', 'Rules for the effective use of cryptography, including cryptographic key management, shall be defined and implemented.', 1, 424, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.25', 'Secure development life cycle', 'Rules for the secure development of software and systems shall be established and applied.', 1, 425, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.26', 'Application security requirements', 'Information security requirements shall be identified, specified and approved when developing or acquiring applications.', 1, 426, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.27', 'Secure system architecture and engineering principles', 'Principles for engineering secure systems shall be established, documented, maintained and applied.', 1, 427, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.28', 'Secure coding', 'Secure coding principles shall be applied to software development.', 1, 428, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-150270022022', 'A.8.29', 'Security testing in development and acceptance', 'Security testing processes shall be defined and implemented in the development life cycle.', 1, 429, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.30', 'Outsourced development', 'The organization shall direct, monitor and review the activities related to outsourced system development.', 1, 430, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.31', 'Separation of development, test and production environments', 'Development, testing and production environments shall be separated and secured.', 1, 431, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.32', 'Change management', 'Changes to information processing facilities and information systems shall be subject to change management procedures.', 1, 432, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.33', 'Test information', 'Test information shall be appropriately selected, protected and managed.', 1, 433, 'active'),
('c0000000-0000-0000-0000-150270022022', 'A.8.34', 'Protection of information systems during audit testing', 'Audit tests and other assurance activities involving assessment of operational systems shall be planned and agreed.', 1, 434, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Set parent_entry_id for all controls to their respective theme
-- ============================================================================
UPDATE catalog_entry SET parent_entry_id = (
  SELECT id FROM catalog_entry WHERE code = 'A.5' AND catalog_id = 'c0000000-0000-0000-0000-150270022022'
) WHERE code LIKE 'A.5.%' AND catalog_id = 'c0000000-0000-0000-0000-150270022022';

UPDATE catalog_entry SET parent_entry_id = (
  SELECT id FROM catalog_entry WHERE code = 'A.6' AND catalog_id = 'c0000000-0000-0000-0000-150270022022'
) WHERE code LIKE 'A.6.%' AND catalog_id = 'c0000000-0000-0000-0000-150270022022';

UPDATE catalog_entry SET parent_entry_id = (
  SELECT id FROM catalog_entry WHERE code = 'A.7' AND catalog_id = 'c0000000-0000-0000-0000-150270022022'
) WHERE code LIKE 'A.7.%' AND catalog_id = 'c0000000-0000-0000-0000-150270022022';

UPDATE catalog_entry SET parent_entry_id = (
  SELECT id FROM catalog_entry WHERE code = 'A.8' AND catalog_id = 'c0000000-0000-0000-0000-150270022022'
) WHERE code LIKE 'A.8.%' AND catalog_id = 'c0000000-0000-0000-0000-150270022022';

-- ============================================================================
-- Summary: 4 themes + 93 controls = 97 catalog_entry rows
-- Organizational: A.5.1–A.5.37 (37 controls)
-- People: A.6.1–A.6.8 (8 controls)
-- Physical: A.7.1–A.7.14 (14 controls)
-- Technological: A.8.1–A.8.34 (34 controls)
-- ============================================================================
