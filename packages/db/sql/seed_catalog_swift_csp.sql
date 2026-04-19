-- ============================================================================
-- ARCTOS Seed: SWIFT Customer Security Programme (CSCF v2024)
-- Source: SWIFT Customer Security Controls Framework v2024
-- 32 controls (24 mandatory + 8 advisory) across 7 control objectives
--
-- Target modules: isms, ics (any tenant connected to SWIFT or providing
-- SWIFT-related services to the financial sector)
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, language, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-5ec5cf000001',
  'SWIFT CSCF v2024',
  'SWIFT Customer Security Controls Framework v2024: 32 controls (24 mandatory + 8 advisory) across 7 control objectives. Mandatory annual self-attestation for all SWIFT users.',
  'control', 'platform', 'swift_cscf_v2024', '2024', 'en', true, '{isms,ics}'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
-- ── Objective 1: Restrict Internet Access and Protect Critical Systems ────
('c0000000-0000-0000-0000-5ec5cf000001', 'O1', 'Restrict Internet Access and Protect Critical Systems from General IT Environment', 'Reduce attack surface by restricting Internet access and segregating SWIFT infrastructure from general IT', 0, 100, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '1.1', 'SWIFT Environment Protection [Mandatory]', 'Ensure the protection of the user''s SWIFT infrastructure from compromise of its general IT environment and external environment', 1, 110, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '1.2', 'Operating System Privileged Account Control [Mandatory]', 'Restrict and control the allocation and use of administrator-level operating system accounts', 1, 120, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '1.3', 'Virtualisation or Cloud Platform Protection [Mandatory]', 'Secure the virtualisation or cloud infrastructure', 1, 130, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '1.4', 'Restriction of Internet Access [Mandatory]', 'Control/protect Internet access from operator PCs and systems within the secure zone', 1, 140, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '1.5', 'Customer Environment Protection [Advisory]', 'Ensure the protection of the customer''s connectivity infrastructure from external environment', 1, 150, 'active'),

-- ── Objective 2: Reduce Attack Surface and Vulnerabilities ─────────────────
('c0000000-0000-0000-0000-5ec5cf000001', 'O2', 'Reduce Attack Surface and Vulnerabilities', 'Reduce the cyber-attack surface of SWIFT-related components by performing security hygiene', 0, 200, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '2.1', 'Internal Data Flow Security [Mandatory]', 'Ensure the confidentiality, integrity and authenticity of application data flows between local SWIFT-related applications', 1, 210, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '2.2', 'Security Updates [Mandatory]', 'Minimise the occurrence of known technical vulnerabilities by ensuring vendor support and applying mandatory updates', 1, 220, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '2.3', 'System Hardening [Mandatory]', 'Reduce the cyber-attack surface of SWIFT-related components by performing system hardening', 1, 230, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '2.4A', 'Back Office Data Flow Security [Advisory]', 'Ensure the confidentiality, integrity, and mutual authenticity of data flows between back-office applications', 1, 240, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '2.5A', 'External Transmission Data Protection [Advisory]', 'Protect the confidentiality of SWIFT-related data transmitted across external networks', 1, 250, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '2.6', 'Operator Session Confidentiality and Integrity [Mandatory]', 'Protect the confidentiality and integrity of interactive operator sessions', 1, 260, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '2.7', 'Vulnerability Scanning [Mandatory]', 'Identify known vulnerabilities by implementing a regular vulnerability-scanning process', 1, 270, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '2.8A', 'Outsourced Critical Activity Protection [Advisory]', 'Ensure protection from compromised outsourced critical activities', 1, 280, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '2.9', 'Transaction Business Controls [Mandatory]', 'Restrict transaction activity to validated and approved business counterparties and within the expected business parameters', 1, 290, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '2.10', 'Application Hardening [Mandatory]', 'Reduce the attack surface of SWIFT applications', 1, 300, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '2.11A', 'RMA Business Controls [Advisory]', 'Restrict transaction activity to validated and approved business counterparties using RMA', 1, 310, 'active'),

