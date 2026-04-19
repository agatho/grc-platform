-- ============================================================================
-- ARCTOS Seed: NIST SP 800-53 Rev. 5 — Security and Privacy Controls
-- Source: NIST SP 800-53 Revision 5 (Sept 2020) + Patch Release 5.1.1
-- US Federal control catalog: 20 control families, ~1,189 controls/enhancements
--
-- This seed includes the 20 control families plus the BASE controls (1 per
-- family) and the most-cited high-impact controls used in cross-mappings.
-- For full enhancement coverage, see NIST OSCAL releases.
--
-- Target modules: isms, ics
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-800530000001',
  'NIST SP 800-53 Rev. 5',
  'NIST Special Publication 800-53 Revision 5: Security and Privacy Controls for Information Systems and Organizations. 20 control families covering access, audit, awareness, configuration, contingency, identification, incident response, maintenance, media, physical, planning, personnel, risk assessment, system services, communications, integrity, supply chain, and privacy.',
  'control', 'platform', 'nist_800_53_r5', 'rev5', 'en', true, '{isms,ics,erm}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
-- ── Family Headers (20) ────────────────────────────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'AC', 'Access Control', 'Control of logical access to information and information systems', 0, 100, 'active'),
('c0000000-0000-0000-0000-800530000001', 'AT', 'Awareness and Training', 'Security awareness and role-based training of personnel', 0, 200, 'active'),
('c0000000-0000-0000-0000-800530000001', 'AU', 'Audit and Accountability', 'Auditable event logging and accountability', 0, 300, 'active'),
('c0000000-0000-0000-0000-800530000001', 'CA', 'Assessment, Authorization, and Monitoring', 'System assessment, authorization to operate (ATO), and continuous monitoring', 0, 400, 'active'),
('c0000000-0000-0000-0000-800530000001', 'CM', 'Configuration Management', 'Baseline configurations, change control, and configuration settings', 0, 500, 'active'),
('c0000000-0000-0000-0000-800530000001', 'CP', 'Contingency Planning', 'System contingency planning, backup, recovery and alternate sites', 0, 600, 'active'),
('c0000000-0000-0000-0000-800530000001', 'IA', 'Identification and Authentication', 'Identification and authentication of organizational and non-organizational users', 0, 700, 'active'),
('c0000000-0000-0000-0000-800530000001', 'IR', 'Incident Response', 'Incident response training, testing, handling and reporting', 0, 800, 'active'),
('c0000000-0000-0000-0000-800530000001', 'MA', 'Maintenance', 'Controlled system maintenance and remote maintenance', 0, 900, 'active'),
('c0000000-0000-0000-0000-800530000001', 'MP', 'Media Protection', 'Protection, transport, sanitization and destruction of media', 0, 1000, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PE', 'Physical and Environmental Protection', 'Physical access, environmental controls, fire protection and equipment', 0, 1100, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PL', 'Planning', 'Security and privacy planning, system security plans', 0, 1200, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PM', 'Program Management', 'Information security and privacy program management', 0, 1300, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PS', 'Personnel Security', 'Personnel screening, transfer, termination and sanctions', 0, 1400, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PT', 'PII Processing and Transparency', 'Privacy controls for processing PII', 0, 1500, 'active'),
('c0000000-0000-0000-0000-800530000001', 'RA', 'Risk Assessment', 'Risk assessment, vulnerability scanning, threat hunting', 0, 1600, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SA', 'System and Services Acquisition', 'Acquisition processes, supplier risk, secure development', 0, 1700, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SC', 'System and Communications Protection', 'Cryptography, network protection, application partitioning', 0, 1800, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SI', 'System and Information Integrity', 'Flaw remediation, malicious-code protection, system monitoring', 0, 1900, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SR', 'Supply Chain Risk Management', 'Supply chain risk management policy, plan and controls', 0, 2000, 'active'),

-- ── Access Control (AC) selected ───────────────────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'AC-1', 'Policy and Procedures', 'Develop, document and disseminate access-control policy and procedures', 1, 110, 'active'),
('c0000000-0000-0000-0000-800530000001', 'AC-2', 'Account Management', 'Define and document the types of accounts, group/role membership and authorization', 1, 111, 'active'),
('c0000000-0000-0000-0000-800530000001', 'AC-3', 'Access Enforcement', 'Enforce approved authorizations for logical access', 1, 112, 'active'),
('c0000000-0000-0000-0000-800530000001', 'AC-4', 'Information Flow Enforcement', 'Enforce approved authorizations for information flows within and between systems', 1, 113, 'active'),
('c0000000-0000-0000-0000-800530000001', 'AC-5', 'Separation of Duties', 'Separate duties of individuals and document such separation', 1, 114, 'active'),
('c0000000-0000-0000-0000-800530000001', 'AC-6', 'Least Privilege', 'Employ the principle of least privilege', 1, 115, 'active'),
('c0000000-0000-0000-0000-800530000001', 'AC-7', 'Unsuccessful Logon Attempts', 'Enforce a limit of consecutive invalid logon attempts', 1, 116, 'active'),
('c0000000-0000-0000-0000-800530000001', 'AC-17', 'Remote Access', 'Establish and document usage restrictions and implementation guidance for remote access', 1, 117, 'active'),
('c0000000-0000-0000-0000-800530000001', 'AC-18', 'Wireless Access', 'Establish and document usage restrictions for wireless access', 1, 118, 'active'),
('c0000000-0000-0000-0000-800530000001', 'AC-19', 'Access Control for Mobile Devices', 'Establish and document usage restrictions for mobile devices', 1, 119, 'active'),

