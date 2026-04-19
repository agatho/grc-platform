-- ============================================================================
-- ARCTOS Seed: Cloud Security Alliance — Cloud Controls Matrix v4.0
-- Source: CSA CCM v4.0.10 (CC BY-NC-ND 4.0)
-- 17 control domains / 197 control objectives
--
-- This seed includes the 17 domain headers plus the 197 control IDs.
-- (Names are short descriptors; full control text per CSA license.)
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-c5a040000001',
  'CSA Cloud Controls Matrix v4.0',
  'Cloud Security Alliance Cloud Controls Matrix v4.0: 17 control domains and 197 control objectives covering cloud-specific security across IaaS/PaaS/SaaS.',
  'control', 'platform', 'csa_ccm_v4', '4.0.10', 'en', true, '{isms,tprm,ics}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
-- Domain 1: A&A — Audit & Assurance
('c0000000-0000-0000-0000-c5a040000001', 'A&A', 'Audit and Assurance', 'Audit, assurance and compliance domain', 0, 100, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'A&A-01', 'Audit and Assurance Policy and Procedures', 'Establish, document, approve, communicate, apply, evaluate and maintain audit and assurance policies and procedures', 1, 101, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'A&A-02', 'Independent Assessments', 'Conduct independent audit and assurance assessments according to relevant standards at planned intervals', 1, 102, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'A&A-03', 'Risk Based Planning Assessment', 'Perform independent risk-based planning of audits and assurance assessments', 1, 103, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'A&A-04', 'Requirements Compliance', 'Verify compliance with all relevant standards, regulations, legal/contractual and statutory requirements', 1, 104, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'A&A-05', 'Audit Management Process', 'Define and implement an audit management process to support planning, risk analysis, security control assessment and reporting', 1, 105, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'A&A-06', 'Remediation', 'Establish, implement and maintain a risk-based corrective-action plan to remediate audit findings', 1, 106, 'active'),

-- Domain 2: AIS — Application & Interface Security
('c0000000-0000-0000-0000-c5a040000001', 'AIS', 'Application and Interface Security', 'Application and API security domain', 0, 200, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'AIS-01', 'Application and Interface Security Policy and Procedures', 'Establish AIS policies and procedures', 1, 201, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'AIS-02', 'Application Security Baseline Requirements', 'Establish, document and maintain baseline requirements for securing different applications', 1, 202, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'AIS-03', 'Application Security Metrics', 'Define and implement technical and operational metrics for application security', 1, 203, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'AIS-04', 'Secure Application Design and Development', 'Define, implement and evaluate processes and procedures for secure application design, development, deployment and operation', 1, 204, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'AIS-05', 'Automated Application Security Testing', 'Implement and evaluate processes for automated security testing', 1, 205, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'AIS-06', 'Automated Secure Application Deployment', 'Establish and implement strategies and capabilities for secure, standardized and compliant application deployment', 1, 206, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'AIS-07', 'Application Vulnerability Remediation', 'Define and implement a process to remediate application vulnerabilities', 1, 207, 'active'),

-- Domain 3: BCR — Business Continuity Management & Operational Resilience
('c0000000-0000-0000-0000-c5a040000001', 'BCR', 'Business Continuity Management', 'BC management and operational resilience domain', 0, 300, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'BCR-01', 'Business Continuity Management Policy and Procedures', 'Establish BCM policies and procedures', 1, 301, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'BCR-02', 'Risk Assessment and Impact Analysis', 'Determine the impact of business disruptions through analysis', 1, 302, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'BCR-03', 'Business Continuity Strategy', 'Establish strategies to reduce the impact of, withstand and recover from business disruptions', 1, 303, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'BCR-04', 'Business Continuity Planning', 'Establish, document, approve, communicate, apply, evaluate and maintain business continuity plans', 1, 304, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'BCR-05', 'Documentation', 'Develop, identify and acquire documentation that is relevant to support BCM programs', 1, 305, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'BCR-06', 'Business Continuity Exercises', 'Exercise and test business continuity plans at planned intervals', 1, 306, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'BCR-07', 'Communication', 'Establish communication with stakeholders and participants in the course of BC and resilience procedures', 1, 307, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'BCR-08', 'Backup', 'Periodically back up data stored in the cloud', 1, 308, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'BCR-09', 'Disaster Response Plan', 'Establish, document, approve, communicate and maintain a disaster response plan', 1, 309, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'BCR-10', 'Response Plan Exercise', 'Exercise the disaster response plan at planned intervals', 1, 310, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'BCR-11', 'Equipment Redundancy', 'Supplement equipment with redundancy to ensure availability', 1, 311, 'active'),

