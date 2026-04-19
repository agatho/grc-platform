-- ============================================================================
-- ARCTOS Seed: NIST SP 800-171 Rev. 3 + CMMC 2.0
-- Source: NIST SP 800-171 Rev. 3 (May 2024) — Protecting CUI in non-federal systems
--         CMMC 2.0 (Cybersecurity Maturity Model Certification, DoD)
--
-- NIST 800-171 Rev. 3 has 110 security requirements across 17 families.
-- CMMC 2.0 has 3 levels:
--   Level 1 (Foundational) = 17 practices from FAR 52.204-21
--   Level 2 (Advanced)     = 110 practices from NIST 800-171
--   Level 3 (Expert)       = 110 + selected practices from NIST 800-172
--
-- This seed includes the 17 NIST 800-171 family headers + key requirements
-- and the CMMC level mapping. NIST 800-171 codes match CMMC L2 1:1.
--
-- Target modules: isms (CUI handling), ics (controls), tprm (DoD supply chain)
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-800171000003',
  'NIST SP 800-171 Rev. 3 / CMMC 2.0',
  'NIST Special Publication 800-171 Rev. 3 — security requirements for protecting Controlled Unclassified Information (CUI) in non-federal systems and organizations. Aligned 1:1 with CMMC 2.0 Level 2. 17 families, 110 requirements.',
  'control', 'platform', 'nist_800_171_r3', 'rev3', 'en', true, '{isms,ics,tprm}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
-- ── Family Headers (17) ────────────────────────────────────────────────────
('c0000000-0000-0000-0000-800171000003', '03.01', 'Access Control (AC)', 'Family covering account management, access enforcement, separation of duties, least privilege, remote and mobile access', 0, 100, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.02', 'Awareness and Training (AT)', 'Family covering literacy training, role-based training and insider-threat awareness', 0, 200, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.03', 'Audit and Accountability (AU)', 'Event logging, audit record content, log review, log protection', 0, 300, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.04', 'Configuration Management (CM)', 'Baseline configurations, change control, least functionality, system component inventory', 0, 400, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.05', 'Identification and Authentication (IA)', 'Identification, authentication, MFA, replay-resistant, password complexity', 0, 500, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.06', 'Incident Response (IR)', 'Incident handling, monitoring, reporting, response training and testing', 0, 600, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.07', 'Maintenance (MA)', 'System maintenance, controlled maintenance, nonlocal maintenance, maintenance personnel', 0, 700, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.08', 'Media Protection (MP)', 'Media access, marking, storage, transport, sanitization, media use restrictions', 0, 800, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.09', 'Personnel Security (PS)', 'Personnel screening, personnel termination/transfer', 0, 900, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.10', 'Physical Protection (PE)', 'Physical access authorization, control, monitoring; visitor control; equipment delivery and removal', 0, 1000, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.11', 'Risk Assessment (RA)', 'Risk assessment, vulnerability monitoring and scanning', 0, 1100, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.12', 'Security Assessment and Monitoring (CA)', 'Security control assessment, plan of action and milestones (POA&M), system security plans', 0, 1200, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.13', 'System and Communications Protection (SC)', 'Boundary protection, transmission security, cryptographic key management, denial-of-service protection', 0, 1300, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.14', 'System and Information Integrity (SI)', 'Flaw remediation, malicious-code protection, system monitoring, security alerts and advisories', 0, 1400, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.15', 'Planning (PL)', 'Policy and procedures, system security and privacy plans, rules of behavior', 0, 1500, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.16', 'System and Services Acquisition (SA)', 'Acquisition process, external system services, system development life cycle', 0, 1600, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.17', 'Supply Chain Risk Management (SR)', 'Supply chain risk management plan, controls, processes', 0, 1700, 'active'),