-- ── Awareness and Training (AT) ────────────────────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'AT-1', 'Policy and Procedures', 'Develop and disseminate awareness and training policy', 1, 210, 'active'),
('c0000000-0000-0000-0000-800530000001', 'AT-2', 'Literacy Training and Awareness', 'Provide security and privacy literacy training to system users', 1, 211, 'active'),
('c0000000-0000-0000-0000-800530000001', 'AT-3', 'Role-Based Training', 'Provide role-based security and privacy training before granting access', 1, 212, 'active'),
('c0000000-0000-0000-0000-800530000001', 'AT-4', 'Training Records', 'Document and monitor security and privacy training activities', 1, 213, 'active'),

-- ── Audit and Accountability (AU) ──────────────────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'AU-1', 'Policy and Procedures', 'Develop and disseminate audit and accountability policy', 1, 310, 'active'),
('c0000000-0000-0000-0000-800530000001', 'AU-2', 'Event Logging', 'Identify the types of events to be logged', 1, 311, 'active'),
('c0000000-0000-0000-0000-800530000001', 'AU-3', 'Content of Audit Records', 'Ensure audit records contain who/what/when/where/source/outcome', 1, 312, 'active'),
('c0000000-0000-0000-0000-800530000001', 'AU-6', 'Audit Record Review, Analysis, and Reporting', 'Review and analyze audit records', 1, 313, 'active'),
('c0000000-0000-0000-0000-800530000001', 'AU-9', 'Protection of Audit Information', 'Protect audit information and audit tools from unauthorized access', 1, 314, 'active'),
('c0000000-0000-0000-0000-800530000001', 'AU-12', 'Audit Record Generation', 'Provide audit record generation capability for the auditable events', 1, 315, 'active'),

-- ── Assessment, Authorization, Monitoring (CA) ────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'CA-1', 'Policy and Procedures', 'Develop and disseminate assessment, authorization and monitoring policy', 1, 410, 'active'),
('c0000000-0000-0000-0000-800530000001', 'CA-2', 'Control Assessments', 'Develop a control-assessment plan and assess controls', 1, 411, 'active'),
('c0000000-0000-0000-0000-800530000001', 'CA-3', 'Information Exchange', 'Approve and manage the exchange of information between systems', 1, 412, 'active'),
('c0000000-0000-0000-0000-800530000001', 'CA-5', 'Plan of Action and Milestones', 'Develop and update plans of action and milestones (POA&M)', 1, 413, 'active'),
('c0000000-0000-0000-0000-800530000001', 'CA-7', 'Continuous Monitoring', 'Develop a continuous-monitoring strategy and implement it', 1, 414, 'active'),

