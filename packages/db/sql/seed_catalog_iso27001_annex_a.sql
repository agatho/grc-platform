-- ============================================================================
-- ARCTOS Seed: ISO/IEC 27001:2022 Annex A — Normative Control Reference
-- Source: ISO/IEC 27001:2022 Annex A (aligned with ISO/IEC 27002:2022)
-- 4 Themes → 93 Controls (Statement of Applicability reference)
-- ============================================================================

-- Create catalog container
INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-270010000006',
  'ISO/IEC 27001:2022 Annex A',
  'Normative Annex A control reference from ISO/IEC 27001:2022. 93 controls in 4 themes for Statement of Applicability (SoA). Aligned with ISO/IEC 27002:2022.',
  'control', 'platform', 'iso_27001_2022_annex_a', '2022', true, '{isms}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Theme A.5: Organizational controls (37 controls)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-270010000006', 'A.5', 'Organizational controls', 'Controls related to organizational policies, responsibilities, governance and management of information security', 0, 500, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.1', 'Policies for information security', 'Information security policy and topic-specific policies shall be defined, approved by management, published, communicated to and acknowledged by relevant personnel and relevant interested parties, and reviewed at planned intervals and if significant changes occur.', 1, 501, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.2', 'Information security roles and responsibilities', 'Information security roles and responsibilities shall be defined and allocated.', 1, 502, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.3', 'Segregation of duties', 'Conflicting duties and conflicting areas of responsibility shall be segregated.', 1, 503, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.4', 'Management responsibilities', 'Management shall require all personnel to apply information security in accordance with the established information security policy, topic-specific policies and procedures of the organization.', 1, 504, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.5', 'Contact with authorities', 'The organization shall establish and maintain contact with relevant authorities.', 1, 505, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.6', 'Contact with special interest groups', 'The organization shall establish and maintain contact with special interest groups or other specialist security forums and professional associations.', 1, 506, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.7', 'Threat intelligence', 'Information relating to information security threats shall be collected and analysed to produce threat intelligence.', 1, 507, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.8', 'Information security in project management', 'Information security shall be integrated into project management.', 1, 508, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-270010000006', 'A.5.9', 'Inventory of information and other associated assets', 'An inventory of information and other associated assets, including owners, shall be identified and maintained.', 1, 509, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.10', 'Acceptable use of information and other associated assets', 'Rules for the acceptable use and procedures for handling information and other associated assets shall be identified, documented and implemented.', 1, 510, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.11', 'Return of assets', 'Personnel and other interested parties as appropriate shall return all the organizational assets in their possession upon change or termination of their employment, contract or agreement.', 1, 511, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.12', 'Classification of information', 'Information shall be classified according to the information security needs of the organization based on confidentiality, integrity, availability and relevant interested party requirements.', 1, 512, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.13', 'Labelling of information', 'An appropriate set of procedures for information labelling shall be developed and implemented in accordance with the information classification scheme adopted by the organization.', 1, 513, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.14', 'Information transfer', 'Information transfer rules, procedures, or agreements shall be in place for all types of transfer facilities within the organization and between the organization and other parties.', 1, 514, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.15', 'Access control', 'Rules to control physical and logical access to information and other associated assets shall be established and implemented based on business and information security requirements.', 1, 515, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.16', 'Identity management', 'The full life cycle of identities shall be managed.', 1, 516, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-270010000006', 'A.5.17', 'Authentication information', 'Allocation and management of authentication information shall be controlled by a management process, including advising personnel on appropriate handling of authentication information.', 1, 517, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.18', 'Access rights', 'Access rights to information and other associated assets shall be provisioned, reviewed, modified and removed in accordance with the topic-specific policy on and rules for access control.', 1, 518, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.19', 'Information security in supplier relationships', 'Processes and procedures shall be defined and implemented to manage the information security risks associated with the use of supplier products or services.', 1, 519, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.20', 'Addressing information security within supplier agreements', 'Relevant information security requirements shall be established and agreed with each supplier based on the type of supplier relationship.', 1, 520, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.21', 'Managing information security in the ICT supply chain', 'Processes and procedures shall be defined and implemented to manage the information security risks associated with the ICT products and services supply chain.', 1, 521, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.22', 'Monitoring, review and change management of supplier services', 'The organization shall regularly monitor, review, evaluate and manage change in supplier information security practices and service delivery.', 1, 522, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.23', 'Information security for use of cloud services', 'Processes for acquisition, use, management and exit from cloud services shall be established in accordance with the information security requirements of the organization.', 1, 523, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.24', 'Information security incident management planning and preparation', 'The organization shall plan and prepare for managing information security incidents by defining, establishing and communicating information security incident management processes, roles and responsibilities.', 1, 524, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-270010000006', 'A.5.25', 'Assessment and decision on information security events', 'The organization shall assess information security events and decide if they are to be categorized as information security incidents.', 1, 525, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.26', 'Response to information security incidents', 'Information security incidents shall be responded to in accordance with the documented procedures.', 1, 526, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.27', 'Learning from information security incidents', 'Knowledge gained from information security incidents shall be used to strengthen and improve the information security controls.', 1, 527, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.28', 'Collection of evidence', 'The organization shall establish and implement procedures for the identification, collection, acquisition and preservation of evidence related to information security events.', 1, 528, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.29', 'Information security during disruption', 'The organization shall plan how to maintain information security at an appropriate level during disruption.', 1, 529, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.30', 'ICT readiness for business continuity', 'ICT readiness shall be planned, implemented, maintained and tested based on business continuity objectives and ICT continuity requirements.', 1, 530, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.31', 'Legal, statutory, regulatory and contractual requirements', 'Legal, statutory, regulatory and contractual requirements relevant to information security and the approach to meet these requirements shall be identified, documented and kept up to date.', 1, 531, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.32', 'Intellectual property rights', 'The organization shall implement appropriate procedures to protect intellectual property rights.', 1, 532, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-270010000006', 'A.5.33', 'Protection of records', 'Records shall be protected from loss, destruction, falsification, unauthorized access and unauthorized release.', 1, 533, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.34', 'Privacy and protection of PII', 'The organization shall identify and meet the requirements regarding the preservation of privacy and protection of personally identifiable information (PII) as required in applicable laws and regulations and contractual requirements.', 1, 534, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.35', 'Independent review of information security', 'The approach to managing information security and its implementation including people, processes and technologies shall be reviewed independently at planned intervals or when significant changes occur.', 1, 535, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.36', 'Compliance with policies, rules and standards for information security', 'Compliance with the established information security policy, topic-specific policies, rules and standards shall be regularly reviewed.', 1, 536, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.5.37', 'Documented operating procedures', 'Operating procedures for information processing facilities shall be documented and made available to personnel who need them.', 1, 537, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Theme A.6: People controls (8 controls)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-270010000006', 'A.6', 'People controls', 'Controls related to individual people including screening, terms of employment, awareness, training and disciplinary processes', 0, 600, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.6.1', 'Screening', 'Background verification checks on all candidates to become personnel shall be carried out prior to joining the organization and on an ongoing basis taking into consideration applicable laws, regulations and ethics and be proportional to the business requirements, the classification of the information to be accessed and the perceived risks.', 1, 601, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.6.2', 'Terms and conditions of employment', 'The employment contractual agreements shall state the personnel and the organization responsibilities for information security.', 1, 602, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.6.3', 'Information security awareness, education and training', 'Personnel of the organization and relevant interested parties shall receive appropriate information security awareness, education and training and regular updates of the information security policy, topic-specific policies and procedures, as relevant for their job function.', 1, 603, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.6.4', 'Disciplinary process', 'A disciplinary process shall be formalized and communicated to take actions against personnel and other relevant interested parties who have committed an information security policy violation.', 1, 604, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.6.5', 'Responsibilities after termination or change of employment', 'Information security responsibilities and duties that remain valid after termination or change of employment shall be defined, enforced and communicated to relevant personnel and other interested parties.', 1, 605, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.6.6', 'Confidentiality or non-disclosure agreements', 'Confidentiality or non-disclosure agreements reflecting the needs for the protection of information shall be identified, documented, regularly reviewed and signed by personnel and other relevant interested parties.', 1, 606, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.6.7', 'Remote working', 'Security measures shall be implemented when personnel are working remotely to protect information accessed, processed or stored outside the premises.', 1, 607, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.6.8', 'Information security event reporting', 'The organization shall provide a mechanism for personnel to report observed or suspected information security events through appropriate channels in a timely manner.', 1, 608, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Theme A.7: Physical controls (14 controls)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-270010000006', 'A.7', 'Physical controls', 'Controls related to physical security of premises, equipment and physical media', 0, 700, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.7.1', 'Physical security perimeters', 'Security perimeters shall be defined and used to protect areas that contain information and other associated assets.', 1, 701, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.7.2', 'Physical entry', 'Secure areas shall be protected by appropriate entry controls and access points.', 1, 702, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.7.3', 'Securing offices, rooms and facilities', 'Physical security for offices, rooms and facilities shall be designed and implemented.', 1, 703, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.7.4', 'Physical security monitoring', 'Premises shall be continuously monitored for unauthorized physical access.', 1, 704, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.7.5', 'Protecting against physical and environmental threats', 'Protection against physical and environmental threats, such as natural disasters and other intentional or unintentional physical threats to infrastructure shall be designed and implemented.', 1, 705, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.7.6', 'Working in secure areas', 'Security measures for working in secure areas shall be designed and implemented.', 1, 706, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.7.7', 'Clear desk and clear screen', 'Clear desk rules for papers and removable storage media and clear screen rules for information processing facilities shall be defined and appropriately enforced.', 1, 707, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.7.8', 'Equipment siting and protection', 'Equipment shall be sited securely and protected.', 1, 708, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.7.9', 'Security of assets off-premises', 'Off-site assets shall be protected.', 1, 709, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.7.10', 'Storage media', 'Storage media shall be managed through their life cycle of acquisition, use, transportation and disposal in accordance with the classification scheme and handling requirements.', 1, 710, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.7.11', 'Supporting utilities', 'Information processing facilities shall be protected from power failures and other disruptions caused by failures in supporting utilities.', 1, 711, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.7.12', 'Cabling security', 'Cables carrying power, data or supporting information services shall be protected from interception, interference or damage.', 1, 712, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.7.13', 'Equipment maintenance', 'Equipment shall be maintained correctly to ensure availability, integrity and confidentiality of information.', 1, 713, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.7.14', 'Secure disposal or re-use of equipment', 'Items of equipment containing storage media shall be verified to ensure that any sensitive data and licensed software has been removed or securely overwritten prior to disposal or re-use.', 1, 714, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Theme A.8: Technological controls (34 controls)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-270010000006', 'A.8', 'Technological controls', 'Controls related to technology including endpoint devices, access, authentication, cryptography, secure development and network security', 0, 800, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.1', 'User endpoint devices', 'Information stored on, processed by or accessible via user endpoint devices shall be protected.', 1, 801, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.2', 'Privileged access rights', 'The allocation and use of privileged access rights shall be restricted and managed.', 1, 802, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.3', 'Information access restriction', 'Access to information and other associated assets shall be restricted in accordance with the established topic-specific policy on access control.', 1, 803, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.4', 'Access to source code', 'Read and write access to source code, development tools and software libraries shall be appropriately managed.', 1, 804, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.5', 'Secure authentication', 'Secure authentication technologies and procedures shall be established and implemented based on information access restrictions and the topic-specific policy on access control.', 1, 805, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.6', 'Capacity management', 'The use of resources shall be monitored and adjusted in line with current and expected capacity requirements.', 1, 806, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.7', 'Protection against malware', 'Protection against malware shall be implemented and supported by appropriate user awareness.', 1, 807, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.8', 'Management of technical vulnerabilities', 'Information about technical vulnerabilities of information systems in use shall be obtained, the exposure to such vulnerabilities shall be evaluated and appropriate measures shall be taken.', 1, 808, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-270010000006', 'A.8.9', 'Configuration management', 'Configurations, including security configurations, of hardware, software, services and networks shall be established, documented, implemented, monitored and reviewed.', 1, 809, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.10', 'Information deletion', 'Information stored in information systems, devices or in any other storage media shall be deleted when no longer required.', 1, 810, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.11', 'Data masking', 'Data masking shall be used in accordance with the topic-specific policy on access control and other related topic-specific policies, and business requirements, taking applicable legislation into consideration.', 1, 811, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.12', 'Data leakage prevention', 'Data leakage prevention measures shall be applied to systems, networks and any other devices that process, store or transmit sensitive information.', 1, 812, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.13', 'Information backup', 'Backup copies of information, software and systems shall be maintained and regularly tested in accordance with the agreed topic-specific policy on backup.', 1, 813, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.14', 'Redundancy of information processing facilities', 'Information processing facilities shall be implemented with redundancy sufficient to meet availability requirements.', 1, 814, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.15', 'Logging', 'Logs that record activities, exceptions, faults and other relevant events shall be produced, stored, protected and analysed.', 1, 815, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.16', 'Monitoring activities', 'Networks, systems and applications shall be monitored for anomalous behaviour and appropriate actions taken to evaluate potential information security incidents.', 1, 816, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-270010000006', 'A.8.17', 'Clock synchronization', 'The clocks of information processing systems used by the organization shall be synchronized to approved time sources.', 1, 817, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.18', 'Use of privileged utility programs', 'The use of utility programs that can be capable of overriding system and application controls shall be restricted and tightly controlled.', 1, 818, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.19', 'Installation of software on operational systems', 'Procedures and measures shall be implemented to securely manage software installation on operational systems.', 1, 819, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.20', 'Networks security', 'Networks and network devices shall be secured, managed and controlled to protect information in systems and applications.', 1, 820, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.21', 'Security of network services', 'Security mechanisms, service levels and service requirements of network services shall be identified, implemented and monitored.', 1, 821, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.22', 'Segregation of networks', 'Groups of information services, users and information systems shall be segregated in the networks.', 1, 822, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.23', 'Web filtering', 'Access to external websites shall be managed to reduce exposure to malicious content.', 1, 823, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.24', 'Use of cryptography', 'Rules for the effective use of cryptography, including cryptographic key management, shall be defined and implemented.', 1, 824, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-270010000006', 'A.8.25', 'Secure development life cycle', 'Rules for the secure development of software and systems shall be established and applied.', 1, 825, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.26', 'Application security requirements', 'Information security requirements shall be identified, specified and approved when developing or acquiring applications.', 1, 826, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.27', 'Secure system architecture and engineering principles', 'Principles for engineering secure systems shall be established, documented, maintained and applied to any information system development activities.', 1, 827, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.28', 'Secure coding', 'Secure coding principles shall be applied to software development.', 1, 828, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.29', 'Security testing in development and acceptance', 'Security testing processes shall be defined and implemented in the development life cycle.', 1, 829, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.30', 'Outsourced development', 'The organization shall direct, monitor and review the activities related to outsourced system development.', 1, 830, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.31', 'Separation of development, test and production environments', 'Development, testing and production environments shall be separated and secured.', 1, 831, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.32', 'Change management', 'Changes to information processing facilities and information systems shall be subject to change management procedures.', 1, 832, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.33', 'Test information', 'Test information shall be appropriately selected, protected and managed.', 1, 833, 'active'),
('c0000000-0000-0000-0000-270010000006', 'A.8.34', 'Protection of information systems during audit testing', 'Audit tests and other assurance activities involving assessment of operational systems shall be planned and agreed between the tester and appropriate management.', 1, 834, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;