-- ── Selected key requirements (Level-2 / CMMC L2 = NIST 800-171) ──────────
('c0000000-0000-0000-0000-800171000003', '03.01.01', 'Account Management', 'Define types of accounts, assign account managers, require approvals for account creation, monitor account use, disable accounts within defined timeframes', 1, 110, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.01.02', 'Access Enforcement', 'Enforce approved authorizations for logical access to CUI and system resources in accordance with applicable access control policies', 1, 111, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.01.05', 'Least Privilege', 'Employ the principle of least privilege, including for specific security functions and privileged accounts', 1, 112, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.01.06', 'Least Privilege — Privileged Accounts', 'Authorize and document use of privileged accounts on the system', 1, 113, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.01.07', 'Least Privilege — Privileged Functions', 'Prevent non-privileged users from executing privileged functions; capture execution of such functions in audit logs', 1, 114, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.01.10', 'Device Lock', 'Prevent further access to the system by initiating a device lock after a defined period of inactivity', 1, 115, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.01.12', 'Remote Access', 'Establish usage restrictions, configuration/connection requirements and implementation guidance for each type of remote access; authorize remote access prior to allowing such connections', 1, 116, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.01.16', 'Wireless Access', 'Establish usage restrictions, configuration/connection requirements for wireless access; authorize wireless access prior to allowing such connections; protect wireless access using authentication and encryption', 1, 117, 'active'),

('c0000000-0000-0000-0000-800171000003', '03.02.01', 'Literacy Training and Awareness', 'Provide security literacy training to system users on insider threat indicators, social engineering, social mining', 1, 210, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.02.02', 'Role-Based Training', 'Provide role-based security training to personnel with assigned security roles and responsibilities', 1, 211, 'active'),

('c0000000-0000-0000-0000-800171000003', '03.03.01', 'Event Logging', 'Specify the following event types selected for logging within the system', 1, 310, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.03.03', 'Audit Record Generation', 'Generate audit records containing information that establishes what type of event occurred, when, where, source, outcome and identity of subjects/objects', 1, 311, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.03.04', 'Response to Audit Logging Process Failures', 'Alert defined personnel within a defined time frame in the event of an audit logging process failure', 1, 312, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.03.05', 'Audit Record Review, Analysis and Reporting', 'Review and analyze system audit records on an ongoing basis for indications of inappropriate or unusual activity', 1, 313, 'active'),

('c0000000-0000-0000-0000-800171000003', '03.04.01', 'Baseline Configuration', 'Develop, document and maintain under configuration control a current baseline configuration of the system', 1, 410, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.04.02', 'Configuration Settings', 'Establish, document and implement the following configuration settings for the system that reflect the most restrictive mode consistent with operational requirements', 1, 411, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.04.06', 'Least Functionality', 'Configure the system to provide only the capabilities essential for organizational missions and functions', 1, 412, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.04.10', 'System Component Inventory', 'Develop and document an inventory of system components that accurately reflects the current system', 1, 413, 'active'),

('c0000000-0000-0000-0000-800171000003', '03.05.01', 'User Identification, Authentication and Re-Authentication', 'Uniquely identify and authenticate users and re-authenticate users when defined circumstances or situations require re-authentication', 1, 510, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.05.03', 'Multi-Factor Authentication', 'Implement multi-factor authentication for access to privileged accounts, network access to non-privileged accounts and access to CUI', 1, 511, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.05.04', 'Replay-Resistant Authentication', 'Implement replay-resistant authentication mechanisms for access to privileged accounts and to CUI', 1, 512, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.05.07', 'Password Management', 'For password-based authentication enforce specific composition and complexity rules and password lifetime restrictions', 1, 513, 'active'),

('c0000000-0000-0000-0000-800171000003', '03.06.01', 'Incident Handling', 'Implement an incident-handling capability that includes preparation, detection and analysis, containment, eradication and recovery', 1, 610, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.06.02', 'Incident Monitoring, Reporting and Response Assistance', 'Track and document incidents; report incidents to appropriate authorities; provide incident response assistance', 1, 611, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.06.03', 'Incident Response Testing', 'Test the effectiveness of the incident response capability for the system', 1, 612, 'active'),

('c0000000-0000-0000-0000-800171000003', '03.07.04', 'Maintenance Tools', 'Approve, control and monitor the use of system maintenance tools', 1, 710, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.07.05', 'Nonlocal Maintenance', 'Approve and monitor nonlocal maintenance and diagnostic activities', 1, 711, 'active'),

('c0000000-0000-0000-0000-800171000003', '03.08.03', 'Media Sanitization', 'Sanitize system media containing CUI prior to disposal, release out of organizational control or release for reuse', 1, 810, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.08.04', 'Media Marking', 'Mark system media containing CUI to indicate distribution limitations, handling caveats and applicable security markings', 1, 811, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.08.06', 'Media Transport', 'Protect and control system media containing CUI during transport outside of controlled areas', 1, 812, 'active'),

('c0000000-0000-0000-0000-800171000003', '03.09.01', 'Personnel Screening', 'Screen individuals prior to authorizing access to systems containing CUI', 1, 910, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.09.02', 'Personnel Termination and Transfer', 'When individual employment is terminated or individuals are reassigned, ensure access to CUI is revoked', 1, 911, 'active'),

('c0000000-0000-0000-0000-800171000003', '03.10.01', 'Physical Access Authorizations', 'Develop, approve and maintain a list of individuals with authorized access to facilities where CUI is processed', 1, 1010, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.10.02', 'Monitoring Physical Access', 'Monitor physical access to facilities and detect/respond to physical security incidents', 1, 1011, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.10.07', 'Physical Access Control', 'Enforce physical access authorizations at entry/exit points to facilities where CUI is processed', 1, 1012, 'active'),

('c0000000-0000-0000-0000-800171000003', '03.11.01', 'Risk Assessment', 'Periodically assess the risk to organizational operations, assets and individuals from CUI processing', 1, 1110, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.11.02', 'Vulnerability Monitoring and Scanning', 'Monitor and scan for vulnerabilities in the system and hosted applications periodically and when new vulnerabilities are identified', 1, 1111, 'active'),

('c0000000-0000-0000-0000-800171000003', '03.12.01', 'Security Assessment', 'Periodically assess the security controls in the system to determine if they are effective in their application', 1, 1210, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.12.02', 'Plan of Action and Milestones', 'Develop and update a plan of action and milestones (POA&M) for the system', 1, 1211, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.12.04', 'System Security Plan', 'Develop, document and periodically update a system security plan that describes the system boundary, environment of operation, security requirements and the controls in place', 1, 1212, 'active'),

('c0000000-0000-0000-0000-800171000003', '03.13.01', 'Boundary Protection', 'Monitor, control and protect communications at the external boundary of the system and at key internal boundaries', 1, 1310, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.13.05', 'Network Communications by Default Deny — Allow by Exception', 'Deny network communications traffic by default and allow network communications traffic by exception', 1, 1311, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.13.08', 'Transmission and Storage Confidentiality', 'Implement cryptographic mechanisms to prevent unauthorized disclosure of CUI during transmission and at rest', 1, 1312, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.13.10', 'Cryptographic Key Establishment and Management', 'Establish and manage cryptographic keys for cryptography employed in the system', 1, 1313, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.13.11', 'Cryptographic Protection', 'Implement the following types of cryptography to protect the confidentiality of CUI', 1, 1314, 'active'),

('c0000000-0000-0000-0000-800171000003', '03.14.01', 'Flaw Remediation', 'Identify, report and correct system flaws in a timely manner', 1, 1410, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.14.02', 'Malicious Code Protection', 'Provide protection from malicious code at designated locations within the system', 1, 1411, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.14.03', 'Security Alerts, Advisories and Directives', 'Receive system security alerts, advisories and directives from external organizations on an ongoing basis', 1, 1412, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.14.06', 'System Monitoring', 'Monitor the system to detect attacks and indicators of potential attacks', 1, 1413, 'active'),

('c0000000-0000-0000-0000-800171000003', '03.15.01', 'Policies and Procedures', 'Develop, document and disseminate to defined personnel the policies and procedures for each security family', 1, 1510, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.15.02', 'System Security Plan', 'Develop and update the system security plan for the system', 1, 1511, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.15.03', 'Rules of Behavior', 'Establish and provide to individuals requiring access to the system the rules describing their responsibilities and expected behavior', 1, 1512, 'active'),

('c0000000-0000-0000-0000-800171000003', '03.16.01', 'External System Services', 'Require external service providers to comply with the same security requirements that apply to the organization', 1, 1610, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.16.02', 'Acquisition Process', 'Include the following requirements, descriptions and criteria, explicitly in the acquisition contract for the system, system component or system service', 1, 1611, 'active'),

('c0000000-0000-0000-0000-800171000003', '03.17.01', 'Supply Chain Risk Management Plan', 'Develop and implement a plan for managing supply chain risks associated with the system', 1, 1710, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.17.02', 'Acquisition Strategies, Tools and Methods', 'Employ the acquisition strategies, contract tools and procurement methods to identify, protect against and mitigate supply chain risks', 1, 1711, 'active'),
('c0000000-0000-0000-0000-800171000003', '03.17.03', 'Supply Chain Requirements and Processes', 'Establish supply chain risk management requirements and processes including a process for identifying suppliers and the security of products, services and information they provide', 1, 1712, 'active');

-- ============================================================================
-- CMMC 2.0 — Cybersecurity Maturity Model Certification
-- 3 levels; Level 1 = FAR 52.204-21 (17 practices); Level 2 = NIST 800-171 (110)
-- Level 3 = NIST 800-171 + selected NIST 800-172 enhancements (~24)
-- ============================================================================
INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-c0c0cc000002',
  'CMMC 2.0',
  'DoD Cybersecurity Maturity Model Certification 2.0. Three levels: Level 1 (Foundational, 17 practices), Level 2 (Advanced, 110 practices = NIST 800-171), Level 3 (Expert, 110 + NIST 800-172 enhanced).',
  'control', 'platform', 'cmmc_v2', '2.0', 'en', true, '{isms,ics,tprm}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
-- Level 1 (Foundational) — FAR 52.204-21 — 17 practices
('c0000000-0000-0000-0000-c0c0cc000002', 'L1', 'Level 1 — Foundational (17 practices, FAR 52.204-21)', 'Basic safeguarding of FCI (Federal Contract Information). Annual self-assessment.', 0, 100, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'AC.L1-3.1.1', 'Authorized Access Control', 'Limit information system access to authorized users, processes acting on behalf of users, or devices', 1, 101, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'AC.L1-3.1.2', 'Transaction & Function Control', 'Limit information system access to the types of transactions and functions that authorized users are permitted to execute', 1, 102, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'AC.L1-3.1.20', 'External Connections', 'Verify and control/limit connections to and use of external information systems', 1, 103, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'AC.L1-3.1.22', 'Control Public Information', 'Control information posted or processed on publicly accessible information systems', 1, 104, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'IA.L1-3.5.1', 'Identification', 'Identify information system users, processes acting on behalf of users, or devices', 1, 105, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'IA.L1-3.5.2', 'Authentication', 'Authenticate (or verify) the identities of users, processes, or devices, as a prerequisite to allowing access', 1, 106, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'MP.L1-3.8.3', 'Media Disposal', 'Sanitize or destroy information system media containing FCI before disposal or release for reuse', 1, 107, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'PE.L1-3.10.1', 'Limit Physical Access', 'Limit physical access to organizational information systems, equipment and the respective operating environments to authorized individuals', 1, 108, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'PE.L1-3.10.3', 'Escort Visitors', 'Escort visitors and monitor visitor activity', 1, 109, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'PE.L1-3.10.4', 'Physical Access Logs', 'Maintain audit logs of physical access', 1, 110, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'PE.L1-3.10.5', 'Manage Physical Access', 'Control and manage physical access devices', 1, 111, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'SC.L1-3.13.1', 'Boundary Protection', 'Monitor, control and protect organizational communications at the external boundaries and key internal boundaries', 1, 112, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'SC.L1-3.13.5', 'Public-Access System Separation', 'Implement subnetworks for publicly accessible system components that are physically or logically separated from internal networks', 1, 113, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'SI.L1-3.14.1', 'Flaw Remediation', 'Identify, report and correct information and information system flaws in a timely manner', 1, 114, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'SI.L1-3.14.2', 'Malicious Code Protection', 'Provide protection from malicious code at appropriate locations within organizational information systems', 1, 115, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'SI.L1-3.14.4', 'Update Malicious Code Protection', 'Update malicious code protection mechanisms when new releases are available', 1, 116, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'SI.L1-3.14.5', 'System & File Scanning', 'Perform periodic scans of the information system and real-time scans of files from external sources as files are downloaded, opened or executed', 1, 117, 'active'),

-- Level 2 (Advanced) — NIST 800-171 alignment
('c0000000-0000-0000-0000-c0c0cc000002', 'L2', 'Level 2 — Advanced (110 practices = NIST 800-171)', 'Protection of CUI. Self-assessment for non-prioritized CUI; C3PAO third-party assessment for prioritized CUI. Triennial.', 0, 200, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'L2-NOTE', 'Level 2 practices', 'All 110 NIST 800-171 Rev. 3 requirements apply. See catalog "nist_800_171_r3" for the full set; this level inherits 1:1.', 1, 201, 'active'),

-- Level 3 (Expert) — NIST 800-172 enhanced
('c0000000-0000-0000-0000-c0c0cc000002', 'L3', 'Level 3 — Expert (110 + NIST 800-172 enhanced)', 'Protection of CUI against APTs. Government-led assessment by DIBCAC. Required for highest-priority defense programs.', 0, 300, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'L3-AC.L3-3.1.2e', 'Restrict Non-Organizational Users', 'Restrict access to systems and system components to only those information resources that are owned, provisioned or issued by the organization', 1, 301, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'L3-AT.L3-3.2.1e', 'Advanced Threat Awareness', 'Provide advanced literacy training and awareness of current cybersecurity threats and APT tactics', 1, 302, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'L3-IR.L3-3.6.1e', 'Security Operations Center', 'Establish and maintain a security operations center capability that operates 24/7', 1, 303, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'L3-IR.L3-3.6.2e', 'Cyber Incident Response Team', 'Establish and maintain a cyber incident response team that can be deployed by the organization within 24 hours', 1, 304, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'L3-RA.L3-3.11.1e', 'Threat-Informed Risk Assessment', 'Employ threat intelligence to inform the development of the system and security architectures, selection of security solutions, monitoring, threat hunting and response and recovery activities', 1, 305, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'L3-RA.L3-3.11.6e', 'Supply Chain Risk Response', 'Assess, respond to and monitor supply chain risks associated with organizational systems and system components', 1, 306, 'active'),
('c0000000-0000-0000-0000-c0c0cc000002', 'L3-SI.L3-3.14.6e', 'Threat-Hunting Operations', 'Conduct threat-hunting activities on an ongoing basis or when indications warrant', 1, 307, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- Done. NIST 800-171 (~70 entries: 17 family headers + ~50 key requirements) +
--       CMMC 2.0 (~25 entries: L1 17 practices + L2 reference + L3 enhanced)