-- ── Configuration Management (CM) ──────────────────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'CM-1', 'Policy and Procedures', 'Develop and disseminate configuration-management policy', 1, 510, 'active'),
('c0000000-0000-0000-0000-800530000001', 'CM-2', 'Baseline Configuration', 'Develop, document and maintain a current baseline configuration', 1, 511, 'active'),
('c0000000-0000-0000-0000-800530000001', 'CM-3', 'Configuration Change Control', 'Determine, document and implement changes to the baseline', 1, 512, 'active'),
('c0000000-0000-0000-0000-800530000001', 'CM-6', 'Configuration Settings', 'Establish and document configuration settings consistent with security requirements', 1, 513, 'active'),
('c0000000-0000-0000-0000-800530000001', 'CM-7', 'Least Functionality', 'Configure the system to provide only essential capabilities', 1, 514, 'active'),
('c0000000-0000-0000-0000-800530000001', 'CM-8', 'System Component Inventory', 'Develop and document a system component inventory', 1, 515, 'active'),

-- ── Contingency Planning (CP) ──────────────────────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'CP-1', 'Policy and Procedures', 'Develop and disseminate contingency-planning policy', 1, 610, 'active'),
('c0000000-0000-0000-0000-800530000001', 'CP-2', 'Contingency Plan', 'Develop a contingency plan covering identified contingencies', 1, 611, 'active'),
('c0000000-0000-0000-0000-800530000001', 'CP-3', 'Contingency Training', 'Provide contingency training to personnel', 1, 612, 'active'),
('c0000000-0000-0000-0000-800530000001', 'CP-4', 'Contingency Plan Testing', 'Test the contingency plan at defined frequency', 1, 613, 'active'),
('c0000000-0000-0000-0000-800530000001', 'CP-9', 'System Backup', 'Conduct backups consistent with recovery objectives', 1, 614, 'active'),
('c0000000-0000-0000-0000-800530000001', 'CP-10', 'System Recovery and Reconstitution', 'Provide for recovery and reconstitution of the system after disruption', 1, 615, 'active'),

-- ── Identification and Authentication (IA) ─────────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'IA-1', 'Policy and Procedures', 'Develop and disseminate identification and authentication policy', 1, 710, 'active'),
('c0000000-0000-0000-0000-800530000001', 'IA-2', 'Identification and Authentication (Organizational Users)', 'Uniquely identify and authenticate organizational users', 1, 711, 'active'),
('c0000000-0000-0000-0000-800530000001', 'IA-3', 'Device Identification and Authentication', 'Uniquely identify and authenticate devices before connection', 1, 712, 'active'),
('c0000000-0000-0000-0000-800530000001', 'IA-5', 'Authenticator Management', 'Manage system authenticators (passwords, tokens, biometrics)', 1, 713, 'active'),
('c0000000-0000-0000-0000-800530000001', 'IA-7', 'Cryptographic Module Authentication', 'Implement mechanisms for cryptographic module authentication', 1, 714, 'active'),
('c0000000-0000-0000-0000-800530000001', 'IA-8', 'Identification and Authentication (Non-Organizational Users)', 'Uniquely identify and authenticate non-organizational users', 1, 715, 'active'),

-- ── Incident Response (IR) ─────────────────────────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'IR-1', 'Policy and Procedures', 'Develop and disseminate incident response policy', 1, 810, 'active'),
('c0000000-0000-0000-0000-800530000001', 'IR-2', 'Incident Response Training', 'Provide incident response training to personnel', 1, 811, 'active'),
('c0000000-0000-0000-0000-800530000001', 'IR-4', 'Incident Handling', 'Implement an incident-handling capability', 1, 812, 'active'),
('c0000000-0000-0000-0000-800530000001', 'IR-5', 'Incident Monitoring', 'Track and document incidents', 1, 813, 'active'),
('c0000000-0000-0000-0000-800530000001', 'IR-6', 'Incident Reporting', 'Report incidents to appropriate authorities', 1, 814, 'active'),
('c0000000-0000-0000-0000-800530000001', 'IR-8', 'Incident Response Plan', 'Develop, distribute and maintain an incident response plan', 1, 815, 'active'),

