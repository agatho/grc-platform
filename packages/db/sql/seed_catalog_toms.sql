-- ============================================================================
-- ARCTOS Seed: Technical and Organizational Measures (TOMs) Catalog
-- Source: Art. 32 GDPR + Standard TOM Catalogs
-- Structure: TOM Categories (Level 0) -> Specific measures (Level 1)
-- Target Modules: dpms, isms
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active, target_modules)
VALUES (
  'c0000000-0000-0000-0000-703500000000',
  'Technical and Organizational Measures (TOMs)',
  'Art. 32 GDPR — Technical and organizational measures to ensure a level of security appropriate to the risk. Categories based on confidentiality, integrity, availability, and resilience.',
  'control', 'platform', 'gdpr_art32_toms', '2018', true, '{dpms,isms}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- TOM-C: Confidentiality
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-703500000000', 'TOM-C', 'Confidentiality', 'Measures to ensure the ongoing confidentiality of processing systems and services (Art. 32(1)(b) GDPR)', 0, 100, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-C.01', 'Physical access control', 'Measures to prevent unauthorized persons from gaining physical access to data processing facilities (e.g. electronic door locks, security guards, alarm systems)', 1, 101, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-C.02', 'Logical access control', 'Measures to prevent unauthorized use of data processing systems (e.g. password policies, multi-factor authentication, automatic screen locks)', 1, 102, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-C.03', 'Data access control', 'Measures to ensure that authorized users can only access data within their authorization scope (e.g. role-based access control, need-to-know principle, access reviews)', 1, 103, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-C.04', 'Separation control', 'Measures to ensure that data collected for different purposes is processed separately (e.g. multi-tenancy isolation, logical database separation, sandbox environments)', 1, 104, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-C.05', 'Pseudonymization', 'Measures to process personal data in such a manner that it can no longer be attributed to a specific data subject without additional information (e.g. tokenization, key-coded datasets)', 1, 105, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-C.06', 'Visitor management', 'Measures to control and document visitor access to premises containing data processing systems (e.g. visitor logs, escort requirements, visitor badges)', 1, 106, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-C.07', 'Clean desk and clear screen policy', 'Measures to prevent unauthorized access to data through unattended workstations or visible documents (e.g. automatic screen locks, clean desk procedures)', 1, 107, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-C.08', 'Secure disposal of data carriers', 'Measures to ensure data carriers are securely destroyed or erased before disposal or reuse (e.g. DIN 66399 shredding, degaussing, certified destruction)', 1, 108, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-C.09', 'Mobile device management', 'Measures to secure mobile devices used for data processing (e.g. device encryption, remote wipe, containerization, MDM solutions)', 1, 109, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-C.10', 'Confidentiality agreements', 'Measures to ensure employees and contractors are bound by confidentiality obligations (e.g. NDAs, data secrecy commitments under Art. 28(3)(b) GDPR)', 1, 110, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- TOM-I: Integrity
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-703500000000', 'TOM-I', 'Integrity', 'Measures to ensure the ongoing integrity of processing systems and services (Art. 32(1)(b) GDPR)', 0, 200, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-I.01', 'Transfer control', 'Measures to ensure that personal data cannot be read, copied, modified or removed without authorization during electronic transfer (e.g. TLS/SSL encryption, VPN tunnels, secure file transfer)', 1, 201, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-I.02', 'Input control', 'Measures to verify and document whether and by whom personal data has been entered, modified or removed in data processing systems (e.g. audit trails, logging, user attribution)', 1, 202, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-I.03', 'Processing control', 'Measures to ensure that personal data is processed only in accordance with the controller instructions (e.g. data processing agreements, documented instructions, compliance audits)', 1, 203, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-I.04', 'Data validation controls', 'Measures to ensure the correctness and completeness of data during processing (e.g. input validation, checksums, plausibility checks, data quality rules)', 1, 204, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-I.05', 'Change management', 'Measures to control and document modifications to data processing systems and configurations (e.g. change approval processes, version control, rollback procedures)', 1, 205, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-I.06', 'Interface and API security', 'Measures to secure data exchanges between systems and applications (e.g. API authentication, rate limiting, input sanitization, HMAC signatures)', 1, 206, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-I.07', 'Network segmentation', 'Measures to isolate network zones to limit the impact of security breaches (e.g. firewalls, VLANs, DMZs, micro-segmentation)', 1, 207, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-I.08', 'Malware protection', 'Measures to detect and prevent malicious software from compromising data integrity (e.g. antivirus, endpoint detection and response, application whitelisting)', 1, 208, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- TOM-A: Availability
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-703500000000', 'TOM-A', 'Availability', 'Measures to ensure the ongoing availability of processing systems and services (Art. 32(1)(b) GDPR)', 0, 300, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-A.01', 'Availability control', 'Measures to protect personal data against accidental destruction or loss (e.g. redundant storage, RAID systems, uninterruptible power supply, climate control)', 1, 301, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-A.02', 'Backup and recovery', 'Measures to restore the availability and access to personal data in a timely manner after a physical or technical incident (e.g. backup schedules, offsite backups, tested restore procedures)', 1, 302, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-A.03', 'Disaster recovery planning', 'Measures to maintain IT services during and after disasters (e.g. disaster recovery plans, failover sites, RTOs and RPOs, recovery testing)', 1, 303, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-A.04', 'Redundancy and high availability', 'Measures to ensure continued operation through redundant systems (e.g. load balancing, clustering, geographic distribution, automatic failover)', 1, 304, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-A.05', 'Fire and water protection', 'Measures to protect data processing facilities from physical damage (e.g. fire detection, fire suppression, water sensors, raised floors)', 1, 305, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-A.06', 'Patch management', 'Measures to keep systems up to date and protected against known vulnerabilities (e.g. regular patch cycles, vulnerability scanning, emergency patching procedures)', 1, 306, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-A.07', 'Monitoring and alerting', 'Measures to detect and respond to system failures and security incidents in a timely manner (e.g. system monitoring, log aggregation, alerting thresholds, on-call procedures)', 1, 307, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-A.08', 'Capacity management', 'Measures to ensure sufficient resources for data processing operations (e.g. capacity planning, resource monitoring, auto-scaling, demand forecasting)', 1, 308, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- TOM-R: Resilience
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-703500000000', 'TOM-R', 'Resilience', 'Measures to ensure the resilience of processing systems and services (Art. 32(1)(b) GDPR)', 0, 400, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-R.01', 'System hardening', 'Measures to reduce the attack surface of processing systems (e.g. removal of unnecessary services, secure default configurations, CIS benchmarks)', 1, 401, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-R.02', 'Incident response capability', 'Measures to detect, contain and recover from security incidents (e.g. incident response plans, CERT team, forensic readiness, escalation procedures)', 1, 402, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-R.03', 'Business continuity for data processing', 'Measures to maintain critical data processing during adverse conditions (e.g. business continuity plans, alternate processing sites, crisis communication)', 1, 403, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-R.04', 'DDoS protection', 'Measures to protect against distributed denial-of-service attacks (e.g. traffic filtering, rate limiting, CDN usage, scrubbing services)', 1, 404, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-R.05', 'Fault tolerance', 'Measures to ensure systems continue to operate correctly even when components fail (e.g. graceful degradation, circuit breakers, retry mechanisms)', 1, 405, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- TOM-P: Procedures for regular testing, assessment and evaluation
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-703500000000', 'TOM-P', 'Procedures for regular testing, assessment and evaluation', 'Procedures for regularly testing, assessing and evaluating the effectiveness of technical and organizational measures (Art. 32(1)(d) GDPR)', 0, 500, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-P.01', 'Data protection impact assessments', 'Procedures to assess the impact of processing operations on the protection of personal data (Art. 35 GDPR)', 1, 501, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-P.02', 'Internal audits', 'Regular audits to verify compliance with data protection policies and the effectiveness of implemented measures', 1, 502, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-P.03', 'Penetration testing', 'Regular security testing to identify vulnerabilities in data processing systems (e.g. external penetration tests, red team exercises, bug bounty programs)', 1, 503, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-P.04', 'Security awareness training', 'Regular training programs to ensure employees understand data protection requirements and security threats (e.g. phishing simulations, onboarding training, annual refreshers)', 1, 504, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-P.05', 'Data protection management system', 'Systematic framework for managing data protection compliance (e.g. DPO appointment, privacy governance, data protection policies, records of processing activities)', 1, 505, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-P.06', 'Review and update of measures', 'Procedures to regularly review and update technical and organizational measures based on risk assessments and incident lessons learned', 1, 506, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-P.07', 'Certification and assurance', 'Use of certifications, codes of conduct and assurance mechanisms to demonstrate compliance (e.g. ISO 27001, SOC 2, approved codes of conduct under Art. 40 GDPR)', 1, 507, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-P.08', 'Vulnerability management program', 'Systematic identification, classification and remediation of security vulnerabilities (e.g. vulnerability scanning, CVE tracking, remediation SLAs)', 1, 508, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- TOM-S: Sub-processor measures
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-703500000000', 'TOM-S', 'Sub-processor measures', 'Measures to ensure sub-processors provide sufficient guarantees for appropriate technical and organizational measures (Art. 28 GDPR)', 0, 600, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-S.01', 'Sub-processor due diligence', 'Measures to assess the data protection capabilities of sub-processors before engagement (e.g. security questionnaires, certifications review, on-site audits)', 1, 601, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-S.02', 'Data processing agreements', 'Contractual measures to bind sub-processors to GDPR requirements (Art. 28(3) GDPR) including instructions, confidentiality, security measures, and audit rights', 1, 602, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-S.03', 'Sub-processor monitoring', 'Ongoing measures to verify sub-processor compliance with contractual and legal obligations (e.g. regular audits, compliance reports, incident notification procedures)', 1, 603, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-S.04', 'Sub-processor change management', 'Measures to manage changes in sub-processor relationships (e.g. prior notification to controller, right of objection, assessment of new sub-processors)', 1, 604, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-S.05', 'International transfer safeguards', 'Measures to ensure adequate protection for personal data transferred to sub-processors in third countries (e.g. SCCs, adequacy decisions, supplementary measures per Schrems II)', 1, 605, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- ============================================================================
-- TOM-E: Encryption measures
-- ============================================================================
INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-703500000000', 'TOM-E', 'Encryption measures', 'Measures for encryption of personal data as referenced in Art. 32(1)(a) GDPR', 0, 700, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-E.01', 'Encryption at rest', 'Measures to encrypt stored personal data (e.g. full disk encryption, database encryption, file-level encryption, AES-256)', 1, 701, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-E.02', 'Encryption in transit', 'Measures to encrypt personal data during transmission (e.g. TLS 1.2+, IPsec VPN, SSH, HTTPS enforcement)', 1, 702, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-E.03', 'Key management', 'Measures for secure generation, storage, rotation and destruction of encryption keys (e.g. HSMs, key rotation schedules, separation of duties for key access)', 1, 703, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-E.04', 'End-to-end encryption', 'Measures to ensure data remains encrypted throughout the entire processing chain (e.g. E2EE for messaging, encrypted backups, zero-knowledge architectures)', 1, 704, 'active'),
('c0000000-0000-0000-0000-703500000000', 'TOM-E.05', 'Certificate management', 'Measures to manage digital certificates for encryption and authentication (e.g. PKI, certificate lifecycle management, automated renewal, certificate pinning)', 1, 705, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;