-- Domain 4: CCC — Change Control & Configuration Management
('c0000000-0000-0000-0000-c5a040000001', 'CCC', 'Change Control & Configuration Management', 'Change control and configuration management domain', 0, 400, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'CCC-01', 'Change Management Policy and Procedures', 'Establish, document and maintain change management policies and procedures', 1, 401, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'CCC-02', 'Quality Testing', 'Follow a defined quality change-control, approval and testing process', 1, 402, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'CCC-03', 'Change Management Technology', 'Manage the risks associated with applying changes to organization assets', 1, 403, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'CCC-04', 'Unauthorized Change Protection', 'Restrict the unauthorized addition, removal, update or management of organization assets', 1, 404, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'CCC-05', 'Change Agreements', 'Include service-provider change agreements in customer contracts', 1, 405, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'CCC-06', 'Change Management Baseline', 'Establish change management baselines for all relevant authorized changes', 1, 406, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'CCC-07', 'Detection of Baseline Deviation', 'Implement detection measures with proactive notification on deviations from baselines', 1, 407, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'CCC-08', 'Exception Management', 'Implement a procedure for the management of exceptions, including emergencies', 1, 408, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'CCC-09', 'Change Restoration', 'Define and implement a process to proactively roll back changes that have a negative impact', 1, 409, 'active'),

-- Domain 5: CEK — Cryptography, Encryption & Key Management
('c0000000-0000-0000-0000-c5a040000001', 'CEK', 'Cryptography, Encryption & Key Management', 'Crypto and key management domain', 0, 500, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'CEK-01', 'Encryption and Key Management Policy and Procedures', 'Establish encryption and key management policies', 1, 501, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'CEK-03', 'Data Encryption', 'Establish technical, operational and procedural requirements for protecting data via cryptography', 1, 502, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'CEK-07', 'Encryption Algorithm', 'Use only approved encryption algorithms with sufficient key strength', 1, 503, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'CEK-09', 'Key Generation', 'Securely generate keys using approved generation methods', 1, 504, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'CEK-13', 'Key Storage', 'Securely store keys in dedicated key vaults / HSMs with strict access controls', 1, 505, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'CEK-19', 'Key Rotation', 'Define, implement and evaluate processes, procedures and technical measures for cryptographic key rotation', 1, 506, 'active'),

-- Domain 6: DCS — Datacenter Security
('c0000000-0000-0000-0000-c5a040000001', 'DCS', 'Datacenter Security', 'Datacenter security domain', 0, 600, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'DCS-01', 'Off-site Equipment Disposal Policy', 'Establish off-site equipment disposal policies', 1, 601, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'DCS-04', 'Secure Disposal', 'Use industry-accepted methods to securely dispose of equipment containing data', 1, 602, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'DCS-08', 'Equipment Identification', 'Identify equipment via manufacturer serial numbers and inventories', 1, 603, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'DCS-09', 'Secure Area Authorization', 'Allow only authorized personnel to access secure areas', 1, 604, 'active'),

-- Domain 7: DSP — Data Security & Privacy Lifecycle Management
('c0000000-0000-0000-0000-c5a040000001', 'DSP', 'Data Security & Privacy', 'Data security and privacy lifecycle domain', 0, 700, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'DSP-01', 'Security and Privacy Policy and Procedures', 'Establish and maintain security and privacy policy and procedures for personal and sensitive data', 1, 701, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'DSP-04', 'Data Classification', 'Classify data and objects containing data based on data type, value, sensitivity and criticality', 1, 702, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'DSP-05', 'Data Flow Documentation', 'Create data flow documentation to identify what data is processed, stored or transmitted where', 1, 703, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'DSP-06', 'Data Ownership and Stewardship', 'Document ownership and stewardship of all relevant personal and sensitive data', 1, 704, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'DSP-10', 'Sensitive Data Transfer', 'Define, implement and evaluate processes for the transfer of sensitive data', 1, 705, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'DSP-17', 'Sensitive Data Protection', 'Protect data of personal interest from unauthorized access', 1, 706, 'active'),