-- ── Maintenance (MA) ───────────────────────────────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'MA-1', 'Policy and Procedures', 'Develop and disseminate maintenance policy', 1, 910, 'active'),
('c0000000-0000-0000-0000-800530000001', 'MA-2', 'Controlled Maintenance', 'Schedule, document and review records of system maintenance', 1, 911, 'active'),
('c0000000-0000-0000-0000-800530000001', 'MA-4', 'Nonlocal Maintenance', 'Approve, monitor and control non-local maintenance and diagnostic activities', 1, 912, 'active'),

-- ── Media Protection (MP) ──────────────────────────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'MP-1', 'Policy and Procedures', 'Develop and disseminate media-protection policy', 1, 1010, 'active'),
('c0000000-0000-0000-0000-800530000001', 'MP-2', 'Media Access', 'Restrict access to digital and non-digital media', 1, 1011, 'active'),
('c0000000-0000-0000-0000-800530000001', 'MP-3', 'Media Marking', 'Mark system media indicating distribution limitations', 1, 1012, 'active'),
('c0000000-0000-0000-0000-800530000001', 'MP-6', 'Media Sanitization', 'Sanitize media prior to disposal, release out of organizational control or release for reuse', 1, 1013, 'active'),

-- ── Physical and Environmental Protection (PE) ─────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'PE-1', 'Policy and Procedures', 'Develop and disseminate physical and environmental policy', 1, 1110, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PE-2', 'Physical Access Authorizations', 'Develop, approve and maintain physical access authorizations', 1, 1111, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PE-3', 'Physical Access Control', 'Enforce physical access authorizations at entry/exit points', 1, 1112, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PE-6', 'Monitoring Physical Access', 'Monitor physical access to detect and respond to physical security incidents', 1, 1113, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PE-13', 'Fire Protection', 'Employ fire detection and suppression devices', 1, 1114, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PE-14', 'Environmental Controls', 'Maintain temperature/humidity within acceptable levels', 1, 1115, 'active'),

-- ── Planning (PL) ──────────────────────────────────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'PL-1', 'Policy and Procedures', 'Develop and disseminate planning policy', 1, 1210, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PL-2', 'System Security and Privacy Plans', 'Develop a system security plan (SSP) describing the system and security requirements', 1, 1211, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PL-4', 'Rules of Behavior', 'Establish rules of behavior for users', 1, 1212, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PL-8', 'Security and Privacy Architectures', 'Develop security and privacy architectures for the system', 1, 1213, 'active'),

-- ── Program Management (PM) ────────────────────────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'PM-1', 'Information Security Program Plan', 'Develop and disseminate an organization-wide IS-program plan', 1, 1310, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PM-9', 'Risk Management Strategy', 'Develop a comprehensive risk-management strategy', 1, 1311, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PM-30', 'Supply Chain Risk Management Strategy', 'Develop an organization-wide SCRM strategy', 1, 1312, 'active'),

-- ── Personnel Security (PS) ────────────────────────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'PS-1', 'Policy and Procedures', 'Develop and disseminate personnel security policy', 1, 1410, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PS-3', 'Personnel Screening', 'Screen individuals prior to authorizing access', 1, 1411, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PS-4', 'Personnel Termination', 'Terminate access upon termination of individual employment', 1, 1412, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PS-5', 'Personnel Transfer', 'Review and confirm ongoing operational need for current logical access', 1, 1413, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PS-6', 'Access Agreements', 'Develop and document access agreements for organizational systems', 1, 1414, 'active'),

-- ── PII Processing and Transparency (PT) ───────────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'PT-1', 'Policy and Procedures', 'Develop and disseminate PII processing and transparency policy', 1, 1510, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PT-2', 'Authority to Process Personally Identifiable Information', 'Determine and document the authority that permits PII processing', 1, 1511, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PT-3', 'Personally Identifiable Information Processing Purposes', 'Identify and document the purposes for processing PII', 1, 1512, 'active'),
('c0000000-0000-0000-0000-800530000001', 'PT-5', 'Privacy Notice', 'Provide notice to individuals about PII activities', 1, 1513, 'active'),

