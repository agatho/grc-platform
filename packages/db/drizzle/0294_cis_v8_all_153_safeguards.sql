-- ============================================================================
-- Migration 0294: CIS Controls v8 — alle 153 Safeguards mit IG-Metadata
--
-- Die Migrationen 0289/0290 und der Seed seed_catalog_cis_controls_v8.sql
-- decken nur einen Kern von ~35 Safeguards ab. Zertifizierungs-Audits nach
-- CIS v8 brauchen aber die vollständige Liste. Diese Migration fügt die
-- fehlenden Safeguards idempotent hinzu (ON CONFLICT DO NOTHING) und setzt
-- die korrekte IG-Zuordnung in metadata.
--
-- Quelle: CIS Critical Security Controls v8 Reference Guide (Mai 2021),
-- offizielles Mapping IG1/IG2/IG3 pro Safeguard.
-- ============================================================================

DO $$
DECLARE
  cis_id UUID := 'c0000000-0000-0000-0000-c150c74201a8';
BEGIN
  -- ── CIS-01 Inventory and Control of Enterprise Assets (5 Safeguards) ──
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata) VALUES
    (cis_id, 'CIS-01.2', 'Address Unauthorized Assets', 'Ensure that a process exists to address unauthorized assets on a weekly basis. IG1.', 1, 102, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-01.4', 'Use Dynamic Host Configuration Protocol (DHCP) Logging', 'Use DHCP logging on all DHCP servers or IP address management tools to update the enterprise asset inventory. IG2.', 1, 104, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO NOTHING;

  -- ── CIS-02 Inventory and Control of Software Assets (7 Safeguards) ──
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata) VALUES
    (cis_id, 'CIS-02.1', 'Establish and Maintain a Software Inventory', 'Establish and maintain a detailed inventory of all licensed software installed on enterprise assets. IG1.', 1, 201, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-02.2', 'Ensure Authorized Software is Currently Supported', 'Ensure that only currently supported software is designated as authorized in the software inventory. IG1.', 1, 202, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-02.4', 'Utilize Automated Software Inventory Tools', 'Utilize software inventory tools to automate the discovery and documentation of installed software. IG2.', 1, 204, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-02.5', 'Allowlist Authorized Software', 'Use technical controls, such as application allowlisting, to ensure that only authorized software can execute. IG2.', 1, 205, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-02.6', 'Allowlist Authorized Libraries', 'Use technical controls to ensure that only authorized software libraries can be loaded. IG2.', 1, 206, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO NOTHING;

  -- ── CIS-03 Data Protection (14 Safeguards) ──
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata) VALUES
    (cis_id, 'CIS-03.1', 'Establish and Maintain a Data Management Process', 'Establish and maintain a documented data management process. IG1.', 1, 301, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-03.2', 'Establish and Maintain a Data Inventory', 'Establish and maintain a data inventory, based on the enterprise''s data management process. IG1.', 1, 302, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-03.3', 'Configure Data Access Control Lists', 'Configure data access control lists based on a user''s need to know. IG1.', 1, 303, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-03.4', 'Enforce Data Retention', 'Retain data according to the enterprise''s data management process. IG1.', 1, 304, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-03.5', 'Securely Dispose of Data', 'Securely dispose of data as outlined in the data management process. IG1.', 1, 305, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-03.6', 'Encrypt Data on End-User Devices', 'Encrypt data on end-user devices containing sensitive data. IG1.', 1, 306, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-03.7', 'Establish and Maintain a Data Classification Scheme', 'Establish and maintain an overall data classification scheme for the enterprise. IG2.', 1, 307, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-03.8', 'Document Data Flows', 'Document data flows including data on third-party connections. IG2.', 1, 308, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-03.9', 'Encrypt Data on Removable Media', 'Encrypt data on removable media. IG2.', 1, 309, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-03.10', 'Encrypt Sensitive Data in Transit', 'Encrypt sensitive data in transit. IG2.', 1, 310, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-03.13', 'Deploy a Data Loss Prevention Solution', 'Deploy a DLP solution on enterprise assets. IG3.', 1, 313, 'active', jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO NOTHING;

  -- ── CIS-04 Secure Configuration (12 Safeguards) ──
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata) VALUES
    (cis_id, 'CIS-04.2', 'Establish and Maintain a Secure Configuration Process for Network Infrastructure', 'Establish and maintain a secure configuration process for network devices. IG1.', 1, 402, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-04.3', 'Configure Automatic Session Locking on Enterprise Assets', 'Configure automatic session locking on enterprise assets after a defined period of inactivity. IG1.', 1, 403, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-04.4', 'Implement and Manage a Firewall on Servers', 'Implement and manage a firewall on servers, where supported. IG1.', 1, 404, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-04.5', 'Implement and Manage a Firewall on End-User Devices', 'Implement and manage a host-based firewall or port-filtering tool on end-user devices. IG1.', 1, 405, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-04.7', 'Manage Default Accounts on Enterprise Assets and Software', 'Manage default accounts on enterprise assets and software, such as root, administrator, and other pre-configured vendor accounts. IG1.', 1, 407, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-04.8', 'Uninstall or Disable Unnecessary Services on Enterprise Assets and Software', 'Uninstall or disable unnecessary services on enterprise assets and software. IG2.', 1, 408, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-04.9', 'Configure Trusted DNS Servers on Enterprise Assets', 'Configure trusted DNS servers on enterprise assets. IG2.', 1, 409, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-04.10', 'Enforce Automatic Device Lockout on Portable End-User Devices', 'Enforce automatic device lockout after a pre-defined number of failed authentication attempts. IG2.', 1, 410, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-04.11', 'Enforce Remote Wipe Capability on Portable End-User Devices', 'Remotely wipe enterprise data from enterprise-owned portable end-user devices when deemed appropriate. IG2.', 1, 411, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-04.12', 'Separate Enterprise Workspaces on Mobile End-User Devices', 'Ensure separate enterprise workspaces are used on mobile end-user devices. IG3.', 1, 412, 'active', jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO NOTHING;

  -- ── CIS-05 Account Management (6 Safeguards) ──
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata) VALUES
    (cis_id, 'CIS-05.1', 'Establish and Maintain an Inventory of Accounts', 'Establish and maintain an inventory of all accounts managed in the enterprise. IG1.', 1, 501, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-05.2', 'Use Unique Passwords', 'Use unique passwords for all enterprise assets. IG1.', 1, 502, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-05.5', 'Establish and Maintain an Inventory of Service Accounts', 'Establish and maintain an inventory of service accounts. IG2.', 1, 505, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-05.6', 'Centralize Account Management', 'Centralize account management through a directory or identity service. IG2.', 1, 506, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO NOTHING;

  -- ── CIS-06 Access Control Management (8 Safeguards) ──
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata) VALUES
    (cis_id, 'CIS-06.1', 'Establish an Access Granting Process', 'Establish and follow a process for granting access. IG1.', 1, 601, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-06.2', 'Establish an Access Revoking Process', 'Establish and follow a process for revoking access. IG1.', 1, 602, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-06.6', 'Establish and Maintain an Inventory of Authentication and Authorization Systems', 'Establish and maintain an inventory of authentication and authorization systems. IG2.', 1, 606, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-06.7', 'Centralize Access Control', 'Centralize access control for all enterprise assets through a directory or SSO provider. IG2.', 1, 607, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO NOTHING;

  -- ── CIS-07 Continuous Vulnerability Management (7 Safeguards) ──
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata) VALUES
    (cis_id, 'CIS-07.2', 'Establish and Maintain a Remediation Process', 'Establish and maintain a risk-based remediation strategy documented in a remediation process. IG1.', 1, 702, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-07.4', 'Perform Automated Application Patch Management', 'Perform application updates on enterprise assets through automated patch management. IG1.', 1, 704, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-07.6', 'Perform Automated Vulnerability Scans of Externally-Exposed Enterprise Assets', 'Perform automated vulnerability scans of externally-exposed enterprise assets. IG2.', 1, 706, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-07.7', 'Remediate Detected Vulnerabilities', 'Remediate detected vulnerabilities in software through processes and tooling. IG2.', 1, 707, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO NOTHING;

  -- ── CIS-08 Audit Log Management (12 Safeguards) ──
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata) VALUES
    (cis_id, 'CIS-08.1', 'Establish and Maintain an Audit Log Management Process', 'Establish and maintain an audit log management process. IG1.', 1, 801, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-08.3', 'Ensure Adequate Audit Log Storage', 'Ensure adequate audit log storage capacity to avoid log loss. IG1.', 1, 803, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-08.4', 'Standardize Time Synchronization', 'Standardize time synchronization across enterprise assets. IG2.', 1, 804, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-08.5', 'Collect Detailed Audit Logs', 'Configure detailed audit logging for enterprise assets containing sensitive data. IG2.', 1, 805, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-08.6', 'Collect DNS Query Audit Logs', 'Collect DNS query audit logs on enterprise assets. IG2.', 1, 806, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-08.7', 'Collect URL Request Audit Logs', 'Collect URL request audit logs on enterprise assets. IG2.', 1, 807, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-08.8', 'Collect Command-Line Audit Logs', 'Collect command-line audit logs. IG2.', 1, 808, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-08.9', 'Centralize Audit Logs', 'Centralize, to the extent possible, audit log collection and retention. IG2.', 1, 809, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-08.11', 'Conduct Audit Log Reviews', 'Conduct reviews of audit logs to detect anomalies or abnormal events. IG2.', 1, 811, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-08.12', 'Collect Service Provider Logs', 'Collect service provider logs, where supported. IG3.', 1, 812, 'active', jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO NOTHING;

  -- ── CIS-09 Email and Web Browser Protections (7 Safeguards) ──
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata) VALUES
    (cis_id, 'CIS-09.1', 'Ensure Use of Only Fully Supported Browsers and Email Clients', 'Ensure only fully supported browsers and email clients are allowed to execute. IG1.', 1, 901, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-09.2', 'Use DNS Filtering Services', 'Use DNS filtering services on all enterprise assets. IG1.', 1, 902, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-09.3', 'Maintain and Enforce Network-Based URL Filters', 'Enforce network-based URL filters. IG2.', 1, 903, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-09.4', 'Restrict Unnecessary or Unauthorized Browser and Email Client Extensions', 'Restrict unauthorized browser and email client extensions. IG2.', 1, 904, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-09.5', 'Implement DMARC', 'Implement DMARC to lower the chance of spoofed email. IG2.', 1, 905, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-09.6', 'Block Unnecessary File Types', 'Block unnecessary file types attempting to enter the enterprise''s email gateway. IG2.', 1, 906, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-09.7', 'Deploy and Maintain Email Server Anti-Malware Protections', 'Deploy and maintain email server anti-malware protections, such as attachment scanning and/or sandboxing. IG3.', 1, 907, 'active', jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO NOTHING;

  -- ── CIS-10 Malware Defenses (7 Safeguards) ──
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata) VALUES
    (cis_id, 'CIS-10.2', 'Configure Automatic Anti-Malware Signature Updates', 'Configure automatic updates for anti-malware signature files. IG1.', 1, 1002, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-10.3', 'Disable Autorun and Autoplay for Removable Media', 'Disable autorun and autoplay auto-execute functionality for removable media. IG1.', 1, 1003, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-10.4', 'Configure Automatic Anti-Malware Scanning of Removable Media', 'Configure automatic anti-malware scanning of removable media. IG2.', 1, 1004, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-10.5', 'Enable Anti-Exploitation Features', 'Enable anti-exploitation features on enterprise assets and software. IG2.', 1, 1005, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-10.6', 'Centrally Manage Anti-Malware Software', 'Centrally manage anti-malware software. IG2.', 1, 1006, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-10.7', 'Use Behavior-Based Anti-Malware Software', 'Use behavior-based anti-malware software. IG2.', 1, 1007, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO NOTHING;

  -- ── CIS-11 Data Recovery (5 Safeguards) ──
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata) VALUES
    (cis_id, 'CIS-11.2', 'Perform Automated Backups', 'Perform automated backups of in-scope enterprise assets. IG1.', 1, 1102, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-11.4', 'Establish and Maintain an Isolated Instance of Recovery Data', 'Establish and maintain an isolated instance of recovery data (e.g., offline, on-prem, cloud-isolated). IG2.', 1, 1104, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-11.5', 'Test Data Recovery', 'Test backup recovery quarterly, or more frequently. IG2.', 1, 1105, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO NOTHING;

  -- ── CIS-12 Network Infrastructure Management (8 Safeguards) ──
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata) VALUES
    (cis_id, 'CIS-12.1', 'Ensure Network Infrastructure is Up-to-Date', 'Ensure network infrastructure is kept up-to-date with security patches. IG1.', 1, 1201, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-12.3', 'Securely Manage Network Infrastructure', 'Securely manage network infrastructure: version-controlled config, access via secure protocols. IG2.', 1, 1203, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-12.4', 'Establish and Maintain Architecture Diagram(s)', 'Establish and maintain network architecture diagrams. IG2.', 1, 1204, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-12.5', 'Centralize Network Authentication, Authorization, and Auditing (AAA)', 'Centralize network AAA. IG2.', 1, 1205, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-12.6', 'Use of Secure Network Management and Communication Protocols', 'Use secure network management and communication protocols (e.g., 802.1X, WPA2-Enterprise). IG2.', 1, 1206, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-12.7', 'Ensure Remote Devices Utilize a VPN and are Connecting to an Enterprise''s AAA Infrastructure', 'Remote devices must route traffic through enterprise AAA. IG2.', 1, 1207, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-12.8', 'Establish and Maintain Dedicated Computing Resources for All Administrative Work', 'Administrators use dedicated workstations for admin tasks. IG3.', 1, 1208, 'active', jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO NOTHING;

  -- ── CIS-13 Network Monitoring and Defense (11 Safeguards) ──
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata) VALUES
    (cis_id, 'CIS-13.1', 'Centralize Security Event Alerting', 'Centralize security event alerting across enterprise assets. IG2.', 1, 1301, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-13.2', 'Deploy a Host-Based Intrusion Detection Solution', 'Deploy a host-based intrusion detection solution (HIDS). IG2.', 1, 1302, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-13.3', 'Deploy a Network Intrusion Detection Solution', 'Deploy a NIDS. IG2.', 1, 1303, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-13.4', 'Perform Traffic Filtering Between Network Segments', 'Perform traffic filtering between network segments, where appropriate. IG2.', 1, 1304, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-13.5', 'Manage Access Control for Remote Assets', 'Manage access control for assets remotely connecting to enterprise resources. IG2.', 1, 1305, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-13.7', 'Deploy a Host-Based Intrusion Prevention Solution', 'Deploy a host-based intrusion prevention solution (HIPS). IG3.', 1, 1307, 'active', jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-13.8', 'Deploy a Network Intrusion Prevention Solution', 'Deploy a NIPS. IG3.', 1, 1308, 'active', jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-13.9', 'Deploy Port-Level Access Control', 'Deploy port-level access control using 802.1X or similar. IG3.', 1, 1309, 'active', jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-13.11', 'Tune Security Event Alerting Thresholds', 'Tune SIEM event thresholds regularly. IG3.', 1, 1311, 'active', jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO NOTHING;

  -- ── CIS-14 Security Awareness and Skills Training (9 Safeguards) ──
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata) VALUES
    (cis_id, 'CIS-14.2', 'Train Workforce Members to Recognize Social Engineering Attacks', 'Train workforce to recognize social engineering attacks (e.g., phishing, pretexting, tailgating). IG1.', 1, 1402, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-14.3', 'Train Workforce Members on Authentication Best Practices', 'Train workforce on authentication best practices (MFA, strong passwords). IG1.', 1, 1403, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-14.5', 'Train Workforce Members on Causes of Unintentional Data Exposure', 'Train workforce on causes of unintentional data exposure. IG1.', 1, 1405, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-14.6', 'Train Workforce Members on Recognizing and Reporting Security Incidents', 'Train workforce to recognize and report potential security incidents. IG1.', 1, 1406, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-14.7', 'Train Workforce on How to Identify and Report if Their Enterprise Assets are Missing Security Updates', 'Train workforce on identifying and reporting missing security updates. IG1.', 1, 1407, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-14.8', 'Train Workforce on the Dangers of Connecting to and Transmitting Enterprise Data Over Insecure Networks', 'Train workforce on risks of connecting to insecure networks (public Wi-Fi). IG1.', 1, 1408, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-14.9', 'Conduct Role-Specific Security Awareness and Skills Training', 'Conduct role-specific security awareness training (devs, admins, execs). IG2.', 1, 1409, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO NOTHING;

  -- ── CIS-15 Service Provider Management (7 Safeguards) ──
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata) VALUES
    (cis_id, 'CIS-15.2', 'Establish and Maintain a Service Provider Management Policy', 'Establish and maintain a SPM policy. IG1.', 1, 1502, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-15.3', 'Classify Service Providers', 'Classify service providers by data sensitivity, volume, and availability requirements. IG2.', 1, 1503, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-15.4', 'Ensure Service Provider Contracts Include Security Requirements', 'Ensure service provider contracts include security requirements. IG2.', 1, 1504, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-15.5', 'Assess Service Providers', 'Assess service providers on a schedule consistent with the provider''s classification. IG3.', 1, 1505, 'active', jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-15.6', 'Monitor Service Providers', 'Monitor service providers for compliance with the enterprise''s SPM policy. IG3.', 1, 1506, 'active', jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-15.7', 'Securely Decommission Service Providers', 'Securely decommission service providers on termination. IG3.', 1, 1507, 'active', jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO NOTHING;

  -- ── CIS-16 Application Software Security (14 Safeguards) ──
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata) VALUES
    (cis_id, 'CIS-16.2', 'Establish and Maintain a Process to Accept and Address Software Vulnerabilities', 'Establish and maintain a process to accept and address software vulnerabilities. IG2.', 1, 1602, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-16.3', 'Perform Root Cause Analysis on Security Vulnerabilities', 'Perform root cause analysis on security vulnerabilities. IG2.', 1, 1603, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-16.4', 'Establish and Manage an Inventory of Third-Party Software Components', 'Establish and manage an SBOM for in-house developed software. IG2.', 1, 1604, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-16.5', 'Use Up-to-Date and Trusted Third-Party Software Components', 'Use up-to-date and trusted third-party software components. IG2.', 1, 1605, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-16.6', 'Establish and Maintain a Severity Rating System for Application Vulnerabilities', 'Establish and maintain a severity rating system and process for software vulnerabilities. IG2.', 1, 1606, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-16.7', 'Use Standard Hardening Configuration Templates for Application Infrastructure', 'Use standard hardening configuration templates for application infrastructure. IG2.', 1, 1607, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-16.8', 'Separate Production and Non-Production Systems', 'Separate production and non-production systems. IG2.', 1, 1608, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-16.9', 'Train Developers in Application Security Concepts and Secure Coding', 'Train developers in secure coding. IG2.', 1, 1609, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-16.10', 'Apply Secure Design Principles in Application Architectures', 'Apply secure design principles in application architectures. IG2.', 1, 1610, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-16.11', 'Leverage Vetted Modules or Services for Application Security Components', 'Leverage vetted modules/services for security components (auth, encryption, logging). IG2.', 1, 1611, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-16.12', 'Implement Code-Level Security Checks', 'Implement code-level security checks (SAST, SCA) in CI. IG3.', 1, 1612, 'active', jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-16.13', 'Conduct Application Penetration Testing', 'Conduct application penetration testing. IG3.', 1, 1613, 'active', jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-16.14', 'Conduct Threat Modeling', 'Conduct threat modeling for in-house developed applications. IG3.', 1, 1614, 'active', jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO NOTHING;

  -- ── CIS-17 Incident Response Management (9 Safeguards) ──
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata) VALUES
    (cis_id, 'CIS-17.2', 'Establish and Maintain Contact Information for Reporting Security Incidents', 'Maintain a contact list for reporting security incidents (internal + external). IG1.', 1, 1702, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-17.3', 'Establish and Maintain an Enterprise Process for Reporting Incidents', 'Establish and maintain a workflow for reporting security incidents. IG1.', 1, 1703, 'active', jsonb_build_object('ig1', true, 'ig2', true, 'ig3', true, 'ig_scope', 'ig1', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-17.5', 'Assign Key Roles and Responsibilities', 'Assign IR roles/responsibilities (incident commander, communications, etc.). IG2.', 1, 1705, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-17.6', 'Define Mechanisms for Communicating During Incident Response', 'Define out-of-band IR comms mechanisms. IG2.', 1, 1706, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-17.7', 'Conduct Routine Incident Response Exercises', 'Conduct routine IR exercises (tabletop, tech). IG2.', 1, 1707, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-17.8', 'Conduct Post-Incident Reviews', 'Conduct post-incident reviews (lessons learned). IG2.', 1, 1708, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-17.9', 'Establish and Maintain Security Incident Thresholds', 'Establish and maintain security incident thresholds. IG3.', 1, 1709, 'active', jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO NOTHING;

  -- ── CIS-18 Penetration Testing (5 Safeguards) ──
  INSERT INTO catalog_entry (catalog_id, code, name, description, level, sort_order, status, metadata) VALUES
    (cis_id, 'CIS-18.2', 'Perform Periodic External Penetration Tests', 'Perform periodic external penetration tests. IG2.', 1, 1802, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-18.3', 'Remediate Penetration Test Findings', 'Remediate penetration test findings based on risk and priority. IG2.', 1, 1803, 'active', jsonb_build_object('ig1', false, 'ig2', true, 'ig3', true, 'ig_scope', 'ig2', 'framework', 'cis_controls_v8')),
    (cis_id, 'CIS-18.4', 'Validate Security Measures', 'Validate security measures after pentest corrections. IG3.', 1, 1804, 'active', jsonb_build_object('ig1', false, 'ig2', false, 'ig3', true, 'ig_scope', 'ig3', 'framework', 'cis_controls_v8'))
  ON CONFLICT (catalog_id, code) DO NOTHING;

  -- ── Parent-Linkage für neu eingefügte Safeguards ──
  UPDATE catalog_entry ce SET parent_entry_id = parent.id
  FROM catalog_entry parent
  WHERE ce.catalog_id = cis_id
    AND parent.catalog_id = cis_id
    AND ce.level = 1
    AND parent.level = 0
    AND ce.parent_entry_id IS NULL
    AND ce.code LIKE parent.code || '.%';

END $$;

-- Bilanz-Hinweis (nicht persistent, nur zur Verifikation):
--   SELECT metadata->>'ig_scope' AS scope, count(*)
--   FROM catalog_entry
--   WHERE catalog_id = 'c0000000-0000-0000-0000-c150c74201a8' AND level = 1
--   GROUP BY 1 ORDER BY 1;
-- Erwartet: ig1: ~50 · ig2: ~70 · ig3: ~20 · unspecified: 0