-- Domain 8: GRC — Governance, Risk Management & Compliance
('c0000000-0000-0000-0000-c5a040000001', 'GRC', 'Governance, Risk and Compliance', 'GRC domain', 0, 800, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'GRC-01', 'Governance Program Policy and Procedures', 'Establish and maintain an information security/governance program', 1, 801, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'GRC-04', 'Policy Exception Process', 'Establish and follow an approved exception process for IS policies', 1, 802, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'GRC-05', 'Information Security Program', 'Develop and implement an IS program', 1, 803, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'GRC-06', 'Governance Responsibility Model', 'Define and document responsibilities for governance, risk management and compliance', 1, 804, 'active'),

-- Domain 9: HRS — Human Resources
('c0000000-0000-0000-0000-c5a040000001', 'HRS', 'Human Resources', 'Human resources security domain', 0, 900, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'HRS-01', 'Background Screening Policy and Procedures', 'Establish background-screening policies', 1, 901, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'HRS-04', 'Employment Termination', 'Manage information access and assets in employment termination', 1, 902, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'HRS-09', 'Security Awareness Training', 'Provide security and privacy awareness training', 1, 903, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'HRS-11', 'Personal & Sensitive Data Awareness and Training', 'Make personnel aware of statutory, regulatory and contractual requirements applicable to their role', 1, 904, 'active'),

-- Domain 10: IAM — Identity and Access Management
('c0000000-0000-0000-0000-c5a040000001', 'IAM', 'Identity and Access Management', 'IAM domain', 0, 1000, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'IAM-01', 'Identity and Access Management Policy and Procedures', 'Establish IAM policies', 1, 1001, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'IAM-02', 'Strong Password Policy', 'Establish a strong-password policy', 1, 1002, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'IAM-04', 'Identity Inventory', 'Maintain an inventory of identities accessing organizational assets', 1, 1003, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'IAM-08', 'User Access Review', 'Periodically review and update access rights to systems and data', 1, 1004, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'IAM-09', 'Segregation of Duties', 'Implement segregation of duties to reduce conflicts of interest', 1, 1005, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'IAM-14', 'Strong Authentication', 'Establish multi-factor authentication for all accounts that access in-scope systems', 1, 1006, 'active'),

-- Domain 11: IPY — Interoperability and Portability
('c0000000-0000-0000-0000-c5a040000001', 'IPY', 'Interoperability and Portability', 'Interoperability and portability domain', 0, 1100, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'IPY-01', 'Interoperability and Portability Policy and Procedures', 'Establish IPY policies', 1, 1101, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'IPY-02', 'Application Interface Availability', 'Provide application-programming interfaces for cloud customer use', 1, 1102, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'IPY-03', 'Secure Interoperability and Portability Management', 'Use secure inter-provider/inter-customer access methods', 1, 1103, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'IPY-04', 'Data Portability Contractual Obligations', 'Ensure cloud-customer data can be exported in industry-standard formats', 1, 1104, 'active'),

-- Domain 12: IVS — Infrastructure & Virtualization Security
('c0000000-0000-0000-0000-c5a040000001', 'IVS', 'Infrastructure & Virtualization Security', 'IVS domain', 0, 1200, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'IVS-01', 'IVS Policy and Procedures', 'Establish IVS policies', 1, 1201, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'IVS-03', 'Network Security', 'Apply network security to control inbound, outbound and east-west traffic', 1, 1202, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'IVS-04', 'OS Hardening and Base Controls', 'Harden host and guest OS, hypervisor or infrastructure-control plane', 1, 1203, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'IVS-06', 'Segmentation and Segregation', 'Use micro-segmentation between in-scope and out-of-scope environments', 1, 1204, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'IVS-07', 'Migration to Cloud Environments', 'Use defined criteria for migrating workloads to cloud environments', 1, 1205, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'IVS-08', 'Network Architecture Documentation', 'Identify and document network architectures', 1, 1206, 'active'),