-- ── Risk Assessment (RA) ───────────────────────────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'RA-1', 'Policy and Procedures', 'Develop and disseminate risk-assessment policy', 1, 1610, 'active'),
('c0000000-0000-0000-0000-800530000001', 'RA-2', 'Security Categorization', 'Categorize the system and the information it processes', 1, 1611, 'active'),
('c0000000-0000-0000-0000-800530000001', 'RA-3', 'Risk Assessment', 'Conduct a risk assessment and document the results', 1, 1612, 'active'),
('c0000000-0000-0000-0000-800530000001', 'RA-5', 'Vulnerability Monitoring and Scanning', 'Monitor and scan for vulnerabilities', 1, 1613, 'active'),
('c0000000-0000-0000-0000-800530000001', 'RA-7', 'Risk Response', 'Respond to findings from security and privacy risk assessments', 1, 1614, 'active'),
('c0000000-0000-0000-0000-800530000001', 'RA-9', 'Criticality Analysis', 'Identify critical system components and functions', 1, 1615, 'active'),

-- ── System and Services Acquisition (SA) ───────────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'SA-1', 'Policy and Procedures', 'Develop and disseminate system and services acquisition policy', 1, 1710, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SA-3', 'System Development Life Cycle', 'Manage the system using a SDLC that incorporates security and privacy', 1, 1711, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SA-4', 'Acquisition Process', 'Include security/privacy requirements in acquisition contracts', 1, 1712, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SA-9', 'External System Services', 'Require providers of external system services to comply with security/privacy requirements', 1, 1713, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SA-11', 'Developer Testing and Evaluation', 'Require developer testing and evaluation', 1, 1714, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SA-15', 'Development Process, Standards, and Tools', 'Require developers to follow a documented process', 1, 1715, 'active'),

-- ── System and Communications Protection (SC) ──────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'SC-1', 'Policy and Procedures', 'Develop and disseminate SC policy', 1, 1810, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SC-7', 'Boundary Protection', 'Monitor and control communications at the external system boundary', 1, 1811, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SC-8', 'Transmission Confidentiality and Integrity', 'Protect the confidentiality and integrity of transmitted information', 1, 1812, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SC-12', 'Cryptographic Key Establishment and Management', 'Establish and manage cryptographic keys', 1, 1813, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SC-13', 'Cryptographic Protection', 'Implement approved cryptographic mechanisms', 1, 1814, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SC-28', 'Protection of Information at Rest', 'Protect the confidentiality/integrity of information at rest', 1, 1815, 'active'),

-- ── System and Information Integrity (SI) ──────────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'SI-1', 'Policy and Procedures', 'Develop and disseminate SI policy', 1, 1910, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SI-2', 'Flaw Remediation', 'Identify, report and correct system flaws', 1, 1911, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SI-3', 'Malicious Code Protection', 'Implement malicious-code protection', 1, 1912, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SI-4', 'System Monitoring', 'Monitor the system to detect attacks and indicators of potential attacks', 1, 1913, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SI-7', 'Software, Firmware, and Information Integrity', 'Employ integrity verification tools to detect unauthorized changes', 1, 1914, 'active'),

-- ── Supply Chain Risk Management (SR) ──────────────────────────────────────
('c0000000-0000-0000-0000-800530000001', 'SR-1', 'Policy and Procedures', 'Develop and disseminate SCRM policy', 1, 2010, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SR-2', 'Supply Chain Risk Management Plan', 'Develop, implement and update a SCRM plan', 1, 2011, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SR-3', 'Supply Chain Controls and Processes', 'Establish a process to identify and address weaknesses in the supply chain', 1, 2012, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SR-5', 'Acquisition Strategies, Tools, and Methods', 'Employ acquisition strategies that mitigate supply chain risks', 1, 2013, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SR-6', 'Supplier Assessments and Reviews', 'Assess and review the supply-chain risk associated with suppliers', 1, 2014, 'active'),
('c0000000-0000-0000-0000-800530000001', 'SR-11', 'Component Authenticity', 'Develop and implement anti-counterfeit policy and procedures', 1, 2015, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- Done. 20 family headers + 100+ key controls = ~120 NIST 800-53 entries
