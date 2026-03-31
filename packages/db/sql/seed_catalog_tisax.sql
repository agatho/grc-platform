-- ============================================================================
-- ARCTOS Seed: TISAX / VDA ISA 6.0 — Trusted Information Security Assessment Exchange
-- Source: VDA Information Security Assessment (ISA) Version 6.0
-- Used by ISMS + TPRM: automotive industry information security assessment catalog
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-715a00000008',
  'TISAX / VDA ISA 6.0',
  'VDA Information Security Assessment (ISA) 6.0 — Assessment catalog for TISAX certification in the automotive industry',
  'control', 'platform', 'vda_isa_tisax', '6.0', true, '{isms,tprm}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Module 1 — Information Security Policies
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-715a00000008', '1', 'Information Security Policies', 'Policies, organization, and roles for information security management.', 0, 1, 'active'),
('c0000000-0000-0000-0000-715a00000008', '1.1', 'Information Security Policy', 'An information security policy is defined, approved by management, and communicated.', 1, 2, 'active'),
('c0000000-0000-0000-0000-715a00000008', '1.1.1', 'IS Policy Documentation', 'The information security policy is documented, approved by top management, published, and communicated to all employees and relevant external parties.', 2, 3, 'active'),
('c0000000-0000-0000-0000-715a00000008', '1.2', 'Organization of Information Security', 'Information security is organized with defined roles and responsibilities.', 1, 4, 'active'),
('c0000000-0000-0000-0000-715a00000008', '1.2.1', 'Roles and Responsibilities', 'Roles and responsibilities for information security are clearly defined and assigned.', 2, 5, 'active'),
('c0000000-0000-0000-0000-715a00000008', '1.2.2', 'Segregation of Duties', 'Conflicting duties and areas of responsibility are segregated to reduce opportunities for unauthorized or unintentional modification or misuse.', 2, 6, 'active'),
('c0000000-0000-0000-0000-715a00000008', '1.3', 'Information Security Risk Management', 'An information security risk management process is established and maintained.', 1, 7, 'active'),
('c0000000-0000-0000-0000-715a00000008', '1.3.1', 'Risk Assessment Process', 'Information security risks are identified, analyzed, evaluated, and treated systematically.', 2, 8, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Module 2 — Human Resources
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-715a00000008', '2', 'Human Resources', 'Security aspects related to human resources before, during, and after employment.', 0, 9, 'active'),
('c0000000-0000-0000-0000-715a00000008', '2.1', 'Prior to Employment', 'Background checks and terms of employment address information security responsibilities.', 1, 10, 'active'),
('c0000000-0000-0000-0000-715a00000008', '2.1.1', 'Screening and Background Checks', 'Background verification checks on candidates are carried out in accordance with relevant laws, regulations, and proportional to business requirements.', 2, 11, 'active'),
('c0000000-0000-0000-0000-715a00000008', '2.2', 'During Employment', 'Employees are aware of their information security responsibilities and fulfill them.', 1, 12, 'active'),
('c0000000-0000-0000-0000-715a00000008', '2.2.1', 'Information Security Awareness and Training', 'All employees and relevant contractors receive appropriate awareness training and regular updates in organizational policies and procedures relevant to their job function.', 2, 13, 'active'),
('c0000000-0000-0000-0000-715a00000008', '2.3', 'Termination and Change of Employment', 'Information security interests are protected during termination or change of employment.', 1, 14, 'active'),
('c0000000-0000-0000-0000-715a00000008', '2.3.1', 'Termination Responsibilities', 'Information security responsibilities and duties that remain valid after termination or change of employment are defined, communicated, and enforced.', 2, 15, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Module 3 — Asset Management
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-715a00000008', '3', 'Asset Management', 'Inventory, classification, and handling of information assets and media.', 0, 16, 'active'),
('c0000000-0000-0000-0000-715a00000008', '3.1', 'Asset Inventory', 'Information assets are identified and an inventory is maintained.', 1, 17, 'active'),
('c0000000-0000-0000-0000-715a00000008', '3.1.1', 'Inventory of Assets', 'Assets associated with information and information processing facilities are identified and an inventory of these assets is drawn up and maintained.', 2, 18, 'active'),
('c0000000-0000-0000-0000-715a00000008', '3.2', 'Information Classification', 'Information is classified in terms of its value, legal requirements, sensitivity, and criticality.', 1, 19, 'active'),
('c0000000-0000-0000-0000-715a00000008', '3.2.1', 'Classification Scheme', 'A classification scheme is established and information is classified according to its protection needs.', 2, 20, 'active'),
('c0000000-0000-0000-0000-715a00000008', '3.3', 'Media Handling', 'Media is managed, controlled, and disposed of securely.', 1, 21, 'active'),
('c0000000-0000-0000-0000-715a00000008', '3.3.1', 'Management of Removable Media', 'Procedures are implemented for the management of removable media in accordance with the classification scheme.', 2, 22, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Module 4 — Access Control
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-715a00000008', '4', 'Access Control', 'Business requirements for access control, user management, system and application access.', 0, 23, 'active'),
('c0000000-0000-0000-0000-715a00000008', '4.1', 'Business Requirements of Access Control', 'Access to information and information processing facilities is controlled based on business and security requirements.', 1, 24, 'active'),
('c0000000-0000-0000-0000-715a00000008', '4.1.1', 'Access Control Policy', 'An access control policy is established, documented, and reviewed based on business and information security requirements.', 2, 25, 'active'),
('c0000000-0000-0000-0000-715a00000008', '4.2', 'User Access Management', 'User access is managed to ensure authorized access and prevent unauthorized access to systems and services.', 1, 26, 'active'),
('c0000000-0000-0000-0000-715a00000008', '4.2.1', 'User Registration and Deregistration', 'A formal user registration and deregistration process is implemented to enable assignment of access rights.', 2, 27, 'active'),
('c0000000-0000-0000-0000-715a00000008', '4.2.2', 'Privileged Access Management', 'The allocation and use of privileged access rights is restricted and controlled.', 2, 28, 'active'),
('c0000000-0000-0000-0000-715a00000008', '4.3', 'System and Application Access Control', 'Access to systems and applications is controlled by secure log-on procedures.', 1, 29, 'active'),
('c0000000-0000-0000-0000-715a00000008', '4.3.1', 'Secure Log-on Procedures', 'Access to systems and applications is controlled by a secure log-on procedure where required by the access control policy.', 2, 30, 'active'),
('c0000000-0000-0000-0000-715a00000008', '4.3.2', 'Password Management System', 'Password management systems are interactive and ensure quality passwords.', 2, 31, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Module 5 — Cryptography
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-715a00000008', '5', 'Cryptography', 'Policy on the use of cryptographic controls and key management.', 0, 32, 'active'),
('c0000000-0000-0000-0000-715a00000008', '5.1', 'Cryptographic Controls', 'A policy on the use of cryptographic controls for protection of information is developed and implemented.', 1, 33, 'active'),
('c0000000-0000-0000-0000-715a00000008', '5.1.1', 'Policy on the Use of Cryptographic Controls', 'A policy on the use of cryptographic controls for protection of information is developed and implemented.', 2, 34, 'active'),
('c0000000-0000-0000-0000-715a00000008', '5.2', 'Key Management', 'A policy on the use, protection, and lifetime of cryptographic keys is developed and implemented.', 1, 35, 'active'),
('c0000000-0000-0000-0000-715a00000008', '5.2.1', 'Key Management Policy', 'A policy on the use, protection, and lifetime of cryptographic keys is developed and implemented through their whole lifecycle.', 2, 36, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Module 6 — Physical and Environmental Security
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-715a00000008', '6', 'Physical and Environmental Security', 'Secure areas and equipment protection to prevent unauthorized physical access, damage, and interference.', 0, 37, 'active'),
('c0000000-0000-0000-0000-715a00000008', '6.1', 'Secure Areas', 'Physical security perimeters and entry controls are defined to protect areas containing sensitive information.', 1, 38, 'active'),
('c0000000-0000-0000-0000-715a00000008', '6.1.1', 'Physical Security Perimeter', 'Security perimeters are defined and used to protect areas that contain either sensitive or critical information and information processing facilities.', 2, 39, 'active'),
('c0000000-0000-0000-0000-715a00000008', '6.1.2', 'Physical Entry Controls', 'Secure areas are protected by appropriate entry controls to ensure that only authorized personnel are allowed access.', 2, 40, 'active'),
('c0000000-0000-0000-0000-715a00000008', '6.2', 'Equipment Protection', 'Equipment is protected from physical and environmental threats and unauthorized access.', 1, 41, 'active'),
('c0000000-0000-0000-0000-715a00000008', '6.2.1', 'Equipment Siting and Protection', 'Equipment is sited and protected to reduce the risks from environmental threats, hazards, and opportunities for unauthorized access.', 2, 42, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Module 7 — Operations Security
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-715a00000008', '7', 'Operations Security', 'Operational procedures, malware protection, backup, logging, software management, vulnerability management, and audit considerations.', 0, 43, 'active'),
('c0000000-0000-0000-0000-715a00000008', '7.1', 'Operational Procedures and Responsibilities', 'Correct and secure operations of information processing facilities are ensured.', 1, 44, 'active'),
('c0000000-0000-0000-0000-715a00000008', '7.1.1', 'Documented Operating Procedures', 'Operating procedures are documented and made available to all users who need them.', 2, 45, 'active'),
('c0000000-0000-0000-0000-715a00000008', '7.1.2', 'Change Management', 'Changes to the organization, business processes, information processing facilities, and systems that affect information security are controlled.', 2, 46, 'active'),
('c0000000-0000-0000-0000-715a00000008', '7.2', 'Protection from Malware', 'Information and information processing facilities are protected against malware.', 1, 47, 'active'),
('c0000000-0000-0000-0000-715a00000008', '7.2.1', 'Controls Against Malware', 'Detection, prevention, and recovery controls to protect against malware are implemented, combined with appropriate user awareness.', 2, 48, 'active'),
('c0000000-0000-0000-0000-715a00000008', '7.3', 'Backup', 'Backup copies of information, software, and system images are taken and tested regularly.', 1, 49, 'active'),
('c0000000-0000-0000-0000-715a00000008', '7.3.1', 'Information Backup', 'Backup copies of information, software, and system images are taken and tested regularly in accordance with an agreed backup policy.', 2, 50, 'active'),
('c0000000-0000-0000-0000-715a00000008', '7.4', 'Logging and Monitoring', 'Events are recorded and evidence is generated.', 1, 51, 'active'),
('c0000000-0000-0000-0000-715a00000008', '7.4.1', 'Event Logging', 'Event logs recording user activities, exceptions, faults, and information security events are produced, kept, and regularly reviewed.', 2, 52, 'active'),
('c0000000-0000-0000-0000-715a00000008', '7.5', 'Control of Operational Software', 'The integrity of operational systems is ensured.', 1, 53, 'active'),
('c0000000-0000-0000-0000-715a00000008', '7.5.1', 'Installation of Software on Operational Systems', 'Procedures are implemented to control the installation of software on operational systems.', 2, 54, 'active'),
('c0000000-0000-0000-0000-715a00000008', '7.6', 'Technical Vulnerability Management', 'Technical vulnerabilities are identified and remediated in a timely manner.', 1, 55, 'active'),
('c0000000-0000-0000-0000-715a00000008', '7.6.1', 'Management of Technical Vulnerabilities', 'Information about technical vulnerabilities of information systems in use is obtained in a timely fashion, and the exposure to such vulnerabilities is evaluated and appropriate measures are taken.', 2, 56, 'active'),
('c0000000-0000-0000-0000-715a00000008', '7.7', 'Information Systems Audit Considerations', 'Audit activities involving operational systems are planned and agreed to minimize disruptions.', 1, 57, 'active'),
('c0000000-0000-0000-0000-715a00000008', '7.7.1', 'IS Audit Controls', 'Audit requirements and activities involving verification of operational systems are carefully planned and agreed to minimize disruptions to business processes.', 2, 58, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Module 8 — Communications Security
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-715a00000008', '8', 'Communications Security', 'Network security management and information transfer policies.', 0, 59, 'active'),
('c0000000-0000-0000-0000-715a00000008', '8.1', 'Network Security Management', 'Information in networks and supporting information processing facilities is protected.', 1, 60, 'active'),
('c0000000-0000-0000-0000-715a00000008', '8.1.1', 'Network Controls', 'Networks are managed and controlled to protect information in systems and applications.', 2, 61, 'active'),
('c0000000-0000-0000-0000-715a00000008', '8.1.2', 'Security of Network Services', 'Security mechanisms, service levels, and management requirements of all network services are identified and included in network services agreements.', 2, 62, 'active'),
('c0000000-0000-0000-0000-715a00000008', '8.2', 'Information Transfer', 'Policies, procedures, and agreements are in place to protect information transfer.', 1, 63, 'active'),
('c0000000-0000-0000-0000-715a00000008', '8.2.1', 'Information Transfer Policies and Procedures', 'Formal transfer policies, procedures, and controls are in place to protect the transfer of information through the use of all types of communication facilities.', 2, 64, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Module 9 — System Acquisition, Development and Maintenance
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-715a00000008', '9', 'System Acquisition, Development and Maintenance', 'Security requirements for information systems, secure development, and test data protection.', 0, 65, 'active'),
('c0000000-0000-0000-0000-715a00000008', '9.1', 'Security Requirements of Information Systems', 'Information security is an integral part of information systems across the entire lifecycle.', 1, 66, 'active'),
('c0000000-0000-0000-0000-715a00000008', '9.1.1', 'Information Security Requirements Analysis', 'Information security related requirements are included in the requirements for new information systems or enhancements to existing information systems.', 2, 67, 'active'),
('c0000000-0000-0000-0000-715a00000008', '9.2', 'Security in Development and Support Processes', 'Security is designed and implemented within the development lifecycle of information systems.', 1, 68, 'active'),
('c0000000-0000-0000-0000-715a00000008', '9.2.1', 'Secure Development Policy', 'Rules for the development of software and systems are established and applied to developments within the organization.', 2, 69, 'active'),
('c0000000-0000-0000-0000-715a00000008', '9.3', 'Test Data', 'Test data is selected carefully, protected, and controlled.', 1, 70, 'active'),
('c0000000-0000-0000-0000-715a00000008', '9.3.1', 'Protection of Test Data', 'Test data is selected carefully, protected, and controlled.', 2, 71, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Module 10 — Supplier Relationships
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-715a00000008', '10', 'Supplier Relationships', 'Information security in supplier relationships and service delivery management.', 0, 72, 'active'),
('c0000000-0000-0000-0000-715a00000008', '10.1', 'Information Security in Supplier Relationships', 'Protection of the organizations assets that is accessible by suppliers is ensured.', 1, 73, 'active'),
('c0000000-0000-0000-0000-715a00000008', '10.1.1', 'Information Security Policy for Supplier Relationships', 'Information security requirements for mitigating the risks associated with supplier access to the organizations assets are agreed with the supplier and documented.', 2, 74, 'active'),
('c0000000-0000-0000-0000-715a00000008', '10.2', 'Supplier Service Delivery Management', 'An agreed level of information security and service delivery is maintained in line with supplier agreements.', 1, 75, 'active'),
('c0000000-0000-0000-0000-715a00000008', '10.2.1', 'Monitoring and Review of Supplier Services', 'Organizations regularly monitor, review, and audit supplier service delivery.', 2, 76, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Module 11 — Information Security Incident Management
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-715a00000008', '11', 'Information Security Incident Management', 'Consistent and effective approach to the management of information security incidents, including communication on security events.', 0, 77, 'active'),
('c0000000-0000-0000-0000-715a00000008', '11.1', 'Management of Information Security Incidents and Improvements', 'Incidents are reported, assessed, responded to, and lessons learned are captured.', 1, 78, 'active'),
('c0000000-0000-0000-0000-715a00000008', '11.1.1', 'Responsibilities and Procedures', 'Management responsibilities and procedures are established to ensure a quick, effective, and orderly response to information security incidents.', 2, 79, 'active'),
('c0000000-0000-0000-0000-715a00000008', '11.1.2', 'Reporting Information Security Events', 'Information security events are reported through appropriate management channels as quickly as possible.', 2, 80, 'active'),
('c0000000-0000-0000-0000-715a00000008', '11.1.3', 'Learning from Information Security Incidents', 'Knowledge gained from analyzing and resolving information security incidents is used to reduce the likelihood or impact of future incidents.', 2, 81, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Module 12 — Business Continuity
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-715a00000008', '12', 'Business Continuity', 'Information security continuity planning, redundancies, and verification.', 0, 82, 'active'),
('c0000000-0000-0000-0000-715a00000008', '12.1', 'Information Security Continuity', 'Information security continuity is embedded in the organizations business continuity management systems.', 1, 83, 'active'),
('c0000000-0000-0000-0000-715a00000008', '12.1.1', 'Planning Information Security Continuity', 'The organization determines its requirements for information security and the continuity of information security management in adverse situations.', 2, 84, 'active'),
('c0000000-0000-0000-0000-715a00000008', '12.2', 'Redundancies', 'Information processing facilities are implemented with sufficient redundancy to meet availability requirements.', 1, 85, 'active'),
('c0000000-0000-0000-0000-715a00000008', '12.2.1', 'Availability of Information Processing Facilities', 'Information processing facilities are implemented with redundancy sufficient to meet availability requirements.', 2, 86, 'active'),
('c0000000-0000-0000-0000-715a00000008', '12.3', 'Verification and Testing', 'Business continuity plans are verified, reviewed, and evaluated at regular intervals.', 1, 87, 'active'),
('c0000000-0000-0000-0000-715a00000008', '12.3.1', 'Verify, Review, and Evaluate Business Continuity', 'The organization verifies the established and implemented information security continuity controls at regular intervals to ensure validity and effectiveness.', 2, 88, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Module 13 — Compliance
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-715a00000008', '13', 'Compliance', 'Compliance with legal and contractual requirements and information security reviews.', 0, 89, 'active'),
('c0000000-0000-0000-0000-715a00000008', '13.1', 'Compliance with Legal and Contractual Requirements', 'Breaches of legal, statutory, regulatory, or contractual obligations and of any security requirements are avoided.', 1, 90, 'active'),
('c0000000-0000-0000-0000-715a00000008', '13.1.1', 'Identification of Applicable Legislation', 'All relevant legislative, statutory, regulatory, and contractual requirements and the organizations approach to meet these requirements are explicitly identified, documented, and kept up to date.', 2, 91, 'active'),
('c0000000-0000-0000-0000-715a00000008', '13.2', 'Information Security Reviews', 'Information security is implemented and operated in accordance with organizational policies and procedures.', 1, 92, 'active'),
('c0000000-0000-0000-0000-715a00000008', '13.2.1', 'Independent Review of Information Security', 'The organizations approach to managing information security and its implementation is reviewed independently at planned intervals or when significant changes occur.', 2, 93, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Additional TISAX Labels — Prototype Protection
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-715a00000008', 'PP', 'Prototype Protection', 'Additional TISAX assessment criteria for protection of prototypes and pre-series vehicles.', 0, 94, 'active'),
('c0000000-0000-0000-0000-715a00000008', 'PP.1', 'Physical and Environmental Protection of Prototypes', 'Prototypes and components are protected from unauthorized physical access, photography, and observation.', 1, 95, 'active'),
('c0000000-0000-0000-0000-715a00000008', 'PP.1.1', 'Prototype Secure Areas', 'Prototype areas are secured with physical perimeter controls, access restrictions, visual shielding, and camouflage measures.', 2, 96, 'active'),
('c0000000-0000-0000-0000-715a00000008', 'PP.2', 'Handling and Transport of Prototypes', 'The handling, transport, and shipping of prototypes are carried out in a controlled manner.', 1, 97, 'active'),
('c0000000-0000-0000-0000-715a00000008', 'PP.2.1', 'Prototype Transport Controls', 'Prototypes are transported using defined procedures that ensure camouflage, secure packaging, and chain-of-custody documentation.', 2, 98, 'active'),
('c0000000-0000-0000-0000-715a00000008', 'PP.3', 'Prototype Photography and Recording', 'Measures are in place to prevent unauthorized photography, filming, or recording of prototypes.', 1, 99, 'active'),
('c0000000-0000-0000-0000-715a00000008', 'PP.3.1', 'Recording Device Controls', 'Use of recording devices (cameras, smartphones) is restricted in prototype areas and appropriate controls are enforced.', 2, 100, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Additional TISAX Labels — Data Protection
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-715a00000008', 'DP', 'Data Protection', 'Additional TISAX assessment criteria for the protection of personal data (GDPR compliance).', 0, 101, 'active'),
('c0000000-0000-0000-0000-715a00000008', 'DP.1', 'Data Protection Organization', 'A data protection officer is appointed and data protection governance is established.', 1, 102, 'active'),
('c0000000-0000-0000-0000-715a00000008', 'DP.1.1', 'Data Protection Officer and Governance', 'A data protection officer is designated, data protection policies are documented, and data processing activities are recorded in a register.', 2, 103, 'active'),
('c0000000-0000-0000-0000-715a00000008', 'DP.2', 'Data Subject Rights and Processing', 'Data subject rights are ensured and personal data processing is compliant with applicable regulations.', 1, 104, 'active'),
('c0000000-0000-0000-0000-715a00000008', 'DP.2.1', 'Data Subject Rights Management', 'Processes are established to ensure data subject rights (access, rectification, erasure, portability) are fulfilled within legal timeframes.', 2, 105, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Additional TISAX Labels — Vehicle Security (Connected / Autonomous Vehicles)
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-715a00000008', 'VS', 'Vehicle Security', 'Additional TISAX assessment criteria for the security of connected and autonomous vehicles.', 0, 106, 'active'),
('c0000000-0000-0000-0000-715a00000008', 'VS.1', 'Vehicle Communication Security', 'Communication interfaces and data flows of connected vehicles are secured.', 1, 107, 'active'),
('c0000000-0000-0000-0000-715a00000008', 'VS.1.1', 'In-Vehicle Network Security', 'Security controls are implemented for in-vehicle networks (CAN, Ethernet) to prevent unauthorized access and manipulation of vehicle functions.', 2, 108, 'active'),
('c0000000-0000-0000-0000-715a00000008', 'VS.2', 'Vehicle Software Security', 'Vehicle software including firmware and over-the-air updates is developed and managed securely.', 1, 109, 'active'),
('c0000000-0000-0000-0000-715a00000008', 'VS.2.1', 'Secure Software Update Mechanisms', 'Over-the-air and wired software update mechanisms for vehicle ECUs are authenticated, integrity-protected, and rollback-resistant.', 2, 110, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;