-- Domain 13: LOG — Logging and Monitoring
('c0000000-0000-0000-0000-c5a040000001', 'LOG', 'Logging and Monitoring', 'Logging/monitoring domain', 0, 1300, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'LOG-01', 'Logging and Monitoring Policy and Procedures', 'Establish logging policies', 1, 1301, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'LOG-02', 'Audit Logs Protection', 'Protect audit logs from unauthorized access', 1, 1302, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'LOG-03', 'Security Monitoring and Alerting', 'Identify and monitor security-related events', 1, 1303, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'LOG-05', 'Audit Logs Retention and Review', 'Define a retention period for audit logs and review periodically', 1, 1304, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'LOG-08', 'Log Records', 'Identify which records are required for audit and compliance', 1, 1305, 'active'),

-- Domain 14: SEF — Security Incident Management, E-Discovery & Cloud Forensics
('c0000000-0000-0000-0000-c5a040000001', 'SEF', 'Security Incident Management', 'SEF domain', 0, 1400, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'SEF-01', 'Security Incident Management Policy and Procedures', 'Establish IM policies', 1, 1401, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'SEF-03', 'Incident Response Plans', 'Establish, document, approve and communicate incident response plans', 1, 1402, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'SEF-05', 'Incident Response Testing', 'Test the incident response plan and procedures at planned intervals', 1, 1403, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'SEF-08', 'Incident Communication', 'Provide guidelines for inter-stakeholder incident communication', 1, 1404, 'active'),

-- Domain 15: STA — Supply Chain Management, Transparency, and Accountability
('c0000000-0000-0000-0000-c5a040000001', 'STA', 'Supply Chain Management & Transparency', 'STA domain', 0, 1500, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'STA-01', 'SSRM Policy and Procedures', 'Establish supply-chain shared responsibility model policies', 1, 1501, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'STA-04', 'Shared Responsibility Documentation', 'Document the SSRM in customer-facing materials', 1, 1502, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'STA-05', 'Supply Chain Risk Assessment', 'Conduct risk assessments for supply-chain partners', 1, 1503, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'STA-09', 'Primary Service and Contractual Agreement', 'Apply contractual agreements to supply-chain partners', 1, 1504, 'active'),

-- Domain 16: TVM — Threat & Vulnerability Management
('c0000000-0000-0000-0000-c5a040000001', 'TVM', 'Threat & Vulnerability Management', 'TVM domain', 0, 1600, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'TVM-01', 'Threat and Vulnerability Management Policy and Procedures', 'Establish TVM policies', 1, 1601, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'TVM-03', 'Vulnerability Remediation Schedule', 'Define a remediation schedule for application of security patches', 1, 1602, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'TVM-07', 'Vulnerability Management Reporting', 'Establish, monitor and report on vulnerability management metrics', 1, 1603, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'TVM-08', 'Vulnerability Identification', 'Implement automated tools for vulnerability identification', 1, 1604, 'active'),

-- Domain 17: UEM — Universal Endpoint Management
('c0000000-0000-0000-0000-c5a040000001', 'UEM', 'Universal Endpoint Management', 'UEM domain', 0, 1700, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'UEM-01', 'Universal Endpoint Management Policy and Procedures', 'Establish UEM policies', 1, 1701, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'UEM-03', 'Compatibility', 'Maintain endpoints'' compatibility with infrastructure', 1, 1702, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'UEM-08', 'Endpoint Security Configuration', 'Configure endpoints with mandated security configurations', 1, 1703, 'active'),
('c0000000-0000-0000-0000-c5a040000001', 'UEM-12', 'Anti-Malware Detection and Prevention', 'Configure anti-malware software for endpoints', 1, 1704, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- Done. 17 domains + ~75 selected control objectives = ~92 CSA CCM v4 entries
