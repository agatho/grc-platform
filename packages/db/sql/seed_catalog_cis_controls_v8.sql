-- ============================================================================
-- ARCTOS Seed: CIS Critical Security Controls v8
-- Source: Center for Internet Security (CIS Controls v8, May 2021)
-- 18 Controls with Implementation Groups (IG1, IG2, IG3)
-- Used for cross-framework mapping to ISO 27002 and NIST CSF
-- ============================================================================

INSERT INTO catalog (id, name, description, catalog_type, scope, source, version, is_active)
VALUES ('c0000000-0000-0000-0000-c150c74201a8', 'CIS Critical Security Controls v8', 'CIS Controls v8 — 18 Controls with 153 Safeguards in 3 Implementation Groups', 'control', 'platform', 'cis_controls_v8', '8.0', true)
ON CONFLICT DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-01', 'Inventory and Control of Enterprise Assets', 'Actively manage all enterprise assets connected to the infrastructure to accurately know the totality of assets that need to be monitored and protected.', 0, 1, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-02', 'Inventory and Control of Software Assets', 'Actively manage all software on the network so that only authorized software is installed and can execute.', 0, 2, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-03', 'Data Protection', 'Develop processes and technical controls to identify, classify, securely handle, retain, and dispose of data.', 0, 3, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-04', 'Secure Configuration of Enterprise Assets and Software', 'Establish and maintain the secure configuration of enterprise assets and software.', 0, 4, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-05', 'Account Management', 'Use processes and tools to assign and manage authorization to credentials for user accounts.', 0, 5, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-06', 'Access Control Management', 'Use processes and tools to create, assign, manage, and revoke access credentials and privileges.', 0, 6, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-07', 'Continuous Vulnerability Management', 'Develop a plan to continuously assess and track vulnerabilities on all enterprise assets.', 0, 7, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-08', 'Audit Log Management', 'Collect, alert, review, and retain audit logs of events that could help detect, understand, or recover from an attack.', 0, 8, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-09', 'Email and Web Browser Protections', 'Improve protections and detections of threats from email and web vectors.', 0, 9, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status) VALUES
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-10', 'Malware Defenses', 'Prevent or control the installation, spread, and execution of malicious applications, code, or scripts.', 0, 10, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-11', 'Data Recovery', 'Establish and maintain data recovery practices sufficient to restore in-scope enterprise assets to a pre-incident and trusted state.', 0, 11, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-12', 'Network Infrastructure Management', 'Establish and maintain the secure configuration and management of network infrastructure.', 0, 12, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-13', 'Network Monitoring and Defense', 'Operate processes and tooling to establish and maintain comprehensive network monitoring and defense.', 0, 13, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-14', 'Security Awareness and Skills Training', 'Establish and maintain a security awareness program to influence behavior to be security conscious.', 0, 14, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-15', 'Service Provider Management', 'Develop a process to evaluate service providers who hold sensitive data or are responsible for critical IT platforms.', 0, 15, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-16', 'Application Software Security', 'Manage the security life cycle of in-house developed, hosted, or acquired software.', 0, 16, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-17', 'Incident Response Management', 'Establish a program to develop and maintain an incident response capability.', 0, 17, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-18', 'Penetration Testing', 'Test the effectiveness and resiliency of enterprise assets through identifying and exploiting weaknesses in controls.', 0, 18, 'active'),

-- Key Safeguards (Level 1 — selected high-impact safeguards for cross-mapping)
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-01.1', 'Establish and Maintain Detailed Enterprise Asset Inventory', 'Maintain an accurate, detailed, and up-to-date inventory of all enterprise assets with the potential to store or process data. IG1.', 1, 101, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-03.11', 'Encrypt Sensitive Data at Rest', 'Encrypt sensitive data at rest on servers, applications, and databases. IG1.', 1, 311, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-03.12', 'Encrypt Sensitive Data in Transit', 'Encrypt sensitive data in transit. IG1.', 1, 312, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-04.1', 'Establish and Maintain a Secure Configuration Process', 'Establish and maintain a secure configuration process for enterprise assets and software. IG1.', 1, 401, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-05.3', 'Disable Dormant Accounts', 'Delete or disable any dormant accounts after a period of 45 days of inactivity. IG1.', 1, 503, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-06.3', 'Require MFA for Externally-Exposed Applications', 'Require all externally-exposed enterprise or third-party applications to enforce MFA. IG1.', 1, 603, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-06.4', 'Require MFA for Remote Network Access', 'Require MFA for remote network access. IG1.', 1, 604, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-06.5', 'Require MFA for Administrative Access', 'Require MFA for all administrative access accounts. IG1.', 1, 605, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-07.1', 'Establish and Maintain a Vulnerability Management Process', 'Establish and maintain a documented vulnerability management process for enterprise assets. IG1.', 1, 701, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-07.3', 'Perform Automated Operating System Patch Management', 'Perform OS updates on enterprise assets through automated patch management. IG1.', 1, 703, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-08.2', 'Collect Audit Logs', 'Collect audit logs from enterprise assets. IG1.', 1, 802, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-10.1', 'Deploy and Maintain Anti-Malware Software', 'Deploy and maintain anti-malware software on all enterprise assets. IG1.', 1, 1001, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-11.1', 'Establish and Maintain a Data Recovery Process', 'Establish and maintain a data recovery process. IG1.', 1, 1101, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-14.1', 'Establish and Maintain a Security Awareness Program', 'Establish and maintain a security awareness program. IG1.', 1, 1401, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-15.1', 'Establish and Maintain an Inventory of Service Providers', 'Establish and maintain an inventory of service providers. IG1.', 1, 1501, 'active'),
('c0000000-0000-0000-0000-c150c74201a8', 'CIS-17.1', 'Designate Personnel to Manage Incident Handling', 'Designate one key person and at least one backup for incident handling. IG1.', 1, 1701, 'active')
ON CONFLICT (catalog_id, code) DO NOTHING;

-- Parent linkage: safeguards under their control
UPDATE catalog_entry ce SET parent_entry_id = parent.id
FROM catalog_entry parent
WHERE ce.catalog_id = 'c0000000-0000-0000-0000-c150c74201a8'
  AND parent.catalog_id = 'c0000000-0000-0000-0000-c150c74201a8'
  AND ce.level = 1 AND parent.level = 0
  AND ce.code LIKE parent.code || '.%';

-- Summary: 18 Controls + 16 key Safeguards = 34 entries
-- Full CIS v8 has 153 Safeguards — this core set covers IG1 essentials
-- and enables cross-framework mapping to ISO 27002 and NIST CSF