-- ── Objective 3: Physically Secure the Environment ────────────────────────
('c0000000-0000-0000-0000-5ec5cf000001', 'O3', 'Physically Secure the Environment', 'Prevent unauthorised physical access to sensitive equipment, hosting sites and storage', 0, 400, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '3.1', 'Physical Security [Mandatory]', 'Prevent unauthorised physical access to sensitive equipment, workplace environments, hosting sites and storage', 1, 410, 'active'),

-- ── Objective 4: Prevent Compromise of Credentials ────────────────────────
('c0000000-0000-0000-0000-5ec5cf000001', 'O4', 'Prevent Compromise of Credentials', 'Ensure the appropriate identification, authentication and authorisation of users', 0, 500, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '4.1', 'Password Policy [Mandatory]', 'Ensure passwords are sufficiently resistant against common password attacks', 1, 510, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '4.2', 'Multi-Factor Authentication [Mandatory]', 'Prevent that a compromise of a single authentication factor allows access to SWIFT-related systems by implementing MFA', 1, 520, 'active'),

-- ── Objective 5: Manage Identities and Segregate Privileges ───────────────
('c0000000-0000-0000-0000-5ec5cf000001', 'O5', 'Manage Identities and Segregate Privileges', 'Enforce the principles of need-to-know, least privilege and segregation of duties for operator accounts', 0, 600, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '5.1', 'Logical Access Control [Mandatory]', 'Enforce the security principles of need-to-know, least privilege and segregation of duties', 1, 610, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '5.2', 'Token Management [Mandatory]', 'Ensure the proper management, tracking and use of connected and disconnected hardware authentication tokens', 1, 620, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '5.3A', 'Personnel Vetting Process [Advisory]', 'Ensure the trustworthiness of staff operating the local SWIFT environment by performing background checks', 1, 630, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '5.4', 'Physical and Logical Password Storage [Mandatory]', 'Protect physically and logically recorded passwords', 1, 640, 'active'),

-- ── Objective 6: Detect Anomalous Activity to Systems or Transaction Records
('c0000000-0000-0000-0000-5ec5cf000001', 'O6', 'Detect Anomalous Activity to Systems or Transaction Records', 'Ensure the detection of anomalous activity', 0, 700, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '6.1', 'Malware Protection [Mandatory]', 'Ensure that local SWIFT infrastructure is protected against malware and act upon results', 1, 710, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '6.2', 'Software Integrity [Mandatory]', 'Ensure the software integrity of the SWIFT-related applications', 1, 720, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '6.3', 'Database Integrity [Mandatory]', 'Ensure the integrity of the database records for the SWIFT messaging interface', 1, 730, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '6.4', 'Logging and Monitoring [Mandatory]', 'Record security events, detect and respond to anomalous actions and operations', 1, 740, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '6.5A', 'Intrusion Detection [Advisory]', 'Detect and prevent anomalous network activity into and within the local or remote SWIFT environment', 1, 750, 'active'),

-- ── Objective 7: Plan for Incident Response and Information Sharing ───────
('c0000000-0000-0000-0000-5ec5cf000001', 'O7', 'Plan for Incident Response and Information Sharing', 'Ensure a consistent and effective approach for the management of cyber incidents', 0, 800, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '7.1', 'Cyber Incident Response Planning [Mandatory]', 'Ensure a consistent and effective approach for the management of cyber incidents', 1, 810, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '7.2', 'Security Training and Awareness [Mandatory]', 'Ensure all staff are aware of and fulfil their security responsibilities', 1, 820, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '7.3A', 'Penetration Testing [Advisory]', 'Validate the operational security configuration and identify security gaps by performing penetration tests', 1, 830, 'active'),
('c0000000-0000-0000-0000-5ec5cf000001', '7.4A', 'Scenario Risk Assessment [Advisory]', 'Evaluate the risk and readiness of the organisation based on plausible cyber-attack scenarios', 1, 840, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- Done. 7 objectives + 32 controls = 39 SWIFT CSCF v2024 entries
