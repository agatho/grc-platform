-- ============================================================================
-- ARCTOS Seed: BSI IT-Grundschutz Compendium — Bausteine (Building Blocks)
-- Source: BSI IT-Grundschutz Kompendium, Edition 2023
-- 10 Layers → ~50 Bausteine → Selected key requirements
-- ============================================================================

-- Create catalog container
INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-b51900000005',
  'BSI IT-Grundschutz Compendium',
  'BSI IT-Grundschutz Kompendium 2023 — Building blocks (Bausteine) for information security management. 10 layers with process, system and infrastructure modules.',
  'control', 'platform', 'bsi_itgs_bausteine', '2023', true, '{isms,ics}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Layer: ISMS — Information Security Management System
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-b51900000005', 'ISMS', 'Security Management', 'Information security management system layer', 0, 100, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ISMS.1', 'Security management', 'Establishment and operation of information security management including policies, organization and resources', 1, 101, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ISMS.1.A1', 'Assumption of overall responsibility for information security by management', 'Management shall assume overall responsibility for information security', 2, 102, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ISMS.1.A2', 'Definition of security objectives and strategy', 'Security objectives and a strategy for achieving them shall be defined', 2, 103, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ISMS.1.A3', 'Creation of an information security policy', 'An information security policy shall be created and communicated', 2, 104, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ISMS.1.A4', 'Appointment of an information security officer', 'An information security officer shall be appointed with adequate resources', 2, 105, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ISMS.1.A7', 'Definition of a security process', 'A security process covering planning, implementation, monitoring and improvement shall be defined', 2, 106, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ISMS.1.A8', 'Management reviews', 'Regular management reviews of the ISMS shall be conducted', 2, 107, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ISMS.1.A9', 'Integration of information security into organizational processes', 'Information security shall be integrated into all organizational processes', 2, 108, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Layer: ORP — Organisation and Personnel
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-b51900000005', 'ORP', 'Organisation and Personnel', 'Organizational and personnel-related security measures', 0, 200, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ORP.1', 'Organisation', 'Organizational measures for information security including roles, responsibilities and processes', 1, 201, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ORP.1.A1', 'Definition of responsibilities and regulations', 'Responsibilities and regulations for information security shall be clearly defined', 2, 202, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ORP.1.A2', 'Assignment of responsibility for information assets', 'All information assets shall have assigned owners', 2, 203, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ORP.1.A4', 'Supervision of activities by external contractors', 'Activities of external personnel shall be supervised and regulated', 2, 204, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ORP.2', 'Personnel', 'Security measures for HR lifecycle including hiring, training and termination', 1, 210, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ORP.2.A1', 'Regulated procedure for hiring personnel', 'A regulated procedure for hiring personnel including security checks shall be established', 2, 211, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ORP.2.A2', 'Regulated procedure for departing personnel', 'A regulated procedure for departing employees including access revocation shall be established', 2, 212, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ORP.2.A3', 'Representation arrangements', 'Representation arrangements shall be defined to ensure continuity of security tasks', 2, 213, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ORP.3', 'Awareness and training', 'Security awareness programs and targeted training for employees', 1, 220, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ORP.3.A1', 'Awareness of information security', 'All employees shall be made aware of information security requirements', 2, 221, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ORP.3.A2', 'Contact person for security questions', 'A contact person for security-related questions shall be designated', 2, 222, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ORP.4', 'Identity and access management', 'User identification, authentication and access control management', 1, 230, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ORP.4.A1', 'Regulation of access to information', 'Access to information and IT systems shall be regulated based on the need-to-know principle', 2, 231, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ORP.4.A2', 'Regulation of access allocation', 'Access rights shall be allocated based on documented authorization processes', 2, 232, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ORP.4.A3', 'Regulation of access to operating resources', 'Access to operating resources shall be regulated and documented', 2, 233, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ORP.5', 'Compliance management', 'Identification and fulfillment of legal, regulatory and contractual requirements', 1, 240, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ORP.5.A1', 'Identification of legal framework', 'The relevant legal, regulatory and contractual requirements shall be identified', 2, 241, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'ORP.5.A2', 'Compliance with legal framework', 'Measures to comply with legal requirements shall be implemented and monitored', 2, 242, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Layer: CON — Concepts
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-b51900000005', 'CON', 'Concepts', 'Security concepts and topic-specific policies', 0, 300, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.1', 'Crypto concept', 'Cryptographic concepts including key management, algorithm selection and encryption policies', 1, 301, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.1.A1', 'Selection of suitable cryptographic procedures', 'Suitable cryptographic procedures shall be selected based on protection requirements', 2, 302, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.1.A2', 'Encoding of data for confidentiality', 'Data requiring confidentiality shall be encrypted using approved procedures', 2, 303, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.2', 'Data protection', 'Data protection concept for handling personal data in accordance with GDPR', 1, 310, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.2.A1', 'Implementation of standard data protection measures', 'Standard data protection measures shall be implemented to comply with GDPR', 2, 311, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.3', 'Data backup concept', 'Backup strategies, procedures and recovery testing for data and systems', 1, 320, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.3.A1', 'Survey of influencing factors for data backups', 'Influencing factors for defining backup requirements shall be identified', 2, 321, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.3.A4', 'Creation of a data backup concept', 'A data backup concept shall be created and maintained', 2, 322, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.6', 'Deletion and destruction of data', 'Secure deletion and physical destruction of data and data carriers', 1, 330, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.6.A1', 'Regulation of deletion and destruction of information', 'Procedures for deletion and destruction of information shall be regulated', 2, 331, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.7', 'Information security on trips abroad', 'Protection of information and IT systems during business travel', 1, 340, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.7.A1', 'Security policy for information security on trips abroad', 'A policy for secure handling of information during trips abroad shall be established', 2, 341, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.8', 'Software development', 'Security requirements for software development processes and lifecycle', 1, 350, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.8.A1', 'Definition of requirements for software development', 'Security requirements shall be defined for all software development activities', 2, 351, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.8.A2', 'Software design according to security requirements', 'Software shall be designed to meet defined security requirements', 2, 352, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.9', 'Information exchange', 'Secure exchange of information between organizations and partners', 1, 360, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.9.A1', 'Regulations for information exchange', 'Regulations for the secure exchange of information shall be established', 2, 361, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.10', 'Developing web applications', 'Security in web application development including OWASP considerations', 1, 370, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.10.A1', 'Securing web applications', 'Web applications shall be developed and operated securely', 2, 371, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.11', 'Secret and project management', 'Protection of confidential project information and secrets', 1, 380, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'CON.11.A1', 'Identification of confidential information in projects', 'Confidential information in projects shall be identified and classified', 2, 381, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Layer: OPS — Operations
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-b51900000005', 'OPS', 'Operations', 'IT operations, administration and third-party IT management', 0, 400, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'OPS.1.1.1', 'General IT operations', 'Fundamentals of orderly and secure IT operations including change management', 1, 401, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'OPS.1.1.1.A1', 'Documentation of IT administration activities', 'All IT administration activities shall be documented', 2, 402, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'OPS.1.1.1.A2', 'Orderly IT administration', 'IT administration shall be performed in an orderly and regulated manner', 2, 403, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'OPS.1.1.2', 'Patch and change management', 'Systematic management of software updates, patches and configuration changes', 1, 410, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'OPS.1.1.2.A1', 'Concept for patch and change management', 'A concept for patch and change management shall be developed and implemented', 2, 411, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'OPS.1.1.2.A2', 'Timely provision of patches and updates', 'Security patches and updates shall be provided and installed in a timely manner', 2, 412, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'OPS.2.2', 'Cloud usage', 'Security requirements for the use of cloud computing services', 1, 420, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'OPS.2.2.A1', 'Definition of a cloud usage strategy', 'A cloud usage strategy shall be defined considering security requirements', 2, 421, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'OPS.2.2.A2', 'Cloud usage planning', 'The use of cloud services shall be carefully planned and documented', 2, 422, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'OPS.2.4', 'Remote maintenance', 'Secure remote access for maintenance of IT systems', 1, 430, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'OPS.2.4.A1', 'Planning remote maintenance', 'Remote maintenance shall be planned and authorized', 2, 431, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'OPS.2.4.A2', 'Secure connection for remote maintenance', 'Connections for remote maintenance shall be secured using encryption and authentication', 2, 432, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Layer: DER — Detection and Response
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-b51900000005', 'DER', 'Detection and Response', 'Security event detection, incident management and emergency response', 0, 500, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'DER.1', 'Detection of security-relevant events', 'SIEM, log analysis and monitoring for detecting security incidents', 1, 501, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'DER.1.A1', 'Creation of a security incident detection policy', 'A policy for detecting security-relevant events shall be created', 2, 502, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'DER.1.A2', 'Compliance with reporting obligations', 'Legal and contractual reporting obligations shall be complied with', 2, 503, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'DER.2.1', 'Incident handling', 'Structured handling and management of information security incidents', 1, 510, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'DER.2.1.A1', 'Definition of an incident handling policy', 'A policy for handling security incidents shall be defined', 2, 511, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'DER.2.1.A2', 'Creation of guidelines for incident handling', 'Detailed guidelines for security incident handling shall be created', 2, 512, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'DER.2.2', 'Forensics', 'IT forensic investigation procedures and evidence handling', 1, 520, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'DER.2.2.A1', 'Examination of the system environment for forensics', 'The system environment shall be examined to support forensic investigations', 2, 521, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'DER.3.1', 'Audits and revisions', 'Internal and external auditing of information security measures', 1, 530, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'DER.3.1.A1', 'Definition of an audit policy', 'An audit policy governing scope, schedule and responsibilities shall be defined', 2, 531, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'DER.4', 'Emergency management', 'Business continuity and IT emergency management (Notfallmanagement)', 1, 540, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'DER.4.A1', 'Creation of an emergency handbook', 'An emergency handbook shall be created covering procedures for security emergencies', 2, 541, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'DER.4.A2', 'Integration into the security process', 'Emergency management shall be integrated into the overall security process', 2, 542, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Layer: APP — Applications
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-b51900000005', 'APP', 'Applications', 'Security of applications including office, web, email and business applications', 0, 600, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'APP.1.1', 'Office products', 'Security of office productivity applications (word processors, spreadsheets, presentations)', 1, 601, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'APP.1.1.A1', 'Ensuring the integrity of office products', 'The integrity of office products shall be ensured through controlled installation', 2, 602, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'APP.1.1.A2', 'Restriction of active content in office documents', 'Active content such as macros shall be restricted in office documents', 2, 603, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'APP.1.2', 'Web browser', 'Secure configuration and operation of web browsers', 1, 610, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'APP.1.2.A1', 'Use of sandboxing', 'Web browsers shall use sandboxing mechanisms to isolate web content', 2, 611, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'APP.1.2.A2', 'Encryption of browser communication', 'Browser communication shall be encrypted using TLS', 2, 612, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'APP.3.2', 'Web server', 'Security of web server infrastructure and configuration', 1, 620, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'APP.3.2.A1', 'Secure configuration of web servers', 'Web servers shall be securely configured following hardening guidelines', 2, 621, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'APP.3.2.A2', 'Protection of web server files', 'Web server files shall be protected against unauthorized access', 2, 622, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'APP.5.3', 'Email servers and clients', 'Security of email/groupware infrastructure and communication', 1, 630, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'APP.5.3.A1', 'Secure configuration of email servers', 'Email servers shall be securely configured and hardened', 2, 631, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'APP.5.3.A2', 'Encryption of email communication', 'Email communication shall be encrypted in transit and optionally at rest', 2, 632, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'APP.7', 'Enterprise applications', 'Security of business-critical enterprise applications (ERP, CRM, etc.)', 1, 640, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'APP.7.A1', 'Documentation of enterprise applications', 'Enterprise applications shall be documented including security configurations', 2, 641, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'APP.7.A2', 'Access control for enterprise applications', 'Access to enterprise applications shall be controlled and monitored', 2, 642, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Layer: SYS — IT Systems
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-b51900000005', 'SYS', 'IT Systems', 'Security of servers, clients, mobile devices and other IT systems', 0, 700, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'SYS.1.1', 'General server', 'Fundamental security requirements for server systems', 1, 701, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'SYS.1.1.A1', 'Suitable installation of a server', 'Servers shall be installed in a suitable and secure environment', 2, 702, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'SYS.1.1.A2', 'User authentication on servers', 'User authentication on servers shall be implemented securely', 2, 703, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'SYS.1.3', 'Linux and Unix servers', 'Security requirements specific to Linux and Unix server operating systems', 1, 710, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'SYS.1.3.A1', 'User authentication under Linux', 'User authentication under Linux shall use secure mechanisms such as PAM', 2, 711, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'SYS.1.3.A2', 'Careful assignment of user and group IDs', 'User and group IDs shall be carefully assigned following the least-privilege principle', 2, 712, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'SYS.1.5', 'Virtualization', 'Security of virtualization platforms and virtual machine management', 1, 720, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'SYS.1.5.A1', 'Planning the use of virtualization', 'The use of virtualization shall be planned considering security requirements', 2, 721, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'SYS.1.5.A2', 'Secure use of virtual environments', 'Virtual environments shall be operated securely with proper isolation', 2, 722, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'SYS.2.1', 'General client', 'Fundamental security requirements for client systems and workstations', 1, 730, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'SYS.2.1.A1', 'User authentication', 'Users shall authenticate before accessing client systems', 2, 731, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'SYS.2.1.A2', 'Rollout planning for client systems', 'Rollout of client systems shall be planned including security configuration', 2, 732, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'SYS.2.1.A3', 'Activation of automatic update mechanisms', 'Automatic update mechanisms shall be activated for client operating systems', 2, 733, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'SYS.3.1', 'Laptops', 'Additional security requirements for mobile laptop computers', 1, 740, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'SYS.3.1.A1', 'Regulations for mobile laptop use', 'Regulations for the mobile use of laptops shall be established', 2, 741, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'SYS.3.1.A2', 'Access protection for laptops', 'Laptops shall be protected with strong access controls including full disk encryption', 2, 742, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'SYS.4.1', 'Printers, copiers and multifunction devices', 'Security of printers, copiers and multifunction devices in networked environments', 1, 750, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'SYS.4.1.A1', 'Planning the use of printers and MFDs', 'The deployment of printers and MFDs shall be planned including network segmentation', 2, 751, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'SYS.4.1.A2', 'Restriction of access to printers', 'Access to printers shall be restricted to authorized users', 2, 752, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Layer: NET — Networks and Communication
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-b51900000005', 'NET', 'Networks and Communication', 'Network architecture, management and active network components', 0, 800, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'NET.1.1', 'Network architecture and design', 'Design of secure network architectures with segmentation and zones', 1, 801, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'NET.1.1.A1', 'Network segmentation policy', 'A network segmentation policy shall be defined based on protection requirements', 2, 802, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'NET.1.1.A2', 'Documentation of the network architecture', 'The network architecture shall be fully documented and kept up to date', 2, 803, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'NET.1.2', 'Network management', 'Management and monitoring of network infrastructure', 1, 810, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'NET.1.2.A1', 'Planning network management', 'Network management shall be planned including tools and processes', 2, 811, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'NET.1.2.A2', 'Requirements for network management protocols', 'Secure network management protocols (e.g. SNMPv3, SSH) shall be required', 2, 812, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'NET.3.1', 'Router and switches', 'Security of routers and layer-3 switches in network infrastructure', 1, 820, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'NET.3.1.A1', 'Secure basic configuration of routers', 'Routers shall be configured with secure default settings', 2, 821, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'NET.3.1.A2', 'Access restriction for administrative interfaces', 'Administrative interfaces of routers shall be access-restricted', 2, 822, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'NET.3.2', 'Firewall', 'Security of firewall systems including rule management and monitoring', 1, 830, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'NET.3.2.A1', 'Definition of a firewall policy', 'A firewall policy defining allowed and denied traffic shall be defined', 2, 831, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'NET.3.2.A2', 'Setting firewall rules', 'Firewall rules shall be set following the principle of least privilege', 2, 832, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'NET.4.1', 'Telecommunication systems', 'Security of VoIP and traditional telecommunication systems', 1, 840, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'NET.4.1.A1', 'Requirements analysis for TK systems', 'A requirements analysis for telecommunication systems shall be performed', 2, 841, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'NET.4.1.A2', 'Selection of a TK service provider', 'TK service providers shall be selected based on security criteria', 2, 842, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Layer: INF — Infrastructure
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-b51900000005', 'INF', 'Infrastructure', 'Physical security of buildings, data centers, offices and mobile workplaces', 0, 900, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.1', 'General building', 'General physical security requirements for buildings', 1, 901, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.1.A1', 'Planning of building use', 'Building use shall be planned with consideration of protection requirements', 2, 902, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.1.A2', 'Adapted access control system', 'An access control system adapted to the protection requirements shall be implemented', 2, 903, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.1.A3', 'Compliance with fire protection regulations', 'Fire protection regulations shall be complied with in all building areas', 2, 904, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.2', 'Data center and server room', 'Physical security of data centers and dedicated server rooms', 1, 910, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.2.A1', 'Planning the data center', 'The data center shall be planned with consideration of security requirements', 2, 911, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.2.A2', 'Formation of redundancies in the data center', 'Critical infrastructure in the data center shall be implemented redundantly', 2, 912, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.2.A3', 'Access control to the data center', 'Access to the data center shall be strictly controlled and logged', 2, 913, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.5', 'Technical room', 'Security of technical equipment rooms (electrical, network, HVAC)', 1, 920, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.5.A1', 'Planning of technical rooms', 'Technical rooms shall be planned considering protection requirements', 2, 921, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.5.A2', 'Access protection for technical rooms', 'Access to technical rooms shall be restricted to authorized personnel', 2, 922, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.7', 'Office workspace', 'Security of office workspaces including clean desk and screen lock policies', 1, 930, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.7.A1', 'Planning of office workspaces', 'Office workspaces shall be planned to meet security requirements', 2, 931, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.7.A2', 'Regulations for the office workspace', 'Regulations for the office workspace including clean desk policy shall be established', 2, 932, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.9', 'Mobile workplace', 'Security of mobile and home office workplaces', 1, 940, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.9.A1', 'Usage regulations for mobile workplaces', 'Usage regulations for mobile workplaces shall be established', 2, 941, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.9.A2', 'Protective measures at mobile workplaces', 'Suitable protective measures shall be implemented at mobile workplaces', 2, 942, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.14', 'Building automation', 'Security of building automation and management systems', 1, 950, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.14.A1', 'Planning of building automation', 'Building automation systems shall be planned with consideration of IT security', 2, 951, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'INF.14.A2', 'Access control to building automation', 'Access to building automation systems shall be restricted and monitored', 2, 952, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- Layer: IND — Industrial IT
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-b51900000005', 'IND', 'Industrial IT', 'Security of industrial control systems and operational technology', 0, 1000, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'IND.1', 'Process control and automation technology', 'General security of process control and automation systems', 1, 1001, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'IND.1.A1', 'Security concept for operational technology', 'A security concept for operational technology environments shall be developed', 2, 1002, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'IND.1.A2', 'Access control for OT systems', 'Access to OT systems shall be strictly controlled and monitored', 2, 1003, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'IND.2.1', 'General ICS component', 'Security of general industrial control system components (PLCs, HMIs, SCADA)', 1, 1010, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'IND.2.1.A1', 'Restriction of access to ICS components', 'Access to ICS components shall be restricted to authorized personnel', 2, 1011, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'IND.2.1.A2', 'Use of secure protocols for ICS', 'Secure communication protocols shall be used for ICS components', 2, 1012, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'IND.3', 'Production network segmentation', 'Segmentation of production networks from corporate IT networks', 1, 1020, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'IND.3.A1', 'Segmentation of the production network', 'The production network shall be segmented from the corporate IT network', 2, 1021, 'active'),
('c0000000-0000-0000-0000-b51900000005', 'IND.3.A2', 'Monitoring of the production network', 'The production network shall be monitored for security anomalies', 2, 1022, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;
